import { describe, it, expect } from 'vitest'
import { polygonArea, distanceToSegment, maxDistance } from './metrics'
import type { Pt } from './visvalingam'

describe('polygonArea (shoelace)', () => {
  it('unit square is 1, in either direction', () => {
    expect(polygonArea([[0, 0], [1, 0], [1, 1], [0, 1]])).toBe(1)
    expect(polygonArea([[0, 1], [1, 1], [1, 0], [0, 0]])).toBe(1)
  })
  it('triangle 3-4 is 6', () => {
    expect(polygonArea([[0, 0], [3, 0], [0, 4]])).toBe(6)
  })
})

describe('distanceToSegment', () => {
  it('perpendicular distance in the middle, end-point distance beyond the ends', () => {
    expect(distanceToSegment([1, 2], [0, 0], [2, 0])).toBe(2)
    expect(distanceToSegment([5, 0], [0, 0], [2, 0])).toBe(3)
    expect(distanceToSegment([-3, 4], [0, 0], [2, 0])).toBe(5)
  })
  it('a zero-length segment is just a point', () => {
    expect(distanceToSegment([3, 4], [0, 0], [0, 0])).toBe(5)
  })
})

describe('maxDistance', () => {
  const line: Pt[] = [[0, 0], [1, 1], [2, 0]]
  it('is 0 when nothing was removed', () => {
    expect(maxDistance(line, line, false)).toBe(0)
  })
  it('is how far the removed point is from the new straight line', () => {
    expect(maxDistance(line, [[0, 0], [2, 0]], false)).toBe(1)
  })
  it('closed shapes include the closing edge', () => {
    const square: Pt[] = [[0, 0], [2, 0], [2, 2], [0, 2]]
    expect(maxDistance(square, [[0, 0], [2, 0], [2, 2]], true)).toBeCloseTo(Math.SQRT2 / 1) // corner (0,2) to the diagonal (2,2)-(0,0)
  })
})
