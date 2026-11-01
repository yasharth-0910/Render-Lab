import { describe, it, expect } from 'vitest'
import {
  identity, multiply, translate, rotate, scale, shear, reflect,
  rotateAbout, determinant, transformPoint,
} from './mat3'
import { expectClose } from './helpers.test-util'

const DEG90 = Math.PI / 2

describe('mat3 (2D homogeneous)', () => {
  it('identity leaves points alone', () => {
    expect(transformPoint(identity(), [3, -4])).toEqual([3, -4])
  })
  it('row-major layout: translate puts tx, ty in the last column', () => {
    expect(translate(5, 7)).toEqual([1, 0, 5, 0, 1, 7, 0, 0, 1])
  })
  it('translate moves a point', () => {
    expect(transformPoint(translate(2, 3), [1, 1])).toEqual([3, 4])
  })
  it('90 degree rotation maps x to y', () => {
    expectClose(transformPoint(rotate(DEG90), [1, 0]), [0, 1])
    expectClose(transformPoint(rotate(DEG90), [0, 1]), [-1, 0])
  })
  it('scale', () => {
    expect(transformPoint(scale(2, 3), [1, 1])).toEqual([2, 3])
  })
  it('shear x by 1 maps (0,1) to (1,1)', () => {
    expect(transformPoint(shear(1, 0), [0, 1])).toEqual([1, 1])
  })
  it('reflect across x axis flips y; across y axis flips x', () => {
    expect(transformPoint(reflect('x'), [2, 3])).toEqual([2, -3])
    expect(transformPoint(reflect('y'), [2, 3])).toEqual([-2, 3])
  })
  it('multiply applies the right matrix first: translate after scale', () => {
    const m = multiply(translate(10, 0), scale(2, 2))
    expect(transformPoint(m, [1, 1])).toEqual([12, 2])
  })
  it('determinant: rotation = 1, shear = 1, reflection = -1, scale = sx*sy', () => {
    expect(determinant(rotate(0.7))).toBeCloseTo(1)
    expect(determinant(shear(2.5, 0))).toBeCloseTo(1)
    expect(determinant(shear(1.5, -0.5))).toBeCloseTo(1 - 1.5 * -0.5)
    expect(determinant(reflect('x'))).toBe(-1)
    expect(determinant(scale(2, 3))).toBe(6)
  })
  it('rotating about a pivot leaves the pivot fixed', () => {
    const m = rotateAbout(1.1, 4, -2)
    expectClose(transformPoint(m, [4, -2]), [4, -2])
  })
  it('rotating (5,2) by 90 degrees about (4,2) gives (4,3)', () => {
    expectClose(transformPoint(rotateAbout(DEG90, 4, 2), [5, 2]), [4, 3])
  })
})
