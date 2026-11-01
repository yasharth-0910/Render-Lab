import { describe, it, expect } from 'vitest'
import {
  composeOps2D, composeOps3D, classifyMatrix, transformPolygon, type Op2, type Op3,
} from './transformLab'
import * as m3 from './mat3'
import * as m4 from './mat4'
import { expectClose } from './helpers.test-util'

const DEG90 = Math.PI / 2
const F: [number, number][] = [[0, 0], [1, 0], [1, 1.8], [2.2, 1.8], [2.2, 2.6], [1, 2.6], [1, 3], [3, 3], [3, 4], [0, 4]]

describe('composeOps2D', () => {
  const moveThenTurn: Op2[] = [{ type: 'translate', tx: 1, ty: 0 }, { type: 'rotate', angle: DEG90 }]
  const turnThenMove: Op2[] = [{ type: 'rotate', angle: DEG90 }, { type: 'translate', tx: 1, ty: 0 }]

  it('an empty list is the identity', () => {
    expect(composeOps2D([]).matrix).toEqual(m3.identity())
    expect(composeOps2D([]).steps).toEqual([])
  })
  it('the list is applied in order: translate THEN rotate sends the origin to (0,1)', () => {
    expectClose(m3.transformPoint(composeOps2D(moveThenTurn).matrix, [0, 0]), [0, 1])
  })
  it('rotate THEN translate sends the origin to (1,0): the order matters', () => {
    expectClose(m3.transformPoint(composeOps2D(turnThenMove).matrix, [0, 0]), [1, 0])
    const a = composeOps2D(moveThenTurn).matrix
    const b = composeOps2D(turnThenMove).matrix
    expect(a.some((v, i) => Math.abs(v - b[i]) > 1e-9)).toBe(true)
  })
  it('the final matrix equals the product of the single matrices (last op on the left)', () => {
    const ops: Op2[] = [
      { type: 'scale', sx: 2, sy: 3 }, { type: 'rotate', angle: 0.7 },
      { type: 'translate', tx: 4, ty: -1 }, { type: 'shear', shx: 0.5, shy: 0 },
    ]
    const { matrix, single } = composeOps2D(ops)
    expect(single.length).toBe(4)
    expectClose(matrix, m3.multiply(single[3], m3.multiply(single[2], m3.multiply(single[1], single[0]))))
  })
  it('steps are the running totals: step i = ops 0..i applied; the last step is the final matrix', () => {
    const ops: Op2[] = [{ type: 'scale', sx: 2, sy: 2 }, { type: 'translate', tx: 1, ty: 1 }]
    const { matrix, steps, single } = composeOps2D(ops)
    expect(steps.length).toBe(2)
    expectClose(steps[0], single[0])
    expectClose(steps[1], matrix)
    expectClose(m3.transformPoint(steps[0], [1, 1]), [2, 2])
    expectClose(m3.transformPoint(steps[1], [1, 1]), [3, 3])
  })
  it('every kind of operation builds the matching mat3', () => {
    expectClose(composeOps2D([{ type: 'translate', tx: 2, ty: 3 }]).matrix, m3.translate(2, 3))
    expectClose(composeOps2D([{ type: 'rotate', angle: 0.4 }]).matrix, m3.rotate(0.4))
    expectClose(composeOps2D([{ type: 'scale', sx: 2, sy: 3 }]).matrix, m3.scale(2, 3))
    expectClose(composeOps2D([{ type: 'shear', shx: 0.5, shy: 0.25 }]).matrix, m3.shear(0.5, 0.25))
    expectClose(composeOps2D([{ type: 'reflect', axis: 'x' }]).matrix, m3.reflect('x'))
    expectClose(composeOps2D([{ type: 'rotateAbout', angle: 1, px: 2, py: 3 }]).matrix, m3.rotateAbout(1, 2, 3))
  })
  it('rotation about a pivot leaves the pivot fixed', () => {
    const m = composeOps2D([{ type: 'rotateAbout', angle: 1.1, px: 4, py: -2 }]).matrix
    expectClose(m3.transformPoint(m, [4, -2]), [4, -2])
  })
})

