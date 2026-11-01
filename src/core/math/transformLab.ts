// transformLab.ts - helpers for the transformations lab.
//
// CONVENTIONS (same as mat3.ts / mat4.ts): row-major matrices, points are column vectors,
// p' = M * p. A list of operations is applied IN ORDER: the first operation in the list
// happens first. So for ops [A, B, C] the final matrix is  C * B * A.

import { polygonArea } from '../simplify/metrics'
import * as m3 from './mat3'
import * as m4 from './mat4'

type Pt = readonly [number, number]

// ---------- the operations ----------
// Angles are in radians here (the UI converts from degrees).

export type Op2 =
  | { type: 'translate'; tx: number; ty: number }
  | { type: 'rotate'; angle: number }
  | { type: 'scale'; sx: number; sy: number }
  | { type: 'shear'; shx: number; shy: number }
  | { type: 'reflect'; axis: 'x' | 'y' }
  | { type: 'rotateAbout'; angle: number; px: number; py: number }

export type Op3 =
  | { type: 'translate'; tx: number; ty: number; tz: number }
  | { type: 'rotateX'; angle: number }
  | { type: 'rotateY'; angle: number }
  | { type: 'rotateZ'; angle: number }
  | { type: 'rotateAxis'; ax: number; ay: number; az: number; angle: number }
  | { type: 'rotateAbout'; ax: number; ay: number; az: number; angle: number; px: number; py: number; pz: number }
  | { type: 'scale'; sx: number; sy: number; sz: number }
  | { type: 'shear'; xy: number; xz: number; yx: number; yz: number; zx: number; zy: number }

export type Composed<M> = {
  matrix: M // everything together
  steps: M[] // steps[i] = the matrix after operations 0..i have been applied (running total)
  single: M[] // single[i] = the matrix of operation i on its own
}

// Multiply the single matrices together in order, keeping every running total.
function accumulate<M>(single: M[], start: M, multiply: (a: M, b: M) => M): Composed<M> {
  const steps: M[] = []
  let total = start
  for (const m of single) {
    total = multiply(m, total) // the NEW operation goes on the left: it happens last
    steps.push(total)
  }
  return { matrix: total, steps, single }
}

/** The matrix of one 2D operation. */
export function opMatrix2D(op: Op2): m3.Mat3 {
  switch (op.type) {
    case 'translate': return m3.translate(op.tx, op.ty)
    case 'rotate': return m3.rotate(op.angle)
    case 'scale': return m3.scale(op.sx, op.sy)
    case 'shear': return m3.shear(op.shx, op.shy)
    case 'reflect': return m3.reflect(op.axis)
    case 'rotateAbout': return m3.rotateAbout(op.angle, op.px, op.py)
  }
}

/** The matrix of one 3D operation. */
export function opMatrix3D(op: Op3): m4.Mat4 {
  switch (op.type) {
    case 'translate': return m4.translate(op.tx, op.ty, op.tz)
    case 'rotateX': return m4.rotateX(op.angle)
    case 'rotateY': return m4.rotateY(op.angle)
    case 'rotateZ': return m4.rotateZ(op.angle)
    case 'rotateAxis': return m4.rotateAxis([op.ax, op.ay, op.az], op.angle)
    case 'rotateAbout': return m4.rotateAbout([op.ax, op.ay, op.az], op.angle, [op.px, op.py, op.pz])
    case 'scale': return m4.scale(op.sx, op.sy, op.sz)
    case 'shear': return m4.shear(op.xy, op.xz, op.yx, op.yz, op.zx, op.zy)
  }
}

/** Compose a list of 2D operations (first one applies first). An empty list gives the identity. */
export function composeOps2D(ops: Op2[]): Composed<m3.Mat3> {
  return accumulate(ops.map(opMatrix2D), m3.identity(), m3.multiply)
}

/** Compose a list of 3D operations (first one applies first). An empty list gives the identity. */
export function composeOps3D(ops: Op3[]): Composed<m4.Mat4> {
  return accumulate(ops.map(opMatrix3D), m4.identity(), m4.multiply)
}

// ---------- classifying a matrix ----------

export type MatrixKind = 'identity' | 'translation' | 'rotation' | 'reflection' | 'scale' | 'shear' | 'general' | 'singular'

export type MatrixInfo = {
  dimension: 2 | 3
  determinant: number
  scaleFactor: number // |determinant|: how much areas (2D) or volumes (3D) are multiplied
  orientation: 'preserved' | 'flipped' | 'collapsed'
  singular: boolean // determinant 0: no inverse, the shape is squashed flat
  isRotation: boolean // linear part is orthogonal with determinant +1
  kind: MatrixKind
  description: string
}

