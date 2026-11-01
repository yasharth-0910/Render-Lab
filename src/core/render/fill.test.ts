import { describe, it, expect } from 'vitest'
import { DepthBuffer, fillTriangle } from './fill'
import { Framebuffer } from './framebuffer'

function litSet(fb: Framebuffer): Set<string> {
  const s = new Set<string>()
  for (let y = 0; y < fb.height; y++) for (let x = 0; x < fb.width; x++) {
    if (fb.getPixel(x, y)[3] !== 0) s.add(`${x},${y}`)
  }
  return s
}

describe('DepthBuffer', () => {
  it('starts empty: any depth passes', () => {
    const d = new DepthBuffer(4, 4)
    expect(d.testAndSet(1, 1, 0.9)).toBe(true)
  })
  it('keeps the nearer value (smaller z) and rejects farther ones', () => {
    const d = new DepthBuffer(4, 4)
    expect(d.testAndSet(1, 1, 0.5)).toBe(true)
    expect(d.testAndSet(1, 1, 0.7)).toBe(false) // farther
    expect(d.testAndSet(1, 1, 0.2)).toBe(true) // nearer
  })
  it('clear resets everything, out-of-bounds is rejected', () => {
    const d = new DepthBuffer(2, 2)
    d.testAndSet(0, 0, 0.1)
    d.clear()
    expect(d.testAndSet(0, 0, 0.9)).toBe(true)
    expect(d.testAndSet(5, 5, 0)).toBe(false)
  })
})

describe('fillTriangle', () => {
  const red = [255, 0, 0, 255] as const
  it('covers the expected pixels of a right triangle (pixel centers inside)', () => {
    // Corners (0,0), (4,0), (0,4). Pixel (x,y) has its center at (x+0.5, y+0.5),
    // which is inside when x + y <= 3. That is 4+3+2+1 = 10 pixels.
    const fb = new Framebuffer(8, 8)
    fillTriangle(fb, new DepthBuffer(8, 8), [0, 0, 0], [4, 0, 0], [0, 4, 0], red)
    const expected = new Set<string>()
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if (x + y <= 3) expected.add(`${x},${y}`)
    expect(litSet(fb)).toEqual(expected)
    expect(expected.size).toBe(10)
  })
  it('gives the same pixels for either winding order', () => {
    const a = new Framebuffer(8, 8)
    const b = new Framebuffer(8, 8)
    fillTriangle(a, new DepthBuffer(8, 8), [0, 0, 0], [4, 0, 0], [0, 4, 0], red)
    fillTriangle(b, new DepthBuffer(8, 8), [0, 0, 0], [0, 4, 0], [4, 0, 0], red)
    expect(litSet(b)).toEqual(litSet(a))
  })
  it('writes the given color', () => {
    const fb = new Framebuffer(8, 8)
    fillTriangle(fb, new DepthBuffer(8, 8), [0, 0, 0], [4, 0, 0], [0, 4, 0], [1, 2, 3, 255])
    expect(fb.getPixel(0, 0)).toEqual([1, 2, 3, 255])
  })
  it('a zero-area triangle draws nothing', () => {
    const fb = new Framebuffer(8, 8)
    fillTriangle(fb, new DepthBuffer(8, 8), [0, 0, 0], [3, 3, 0], [6, 6, 0], red)
    expect(litSet(fb).size).toBe(0)
  })
  it('is clipped to the framebuffer (partly off-screen triangle does not crash)', () => {
    const fb = new Framebuffer(8, 8)
    fillTriangle(fb, new DepthBuffer(8, 8), [-10, -10, 0], [20, -10, 0], [-10, 20, 0], red)
    expect(litSet(fb).has('0,0')).toBe(true)
    fillTriangle(fb, new DepthBuffer(8, 8), [100, 100, 0], [120, 100, 0], [100, 120, 0], red) // fully outside
  })
  it('depth buffer keeps the nearer triangle, whatever the draw order', () => {
    const near = [0, 255, 0, 255] as const
    const far = [255, 0, 0, 255] as const
    for (const nearFirst of [true, false]) {
      const fb = new Framebuffer(8, 8)
      const depth = new DepthBuffer(8, 8)
      const drawNear = () => fillTriangle(fb, depth, [0, 0, -0.5], [6, 0, -0.5], [0, 6, -0.5], near)
      const drawFar = () => fillTriangle(fb, depth, [0, 0, 0.5], [6, 0, 0.5], [0, 6, 0.5], far)
      if (nearFirst) { drawNear(); drawFar() } else { drawFar(); drawNear() }
      expect(fb.getPixel(1, 1)).toEqual([0, 255, 0, 255])
    }
  })
  it('interpolates depth across the triangle (a tilted triangle passes in front of a flat one)', () => {
    // Flat wall at z = 0. Tilted triangle goes from z = -1 (left) to z = +1 (right).
    // Left side is nearer than the wall, right side is farther.
    const fb = new Framebuffer(10, 10)
    const depth = new DepthBuffer(10, 10)
    fillTriangle(fb, depth, [0, 0, 0], [10, 0, 0], [0, 10, 0], [255, 0, 0, 255]) // wall
    fillTriangle(fb, depth, [0, 0, -1], [10, 0, 1], [0, 10, -1], [0, 255, 0, 255])
    expect(fb.getPixel(0, 0)).toEqual([0, 255, 0, 255]) // nearer than the wall
    expect(fb.getPixel(7, 0)).toEqual([255, 0, 0, 255]) // behind the wall
  })
})
