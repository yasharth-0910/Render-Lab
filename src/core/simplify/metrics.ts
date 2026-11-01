// metrics.ts - numbers that say how good a simplification is.

import type { Pt } from './visvalingam'

/** Area enclosed by a closed polygon (shoelace formula: add up the 2D cross products of neighbouring points). */
export function polygonArea(points: readonly Pt[]): number {
  let sum = 0
  for (let i = 0; i < points.length; i++) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    sum += a[0] * b[1] - b[0] * a[1]
  }
  return Math.abs(sum) / 2
}

/** Shortest distance from point p to the segment a-b. */
export function distanceToSegment(p: Pt, a: Pt, b: Pt): number {
  const abx = b[0] - a[0]
  const aby = b[1] - a[1]
  const lengthSquared = abx * abx + aby * aby
  // t = how far along a->b the closest spot is (0 = at a, 1 = at b), kept inside the segment.
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * abx + (p[1] - a[1]) * aby) / lengthSquared))
  return Math.hypot(p[0] - (a[0] + t * abx), p[1] - (a[1] + t * aby))
}

/** Worst case: the original point that is farthest from the simplified line (or polygon outline). */
export function maxDistance(original: readonly Pt[], simplified: readonly Pt[], closed: boolean): number {
  if (simplified.length === 0) return Infinity
  const segmentCount = closed ? simplified.length : simplified.length - 1
  let worst = 0
  for (const p of original) {
    let nearest = Infinity
    if (segmentCount === 0) nearest = Math.hypot(p[0] - simplified[0][0], p[1] - simplified[0][1])
    for (let i = 0; i < segmentCount; i++) {
      const d = distanceToSegment(p, simplified[i], simplified[(i + 1) % simplified.length])
      if (d < nearest) nearest = d
    }
    if (nearest > worst) worst = nearest
  }
  return worst
}
