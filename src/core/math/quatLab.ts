// quatLab.ts - helpers for the quaternion lab (on top of quat.ts).
//
// EULER CONVENTION used everywhere in this lab (the aerospace one, with z up):
//   x = roll  (about the nose axis), y = pitch (about the wing axis), z = yaw (about vertical).
//   The matrix is  R = Rz(yaw) * Ry(pitch) * Rx(roll):  roll happens first, yaw last.
//   This is exactly quat.ts fromEuler(x, y, z).
// Quaternions are [x, y, z, w]. Angles are in radians.

import * as m4 from './mat4'
import { fromEuler, multiply, conjugate, normalize, rotateVec3, toMat4, slerp, type Quat } from './quat'
import type { Vec3 } from './vec3'

/** The rotation matrix for three Euler angles: Rz(z) * Ry(y) * Rx(x). */
export function eulerToMatrix(x: number, y: number, z: number): m4.Mat4 {
  return m4.multiply(m4.rotateZ(z), m4.multiply(m4.rotateY(y), m4.rotateX(x)))
}

/**
 * Gimbal lock: when the MIDDLE angle (pitch, y) is +90 or -90 degrees, cos(pitch) = 0.
 * Then the roll axis and the yaw axis point along the same line, so changing roll and
 * changing yaw do the same kind of turn. The picture only depends on yaw - roll (pitch +90)
 * or yaw + roll (pitch -90), so one of the three degrees of freedom is lost.
 * `tolerance` is how close to 0 cos(pitch) must be.
 */
export function gimbalLock(x: number, y: number, z: number, tolerance = 1e-6): {
  locked: boolean
  degreesOfFreedomLost: number
  middleAngleDeg: number
  explanation: string
} {
  const locked = Math.abs(Math.cos(y)) < tolerance
  const deg = (r: number) => ((r * 180) / Math.PI).toFixed(1)
  let explanation = 'No gimbal lock: roll, pitch and yaw each give a different kind of turn (3 degrees of freedom).'
  if (locked) {
    const sign = Math.sin(y) > 0 ? -1 : 1 // +90 pitch: yaw - roll matters; -90 pitch: yaw + roll matters
    const combined = z + sign * x
    explanation = `Gimbal lock: roll and yaw turn about the same line. Only yaw ${sign < 0 ? '−' : '+'} roll = ${deg(combined)}° matters (2 degrees of freedom left).`
  }
  return { locked, degreesOfFreedomLost: locked ? 1 : 0, middleAngleDeg: (y * 180) / Math.PI, explanation }
}

/**
 * The (world-space) axis a tiny change of one Euler angle turns the object about.
 * which = 'x' (roll), 'y' (pitch) or 'z' (yaw). We nudge that angle a little and read the
 * axis of the extra rotation:  delta = q_nudged * conjugate(q_original).
 * At gimbal lock the roll and yaw axes come out as the same line.
 */
export function nudgeAxis(x: number, y: number, z: number, which: 'x' | 'y' | 'z'): Vec3 {
  const eps = 0.01
  const before = fromEuler(x, y, z)
  const after = fromEuler(which === 'x' ? x + eps : x, which === 'y' ? y + eps : y, which === 'z' ? z + eps : z)
  return quatToAxisAngle(multiply(after, conjugate(before))).axis
}

/**
 * The axis and angle of a rotation quaternion. q = (sin(a/2)*axis, cos(a/2)), so
 * sin(a/2) = length of the vector part and cos(a/2) = w.
 * q and -q are the same rotation; we pick the one with w >= 0, which gives an angle between 0 and 180 degrees.
 * For no rotation at all the axis does not matter, so we return the x axis and angle 0.
 */
export function quatToAxisAngle(q: Quat): { axis: Vec3; angle: number } {
  const n = normalize(q)
  const flip = n[3] < 0 ? -1 : 1
  const [x, y, z, w] = [n[0] * flip, n[1] * flip, n[2] * flip, n[3] * flip]
  const s = Math.sqrt(x * x + y * y + z * z)
  if (s < 1e-12) return { axis: [1, 0, 0], angle: 0 }
  return { axis: [x / s, y / s, z / s], angle: 2 * Math.atan2(s, w) }
}

