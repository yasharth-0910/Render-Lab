// quat.ts - quaternions, a way to store a 3D rotation as 4 numbers.
//
// CONVENTIONS (read these first):
// - A Quat is [x, y, z, w]. The vector part (x, y, z) is axis * sin(angle/2) and
//   w is cos(angle/2). A rotation quaternion has length 1 ("unit quaternion").
// - multiply(a, b) applies b FIRST and then a (same order as matrix multiply).
// - toMat4 returns a ROW-MAJOR matrix for column vectors, matching mat4.ts, so
//   quaternion and matrix rotations give identical results.
// - Angles are in radians; positive angles follow the right-hand rule.

import { cross, normalize as normalizeVec, scale, add, type Vec3 } from './vec3'
import type { Mat4 } from './mat4'

export type Quat = readonly [number, number, number, number]

/** Rotation of `angle` radians around `axis` (the axis is normalized for you). */
export function fromAxisAngle(axis: Vec3, angle: number): Quat {
  const [x, y, z] = normalizeVec(axis)
  const half = angle / 2
  const s = Math.sin(half)
  return [x * s, y * s, z * s, Math.cos(half)]
}

/**
 * Build a rotation from three Euler angles: rotate about x, THEN y, THEN z
 * (all around the fixed world axes). Same as the matrix rotateZ * rotateY * rotateX.
 */
export function fromEuler(x: number, y: number, z: number): Quat {
  const qx = fromAxisAngle([1, 0, 0], x)
  const qy = fromAxisAngle([0, 1, 0], y)
  const qz = fromAxisAngle([0, 0, 1], z)
  return multiply(qz, multiply(qy, qx))
}

/** Hamilton product a * b. As a rotation: do b first, then a. Not commutative. */
export function multiply(a: Quat, b: Quat): Quat {
  const [ax, ay, az, aw] = a
  const [bx, by, bz, bw] = b
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ]
}

/** Flip the vector part. For a unit quaternion this is the inverse rotation. */
export function conjugate(q: Quat): Quat {
  return [-q[0], -q[1], -q[2], q[3]]
}

/** Scale to length 1 (needed for the quaternion to be a pure rotation). */
export function normalize(q: Quat): Quat {
  const len = Math.hypot(q[0], q[1], q[2], q[3])
  return [q[0] / len, q[1] / len, q[2] / len, q[3] / len]
}

/**
 * Rotate vector v by unit quaternion q. This is the sandwich q * v * q^-1,
 * written out in the cheaper form: v' = v + 2w(u x v) + 2 u x (u x v), where
 * u is the vector part of q.
 */
export function rotateVec3(q: Quat, v: Vec3): Vec3 {
  const u: Vec3 = [q[0], q[1], q[2]]
  const uv = cross(u, v)
  const uuv = cross(u, uv)
  return add(v, add(scale(uv, 2 * q[3]), scale(uuv, 2)))
}

/** The 4x4 rotation matrix (row-major) equal to this unit quaternion. */
export function toMat4(q: Quat): Mat4 {
  const [x, y, z, w] = q
  return [
    1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w), 0,
    2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w), 0,
    2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y), 0,
    0, 0, 0, 1,
  ]
}

/**
 * Spherical linear interpolation: turn from a to b at constant speed.
 * t = 0 gives a, t = 1 gives b. Both inputs should be unit quaternions.
 */
export function slerp(a: Quat, b: Quat, t: number): Quat {
  let [bx, by, bz, bw] = b
  let cosTheta = a[0] * bx + a[1] * by + a[2] * bz + a[3] * bw
  // q and -q are the same rotation. If they point away from each other,
  // flip b so we take the SHORT way round.
  if (cosTheta < 0) {
    ;[bx, by, bz, bw] = [-bx, -by, -bz, -bw]
    cosTheta = -cosTheta
  }
  // If a and b are almost equal, sin(theta) is ~0 and dividing by it is unsafe.
  // A plain straight-line blend (then re-normalize) is accurate enough there.
  if (cosTheta > 0.9995) {
    return normalize([
      a[0] + t * (bx - a[0]),
      a[1] + t * (by - a[1]),
      a[2] + t * (bz - a[2]),
      a[3] + t * (bw - a[3]),
    ])
  }
  const theta = Math.acos(cosTheta)
  const sinTheta = Math.sin(theta)
  const wa = Math.sin((1 - t) * theta) / sinTheta
  const wb = Math.sin(t * theta) / sinTheta
  return [
    wa * a[0] + wb * bx,
    wa * a[1] + wb * by,
    wa * a[2] + wb * bz,
    wa * a[3] + wb * bw,
  ]
}
