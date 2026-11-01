// fill.ts - filled triangles with a depth buffer.
//
// Method: the EDGE FUNCTION (barycentric) method.
// For a pixel P and triangle corners p0, p1, p2, the barycentric numbers b0, b1, b2 say how
// much P is "made of" each corner (they add up to 1). P is inside the triangle exactly
// when all three are >= 0. They also let us blend any value stored at the corners,
// such as depth, across the triangle: value = b0*v0 + b1*v1 + b2*v2.

import type { Color, Framebuffer } from './framebuffer'

/** A screen point: x pixel, y pixel, and z depth (smaller = nearer). */
export type ScreenPoint = readonly [number, number, number]

/** One depth number per pixel: how far away the nearest thing drawn there is. */
export class DepthBuffer {
  readonly width: number
  readonly height: number
  readonly data: Float32Array

  constructor(width: number, height: number) {
    this.width = width
    this.height = height
    this.data = new Float32Array(width * height)
    this.clear()
  }

  /** Forget everything: every pixel is "infinitely far away" again. */
  clear(): void {
    this.data.fill(Infinity)
  }

  /**
   * Is depth z nearer than what is stored at (x, y)? If yes, store it and return true
   * (the caller should draw the pixel). If not, return false (the pixel is hidden).
   */
  testAndSet(x: number, y: number, z: number): boolean {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return false
    const i = y * this.width + x
    if (z < this.data[i]) {
      this.data[i] = z
      return true
    }
    return false
  }
}

// Twice the signed area of the triangle (a, b, P): the "edge function".
// Positive when P is to the left of the edge a -> b (in maths axes).
function edge(ax: number, ay: number, bx: number, by: number, px: number, py: number): number {
  return (bx - ax) * (py - ay) - (by - ay) * (px - ax)
}

/**
 * Barycentric numbers [b0, b1, b2] of the point (x, y) in triangle p0 p1 p2.
 * Returns null for a triangle with zero area. Dividing by the total area makes the
 * result the same for clockwise and counter-clockwise triangles.
 */
export function barycentric(
  p0: ScreenPoint, p1: ScreenPoint, p2: ScreenPoint, x: number, y: number,
): [number, number, number] | null {
  const area = edge(p0[0], p0[1], p1[0], p1[1], p2[0], p2[1])
  if (area === 0) return null
  return [
    edge(p1[0], p1[1], p2[0], p2[1], x, y) / area, // weight of p0
    edge(p2[0], p2[1], p0[0], p0[1], x, y) / area, // weight of p1
    edge(p0[0], p0[1], p1[0], p1[1], x, y) / area, // weight of p2
  ]
}

/**
 * Fill the triangle p0 p1 p2 with a color, keeping only the nearest pixels (depth test).
 * Only the pixels in the triangle's bounding box are visited, clipped to the screen.
 * A pixel counts as covered when its CENTER (x + 0.5, y + 0.5) is inside the triangle.
 * (Pixels exactly on a shared edge may be drawn by both triangles; the depth test makes
 * the first one win, so there are no gaps.)
 */
export function fillTriangle(
  fb: Framebuffer, depth: DepthBuffer, p0: ScreenPoint, p1: ScreenPoint, p2: ScreenPoint, color: Color,
): void {
  // Bounding box, clipped to the framebuffer.
  const minX = Math.max(0, Math.floor(Math.min(p0[0], p1[0], p2[0])))
  const maxX = Math.min(fb.width - 1, Math.ceil(Math.max(p0[0], p1[0], p2[0])))
  const minY = Math.max(0, Math.floor(Math.min(p0[1], p1[1], p2[1])))
  const maxY = Math.min(fb.height - 1, Math.ceil(Math.max(p0[1], p1[1], p2[1])))
  const [r, g, b, a] = color

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const w = barycentric(p0, p1, p2, x + 0.5, y + 0.5)
      if (w === null) return // zero-area triangle: nothing to draw
      if (w[0] < 0 || w[1] < 0 || w[2] < 0) continue // outside the triangle
      // Depth at this pixel = the corner depths blended with the same weights.
      const z = w[0] * p0[2] + w[1] * p1[2] + w[2] * p2[2]
      if (depth.testAndSet(x, y, z)) fb.setPixel(x, y, r, g, b, a)
    }
  }
}