/**
 * Euler angles [x, y, z] (roll, pitch, yaw) of a rotation quaternion, read from its matrix:
 *   R20 = -sin(y)     R21 = cos(y) sin(x)     R22 = cos(y) cos(x)
 *   R10 =  cos(y) sin(z)                      R00 = cos(y) cos(z)
 * so y = asin(-R20), x = atan2(R21, R22), z = atan2(R10, R00).
 *
 * WHY THE RESULT IS NOT UNIQUE: many Euler triples make the same rotation.
 *  - Angles repeat every 360 degrees.
 *  - (x, y, z) and (x + 180, 180 - y, z + 180) give the identical matrix.
 *  - At gimbal lock (y = +-90) infinitely many (x, z) pairs fit.
 * We return the one with pitch between -90 and +90, roll and yaw between -180 and 180.
 * At gimbal lock we choose roll = 0 and put everything into yaw.
 */
export function quatToEuler(q: Quat): [number, number, number] {
  const r = toMat4(normalize(q))
  const r20 = Math.max(-1, Math.min(1, r[8]))
  const y = Math.asin(-r20)
  if (Math.abs(r20) > 1 - 1e-12) {
    // gimbal lock: cos(y) = 0, so R21, R22, R10, R00 are all 0. Use R01 and R11 instead.
    return [0, y, Math.atan2(-r[1], r[5])]
  }
  return [Math.atan2(r[9], r[10]), y, Math.atan2(r[4], r[0])]
}

/** The angle (radians, 0..180 degrees) of the turn that takes orientation a to b. */
export function angleBetween(a: Quat, b: Quat): number {
  const r = multiply(b, conjugate(a)) // the rotation from a to b
  return 2 * Math.atan2(Math.hypot(r[0], r[1], r[2]), Math.abs(r[3]))
}

/**
 * Normalized lerp: blend the four numbers in a straight line, then rescale to length 1.
 * Cheaper than slerp, same path, but NOT constant speed. Takes the short way round
 * (if a and b are on opposite sides, flip b: q and -q are the same rotation).
 */
export function lerpNormalized(a: Quat, b: Quat, t: number): Quat {
  const sign = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3] < 0 ? -1 : 1
  return normalize([
    a[0] + t * (sign * b[0] - a[0]),
    a[1] + t * (sign * b[1] - a[1]),
    a[2] + t * (sign * b[2] - a[2]),
    a[3] + t * (sign * b[3] - a[3]),
  ])
}

/**
 * Split t = 0..1 into n equal steps, blend with the chosen method, and return the angle
 * (radians) turned in each step. Slerp: every step is the same. Lerp: small at the ends, big in the middle.
 */
export function angularSpeedSamples(a: Quat, b: Quat, n: number, method: 'slerp' | 'lerp'): number[] {
  const blend = method === 'slerp' ? slerp : lerpNormalized
  const steps: number[] = []
  let previous = blend(a, b, 0)
  for (let i = 1; i <= n; i++) {
    const next = blend(a, b, i / n)
    steps.push(angleBetween(previous, next))
    previous = next
  }
  return steps
}

/**
 * Turn v by `first`, then by `second`, two ways: with quaternions (q = second * first)
 * and with matrices (M = M2 * M1). Both must agree. Returns both results and both composed rotations.
 */
export function composeRotations(first: Quat, second: Quat, v: Vec3): {
  viaQuaternion: Vec3
  viaMatrix: Vec3
  quaternion: Quat
  matrix: m4.Mat4
} {
  const quaternion = multiply(second, first)
  const matrix = m4.multiply(toMat4(second), toMat4(first))
  return { viaQuaternion: rotateVec3(quaternion, v), viaMatrix: m4.transformPoint(matrix, v), quaternion, matrix }
}
