// dda.ts - the simple DDA (digital differential analyzer) line, kept only so the
// Bresenham lab can show how it differs. The renderer does NOT use this.
//
// Idea: walk along the longer axis one pixel at a time, add a fixed fractional amount
// to the other coordinate each step, and round it to the nearest pixel.
// It needs division and floating point numbers; Bresenham needs neither.

export type Pixel = { x: number; y: number }

/** Every pixel of the line from (x0,y0) to (x1,y1), end points included. */
export function ddaSteps(x0: number, y0: number, x1: number, y1: number): Pixel[] {
  const dx = x1 - x0
  const dy = y1 - y0
  // Number of steps = the longer side, so each step moves at most 1 pixel on each axis.
  const count = Math.max(Math.abs(dx), Math.abs(dy))
  if (count === 0) return [{ x: x0, y: y0 }]
  const xStep = dx / count
  const yStep = dy / count
  const pixels: Pixel[] = []
  for (let i = 0; i <= count; i++) {
    pixels.push({ x: Math.round(x0 + i * xStep), y: Math.round(y0 + i * yStep) })
  }
  return pixels
}
