// geometryLab.ts - the geometry behind the Geometry Lab: the outer (wedge) product and what it gives
// (areas, orientation, volume), the sine rule, the intersection of two lines, handedness, and
// vector spaces (spanning sets, orthogonal bases). Pure maths: no React, no drawing.
//
// Vectors are plain arrays of numbers. 2D points are [x, y]; the same functions that work for any
// number of dimensions take number[].
//
// THE OUTER PRODUCT in one sentence: a ∧ b is the oriented area of the parallelogram that a and b span.
// In 2D it is a single number (wedge2); in 3D it has three components (vec3.ts wedge) and the triple
// product a ∧ b ∧ c is a single number, the oriented volume.

import { cross, length, sub, type Vec3 } from './vec3'

export type Vec2 = readonly [number, number]

// "Zero" for tests like "are these parallel?". The numbers we compare are of the size of the inputs,
// so the tolerance is relative where it matters.
const EPSILON = 1e-12

// ---------------------------------------------------------------------------------------------
// The 2D outer product, areas and orientation
// ---------------------------------------------------------------------------------------------

/**
 * Outer (wedge) product of two 2D vectors:  a ∧ b = a1·b2 − a2·b1.
 * Its size is the area of the parallelogram spanned by a and b; it equals |a||b| sin θ where θ is the
 * angle turning a into b. THE SIGN says which way that turn goes:
 *   positive: b is ANTICLOCKWISE from a (the turn from a to b is less than 180° counter-clockwise),
 *   negative: b is CLOCKWISE from a,
 *   zero:     a and b are parallel (or one is zero).
 * Swapping the two vectors flips the sign: a ∧ b = −(b ∧ a).
 * (With the y axis pointing up. On a screen y points down and the two words swap.)
 */
export function wedge2(a: Vec2, b: Vec2): number {
  return a[0] * b[1] - a[1] * b[0]
}

/** Signed area of the triangle a, b, c: half the wedge of two of its edges. Positive when a → b → c goes anticlockwise. */
export function signedTriangleArea(a: Vec2, b: Vec2, c: Vec2): number {
  return wedge2([b[0] - a[0], b[1] - a[1]], [c[0] - a[0], c[1] - a[1]]) / 2
}

/** Area of a 2D triangle by the wedge: ½ |(b − a) ∧ (c − a)|. */
export function triangleAreaWedge(a: Vec2, b: Vec2, c: Vec2): number {
  return Math.abs(signedTriangleArea(a, b, c))
}

/**
 * Area of a 3D triangle by the cross product: ½ |(b − a) × (c − a)|. The length of the cross product is
 * the same number as the size of the wedge (they hold the same three components), so for a triangle that
 * lies flat in 2D the two methods give the same area.
 */
export function triangleAreaCross(a: Vec3, b: Vec3, c: Vec3): number {
  return length(cross(sub(b, a), sub(c, a))) / 2
}

/** Which way does a → b → c turn? Anticlockwise, clockwise, or "collinear" if they are on one line. */
export function orientation2D(a: Vec2, b: Vec2, c: Vec2): 'anticlockwise' | 'clockwise' | 'collinear' {
  const value = wedge2([b[0] - a[0], b[1] - a[1]], [c[0] - a[0], c[1] - a[1]])
  if (Math.abs(value) < EPSILON) return 'collinear'
  return value > 0 ? 'anticlockwise' : 'clockwise'
}

// ---------------------------------------------------------------------------------------------
// The sine rule
// ---------------------------------------------------------------------------------------------

export type SineRuleResult = {
  sides: [number, number, number] // a = |BC|, b = |CA|, c = |AB| (each side is opposite the corner with the same letter)
  angles: [number, number, number] // the corners A, B, C in radians
  sines: [number, number, number] // sin A, sin B, sin C
  ratios: [number, number, number] // a / sin A, b / sin B, c / sin C: all the same number, the sine rule
  area: number
  degenerate: boolean // the three points are on one line: there is no triangle
}

