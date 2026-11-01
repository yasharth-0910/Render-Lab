import { describe, it, expect } from 'vitest'
import { rdp, rdpToCount } from './rdp'
import { createCoastline, createIsland } from './shapes'
import type { Pt } from './visvalingam'

describe('rdp (comparison only)', () => {
  it('a straight line collapses to its two end points', () => {
    expect(rdp([[0, 0], [1, 1], [2, 2], [3, 3]], 0.01, false)).toEqual([[0, 0], [3, 3]])
  })
  it('keeps a corner that sticks out more than epsilon, drops it when epsilon is bigger', () => {
    const pts: Pt[] = [[0, 0], [1, 1], [2, 0]]
    expect(rdp(pts, 0.5, false).length).toBe(3)
    expect(rdp(pts, 1.5, false).length).toBe(2)
  })
  it('a bigger epsilon never keeps more points', () => {
    const pts = createCoastline().points
    expect(rdp(pts, 0.5, false).length).toBeLessThanOrEqual(rdp(pts, 0.1, false).length)
  })
  it('epsilon 0 keeps every non-collinear point', () => {
    const pts = createCoastline().points
    expect(rdp(pts, 0, false).length).toBe(pts.length)
  })
  it('closed shapes keep at least 3 points', () => {
    expect(rdp(createIsland().points, 100, true).length).toBeGreaterThanOrEqual(3)
  })
})

describe('rdpToCount', () => {
  it('lands at or just under the requested count', () => {
    const pts = createCoastline().points
    const out = rdpToCount(pts, false, 60)
    expect(out.length).toBeLessThanOrEqual(60)
    expect(out.length).toBeGreaterThan(40)
  })
  it('keeps the end points of an open line', () => {
    const pts = createCoastline().points
    const out = rdpToCount(pts, false, 30)
    expect(out[0]).toEqual(pts[0])
    expect(out[out.length - 1]).toEqual(pts[pts.length - 1])
  })
})
