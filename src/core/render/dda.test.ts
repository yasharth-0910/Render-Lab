import { describe, it, expect } from 'vitest'
import { ddaSteps } from './dda'

describe('ddaSteps', () => {
  it('horizontal and diagonal lines', () => {
    expect(ddaSteps(0, 0, 3, 0)).toEqual([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }])
    expect(ddaSteps(0, 0, 2, 2).map((p) => [p.x, p.y])).toEqual([[0, 0], [1, 1], [2, 2]])
  })
  it('has max(|dx|,|dy|)+1 pixels and hits both end points', () => {
    const s = ddaSteps(1, 2, 9, 5)
    expect(s.length).toBe(9)
    expect([s[0].x, s[0].y]).toEqual([1, 2])
    expect([s[8].x, s[8].y]).toEqual([9, 5])
  })
  it('single point', () => {
    expect(ddaSteps(4, 4, 4, 4)).toEqual([{ x: 4, y: 4 }])
  })
})
