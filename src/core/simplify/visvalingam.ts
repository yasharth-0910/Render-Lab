// visvalingam.ts - Visvalingam-Whyatt line simplification.
//
// THE IDEA: a polyline has too many points. Which ones matter least? For every point,
// look at the triangle it makes with its two neighbours. A tiny triangle means the point
// barely bends the line, so removing it changes the shape very little.
// Repeat: remove the point with the SMALLEST triangle, then fix the triangles of its two
// neighbours (their neighbours changed). Stop when few enough points remain.
//
// "Effective area" of a point = area of the triangle (previous point, this point, next point).
// A triangle's area comes from the 2D cross product of two of its edges. That is the
// outer (wedge) product from the course: for edges u and v in 2D, u ^ v has one number,
// u.x*v.y - u.y*v.x, the signed area of the parallelogram they span. Half its size is
// the triangle area.
//
// Rules:
//  - Open polyline: the two end points are never removed (so at least 2 points remain).
//  - Closed polygon: every point can go, but at least 3 points remain (a triangle).
//
// Speed: each removal scans all points to find the smallest area, so the whole thing is
// O(n^2). That keeps the code easy to follow. A priority queue (heap) would find the
// smallest in O(log n) and make the whole algorithm O(n log n).

export type Pt = readonly [number, number]

/** One removal. `index` refers to the ORIGINAL point list. */
export type VWStep = {
  index: number // which original point was removed
  area: number // its ranking area (after the monotonic rule, see below)
  rawArea: number // the plain triangle area at that moment
  prev: number // the neighbours it had when it was removed
  next: number
  smallestRemaining: number | null // smallest ranking area among the points still waiting (null = none can go)
}

/** Area of triangle a, b, c: half the size of the 2D cross product of two edges. */
export function triangleArea(a: Pt, b: Pt, c: Pt): number {
  const cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
  return Math.abs(cross) / 2
}

/**
 * The full removal order, from the first point removed to the last possible one.
 *
 * MONOTONIC RULE: when a neighbour's triangle is recomputed, it may come out SMALLER than
 * the area of the point we just removed (the line straightened out). We then rank it with
 * the area of the removed point instead: ranking area = max(new area, last removed area).
 * Why: without this, a point could be removed "early" with a tiny area after a big one was
 * removed, so removal areas would not rise steadily. With it the areas never decrease, so
 * "remove every point whose area is below X" is the same as "remove the first k points",
 * and one ordering serves every level of detail.
 *
 * Ties: if two points have the same area, the one with the lower index goes first.
 */
export function visvalingamSteps(points: readonly Pt[], closed: boolean): VWStep[] {
  const n = points.length
  const minKeep = closed ? 3 : 2
  if (n <= minKeep) return []

  // Doubly linked list through the points: prev[i] and next[i] are i's current neighbours.
  const prev: number[] = []
  const next: number[] = []
  for (let i = 0; i < n; i++) {
    prev.push(closed ? (i - 1 + n) % n : i - 1)
    next.push(closed ? (i + 1) % n : i + 1)
  }
  const alive: boolean[] = new Array(n).fill(true)
  // In an open polyline the first and last point are not allowed to be removed.
  const canGo = (i: number) => closed || (i !== 0 && i !== n - 1)

  const rawArea: number[] = new Array(n).fill(Infinity)
  const area: number[] = new Array(n).fill(Infinity) // ranking area
  for (let i = 0; i < n; i++) {
    if (canGo(i)) {
      rawArea[i] = triangleArea(points[prev[i]], points[i], points[next[i]])
      area[i] = rawArea[i]
    }
  }

  // Scan every living point and return the one with the smallest ranking area.
  const findSmallest = (): number => {
    let best = -1
    for (let i = 0; i < n; i++) {
      if (alive[i] && canGo(i) && (best < 0 || area[i] < area[best])) best = i
    }
    return best
  }

  const steps: VWStep[] = []
  let aliveCount = n
  let lastArea = 0 // ranking area of the point removed most recently
  let best = findSmallest()

  while (aliveCount > minKeep) {
    const p = prev[best]
    const q = next[best]
    lastArea = area[best]
    // Remove `best`: unlink it so p and q become neighbours.
    alive[best] = false
    aliveCount--
    next[p] = q
    prev[q] = p
    // The two neighbours now have a new triangle. Recompute (with the monotonic rule).
    for (const v of [p, q]) {
      if (canGo(v)) {
        rawArea[v] = triangleArea(points[prev[v]], points[v], points[next[v]])
        area[v] = Math.max(rawArea[v], lastArea)
      }
    }
    const removed = best
    best = aliveCount > minKeep ? findSmallest() : -1
    steps.push({
      index: removed,
      area: lastArea,
      rawArea: rawArea[removed],
      prev: p,
      next: q,
      smallestRemaining: best < 0 ? null : area[best],
    })
  }
  return steps
}

/** Which points are still there after the first `removeCount` steps? (true = kept) */
export function keptMask(length: number, steps: readonly VWStep[], removeCount: number): boolean[] {
  const kept: boolean[] = new Array(length).fill(true)
  for (let i = 0; i < removeCount && i < steps.length; i++) kept[steps[i].index] = false
  return kept
}

/** Simplify down to n points (never fewer than 2 for a line or 3 for a polygon). */
export function simplifyToCount(points: readonly Pt[], closed: boolean, n: number): Pt[] {
  const steps = visvalingamSteps(points, closed)
  const minKeep = Math.min(points.length, closed ? 3 : 2)
  const target = Math.max(minKeep, Math.min(points.length, Math.round(n)))
  const kept = keptMask(points.length, steps, points.length - target)
  return points.filter((_, i) => kept[i])
}

/** Remove every point whose ranking area is below minArea (the areas never decrease, so that is a prefix of the steps). */
export function simplifyByArea(points: readonly Pt[], closed: boolean, minArea: number): Pt[] {
  const steps = visvalingamSteps(points, closed)
  let removeCount = 0
  while (removeCount < steps.length && steps[removeCount].area < minArea) removeCount++
  const kept = keptMask(points.length, steps, removeCount)
  return points.filter((_, i) => kept[i])
}
