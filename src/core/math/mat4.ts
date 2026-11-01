// mat4.ts - 4x4 matrices for 3D transforms in homogeneous coordinates.
//
// CONVENTIONS (read these first):
// - A Mat4 is a plain array of 16 numbers stored ROW-MAJOR: element (row r, column c)
//   is at index r*4 + c. So the first four numbers are the first ROW.
// - Points are COLUMN vectors [x, y, z, 1], so we compute  p' = M * p.
// - multiply(a, b) = a * b, which applies b FIRST and then a.
// - Translation lives in the last column (indices 3, 7, 11).
// - Right-handed coordinates. The camera looks down the NEGATIVE z axis.
// - Angles are in radians; positive angles follow the right-hand rule.

import { cross, dot, normalize, sub, type Vec3 } from './vec3'

export type Mat4 = number[]

/** The matrix that changes nothing. */
export function identity(): Mat4 {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
}

/** a * b (row times column). Applying the result = apply b first, then a. */
export function multiply(a: Mat4, b: Mat4): Mat4 {
  const out: Mat4 = new Array(16).fill(0)
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      let sum = 0
      for (let k = 0; k < 4; k++) sum += a[row * 4 + k] * b[k * 4 + col]
      out[row * 4 + col] = sum
    }
  }
  return out
}

/** Swap rows and columns. */
export function transpose(m: Mat4): Mat4 {
  const out: Mat4 = new Array(16)
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) out[col * 4 + row] = m[row * 4 + col]
  }
  return out
}

// Determinant of the 3x3 matrix made from `m` by deleting one row and one column.
function minor3(m: Mat4, skipRow: number, skipCol: number): number {
  const v: number[] = []
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if (r !== skipRow && c !== skipCol) v.push(m[r * 4 + c])
    }
  }
  return (
    v[0] * (v[4] * v[8] - v[5] * v[7]) -
    v[1] * (v[3] * v[8] - v[5] * v[6]) +
    v[2] * (v[3] * v[7] - v[4] * v[6])
  )
}

/** Determinant by cofactor expansion along the first row (signs + - + -). */
export function determinant(m: Mat4): number {
  let det = 0
  for (let col = 0; col < 4; col++) {
    const sign = col % 2 === 0 ? 1 : -1
    det += sign * m[col] * minor3(m, 0, col)
  }
  return det
}

/**
 * Inverse by Gauss-Jordan elimination: write [M | I] and row-reduce until the
 * left half becomes I; the right half is then the inverse.
 * Throws if the matrix is singular (determinant 0, no inverse exists).
 */
export function inverse(m: Mat4): Mat4 {
  // Build the 4 x 8 augmented matrix [M | I] as an array of rows.
  const a: number[][] = []
  for (let r = 0; r < 4; r++) {
    a.push([...m.slice(r * 4, r * 4 + 4), ...[0, 1, 2, 3].map((c) => (c === r ? 1 : 0))])
  }
  for (let col = 0; col < 4; col++) {
    // Pick the row (at or below `col`) with the biggest number in this column.
    // Using the biggest one keeps rounding errors small.
    let pivot = col
    for (let r = col + 1; r < 4; r++) {
      if (Math.abs(a[r][col]) > Math.abs(a[pivot][col])) pivot = r
    }
    if (Math.abs(a[pivot][col]) < 1e-12) throw new Error('mat4.inverse: matrix is singular')
    ;[a[col], a[pivot]] = [a[pivot], a[col]]
    // Scale the pivot row so the pivot becomes 1.
    const p = a[col][col]
    for (let c = 0; c < 8; c++) a[col][c] /= p
    // Subtract multiples of the pivot row to clear this column in every other row.
    for (let r = 0; r < 4; r++) {
      if (r === col) continue
      const f = a[r][col]
      for (let c = 0; c < 8; c++) a[r][c] -= f * a[col][c]
    }
  }
  return a.flatMap((row) => row.slice(4))
}

/** Move by (x, y, z). */
export function translate(x: number, y: number, z: number): Mat4 {
  return [1, 0, 0, x, 0, 1, 0, y, 0, 0, 1, z, 0, 0, 0, 1]
}

/** Stretch each axis separately. A negative factor mirrors (determinant < 0). */
export function scale(x: number, y: number, z: number): Mat4 {
  return [x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1]
}

