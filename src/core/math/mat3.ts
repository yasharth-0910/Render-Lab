// mat3.ts - 3x3 matrices for 2D transforms in homogeneous coordinates.
//
// CONVENTIONS (read these first):
// - A Mat3 is a plain array of 9 numbers stored ROW-MAJOR:
//       [ m0 m1 m2 ]
//       [ m3 m4 m5 ]   is stored as  [m0, m1, m2, m3, m4, m5, m6, m7, m8]
//       [ m6 m7 m8 ]
// - Points are COLUMN vectors [x, y, 1], so we compute  p' = M * p.
// - multiply(a, b) = a * b, which applies b FIRST and then a.
// - Translation lives in the last column (m2, m5).
// - Angles are in radians; positive angles turn x toward y (counter-clockwise).

export type Mat3 = number[]
type Point2 = readonly [number, number]

/** The matrix that changes nothing. */
export function identity(): Mat3 {
  return [1, 0, 0, 0, 1, 0, 0, 0, 1]
}

/** a * b (row times column). Applying the result = apply b first, then a. */
export function multiply(a: Mat3, b: Mat3): Mat3 {
  const out: Mat3 = new Array(9).fill(0)
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      let sum = 0
      for (let k = 0; k < 3; k++) sum += a[row * 3 + k] * b[k * 3 + col]
      out[row * 3 + col] = sum
    }
  }
  return out
}

/** Move by (tx, ty). */
export function translate(tx: number, ty: number): Mat3 {
  return [1, 0, tx, 0, 1, ty, 0, 0, 1]
}

/** Rotate by `angle` radians around the origin. */
export function rotate(angle: number): Mat3 {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  return [c, -s, 0, s, c, 0, 0, 0, 1]
}

/** Stretch x by sx and y by sy. */
export function scale(sx: number, sy: number): Mat3 {
  return [sx, 0, 0, 0, sy, 0, 0, 0, 1]
}

/** Shear: x' = x + shx*y and y' = y + shy*x. Determinant = 1 - shx*shy. */
export function shear(shx: number, shy: number): Mat3 {
  return [1, shx, 0, shy, 1, 0, 0, 0, 1]
}

/** Mirror across an axis: 'x' flips y (mirror in the x axis), 'y' flips x. */
export function reflect(axis: 'x' | 'y'): Mat3 {
  return axis === 'x' ? scale(1, -1) : scale(-1, 1)
}

/**
 * Rotate around the point (px, py) instead of the origin.
 * Three steps, right to left: move the pivot to the origin, rotate, move back.
 */
export function rotateAbout(angle: number, px: number, py: number): Mat3 {
  return multiply(translate(px, py), multiply(rotate(angle), translate(-px, -py)))
}

/** Determinant (how much areas are scaled; negative means orientation flips). */
export function determinant(m: Mat3): number {
  return (
    m[0] * (m[4] * m[8] - m[5] * m[7]) -
    m[1] * (m[3] * m[8] - m[5] * m[6]) +
    m[2] * (m[3] * m[7] - m[4] * m[6])
  )
}

/** Apply the matrix to the 2D point (x, y), treating it as [x, y, 1]. */
export function transformPoint(m: Mat3, p: Point2): [number, number] {
  const [x, y] = p
  return [m[0] * x + m[1] * y + m[2], m[3] * x + m[4] * y + m[5]]
}