/**
 * The sides, angles and sine-rule ratios of the triangle A, B, C.
 * At each corner take the two edges u and v that leave it. Then
 *   sin(corner) = |u ∧ v| / (|u| |v|)   (the wedge is |u||v| sin θ)
 *   cos(corner) =  u · v  / (|u| |v|)
 * and the angle is atan2(|u ∧ v|, u · v), which also works for angles over 90°.
 * The sine rule says a / sin A = b / sin B = c / sin C. That common number is the diameter of the
 * circle through the three corners.
 */
export function sineRule(A: Vec2, B: Vec2, C: Vec2): SineRuleResult {
  const dist = (p: Vec2, q: Vec2) => Math.hypot(q[0] - p[0], q[1] - p[1])
  const sides: [number, number, number] = [dist(B, C), dist(C, A), dist(A, B)]

  // The corner at P, between the edges P→Q and P→R.
  const corner = (P: Vec2, Q: Vec2, R: Vec2) => {
    const u: Vec2 = [Q[0] - P[0], Q[1] - P[1]]
    const v: Vec2 = [R[0] - P[0], R[1] - P[1]]
    const w = Math.abs(wedge2(u, v))
    const d = u[0] * v[0] + u[1] * v[1]
    const lengths = Math.hypot(...u) * Math.hypot(...v)
    return { angle: Math.atan2(w, d), sine: lengths === 0 ? 0 : w / lengths }
  }
  const cornerA = corner(A, B, C)
  const cornerB = corner(B, C, A)
  const cornerC = corner(C, A, B)
  const sines: [number, number, number] = [cornerA.sine, cornerB.sine, cornerC.sine]
  const area = triangleAreaWedge(A, B, C)
  const degenerate = area < EPSILON * Math.max(1, sides[0] * sides[1])
  return {
    sides,
    angles: [cornerA.angle, cornerB.angle, cornerC.angle],
    sines,
    ratios: [sides[0] / sines[0], sides[1] / sines[1], sides[2] / sines[2]],
    area,
    degenerate,
  }
}

// ---------------------------------------------------------------------------------------------
// Intersection of two lines
// ---------------------------------------------------------------------------------------------

export type LineHit = { point: [number, number]; t: number; s: number }

/**
 * Where do the lines  p1 + t·d1  and  p2 + s·d2  meet?  At a point where
 *   p1 + t d1 = p2 + s d2.
 * Take the outer product of both sides with d2 (d2 ∧ d2 = 0 removes the s term):
 *   p1 ∧ d2 + t (d1 ∧ d2) = p2 ∧ d2   so   t = (p2 − p1) ∧ d2 / (d1 ∧ d2)
 * and with d1 in the same way:            s = (p2 − p1) ∧ d1 / (d1 ∧ d2).
 * If d1 ∧ d2 = 0 the directions are parallel: no single meeting point, so we return null.
 */
export function intersectLines(p1: Vec2, d1: Vec2, p2: Vec2, d2: Vec2): LineHit | null {
  const denominator = wedge2(d1, d2)
  if (Math.abs(denominator) <= EPSILON * Math.hypot(...d1) * Math.hypot(...d2)) return null
  const between: Vec2 = [p2[0] - p1[0], p2[1] - p1[1]]
  const t = wedge2(between, d2) / denominator
  const s = wedge2(between, d1) / denominator
  return { point: [p1[0] + t * d1[0], p1[1] + t * d1[1]], t, s }
}

/** Do the two lines cross, run side by side without touching ("parallel"), or lie on top of each other ("coincident")? */
export function lineRelation(p1: Vec2, d1: Vec2, p2: Vec2, d2: Vec2): 'intersecting' | 'parallel' | 'coincident' {
  if (intersectLines(p1, d1, p2, d2)) return 'intersecting'
  // Parallel. They are the same line if the way from p1 to p2 is also along d1: (p2 − p1) ∧ d1 = 0.
  const between: Vec2 = [p2[0] - p1[0], p2[1] - p1[1]]
  const sameLine = Math.abs(wedge2(between, d1)) <= 1e-9 * Math.max(1, Math.hypot(...between) * Math.hypot(...d1))
  return sameLine ? 'coincident' : 'parallel'
}

