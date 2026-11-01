import { describe, it, expect } from 'vitest'
import {
  fromAxisAngle, fromEuler, multiply, conjugate, normalize,
  rotateVec3, toMat4, slerp,
} from './quat'
import * as m4 from './mat4'
import { expectClose } from './helpers.test-util'

// quaternion layout is [x, y, z, w]
const DEG90 = Math.PI / 2

describe('quat', () => {
  it('fromAxisAngle: 90 degrees about z', () => {
    const s = Math.sin(Math.PI / 4)
    expectClose(fromAxisAngle([0, 0, 1], DEG90), [0, 0, s, Math.cos(Math.PI / 4)])
  })
  it('fromAxisAngle accepts a non-unit axis', () => {
    expectClose(fromAxisAngle([0, 0, 5], DEG90), fromAxisAngle([0, 0, 1], DEG90))
  })
  it('90 degrees about z maps x to y', () => {
    expectClose(rotateVec3(fromAxisAngle([0, 0, 1], DEG90), [1, 0, 0]), [0, 1, 0])
  })
  it('conjugate undoes a rotation', () => {
    const q = fromAxisAngle([1, 2, 3], 0.9)
    expectClose(rotateVec3(conjugate(q), rotateVec3(q, [1, 0, 0])), [1, 0, 0])
  })
  it('multiply: two 90 degree turns about z make a 180 degree turn', () => {
    const q = fromAxisAngle([0, 0, 1], DEG90)
    expectClose(rotateVec3(multiply(q, q), [1, 0, 0]), [-1, 0, 0])
  })
  it('multiply applies the right quaternion first', () => {
    const rx = fromAxisAngle([1, 0, 0], DEG90)
    const rz = fromAxisAngle([0, 0, 1], DEG90)
    // rx first: y -> z. then rz leaves z alone.
    expectClose(rotateVec3(multiply(rz, rx), [0, 1, 0]), [0, 0, 1])
    // rz first: y -> -x. then rx leaves x alone.
    expectClose(rotateVec3(multiply(rx, rz), [0, 1, 0]), [-1, 0, 0])
  })
  it('normalize gives length 1', () => {
    const q = normalize([1, 2, 3, 4])
    expect(Math.hypot(...q)).toBeCloseTo(1)
  })
  it('rotateVec3 matches the equivalent mat4 rotation', () => {
    const axis = [1, -2, 0.5] as const
    const angle = 1.234
    const q = fromAxisAngle(axis, angle)
    const v = [0.3, -1.1, 2] as const
    expectClose(rotateVec3(q, v), m4.transformPoint(m4.rotateAxis(axis, angle), v))
  })
  it('toMat4 equals rotateAxis for the same rotation', () => {
    expectClose(toMat4(fromAxisAngle([1, -2, 0.5], 1.234)), m4.rotateAxis([1, -2, 0.5], 1.234))
  })
  it('fromEuler equals rotateZ * rotateY * rotateX (x applied first)', () => {
    const [x, y, z] = [0.3, -0.8, 1.1]
    const expected = m4.multiply(m4.rotateZ(z), m4.multiply(m4.rotateY(y), m4.rotateX(x)))
    expectClose(toMat4(fromEuler(x, y, z)), expected)
  })
  it('slerp at t=0 and t=1 returns the endpoints', () => {
    const a = fromAxisAngle([0, 1, 0], 0.2)
    const b = fromAxisAngle([1, 0, 0], 1.5)
    expectClose(slerp(a, b, 0), a)
    expectClose(slerp(a, b, 1), b)
  })
  it('slerp at t=0.5 between 0 and 90 degrees about z is 45 degrees', () => {
    const a = fromAxisAngle([0, 0, 1], 0)
    const b = fromAxisAngle([0, 0, 1], DEG90)
    expectClose(slerp(a, b, 0.5), fromAxisAngle([0, 0, 1], Math.PI / 4))
  })
  it('slerp always returns a unit quaternion', () => {
    const a = fromAxisAngle([0, 1, 0], 0.2)
    const b = fromAxisAngle([1, 1, 0], 2.5)
    for (const t of [0.1, 0.3, 0.77]) expect(Math.hypot(...slerp(a, b, t))).toBeCloseTo(1)
  })
  it('slerp takes the short way when q and -q are given (same rotation)', () => {
    const a = fromAxisAngle([0, 0, 1], 0.2)
    const b = fromAxisAngle([0, 0, 1], 0.4)
    const minusB: [number, number, number, number] = [-b[0], -b[1], -b[2], -b[3]]
    expectClose(slerp(a, minusB, 0.5), fromAxisAngle([0, 0, 1], 0.3))
  })
})
