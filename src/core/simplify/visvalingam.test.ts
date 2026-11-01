import { describe, it, expect } from 'vitest'
import {
  triangleArea, visvalingamSteps, simplifyToCount, simplifyByArea, type Pt,
} from './visvalingam'
import { polygonArea } from './metrics'
import { createCoastline, createIsland, createSpiral, createStar } from './shapes'

describe('triangleArea (2D cross / outer product)', () => {
  it('right triangle 3-4 has area 6', () => {
    expect(triangleArea([0, 0], [3, 0], [0, 4])).toBe(6)
  })
  it('does not depend on the winding order', () => {
    expect(triangleArea([0, 0], [0, 4], [3, 0])).toBe(6)
  })
  it('collinear points give 0', () => {
    expect(triangleArea([0, 0], [1, 1], [5, 5])).toBe(0)
  })
})

describe('hand-worked example (every area written out)', () => {
  // Open line: a=(0,0) b=(1,5) c=(2,0) d=(3,0) e=(4,0).  Indices 0..4.
  const pts: Pt[] = [[0, 0], [1, 5], [2, 0], [3, 0], [4, 0]]
  // Start: b = 0.5*|(1,5)x(2,0)| = 0.5*10 = 5;  c = tri(b,c,d) = 0.5*|(1,-5)x(2,-5)| = 2.5;  d = tri(c,d,e) = 0
  // 1) remove d (area 0). c becomes tri(b,c,e) = 0.5*|(1,-5)x(3,-5)| = 5.
  // 2) b and c both have area 5: tie, lowest index wins, so remove b (area 5). c becomes tri(a,c,e) = 0 (collinear!)
  //    but it is bumped up to the last removed area, 5 (the monotonic rule).
  // 3) remove c (ranked area 5, raw area 0).
  const steps = visvalingamSteps(pts, false)
  it('removes d, then b, then c', () => {
    expect(steps.map((s) => s.index)).toEqual([3, 1, 2])
  })
  it('records the ranked area of every removal', () => {
    expect(steps.map((s) => s.area)).toEqual([0, 5, 5])
  })
  it('records the raw triangle area too: c was really 0 but is ranked 5', () => {
    expect(steps.map((s) => s.rawArea)).toEqual([0, 5, 0])
  })
  it('records the neighbours at the time of removal', () => {
    expect(steps.map((s) => [s.prev, s.next])).toEqual([[2, 4], [0, 2], [0, 4]])
  })
  it('records the smallest area still waiting after each removal (null at the end)', () => {
    expect(steps.map((s) => s.smallestRemaining)).toEqual([5, 5, null])
  })
})

describe('visvalingamSteps rules', () => {
  it('collinear points are removed first', () => {
    // (1,0), (2,0), (3,0) lie on a straight line; only (4,2) is a real corner.
    const pts: Pt[] = [[0, 0], [1, 0], [2, 0], [3, 0], [4, 2], [5, 0]]
    const steps = visvalingamSteps(pts, false)
    // (1,0) goes first (area 0, lowest index), then (2,0) becomes collinear with its new neighbours.
    expect(steps.slice(0, 2).map((s) => s.index)).toEqual([1, 2])
    expect(steps.slice(0, 2).map((s) => s.area)).toEqual([0, 0])
    expect(steps[2].area).toBeGreaterThan(0) // everything after that is a real bend
  })
  it('a square with one extra point on an edge loses that point first', () => {
    const square: Pt[] = [[0, 0], [1, 0], [2, 0], [2, 2], [0, 2]] // (1,0) is the extra point
    const steps = visvalingamSteps(square, true)
    expect(steps[0].index).toBe(1)
    expect(steps[0].area).toBe(0)
  })
  it('a triangle polygon is never reduced', () => {
    const tri: Pt[] = [[0, 0], [4, 0], [0, 3]]
    expect(visvalingamSteps(tri, true)).toEqual([])
    expect(simplifyToCount(tri, true, 1)).toEqual(tri)
  })
  it('a closed polygon is never reduced below 3 vertices', () => {
    const island = createIsland().points
    expect(simplifyToCount(island, true, 0).length).toBe(3)
    expect(visvalingamSteps(island, true).length).toBe(island.length - 3)
  })
  it('an open line is never reduced below 2 vertices', () => {
    const coast = createCoastline().points
    expect(simplifyToCount(coast, false, 0).length).toBe(2)
    expect(visvalingamSteps(coast, false).length).toBe(coast.length - 2)
  })
  it('endpoints of an open line always survive', () => {
    const coast = createCoastline().points
    for (const n of [2, 3, 10, 100, 499]) {
      const out = simplifyToCount(coast, false, n)
      expect(out[0]).toEqual(coast[0])
      expect(out[out.length - 1]).toEqual(coast[coast.length - 1])
    }
  })
  it('each removed index appears once and never an endpoint of an open line', () => {
    const pts = createSpiral().points
    const idx = visvalingamSteps(pts, false).map((s) => s.index)
    expect(new Set(idx).size).toBe(idx.length)
    expect(idx).not.toContain(0)
    expect(idx).not.toContain(pts.length - 1)
  })
})

