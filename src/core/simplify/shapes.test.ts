import { describe, it, expect } from 'vitest'
import { createCoastline, createIsland, createSpiral, createStar, parsePoints } from './shapes'

describe('sample shapes', () => {
  it('have the promised sizes and open/closed flags', () => {
    expect(createCoastline()).toMatchObject({ closed: false })
    expect(createCoastline().points.length).toBe(500)
    expect(createIsland()).toMatchObject({ closed: true })
    expect(createIsland().points.length).toBe(400)
    expect(createSpiral().closed).toBe(false)
    expect(createStar().closed).toBe(true)
  })
  it('are the same every time (fixed seed)', () => {
    expect(createCoastline().points).toEqual(createCoastline().points)
    expect(createStar().points).toEqual(createStar().points)
  })
  it('contain only finite numbers and no two neighbours at the same place', () => {
    for (const s of [createCoastline(), createIsland(), createSpiral(), createStar()]) {
      s.points.forEach((p, i) => {
        expect(Number.isFinite(p[0]) && Number.isFinite(p[1])).toBe(true)
        if (i > 0) expect(p[0] !== s.points[i - 1][0] || p[1] !== s.points[i - 1][1]).toBe(true)
      })
    }
  })
})

describe('parsePoints', () => {
  it('reads "x,y" lines, also with spaces or semicolons, and counts bad lines', () => {
    const r = parsePoints('1,2\n3 4\n\nfoo\n5;6\n# comment\n7,x\n-1.5, 2e1')
    expect(r.points).toEqual([[1, 2], [3, 4], [5, 6], [-1.5, 20]])
    expect(r.bad).toBe(2) // "foo" and "7,x"
  })
  it('empty text gives no points', () => {
    expect(parsePoints('')).toEqual({ points: [], bad: 0 })
  })
})

describe('createCoastline with a size', () => {
  it('makes the asked number of points; the default is still 500', () => {
    expect(createCoastline(2000).points.length).toBe(2000)
    expect(createCoastline(100).points.length).toBe(100)
    expect(createCoastline().points.length).toBe(500)
  })
  it('bigger ones are the same curve sampled more finely: same start and end, same seed', () => {
    const small = createCoastline(100).points
    const big = createCoastline(1000).points
    expect(small[0]).toEqual(big[0])
    expect(small[99]).toEqual(big[999])
    expect(createCoastline(1000).points).toEqual(big)
  })
})