const EPSILON = 1e-9

// The "linear part": the rotation/scale/shear block, without the translation column.
// 3x3 matrix -> its top-left 2x2. 4x4 matrix -> its top-left 3x3. Returned as rows.
function linearPart(m: number[]): number[][] {
  const size = m.length === 9 ? 3 : 4
  const dim = size - 1
  const rows: number[][] = []
  for (let r = 0; r < dim; r++) rows.push(m.slice(r * size, r * size + dim))
  return rows
}

/**
 * Describe what a matrix does, using its determinant.
 *  - determinant = factor by which areas (2D) / volumes (3D) are multiplied, with a sign:
 *    positive keeps orientation, negative flips it (a mirror image), 0 means singular.
 *  - Orthogonal linear part (its columns are perpendicular unit vectors, L * L^T = I) means
 *    lengths and angles are kept: determinant +1 is a rotation, -1 a reflection.
 */
export function classifyMatrix(m: number[]): MatrixInfo {
  if (m.length !== 9 && m.length !== 16) throw new Error('classifyMatrix: expected a 3x3 or 4x4 matrix')
  const dimension = m.length === 9 ? 2 : 3
  const determinant = dimension === 2 ? m3.determinant(m) : m4.determinant(m)
  const L = linearPart(m)
  const n = L.length
  const near = (a: number, b: number) => Math.abs(a - b) < 1e-9

  // Test L * L^T = I (every row has length 1 and rows are perpendicular).
  let orthogonal = true
  let diagonal = true
  let linearIsIdentity = true
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      let rowDot = 0
      for (let k = 0; k < n; k++) rowDot += L[i][k] * L[j][k]
      if (!near(rowDot, i === j ? 1 : 0)) orthogonal = false
      if (i !== j && !near(L[i][j], 0)) diagonal = false
      if (!near(L[i][j], i === j ? 1 : 0)) linearIsIdentity = false
    }
  }
  // The translation column is the last number of each of the first n rows.
  const size = n + 1
  const hasTranslation = Array.from({ length: n }, (_, r) => m[r * size + n]).some((t) => !near(t, 0))

  const singular = Math.abs(determinant) < EPSILON
  let kind: MatrixKind
  if (singular) kind = 'singular'
  else if (linearIsIdentity) kind = hasTranslation ? 'translation' : 'identity'
  else if (orthogonal) kind = determinant > 0 ? 'rotation' : 'reflection'
  else if (diagonal) kind = 'scale'
  else if (near(determinant, 1)) kind = 'shear'
  else kind = 'general'

  const scaleFactor = Math.abs(determinant)
  const orientation = singular ? 'collapsed' : determinant > 0 ? 'preserved' : 'flipped'
  const measure = dimension === 2 ? 'area' : 'volume'
  const factor = Number(scaleFactor.toPrecision(4))
  const text: Record<MatrixKind, string> = {
    singular: dimension === 2
      ? 'singular: the plane is squashed onto a line or a point, there is no inverse'
      : 'singular: space is squashed onto a plane, line or point, there is no inverse',
    identity: `identity: nothing changes (${measure} × 1)`,
    translation: `translation only: the shape moves, ${measure} × 1`,
    rotation: `rotation: lengths and angles kept, ${measure} × 1`,
    reflection: `reflection: a mirror image, orientation flipped, ${measure} × 1`,
    scale: `scaling: ${measure} scaled by ${factor}${determinant < 0 ? ', orientation flipped' : ''}`,
    shear: `shear: slanted, but ${measure} kept (× 1)`,
    general: `${measure} scaled by ${factor}${determinant < 0 ? ', orientation flipped' : ''}`,
  }
  return {
    dimension, determinant, scaleFactor, orientation, singular,
    isRotation: kind === 'rotation', kind, description: text[kind],
  }
}

// ---------- areas before and after ----------

/** Apply a 2D matrix to a polygon and report its area before and after (after = |det| × before). */
export function transformPolygon(
  m: m3.Mat3, points: readonly Pt[],
): { points: [number, number][]; areaBefore: number; areaAfter: number; ratio: number } {
  const moved = points.map((p) => m3.transformPoint(m, p))
  const areaBefore = polygonArea(points)
  const areaAfter = polygonArea(moved)
  return { points: moved, areaBefore, areaAfter, ratio: areaBefore === 0 ? 0 : areaAfter / areaBefore }
}
