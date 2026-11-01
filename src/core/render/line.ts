// line.ts - PLACEHOLDER line drawing.
// This is a simple DDA (digital differential analyzer). Step 3 replaces it with
// Bresenham's algorithm, which gives the same kind of line using integers only.

import type { Color, Framebuffer } from './framebuffer'

/**
 * Draw a line from (x0, y0) to (x1, y1), both end points included.
 * Idea: walk along the longer direction one pixel at a time, and move the other
 * coordinate by a fixed fraction each step, rounding to the nearest pixel.
 */
export function drawLine(
  fb: Framebuffer,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color: Color,
): void {
  const dx = x1 - x0
  const dy = y1 - y0
  // Number of steps = the longer side, so each step moves at most 1 pixel on each axis.
  const steps = Math.max(Math.abs(dx), Math.abs(dy))
  const [r, g, b, a] = color
  if (steps === 0) {
    fb.setPixel(Math.round(x0), Math.round(y0), r, g, b, a)
    return
  }
  const xStep = dx / steps
  const yStep = dy / steps
  let x = x0
  let y = y0
  for (let i = 0; i <= steps; i++) {
    fb.setPixel(Math.round(x), Math.round(y), r, g, b, a)
    x += xStep
    y += yStep
  }
}