describe('classifyMatrix (2D)', () => {
  const info = (ops: Op2[]) => classifyMatrix(composeOps2D(ops).matrix)

  it('determinant of a rotation is 1', () => {
    expect(info([{ type: 'rotate', angle: 0.9 }]).determinant).toBeCloseTo(1)
  })
  it('determinant of a reflection is -1', () => {
    expect(info([{ type: 'reflect', axis: 'y' }]).determinant).toBeCloseTo(-1)
  })
  it('determinant of scale(2,3) is 6', () => {
    expect(info([{ type: 'scale', sx: 2, sy: 3 }]).determinant).toBeCloseTo(6)
  })
  it('determinant of the one-axis shear x\' = x + k*y is 1, for any k', () => {
    for (const k of [0.5, 2, -3]) expect(info([{ type: 'shear', shx: k, shy: 0 }]).determinant).toBeCloseTo(1)
  })
  it('classifies each kind of matrix', () => {
    expect(info([]).kind).toBe('identity')
    expect(info([{ type: 'translate', tx: 3, ty: 1 }]).kind).toBe('translation')
    expect(info([{ type: 'rotate', angle: 0.5 }]).kind).toBe('rotation')
    expect(info([{ type: 'rotateAbout', angle: 0.5, px: 2, py: 2 }]).kind).toBe('rotation')
    expect(info([{ type: 'reflect', axis: 'x' }]).kind).toBe('reflection')
    expect(info([{ type: 'scale', sx: 2, sy: 3 }]).kind).toBe('scale')
    expect(info([{ type: 'shear', shx: 1.5, shy: 0 }]).kind).toBe('shear')
    expect(info([{ type: 'scale', sx: 2, sy: 1 }, { type: 'rotate', angle: 0.5 }]).kind).toBe('general')
  })
  it('only rotations are "pure rotation" and only the right ones preserve orientation', () => {
    expect(info([{ type: 'rotate', angle: 0.5 }]).isRotation).toBe(true)
    expect(info([{ type: 'reflect', axis: 'x' }]).isRotation).toBe(false)
    expect(info([{ type: 'shear', shx: 1, shy: 0 }]).isRotation).toBe(false)
    expect(info([{ type: 'rotate', angle: 0.5 }]).orientation).toBe('preserved')
    expect(info([{ type: 'reflect', axis: 'x' }]).orientation).toBe('flipped')
  })
  it('a rotation then reflection is still a reflection (determinant -1)', () => {
    const r = info([{ type: 'rotate', angle: 1 }, { type: 'reflect', axis: 'x' }])
    expect(r.kind).toBe('reflection')
    expect(r.scaleFactor).toBeCloseTo(1)
  })
  it('scale by 0 is reported as singular', () => {
    const r = info([{ type: 'scale', sx: 0, sy: 1 }])
    expect(r.singular).toBe(true)
    expect(r.kind).toBe('singular')
    expect(r.orientation).toBe('collapsed')
    expect(r.description).toContain('singular')
  })
  it('scaleFactor is |det|, so a negative determinant still gives a positive area scale', () => {
    expect(info([{ type: 'scale', sx: -2, sy: 3 }]).scaleFactor).toBeCloseTo(6)
  })
  it('rejects a matrix that is not 3x3 or 4x4', () => {
    expect(() => classifyMatrix([1, 2, 3])).toThrow()
  })
})

describe('transformPolygon: area scales by |det|', () => {
  const cases: [string, Op2[]][] = [
    ['rotation', [{ type: 'rotate', angle: 1 }]],
    ['scale', [{ type: 'scale', sx: 2, sy: 3 }]],
    ['shear', [{ type: 'shear', shx: 1.5, shy: 0 }]],
    ['reflection', [{ type: 'reflect', axis: 'x' }]],
    ['mixed', [{ type: 'scale', sx: 1.5, sy: 0.5 }, { type: 'rotateAbout', angle: 0.8, px: 1, py: 2 }, { type: 'translate', tx: 3, ty: -1 }, { type: 'shear', shx: 0.3, shy: 0.2 }]],
  ]
  for (const [name, ops] of cases) {
    it(`${name}: area after = |det| * area before`, () => {
      const m = composeOps2D(ops).matrix
      const r = transformPolygon(m, F)
      expect(r.areaBefore).toBeCloseTo(6.96)
      expect(r.areaAfter).toBeCloseTo(Math.abs(classifyMatrix(m).determinant) * r.areaBefore)
      expect(r.ratio).toBeCloseTo(Math.abs(classifyMatrix(m).determinant))
    })
  }
  it('returns the transformed points', () => {
    const r = transformPolygon(m3.translate(10, 0), [[0, 0], [1, 0], [0, 1]])
    expect(r.points).toEqual([[10, 0], [11, 0], [10, 1]])
  })
  it('a singular matrix collapses the area to 0', () => {
    expect(transformPolygon(m3.scale(0, 1), F).areaAfter).toBeCloseTo(0)
  })
})

