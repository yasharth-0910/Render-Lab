import { describe, it, expect } from 'vitest'
import {
  eulerToMatrix, gimbalLock, nudgeAxis, quatToAxisAngle, quatToEuler, lerpNormalized,
  angleBetween, angularSpeedSamples, composeRotations,
} from './quatLab'
import { fromAxisAngle, fromEuler, multiply, conjugate, normalize, rotateVec3, toMat4, slerp, type Quat } from './quat'
import * as m4 from './mat4'
import { dot, length, normalize as normVec, type Vec3 } from './vec3'
import { expectClose } from './helpers.test-util'

const deg = (d: number) => (d * Math.PI) / 180
const DEG90 = Math.PI / 2

describe('quaternion vs matrix', () => {
  const cases: [Vec3, number][] = [[[1, 0, 0], 0.7], [[0, 1, 0], -1.2], [[1, 2, 3], 2.5], [[-1, 0.5, 0.2], 3.0]]
  it('quaternion rotation equals the matching mat4 rotation', () => {
    for (const [axis, angle] of cases) {
      const q = fromAxisAngle(axis, angle)
      const v: Vec3 = [0.3, -1.1, 2]
      expectClose(rotateVec3(q, v), m4.transformPoint(m4.rotateAxis(axis, angle), v))
      expectClose(toMat4(q), m4.rotateAxis(axis, angle))
    }
  })
  it('stays unit length after thousands of multiplications (no renormalizing)', () => {
    const step = fromAxisAngle([1, 2, 3], 0.001)
    let q: Quat = [0, 0, 0, 1]
    for (let i = 0; i < 5000; i++) q = multiply(q, step)
    expect(Math.abs(Math.hypot(...q) - 1)).toBeLessThan(1e-9)
  })
  it('q and -q are the same rotation', () => {
    const q = fromAxisAngle([1, -2, 0.5], 1.9)
    const minus: Quat = [-q[0], -q[1], -q[2], -q[3]]
    const v: Vec3 = [1, 2, 3]
    expectClose(rotateVec3(q, v), rotateVec3(minus, v))
    expectClose(toMat4(q), toMat4(minus))
  })
})

describe('quatToAxisAngle', () => {
  it('round trip: axis and angle come back', () => {
    for (const [axis, angle] of [[[0, 0, 1], 0.5], [[1, 2, 3], 1.4], [[-1, 0, 2], 3.0]] as [Vec3, number][]) {
      const r = quatToAxisAngle(fromAxisAngle(axis, angle))
      expectClose(r.axis, normVec(axis))
      expect(r.angle).toBeCloseTo(angle)
    }
  })
  it('identity gives angle 0', () => {
    expect(quatToAxisAngle([0, 0, 0, 1]).angle).toBe(0)
  })
  it('an angle over 180 degrees comes back as the same rotation the short way (angle <= 180)', () => {
    const q = fromAxisAngle([0, 0, 1], 4) // 229 degrees = 131 degrees the other way round
    const r = quatToAxisAngle(q)
    expect(r.angle).toBeLessThanOrEqual(Math.PI)
    expectClose(rotateVec3(fromAxisAngle(r.axis, r.angle), [1, 0, 0]), rotateVec3(q, [1, 0, 0]))
  })
  it('q and -q give the same axis and angle', () => {
    const q = fromAxisAngle([1, 2, 3], 1.1)
    const a = quatToAxisAngle(q)
    const b = quatToAxisAngle([-q[0], -q[1], -q[2], -q[3]])
    expectClose(a.axis, b.axis)
    expect(a.angle).toBeCloseTo(b.angle)
  })
})

