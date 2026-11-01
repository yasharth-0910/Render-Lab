import { describe, it, expect } from 'vitest'
import {
  identity, multiply, transpose, determinant, inverse, translate, scale,
  rotateX, rotateY, rotateZ, rotateAxis, rotateAbout, shear, perspective,
  lookAt, transformPoint,
} from './mat4'
import { expectClose } from './helpers.test-util'

const DEG90 = Math.PI / 2

describe('mat4', () => {
  it('identity has determinant 1 and leaves points alone', () => {
    expect(determinant(identity())).toBe(1)
    expect(transformPoint(identity(), [1, 2, 3])).toEqual([1, 2, 3])
  })
  it('row-major layout: translate puts the offset in the last column', () => {
    const t = translate(1, 2, 3)
    expect([t[3], t[7], t[11]]).toEqual([1, 2, 3])
  })
  it('translate and scale move points', () => {
    expect(transformPoint(translate(1, 2, 3), [1, 1, 1])).toEqual([2, 3, 4])
    expect(transformPoint(scale(2, 3, 4), [1, 1, 1])).toEqual([2, 3, 4])
  })
  it('multiply applies the right matrix first', () => {
    const m = multiply(translate(10, 0, 0), scale(2, 2, 2))
    expect(transformPoint(m, [1, 1, 1])).toEqual([12, 2, 2])
  })
  it('transpose swaps rows and columns, and twice gives back the original', () => {
    const t = translate(1, 2, 3)
    const tt = transpose(t)
    expect([tt[12], tt[13], tt[14]]).toEqual([1, 2, 3])
    expect(transpose(tt)).toEqual(t)
  })
  it('90 degree rotations: X->Y about z, Y->Z about x, Z->X about y', () => {
    expectClose(transformPoint(rotateZ(DEG90), [1, 0, 0]), [0, 1, 0])
    expectClose(transformPoint(rotateX(DEG90), [0, 1, 0]), [0, 0, 1])
    expectClose(transformPoint(rotateY(DEG90), [0, 0, 1]), [1, 0, 0])
  })
  it('determinant of rotations is 1', () => {
    expect(determinant(rotateX(0.3))).toBeCloseTo(1)
    expect(determinant(rotateY(1.2))).toBeCloseTo(1)
    expect(determinant(rotateZ(-2))).toBeCloseTo(1)
    expect(determinant(rotateAxis([1, 2, 3], 0.9))).toBeCloseTo(1)
  })
  it('determinant of a reflection (scale -1 on x) is -1', () => {
    expect(determinant(scale(-1, 1, 1))).toBe(-1)
  })
  it('determinant of shear is 1', () => {
    expect(determinant(shear(2, 0, 0, 0, 0.5, 0))).toBeCloseTo(1)
  })
  it('shear x by y: (0,1,0) -> (k,1,0)', () => {
    // shear(xy, xz, yx, yz, zx, zy): x += xy*y + xz*z, and so on
    expect(transformPoint(shear(3, 0, 0, 0, 0, 0), [0, 1, 0])).toEqual([3, 1, 0])
  })
  it('determinant of a general matrix (hand checked)', () => {
    // diag(2,3,4,1) has determinant 24
    expect(determinant(scale(2, 3, 4))).toBe(24)
    // a matrix with a swapped pair of rows flips the sign
    const swapped = [0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
    expect(determinant(swapped)).toBe(-1)
  })
  it('inverse times matrix is identity', () => {
    const m = multiply(translate(1, -2, 3), multiply(rotateAxis([1, 1, 0], 0.8), scale(2, 3, 0.5)))
    expectClose(multiply(inverse(m), m), identity())
    expectClose(multiply(m, inverse(m)), identity())
  })
  it('inverse of a singular matrix throws', () => {
    expect(() => inverse(scale(1, 0, 1))).toThrow()
  })
  it('rotateAxis about z equals rotateZ; about x equals rotateX', () => {
    expectClose(rotateAxis([0, 0, 1], 0.5), rotateZ(0.5))
    expectClose(rotateAxis([1, 0, 0], 0.5), rotateX(0.5))
    expectClose(rotateAxis([0, 2, 0], 0.5), rotateY(0.5)) // axis need not be unit length
  })
  it('rotating about a pivot leaves the pivot fixed', () => {
    const m = rotateAbout([0, 1, 0], 1.3, [3, 4, 5])
    expectClose(transformPoint(m, [3, 4, 5]), [3, 4, 5])
  })
  it('rotating (4,0,0) by 90 degrees about y through pivot (3,0,0)', () => {
    // offset (1,0,0) rotates to (0,0,-1) about +y, so result (3,0,-1)
    expectClose(transformPoint(rotateAbout([0, 1, 0], DEG90, [3, 0, 0]), [4, 0, 0]), [3, 0, -1])
  })
  it('perspective maps the near plane to z=-1 and the far plane to z=+1 (NDC)', () => {
    const p = perspective(DEG90, 1, 1, 10)
    expectClose(transformPoint(p, [0, 0, -1]), [0, 0, -1])
    expectClose(transformPoint(p, [0, 0, -10]), [0, 0, 1])
  })
  it('perspective with 90 degree fov: point at (d, 0, -d) lands on the right edge x=1', () => {
    const p = perspective(DEG90, 1, 0.1, 100)
    expectClose(transformPoint(p, [5, 0, -5]).slice(0, 2), [1, 0])
  })
  it('lookAt puts the eye at the origin and the target on the -z axis', () => {
    const v = lookAt([0, 0, 5], [0, 0, 0], [0, 1, 0])
    expectClose(transformPoint(v, [0, 0, 5]), [0, 0, 0])
    expectClose(transformPoint(v, [0, 0, 0]), [0, 0, -5])
  })
  it('lookAt from the +x side: target ends up straight ahead', () => {
    const v = lookAt([4, 0, 0], [0, 0, 0], [0, 1, 0])
    expectClose(transformPoint(v, [0, 0, 0]), [0, 0, -4])
  })
})