/**
 * Do the SEGMENTS a0→a1 and b0→b1 cross? Same formula with d1 = a1 − a0 and d2 = b1 − b0, but the meeting
 * point only counts if it lies on both segments: 0 ≤ t ≤ 1 and 0 ≤ s ≤ 1.
 */
export function intersectSegments(a0: Vec2, a1: Vec2, b0: Vec2, b1: Vec2): LineHit | null {
  const hit = intersectLines(a0, [a1[0] - a0[0], a1[1] - a0[1]], b0, [b1[0] - b0[0], b1[1] - b0[1]])
  if (!hit) return null
  const inside = (x: number) => x >= -1e-12 && x <= 1 + 1e-12
  return inside(hit.t) && inside(hit.s) ? hit : null
}

// ---------------------------------------------------------------------------------------------
// Handedness and volume
// ---------------------------------------------------------------------------------------------

/**
 * The oriented volume of the parallelepiped spanned by a, b, c: the 3D outer product a ∧ b ∧ c
 * (the "trivector"). As a number it is the determinant of the 3x3 matrix with a, b, c as rows,
 * which is the same as the triple product a · (b × c). Its size is the volume of the box; its sign
 * tells the handedness. Swapping any two vectors flips the sign.
 */
export function volume3(a: Vec3, b: Vec3, c: Vec3): number {
  return a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])
}

/**
 * Is the axis system x, y, z right handed or left handed? Look at the sign of the triple product:
 *   +  right handed (x × y points the way z does, like the thumb, index and middle finger of the right hand),
 *   −  left handed (z points the opposite way),
 *   0  "flat": the three vectors lie in one plane, so they are not axes at all.
 */
export function handedness(x: Vec3, y: Vec3, z: Vec3): { value: number; hand: 'right' | 'left' | 'flat' } {
  const value = volume3(x, y, z)
  if (Math.abs(value) < EPSILON) return { value, hand: 'flat' }
  return { value, hand: value > 0 ? 'right' : 'left' }
}

// ---------------------------------------------------------------------------------------------
// Vector spaces: determinant, rank, spanning, coordinates, Gram-Schmidt
// ---------------------------------------------------------------------------------------------

/** Determinant of a square matrix (rows given as arrays), by expanding along the first row. Fine for small matrices. */
export function determinant(m: number[][]): number {
  const n = m.length
  if (n === 0) return 1
  if (n === 1) return m[0][0]
  if (n === 2) return m[0][0] * m[1][1] - m[0][1] * m[1][0]
  let sum = 0
  for (let col = 0; col < n; col++) {
    // The smaller matrix without row 0 and without this column, with the + − + − sign pattern.
    const minor = m.slice(1).map((row) => row.filter((_, c) => c !== col))
    sum += (col % 2 === 0 ? 1 : -1) * m[0][col] * determinant(minor)
  }
  return sum
}

// All ways to choose k numbers out of 0..n-1, in order.
function combinations(n: number, k: number): number[][] {
  if (k === 0) return [[]]
  const result: number[][] = []
  for (let first = 0; first <= n - k; first++) {
    for (const rest of combinations(n - first - 1, k - 1)) result.push([first, ...rest.map((r) => r + first + 1)])
  }
  return result
}

/**
 * The rank of a set of vectors: how many of them are really independent. It is the size of the biggest
 * square block of numbers (choose k of the vectors and k of the coordinates) with a determinant that is not 0.
 */
export function rank(vectors: number[][]): number {
  if (vectors.length === 0) return 0
  const dimension = vectors[0].length
  const scale = Math.max(1, ...vectors.flat().map(Math.abs))
  for (let k = Math.min(vectors.length, dimension); k >= 1; k--) {
    for (const rows of combinations(vectors.length, k)) {
      for (const cols of combinations(dimension, k)) {
        const block = rows.map((r) => cols.map((c) => vectors[r][c]))
        if (Math.abs(determinant(block)) > 1e-9 * scale ** k) return k
      }
    }
  }
  return 0
}

/** Do these vectors span the whole space of the given dimension (the plane for 2, space for 3)? True when the rank equals the dimension. */
export function spansSpace(vectors: number[][], dimension: number): boolean {
  return rank(vectors) === dimension
}