describe('composeOps3D', () => {
  it('an empty list is the identity', () => {
    expect(composeOps3D([]).matrix).toEqual(m4.identity())
  })
  it('every kind of operation builds the matching mat4', () => {
    expectClose(composeOps3D([{ type: 'translate', tx: 1, ty: 2, tz: 3 }]).matrix, m4.translate(1, 2, 3))
    expectClose(composeOps3D([{ type: 'rotateX', angle: 0.3 }]).matrix, m4.rotateX(0.3))
    expectClose(composeOps3D([{ type: 'rotateY', angle: 0.3 }]).matrix, m4.rotateY(0.3))
    expectClose(composeOps3D([{ type: 'rotateZ', angle: 0.3 }]).matrix, m4.rotateZ(0.3))
    expectClose(composeOps3D([{ type: 'rotateAxis', ax: 0, ay: 0, az: 2, angle: 0.3 }]).matrix, m4.rotateZ(0.3))
    expectClose(composeOps3D([{ type: 'scale', sx: 2, sy: 3, sz: 4 }]).matrix, m4.scale(2, 3, 4))
    expectClose(composeOps3D([{ type: 'shear', xy: 1, xz: 0, yx: 0, yz: 0, zx: 0, zy: 0 }]).matrix, m4.shear(1, 0, 0, 0, 0, 0))
    expectClose(
      composeOps3D([{ type: 'rotateAbout', ax: 0, ay: 1, az: 0, angle: 1, px: 1, py: 2, pz: 3 }]).matrix,
      m4.rotateAbout([0, 1, 0], 1, [1, 2, 3]),
    )
  })
  it('order matters: translate then rotate differs from rotate then translate', () => {
    const a: Op3[] = [{ type: 'translate', tx: 1, ty: 0, tz: 0 }, { type: 'rotateZ', angle: DEG90 }]
    const b: Op3[] = [{ type: 'rotateZ', angle: DEG90 }, { type: 'translate', tx: 1, ty: 0, tz: 0 }]
    expectClose(m4.transformPoint(composeOps3D(a).matrix, [0, 0, 0]), [0, 1, 0])
    expectClose(m4.transformPoint(composeOps3D(b).matrix, [0, 0, 0]), [1, 0, 0])
  })
  it('the final matrix is the product of the single matrices', () => {
    const { matrix, single } = composeOps3D([
      { type: 'scale', sx: 2, sy: 1, sz: 1 }, { type: 'rotateX', angle: 0.5 }, { type: 'translate', tx: 1, ty: 2, tz: 3 },
    ])
    expectClose(matrix, m4.multiply(single[2], m4.multiply(single[1], single[0])))
  })
  it('rotation about a pivot leaves the pivot fixed', () => {
    const m = composeOps3D([{ type: 'rotateAbout', ax: 1, ay: 1, az: 0, angle: 1.2, px: 3, py: -1, pz: 2 }]).matrix
    expectClose(m4.transformPoint(m, [3, -1, 2]), [3, -1, 2])
  })
  it('classifies 3D matrices: rotation 1, reflection -1, scale = volume, shear 1, singular', () => {
    const c = (ops: Op3[]) => classifyMatrix(composeOps3D(ops).matrix)
    expect(c([{ type: 'rotateAxis', ax: 1, ay: 2, az: 3, angle: 0.8 }]).kind).toBe('rotation')
    expect(c([{ type: 'rotateAxis', ax: 1, ay: 2, az: 3, angle: 0.8 }]).determinant).toBeCloseTo(1)
    expect(c([{ type: 'scale', sx: -1, sy: 1, sz: 1 }]).kind).toBe('reflection')
    expect(c([{ type: 'scale', sx: -1, sy: 1, sz: 1 }]).determinant).toBeCloseTo(-1)
    expect(c([{ type: 'scale', sx: 2, sy: 3, sz: 4 }]).scaleFactor).toBeCloseTo(24)
    expect(c([{ type: 'scale', sx: 2, sy: 3, sz: 4 }]).kind).toBe('scale')
    expect(c([{ type: 'shear', xy: 1, xz: 0.5, yx: 0, yz: 0, zx: 0, zy: 0 }]).kind).toBe('shear')
    expect(c([{ type: 'shear', xy: 1, xz: 0.5, yx: 0, yz: 0, zx: 0, zy: 0 }]).determinant).toBeCloseTo(1)
    expect(c([{ type: 'scale', sx: 1, sy: 0, sz: 1 }]).singular).toBe(true)
    expect(c([{ type: 'scale', sx: 1, sy: 0, sz: 1 }]).description).toContain('singular')
  })
  it('the description says volume for 3D and area for 2D', () => {
    expect(classifyMatrix(composeOps3D([{ type: 'scale', sx: 2, sy: 2, sz: 2 }]).matrix).description).toContain('volume')
    expect(classifyMatrix(composeOps2D([{ type: 'scale', sx: 2, sy: 2 }]).matrix).description).toContain('area')
  })
})