/** Rotate around the x axis (y turns toward z). */
export function rotateX(angle: number): Mat4 {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  return [1, 0, 0, 0, 0, c, -s, 0, 0, s, c, 0, 0, 0, 0, 1]
}

/** Rotate around the y axis (z turns toward x). */
export function rotateY(angle: number): Mat4 {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  return [c, 0, s, 0, 0, 1, 0, 0, -s, 0, c, 0, 0, 0, 0, 1]
}

/** Rotate around the z axis (x turns toward y). */
export function rotateZ(angle: number): Mat4 {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  return [c, -s, 0, 0, s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
}

/**
 * Rotate around any axis through the origin (Rodrigues' formula).
 * With a unit axis k = (x, y, z), c = cos(angle), s = sin(angle), t = 1 - c:
 * the 3x3 part is  c*I + s*[k]x + t*(k k^T).  The axis does not need to be unit length.
 */
export function rotateAxis(axis: Vec3, angle: number): Mat4 {
  const [x, y, z] = normalize(axis)
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  const t = 1 - c
  return [
    t * x * x + c, t * x * y - s * z, t * x * z + s * y, 0,
    t * x * y + s * z, t * y * y + c, t * y * z - s * x, 0,
    t * x * z - s * y, t * y * z + s * x, t * z * z + c, 0,
    0, 0, 0, 1,
  ]
}

/**
 * Rotate around an axis that passes through `pivot` (not the origin).
 * Right to left: move the pivot to the origin, rotate, move back.
 */
export function rotateAbout(axis: Vec3, angle: number, pivot: Vec3): Mat4 {
  const [px, py, pz] = pivot
  return multiply(translate(px, py, pz), multiply(rotateAxis(axis, angle), translate(-px, -py, -pz)))
}

/**
 * Shear: each coordinate gets a multiple of the other two.
 *   x' = x + xy*y + xz*z
 *   y' = y + yx*x + yz*z
 *   z' = z + zx*x + zy*y
 * (Determinant is 1 when only one side of the diagonal is used, i.e. volume is kept.)
 */
export function shear(xy: number, xz: number, yx: number, yz: number, zx: number, zy: number): Mat4 {
  return [1, xy, xz, 0, yx, 1, yz, 0, zx, zy, 1, 0, 0, 0, 0, 1]
}

/**
 * Perspective projection (OpenGL style). The camera is at the origin looking down -z.
 * fovY is the vertical field of view in radians; near/far are positive distances.
 * After dividing by w, visible points land in the cube -1..1 on every axis
 * (z = -1 on the near plane, z = +1 on the far plane).
 * Far objects get a bigger w (w = -z), so they are divided more and look smaller.
 */
export function perspective(fovY: number, aspect: number, near: number, far: number): Mat4 {
  const f = 1 / Math.tan(fovY / 2)
  return [
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) / (near - far), (2 * far * near) / (near - far),
    0, 0, -1, 0,
  ]
}

/**
 * View matrix that moves the world so the camera sits at the origin looking down -z.
 * Build the camera's own axes: forward f, right s, true-up u. Then the rows of the
 * matrix are those axes (a rotation), followed by moving the eye to the origin.
 */
export function lookAt(eye: Vec3, target: Vec3, up: Vec3): Mat4 {
  const f = normalize(sub(target, eye))
  const s = normalize(cross(f, up))
  const u = cross(s, f)
  return [
    s[0], s[1], s[2], -dot(s, eye),
    u[0], u[1], u[2], -dot(u, eye),
    -f[0], -f[1], -f[2], dot(f, eye),
    0, 0, 0, 1,
  ]
}

/**
 * Apply the matrix to a 3D point (treated as [x, y, z, 1]).
 * Divides by the resulting w, which does nothing for ordinary transforms (w = 1)
 * but is the "perspective divide" for a perspective matrix.
 */
export function transformPoint(m: Mat4, p: Vec3): [number, number, number] {
  const [x, y, z] = p
  const w = m[12] * x + m[13] * y + m[14] * z + m[15]
  return [
    (m[0] * x + m[1] * y + m[2] * z + m[3]) / w,
    (m[4] * x + m[5] * y + m[6] * z + m[7]) / w,
    (m[8] * x + m[9] * y + m[10] * z + m[11]) / w,
  ]
}