// Solve the square system A x = b by Gauss-Jordan elimination (null if A has no inverse).
function solve(A: number[][], b: number[]): number[] | null {
  const n = b.length
  const m = A.map((row, i) => [...row, b[i]]) // the augmented matrix [A | b]
  for (let col = 0; col < n; col++) {
    let pivot = col
    for (let r = col + 1; r < n; r++) if (Math.abs(m[r][col]) > Math.abs(m[pivot][col])) pivot = r
    if (Math.abs(m[pivot][col]) < 1e-12) return null
    ;[m[col], m[pivot]] = [m[pivot], m[col]]
    const p = m[col][col]
    for (let c = col; c <= n; c++) m[col][c] /= p
    for (let r = 0; r < n; r++) {
      if (r === col) continue
      const factor = m[r][col]
      for (let c = col; c <= n; c++) m[r][c] -= factor * m[col][c]
    }
  }
  return m.map((row) => row[n])
}

/**
 * Write v as a combination of the basis vectors:  v = c1·b1 + c2·b2 + ...  and return the coefficients.
 * We want the combination closest to v. Taking the dot product with every b_i gives the "normal equations"
 *   Σ_j c_j (b_i · b_j) = b_i · v,
 * a square system we solve. If v really is in the span, the residual (the distance between v and the
 * combination) is 0. Returns null if the basis vectors are dependent (the system has no solution).
 */
export function coordinatesInBasis(v: number[], basis: number[][]): { coefficients: number[]; residual: number; inSpan: boolean } | null {
  const dotp = (p: number[], q: number[]) => p.reduce((sum, x, k) => sum + x * q[k], 0)
  const gram = basis.map((bi) => basis.map((bj) => dotp(bi, bj)))
  const coefficients = solve(gram, basis.map((bi) => dotp(bi, v)))
  if (!coefficients) return null
  const combination = v.map((_, k) => coefficients.reduce((sum, c, i) => sum + c * basis[i][k], 0))
  const residual = Math.hypot(...v.map((x, k) => x - combination[k]))
  return { coefficients, residual, inSpan: residual < 1e-9 * Math.max(1, Math.hypot(...v)) }
}

/** Is `target` a combination of `vectors`? (It is in their span.) */
export function spans(vectors: number[][], target: number[]): boolean {
  // Use only the independent ones, so a dependent set does not make the equations unsolvable.
  const independent = gramSchmidt(vectors).orthogonal
  if (independent.length === 0) return target.every((x) => Math.abs(x) < 1e-12)
  return coordinatesInBasis(target, independent)?.inSpan ?? false
}

export type GramSchmidtResult = {
  orthogonal: number[][] // perpendicular vectors with the same span
  orthonormal: number[][] // the same, each scaled to length 1
  dependent: number[] // positions of the input vectors that were left out because they add nothing new
  rank: number // how many independent vectors there were
}

/**
 * Gram-Schmidt: turn a list of vectors into perpendicular ones that span the same space.
 * Go through the vectors in order. From each, subtract its shadow (projection) on every perpendicular
 * vector found so far:
 *   u_k = v_k − Σ_j  (v_k · u_j) / (u_j · u_j)  u_j
 * What is left is perpendicular to all earlier ones. If nothing is left (u_k is about 0), the vector was a
 * combination of the earlier ones: it is dependent and is skipped.
 */
export function gramSchmidt(vectors: number[][], tolerance = 1e-9): GramSchmidtResult {
  const dotp = (p: number[], q: number[]) => p.reduce((sum, x, k) => sum + x * q[k], 0)
  const orthogonal: number[][] = []
  const dependent: number[] = []
  vectors.forEach((v, index) => {
    const u = [...v]
    for (const earlier of orthogonal) {
      const shadow = dotp(v, earlier) / dotp(earlier, earlier)
      for (let k = 0; k < u.length; k++) u[k] -= shadow * earlier[k]
    }
    if (Math.hypot(...u) <= tolerance * Math.max(1, Math.hypot(...v))) dependent.push(index)
    else orthogonal.push(u)
  })
  const orthonormal = orthogonal.map((u) => u.map((x) => x / Math.hypot(...u)))
  return { orthogonal, orthonormal, dependent, rank: orthogonal.length }
}
