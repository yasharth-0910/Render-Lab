import { describe, it, expect } from 'vitest'
import { Framebuffer } from './framebuffer'
import { drawLine } from './line'
import { renderWireframe } from './render'
import { createCube } from './mesh'
import { identity } from '../math/mat4'
import type { Camera } from './camera'

function litPixels(fb: Framebuffer): number {
  let n = 0
  for (let i = 3; i < fb.data.length; i += 4) if (fb.data[i] !== 0) n++
  return n
}

describe('drawLine', () => {
  it('draws a horizontal line including both end points', () => {
    const fb = new Framebuffer(10, 5)
    drawLine(fb, 1, 2, 6, 2, [255, 0, 0, 255])
    for (let x = 1; x <= 6; x++) expect(fb.getPixel(x, 2)).toEqual([255, 0, 0, 255])
    expect(litPixels(fb)).toBe(6)
  })
  it('draws a perfect diagonal', () => {
    const fb = new Framebuffer(10, 10)
    drawLine(fb, 0, 0, 5, 5, [0, 255, 0, 255])
    for (let i = 0; i <= 5; i++) expect(fb.getPixel(i, i)).toEqual([0, 255, 0, 255])
    expect(litPixels(fb)).toBe(6)
  })
  it('works backwards and for a single point', () => {
    const fb = new Framebuffer(10, 5)
    drawLine(fb, 6, 2, 1, 2, [1, 1, 1, 255])
    expect(litPixels(fb)).toBe(6)
    const fb2 = new Framebuffer(10, 5)
    drawLine(fb2, 3, 3, 3, 3, [1, 1, 1, 255])
    expect(litPixels(fb2)).toBe(1)
  })
  it('does not crash when the line leaves the screen', () => {
    const fb = new Framebuffer(10, 10)
    drawLine(fb, -5, 5, 20, 5, [1, 1, 1, 255])
    expect(litPixels(fb)).toBe(10)
  })
})

describe('renderWireframe', () => {
  const cam: Camera = {
    eye: [0, 0, 4], target: [0, 0, 0], up: [0, 1, 0],
    fovY: Math.PI / 3, aspect: 1, near: 0.1, far: 100,
  }
  it('draws something, and the center of the cube front face stays empty', () => {
    const fb = new Framebuffer(100, 100)
    renderWireframe(fb, createCube(), identity(), cam)
    expect(litPixels(fb)).toBeGreaterThan(50)
    expect(fb.getPixel(50, 50)).toEqual([0, 0, 0, 0]) // wireframe, so the middle is empty
  })
  it('skips edges with a corner behind the camera instead of crashing', () => {
    const fb = new Framebuffer(100, 100)
    const inside: Camera = { ...cam, eye: [0, 0, 0.2] } // camera inside the cube
    expect(() => renderWireframe(fb, createCube(), identity(), inside)).not.toThrow()
  })
})