describe('Euler angles', () => {
  it('eulerToMatrix equals the quaternion matrix: roll x first, pitch y, yaw z last', () => {
    expectClose(eulerToMatrix(0.3, -0.8, 1.1), toMat4(fromEuler(0.3, -0.8, 1.1)))
    expectClose(eulerToMatrix(0.3, -0.8, 1.1), m4.multiply(m4.rotateZ(1.1), m4.multiply(m4.rotateY(-0.8), m4.rotateX(0.3))))
  })
  it('Euler -> quaternion -> Euler round trip away from gimbal lock', () => {
    for (const x of [-150, -60, 0, 45, 120]) for (const y of [-80, -30, 0, 40, 80]) for (const z of [-170, -20, 0, 90, 135]) {
      expectClose(quatToEuler(fromEuler(deg(x), deg(y), deg(z))), [deg(x), deg(y), deg(z)], 6)
    }
  })
  it('Euler angles are NOT unique: (x, y, z) and (x+180, 180-y, z+180) are the same rotation', () => {
    const [x, y, z] = [0.4, 0.3, -0.9]
    expectClose(eulerToMatrix(x, y, z), eulerToMatrix(x + Math.PI, Math.PI - y, z + Math.PI))
  })
  it('quatToEuler still gives a matching rotation at gimbal lock', () => {
    for (const pitch of [90, -90]) {
      const q = fromEuler(deg(20), deg(pitch), deg(50))
      const [x, y, z] = quatToEuler(q)
      expectClose(eulerToMatrix(x, y, z), toMat4(q), 6)
    }
  })
})

describe('gimbal lock', () => {
  it('is detected when the middle angle (pitch) is +90 or -90 degrees', () => {
    expect(gimbalLock(0, DEG90, 0)).toMatchObject({ locked: true, degreesOfFreedomLost: 1 })
    expect(gimbalLock(1, -DEG90, 2)).toMatchObject({ locked: true, degreesOfFreedomLost: 1 })
    expect(gimbalLock(0, deg(270), 0).locked).toBe(true) // 270 degrees is the same as -90
  })
  it('is not detected elsewhere, not even close to 90', () => {
    expect(gimbalLock(0, 0, 0)).toMatchObject({ locked: false, degreesOfFreedomLost: 0 })
    expect(gimbalLock(0, deg(89), 0).locked).toBe(false)
  })
  it('at pitch 90 the picture depends only on (yaw - roll): one degree of freedom is lost', () => {
    // arguments are (roll, pitch, yaw)
    expectClose(eulerToMatrix(0.2, DEG90, 0.9), eulerToMatrix(0.7, DEG90, 1.4), 9)
    expectClose(eulerToMatrix(0.2, DEG90, 0.9), eulerToMatrix(-1, DEG90, -0.3), 9)
    // ...but not away from the lock
    const a = eulerToMatrix(0.2, 0.5, 0.9)
    const b = eulerToMatrix(0.7, 0.5, 1.4)
    expect(a.some((v, i) => Math.abs(v - b[i]) > 1e-3)).toBe(true)
  })
  it('at pitch 90 changing yaw and changing roll rotate about the SAME axis; at pitch 0 they differ', () => {
    const yawAxis = nudgeAxis(0.3, DEG90, 0.5, 'z')
    const rollAxis = nudgeAxis(0.3, DEG90, 0.5, 'x')
    expect(Math.abs(dot(yawAxis, rollAxis))).toBeCloseTo(1, 6)
    const yaw0 = nudgeAxis(0.3, 0, 0.5, 'z')
    const roll0 = nudgeAxis(0.3, 0, 0.5, 'x')
    expect(Math.abs(dot(yaw0, roll0))).toBeLessThan(0.99)
    expect(Math.abs(dot(yaw0, roll0))).toBeCloseTo(0, 6) // yaw about z, roll about x: perpendicular
  })
  it('nudgeAxis is a unit vector', () => {
    expect(length(nudgeAxis(0.3, 0.2, 0.5, 'y'))).toBeCloseTo(1)
  })
})

