import { describe, it, expect } from 'vitest'
import { bresenhamSteps, drawLine } from './line'
import { Framebuffer } from './framebuffer'

const key = (p: { x: number; y: number }) => `${p.x},${p.y}`
const pixelSet = (steps: { x: number; y: number }[]) => new Set(steps.map(key))
const pts = (steps: { x: number; y: number }[]) => steps.map((s) => [s.x, s.y])

describe('bresenhamSteps: simple shapes', () => {
  it('horizontal', () => {
    expect(pts(bresenhamSteps(2, 3, 6, 3))).toEqual([[2, 3], [3, 3], [4, 3], [5, 3], [6, 3]])
  })
  it('vertical', () => {
    expect(pts(bresenhamSteps(4, 1, 4, 4))).toEqual([[4, 1], [4, 2], [4, 3], [4, 4]])
  })
  it('45 degrees', () => {
    expect(pts(bresenhamSteps(0, 0, 3, 3))).toEqual([[0, 0], [1, 1], [2, 2], [3, 3]])
  })
  it('single point gives exactly one pixel', () => {
    const s = bresenhamSteps(5, 7, 5, 7)
    expect(pts(s)).toEqual([[5, 7]])
    expect(s[0].move).toBe('none')
  })
  it('hand-checked shallow line (0,0) to (5,2) with every error value', () => {
    const s = bresenhamSteps(0, 0, 5, 2)
    expect(pts(s)).toEqual([[0, 0], [1, 0], [2, 1], [3, 1], [4, 2], [5, 2]])
    expect(s.map((t) => t.errorBefore)).toEqual([-1, 3, -3, 1, -5, -1])
    expect(s.map((t) => t.errorAfter)).toEqual([3, -3, 1, -5, -1, -1])
    expect(s.map((t) => t.move)).toEqual(['straight', 'diagonal', 'straight', 'diagonal', 'straight', 'none'])
  })
  it('hand-checked steep line (0,0) to (2,5): same as the shallow one with x and y swapped', () => {
    expect(pts(bresenhamSteps(0, 0, 2, 5))).toEqual([[0, 0], [0, 1], [1, 2], [1, 3], [2, 4], [2, 5]])
  })
})

// Every direction and slope: all 8 octants, written as (x0,y0,x1,y1).
const octantLines: [string, number, number, number, number][] = [
  ['shallow right-down', 0, 0, 7, 3],
  ['shallow right-up', 0, 5, 7, 2],
  ['shallow left-down', 7, 0, 0, 3],
  ['shallow left-up', 7, 5, 0, 2],
  ['steep right-down', 0, 0, 3, 7],
  ['steep right-up', 0, 7, 3, 0],
  ['steep left-down', 3, 0, 0, 7],
  ['steep left-up', 3, 7, 0, 0],
]

// The true line's other coordinate at a given position along the longer axis.
function distanceFromTrueLine(x0: number, y0: number, x1: number, y1: number, p: { x: number; y: number }) {
  const dx = x1 - x0
  const dy = y1 - y0
  if (dx === 0 && dy === 0) return Math.hypot(p.x - x0, p.y - y0) // a single point
  if (Math.abs(dy) > Math.abs(dx)) return Math.abs(p.x - (x0 + (dx * (p.y - y0)) / dy))
  return Math.abs(p.y - (y0 + (dy * (p.x - x0)) / dx))
}

describe.each(octantLines)('bresenhamSteps: %s', (_name, x0, y0, x1, y1) => {
  const steps = bresenhamSteps(x0, y0, x1, y1)
  it('first and last step are the end points', () => {
    expect(pts([steps[0]])[0]).toEqual([x0, y0])
    expect(pts([steps[steps.length - 1]])[0]).toEqual([x1, y1])
  })
  it('has max(|dx|,|dy|)+1 steps', () => {
    expect(steps.length).toBe(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) + 1)
  })
  it('stays within half a pixel of the true line', () => {
    for (const p of steps) expect(distanceFromTrueLine(x0, y0, x1, y1, p)).toBeLessThanOrEqual(0.5 + 1e-9)
  })
  it('reversed end points give the same pixels', () => {
    expect(pixelSet(bresenhamSteps(x1, y1, x0, y0))).toEqual(pixelSet(steps))
  })
})

describe('bresenhamSteps: every line on a small grid', () => {
  // All pairs of end points with coordinates -4..4: 6561 lines.
  it('obeys all the rules', () => {
    const range = [-4, -3, -2, -1, 0, 1, 2, 3, 4]
    for (const x0 of range) for (const y0 of range) for (const x1 of range) for (const y1 of range) {
      const s = bresenhamSteps(x0, y0, x1, y1)
      // count
      expect(s.length).toBe(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) + 1)
      // end points
      expect([s[0].x, s[0].y]).toEqual([x0, y0])
      expect([s[s.length - 1].x, s[s.length - 1].y]).toEqual([x1, y1])
      for (let i = 0; i < s.length; i++) {
        // within 0.5 pixel of the true line
        expect(distanceFromTrueLine(x0, y0, x1, y1, s[i])).toBeLessThanOrEqual(0.5 + 1e-9)
        // no gaps: the next pixel is a neighbour (8-connected) and not the same pixel
        if (i > 0) {
          const jump = Math.max(Math.abs(s[i].x - s[i - 1].x), Math.abs(s[i].y - s[i - 1].y))
          expect(jump).toBe(1)
        }
      }
      // reversed end points: same pixel set
      expect(pixelSet(bresenhamSteps(x1, y1, x0, y0))).toEqual(pixelSet(s))
    }
  })
  it('uses whole numbers only', () => {
    for (const s of bresenhamSteps(0, 0, 13, 5)) {
      for (const v of [s.x, s.y, s.errorBefore, s.errorAfter]) expect(Number.isInteger(v)).toBe(true)
    }
  })
  it('each errorAfter becomes the next errorBefore', () => {
    const s = bresenhamSteps(0, 0, 13, 5)
    for (let i = 1; i < s.length; i++) expect(s[i].errorBefore).toBe(s[i - 1].errorAfter)
  })
})

describe('drawLine uses the same pixels as bresenhamSteps', () => {
  it('lights exactly the step pixels', () => {
    const fb = new Framebuffer(20, 20)
    drawLine(fb, 1, 2, 15, 9, [255, 0, 0, 255])
    const lit = new Set<string>()
    for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) if (fb.getPixel(x, y)[3] !== 0) lit.add(`${x},${y}`)
    expect(lit).toEqual(pixelSet(bresenhamSteps(1, 2, 15, 9)))
  })
})
