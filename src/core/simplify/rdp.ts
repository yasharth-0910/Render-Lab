// rdp.ts - Ramer-Douglas-Peucker simplification. FOR COMPARISON ONLY.
// The lab can draw this next to Visvalingam-Whyatt. It is not one of the required algorithms.
//
// Idea: draw a straight line from the first to the last point. Find the point farthest from
// that line. If it is closer than epsilon, drop everything between. Otherwise keep it and
// repeat on the two halves.

import { distanceToSegment } from './metrics'
import type { Pt } from './visvalingam'

// Mark which points of points[from..to] to keep, between two fixed end points.
function markKept(points: readonly Pt[], from: number, to: number, epsilon: number, kept: boolean[]): void {
  let farthest = -1
  let farthestDistance = epsilon
  for (let i = from + 1; i < to; i++) {
    const d = distanceToSegment(points[i], points[from], points[to])
    if (d > farthestDistance) {
      farthest = i
      farthestDistance = d
    }
  }
  if (farthest < 0) return // everything in between is close enough: drop it
  kept[farthest] = true
  markKept(points, from, farthest, epsilon, kept)
  markKept(points, farthest, to, epsilon, kept)
}

/** Simplify with tolerance epsilon. A closed polygon is cut in two at its point farthest from point 0. */
export function rdp(points: readonly Pt[], epsilon: number, closed: boolean): Pt[] {
  const n = points.length
  if (n < 3 || (closed && n < 4)) return [...points]
  const kept: boolean[] = new Array(n).fill(false)
  if (!closed) {
    kept[0] = true
    kept[n - 1] = true
    markKept(points, 0, n - 1, epsilon, kept)
    return points.filter((_, i) => kept[i])
  }
  // Closed: use point 0 and the point farthest from it as two anchors, then simplify
  // the two halves of the loop separately.
  let far = 1
  for (let i = 1; i < n; i++) {
    if (Math.hypot(points[i][0] - points[0][0], points[i][1] - points[0][1]) >
        Math.hypot(points[far][0] - points[0][0], points[far][1] - points[0][1])) far = i
  }
  kept[0] = true
  kept[far] = true
  markKept(points, 0, far, epsilon, kept) // first half: points 0..far
  // Second half: points far..n-1 and then back to point 0 (a copy is appended as the end).
  const second = [...points.slice(far), points[0]]
  const secondKept: boolean[] = new Array(second.length).fill(false)
  secondKept[0] = true
  secondKept[second.length - 1] = true
  markKept(second, 0, second.length - 1, epsilon, secondKept)
  for (let i = 1; i < second.length - 1; i++) kept[far + i] = secondKept[i]
  // A polygon needs 3 points. If only the two anchors survived, add the point farthest from their line.
  if (kept.filter(Boolean).length < 3) {
    let third = -1
    let thirdDistance = -1
    for (let i = 0; i < n; i++) {
      const d = i === 0 || i === far ? -1 : distanceToSegment(points[i], points[0], points[far])
      if (d > thirdDistance) {
        third = i
        thirdDistance = d
      }
    }
    kept[third] = true
  }
  return points.filter((_, i) => kept[i])
}

/** Find the smallest epsilon (by bisection) that leaves at most `target` points. */
export function rdpToCount(points: readonly Pt[], closed: boolean, target: number): Pt[] {
  let low = 0
  let high = 1
  // Grow `high` until it is a big enough tolerance to leave at most `target` points.
  while (rdp(points, high, closed).length > target && high < 1e12) high *= 2
  for (let i = 0; i < 40; i++) {
    const mid = (low + high) / 2
    if (rdp(points, mid, closed).length > target) low = mid
    else high = mid
  }
  return rdp(points, high, closed)
}