describe('slerp vs normalized lerp', () => {
  const a: Quat = [0, 0, 0, 1]
  const b = fromAxisAngle([1, 1, 1], deg(160))
  it('lerpNormalized returns the end points at t = 0 and t = 1 and is always unit length', () => {
    expectClose(lerpNormalized(a, b, 0), a)
    expectClose(lerpNormalized(a, b, 1), b)
    for (const t of [0.1, 0.5, 0.9]) expect(length(lerpNormalized(a, b, t).slice(0, 3) as unknown as Vec3) ** 2 + lerpNormalized(a, b, t)[3] ** 2).toBeCloseTo(1)
  })
  it('lerpNormalized also takes the short way round', () => {
    const c = fromAxisAngle([0, 0, 1], deg(350))
    expectClose(rotateVec3(lerpNormalized(a, c, 0.5), [1, 0, 0]), [Math.cos(deg(5)), -Math.sin(deg(5)), 0], 6)
  })
  it('angleBetween: identity vs 90 degrees is 90; q vs -q is 0', () => {
    expect(angleBetween(a, fromAxisAngle([0, 0, 1], DEG90))).toBeCloseTo(DEG90)
    expect(angleBetween(b, [-b[0], -b[1], -b[2], -b[3]])).toBeCloseTo(0)
    expect(angleBetween(a, b)).toBeCloseTo(deg(160))
  })
  it('slerp has a constant angular step', () => {
    const steps = angularSpeedSamples(a, b, 20, 'slerp')
    expect(steps.length).toBe(20)
    for (const s of steps) expect(s).toBeCloseTo(angleBetween(a, b) / 20, 9)
  })
  it('normalized lerp does NOT: slow at the ends, fast in the middle', () => {
    const steps = angularSpeedSamples(a, b, 20, 'lerp')
    expect(Math.max(...steps) - Math.min(...steps)).toBeGreaterThan(0.01)
    expect(steps[10]).toBeGreaterThan(steps[0]) // faster in the middle than at the start
    expect(steps[10]).toBeGreaterThan(steps[19])
    // but it still gets there: the steps add up to the total angle
    expect(steps.reduce((s, v) => s + v, 0)).toBeCloseTo(angleBetween(a, b), 9)
  })
  it('for a small angle the two are almost the same', () => {
    const small = fromAxisAngle([0, 1, 0], deg(5))
    const s = angularSpeedSamples(a, small, 10, 'lerp')
    expect(Math.max(...s) - Math.min(...s)).toBeLessThan(1e-4)
  })
  it('slerp takes the short way round: 350 degrees is really -10 degrees', () => {
    const c = fromAxisAngle([0, 0, 1], deg(350))
    expectClose(rotateVec3(slerp(a, c, 0.5), [1, 0, 0]), [Math.cos(deg(5)), -Math.sin(deg(5)), 0], 6)
    expect(angleBetween(a, c)).toBeCloseTo(deg(10))
  })
})

describe('composeRotations', () => {
  it('composing two rotations by quaternion equals composing by matrix', () => {
    const first = fromAxisAngle([1, 0, 0], 0.9)
    const second = fromAxisAngle([0, 1, 1], -1.3)
    const v: Vec3 = [0.5, -2, 1]
    const r = composeRotations(first, second, v)
    expectClose(r.viaQuaternion, r.viaMatrix, 9)
    expectClose(toMat4(r.quaternion), r.matrix, 9)
  })
  it('the first rotation happens first: x turned about z by 90 then about x by 90 ends on z', () => {
    const r = composeRotations(fromAxisAngle([0, 0, 1], DEG90), fromAxisAngle([1, 0, 0], DEG90), [1, 0, 0])
    expectClose(r.viaQuaternion, [0, 0, 1], 9)
  })
  it('order matters', () => {
    const p = fromAxisAngle([0, 0, 1], DEG90)
    const q = fromAxisAngle([1, 0, 0], DEG90)
    const ab = composeRotations(p, q, [1, 0, 0]).viaQuaternion
    const ba = composeRotations(q, p, [1, 0, 0]).viaQuaternion
    expect(Math.abs(ab[2] - ba[2]) + Math.abs(ab[1] - ba[1])).toBeGreaterThan(0.5)
  })
  it('uses conjugate/multiply consistently with rotateVec3', () => {
    const q = normalize([0.2, 0.4, 0.1, 0.9])
    const v: Vec3 = [1, 2, 3]
    // v' = q v q*  written out with quaternion products
    const p: Quat = [v[0], v[1], v[2], 0]
    const r = multiply(multiply(q, p), conjugate(q))
    expectClose([r[0], r[1], r[2]], rotateVec3(q, v), 9)
  })
})
