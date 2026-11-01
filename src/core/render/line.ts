// line.ts - Bresenham's line algorithm (integer maths only).
//
// THE PROBLEM: pixels sit on a whole-number grid, but a real line passes between them.
// For each step along the line we must choose the pixel closest to the true line.
//
// THE IDEA: call the longer direction the MAJOR axis and the shorter one the MINOR axis
// (for a shallow line major is x, for a steep line major is y). We walk one pixel at a
// time along the major axis. At every step the minor coordinate either
//   - stays the same        ("straight"), or
//   - goes up/down by one   ("diagonal").
//
// THE ERROR TERM (also called the decision variable): a whole number that tells us how
// far the line has drifted from the pixel row we are in, scaled by 2*major so it stays an
// integer. The true line rises by (minor / major) per step. Drift past half a pixel means
// the next row is now closer, so:
//   - error > 0  -> the line is nearer the NEXT row: move diagonally, then subtract one
//                   whole row from the error: error += 2*minor - 2*major
//   - error <= 0 -> the line is still nearer the CURRENT row: move straight, error += 2*minor
// The first value is  error = 2*minor - major  (the drift after the first half step).
// Because we only add and compare whole numbers, there is no division, no floating point
// and no rounding. All 8 octants are handled by the signs sx, sy and the steep flag.
//
// Tie rule: when error is exactly 0 the line is exactly half way between two pixels.
// We always pick the pixel with the LARGER minor coordinate, so that drawing the line
// backwards gives exactly the same pixels as drawing it forwards.

import type { Color, Framebuffer } from './framebuffer'

export type BresenhamStep = {
  x: number // pixel column
  y: number // pixel row
  errorBefore: number // error value used to decide the move away from this pixel
  errorAfter: number // error value after the move (the next pixel's errorBefore)
  // 'straight': only the major axis moves (x for shallow lines, y for steep lines)
  // 'diagonal': both axes move
  // 'none': this is the last pixel, there is no move
  move: 'straight' | 'diagonal' | 'none'
}

/** Every pixel of the line from (x0,y0) to (x1,y1), end points included, with the error values. */
export function bresenhamSteps(x0: number, y0: number, x1: number, y1: number): BresenhamStep[] {
  // Distances and directions (+1 or -1) for each axis.
  const dx = Math.abs(x1 - x0)
  const dy = Math.abs(y1 - y0)
  const sx = x0 < x1 ? 1 : -1
  const sy = y0 < y1 ? 1 : -1

  // Steep lines (more tall than wide) walk along y; all others walk along x.
  const steep = dy > dx
  const major = steep ? dy : dx // number of moves to make
  const minor = steep ? dx : dy
  const minorSign = steep ? sx : sy // direction of the minor axis

  let error = 2 * minor - major // first decision value
  let x = x0
  let y = y0
  const steps: BresenhamStep[] = []

  for (let i = 0; i <= major; i++) {
    // Last pixel: record it and stop, there is nowhere left to move.
    if (i === major) {
      steps.push({ x, y, errorBefore: error, errorAfter: error, move: 'none' })
      break
    }
    const errorBefore = error
    const px = x // the pixel we are leaving
    const py = y
    // Diagonal if the line is nearer the next row. On an exact tie, go diagonal only
    // when that means a LARGER minor coordinate (see the tie rule above).
    const diagonal = error > 0 || (error === 0 && minorSign > 0)
    if (diagonal) {
      error += 2 * (minor - major)
      x += sx
      y += sy
    } else {
      error += 2 * minor
      if (steep) y += sy
      else x += sx
    }
    steps.push({ x: px, y: py, errorBefore, errorAfter: error, move: diagonal ? 'diagonal' : 'straight' })
  }
  return steps
}

/** Draw the line into the framebuffer, one pixel per Bresenham step. */
export function drawLine(
  fb: Framebuffer,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color: Color,
): void {
  const [r, g, b, a] = color
  for (const step of bresenhamSteps(x0, y0, x1, y1)) {
    fb.setPixel(step.x, step.y, r, g, b, a)
  }
}
