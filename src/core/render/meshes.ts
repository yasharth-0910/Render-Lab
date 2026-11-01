// meshes.ts - more shapes (the cube is in mesh.ts).
// Every triangle is wound counter-clockwise when seen from OUTSIDE, so its normal
// (cross product of two edges) points outward.

import type { Mesh } from './mesh'

// Build the list of unique edges from the triangles, so wireframes have no repeats.
function edgesFromTriangles(triangles: [number, number, number][]): [number, number][] {
  const seen = new Set<string>()
  const edges: [number, number][] = []
  for (const [a, b, c] of triangles) {
    for (const [i, j] of [[a, b], [b, c], [c, a]]) {
      const key = `${Math.min(i, j)}-${Math.max(i, j)}`
      if (!seen.has(key)) {
        seen.add(key)
        edges.push([i, j])
      }
    }
  }
  return edges
}

/**
 * A sphere of radius 0.5 centered on the origin.
 * `segments` = slices around the y axis (like orange segments, at least 3).
 * `rings` = bands from the top pole to the bottom pole (at least 2).
 * Vertices: the top pole, then (rings - 1) rings of `segments` points, then the bottom pole.
 */
export function createUVSphere(segments: number, rings: number): Mesh {
  const radius = 0.5
  const vertices: Mesh['vertices'] = [[0, radius, 0]] // index 0 = top pole
  for (let r = 1; r < rings; r++) {
    const phi = (Math.PI * r) / rings // angle down from the top pole
    for (let s = 0; s < segments; s++) {
      const theta = (2 * Math.PI * s) / segments // angle around the y axis
      vertices.push([
        radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.cos(phi),
        radius * Math.sin(phi) * Math.sin(theta),
      ])
    }
  }
  const bottom = vertices.length
  vertices.push([0, -radius, 0])

  // Index of the vertex in ring r (1-based) at segment s; s wraps around.
  const ring = (r: number, s: number) => 1 + (r - 1) * segments + (s % segments)

  const triangles: [number, number, number][] = []
  for (let s = 0; s < segments; s++) {
    triangles.push([0, ring(1, s + 1), ring(1, s)]) // top cap
    for (let r = 1; r < rings - 1; r++) {
      // One quad between ring r and ring r + 1, split into two triangles.
      const a = ring(r, s)
      const b = ring(r, s + 1)
      const c = ring(r + 1, s + 1)
      const d = ring(r + 1, s)
      triangles.push([a, b, d], [b, c, d])
    }
    triangles.push([ring(rings - 1, s), ring(rings - 1, s + 1), bottom]) // bottom cap
  }
  return { vertices, triangles, edges: edgesFromTriangles(triangles) }
}

/** A flat square on the xz plane (y = 0), `size` wide, facing up (+y). */
export function createPlane(size: number): Mesh {
  const h = size / 2
  return {
    vertices: [[-h, 0, -h], [h, 0, -h], [h, 0, h], [-h, 0, h]],
    triangles: [[0, 3, 2], [0, 2, 1]],
    edges: [[0, 1], [1, 2], [2, 3], [3, 0]],
  }
}
