import { describe, it, expect } from 'vitest'
import { add, sub, scale, dot, cross, length, normalize, wedge } from './vec3'
import { expectClose } from './helpers.test-util'

const X = [1, 0, 0] as const
const Y = [0, 1, 0] as const
const Z = [0, 0, 1] as const

describe('vec3', () => {
  it('add and sub', () => {
    expect(add([1, 2, 3], [4, 5, 6])).toEqual([5, 7, 9])
    expect(sub([4, 5, 6], [1, 2, 3])).toEqual([3, 3, 3])
  })
  it('scale', () => {
    expect(scale([1, -2, 3], 2)).toEqual([2, -4, 6])
  })
  it('dot of perpendicular axes is 0, dot of (1,2,3).(4,5,6) is 32', () => {
    expect(dot(X, Y)).toBe(0)
    expect(dot([1, 2, 3], [4, 5, 6])).toBe(32)
  })
  it('cross of x and y is z, and y x x is -z', () => {
    expect(cross(X, Y)).toEqual([0, 0, 1])
    expect(cross(Y, X)).toEqual([0, 0, -1])
    expect(cross(Y, Z)).toEqual([1, 0, 0])
  })
  it('length of (3,4,0) is 5', () => {
    expect(length([3, 4, 0])).toBe(5)
  })
  it('normalize gives length 1 and keeps direction', () => {
    expectClose(normalize([0, 3, 4]), [0, 0.6, 0.8])
    expect(length(normalize([2, 3, 6]))).toBeCloseTo(1)
  })
  it('normalize of the zero vector stays zero (no NaN)', () => {
    expect(normalize([0, 0, 0])).toEqual([0, 0, 0])
  })
  it('wedge of x and y is the xy bivector with value 1', () => {
    // components are [xy, yz, zx]
    expect(wedge(X, Y)).toEqual([1, 0, 0])
    expect(wedge(Y, Z)).toEqual([0, 1, 0])
    expect(wedge(Z, X)).toEqual([0, 0, 1])
  })
  it('wedge is anti-symmetric: a^b = -(b^a)', () => {
    const a = [1, 2, 3] as const
    const b = [-2, 0, 5] as const
    const w1 = wedge(a, b)
    const w2 = wedge(b, a)
    expectClose(w1, [-w2[0], -w2[1], -w2[2]])
  })
  it('wedge components are the cross product components (reordered)', () => {
    const a = [1, 2, 3] as const
    const b = [4, -1, 2] as const
    const c = cross(a, b)
    const w = wedge(a, b)
    // cross = [yz, zx, xy], wedge = [xy, yz, zx]
    expect([w[1], w[2], w[0]]).toEqual([c[0], c[1], c[2]])
  })
  it('triangle area = half the wedge length (right triangle 3 by 4 has area 6)', () => {
    const w = wedge([3, 0, 0], [0, 4, 0])
    expect(length(w) / 2).toBe(6)
  })
})