describe('simplifyToCount', () => {
  const shapes = [createCoastline(), createIsland(), createSpiral(), createStar()]
  for (const shape of shapes) {
    it(`${shape.name}: returns exactly n points, a subset of the originals in the same order`, () => {
      for (const n of [3, 4, 25, 100, shape.points.length - 1]) {
        const out = simplifyToCount(shape.points, shape.closed, n)
        expect(out.length).toBe(n)
        // walk through the original once: every output point must appear, in order
        let from = 0
        for (const p of out) {
          const at = shape.points.findIndex((q, i) => i >= from && q[0] === p[0] && q[1] === p[1])
          expect(at).toBeGreaterThanOrEqual(from)
          from = at + 1
        }
      }
    })
    it(`${shape.name}: asking for the original count (or more) returns the same points`, () => {
      expect(simplifyToCount(shape.points, shape.closed, shape.points.length)).toEqual(shape.points)
      expect(simplifyToCount(shape.points, shape.closed, shape.points.length + 50)).toEqual(shape.points)
    })
    it(`${shape.name}: removal areas never decrease (monotonic)`, () => {
      const areas = visvalingamSteps(shape.points, shape.closed).map((s) => s.area)
      for (let i = 1; i < areas.length; i++) expect(areas[i]).toBeGreaterThanOrEqual(areas[i - 1])
    })
  }
})

describe('monotonic rule', () => {
  it('ranked area is never below the area of the previous removal, even when the raw area is', () => {
    const steps = visvalingamSteps([[0, 0], [1, 5], [2, 0], [3, 0], [4, 0]], false)
    const lowRaw = steps.filter((s) => s.rawArea < s.area)
    expect(lowRaw.length).toBeGreaterThan(0) // the rule really was needed in this example
  })
})

describe('simplifyByArea', () => {
  const pts = createCoastline().points
  it('minArea 0 removes nothing', () => {
    expect(simplifyByArea(pts, false, 0)).toEqual(pts)
  })
  it('a huge minArea removes everything removable', () => {
    expect(simplifyByArea(pts, false, 1e9).length).toBe(2)
  })
  it('a bigger minArea keeps fewer points, and every removed point had a smaller area', () => {
    const a = simplifyByArea(pts, false, 0.001).length
    const b = simplifyByArea(pts, false, 0.01).length
    expect(b).toBeLessThanOrEqual(a)
    const steps = visvalingamSteps(pts, false)
    const removed = steps.filter((s) => s.area < 0.01).length
    expect(pts.length - b).toBe(removed)
  })
})

describe('shape quality', () => {
  it('polygon area stays close to the original after mild simplification', () => {
    const island = createIsland().points
    const before = polygonArea(island)
    const after = polygonArea(simplifyToCount(island, true, 300)) // 25% of the points gone
    expect(Math.abs(after - before) / before).toBeLessThan(0.01)
  })
  it('even a strong simplification keeps the rough size (island down to 40 points)', () => {
    const island = createIsland().points
    const before = polygonArea(island)
    const after = polygonArea(simplifyToCount(island, true, 40))
    expect(Math.abs(after - before) / before).toBeLessThan(0.1)
  })
})
