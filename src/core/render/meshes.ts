// meshes.ts - more shapes (the cube is in mesh.ts).
// Every triangle is wound counter-clockwise when seen from OUTSIDE, so its normal
// (cross product of two edges) points outward.

import { createCube, type Mesh } from './mesh'

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

/**
 * A simple aircraft as a wireframe (edges only, no triangles), nose along +x,
 * wings along +-y, tail fin up +z. About 2 units long, so a turn is easy to see.
 */
export function createAircraft(): Mesh {
  return {
    vertices: [
      [1, 0, 0], // 0 nose
      [-1, 0, 0], // 1 tail end
      [0.2, 0, 0], // 2 wing front (where the wings meet the body)
      [-0.3, 0.9, 0], // 3 right wing tip
      [-0.3, -0.9, 0], // 4 left wing tip
      [-0.35, 0, 0], // 5 wing back
      [-1, 0.4, 0], // 6 tail plane right tip
      [-1, -0.4, 0], // 7 tail plane left tip
      [-1, 0, 0.45], // 8 fin top
      [-0.65, 0, 0], // 9 fin front
      [-0.75, 0, 0], // 10 tail plane front
    ],
    triangles: [],
    edges: [
      [0, 1], // body
      [2, 3], [2, 4], [3, 5], [4, 5], // wings
      [10, 6], [6, 1], [1, 7], [7, 10], // tail plane
      [9, 8], [8, 1], // fin
    ],
  }
}

/** A box of the given width (x), height (y) and depth (z), centred on the origin. */
export function createBox(width: number, height: number, depth: number): Mesh {
  const cube = createCube() // corners at +-0.5, outward counter-clockwise triangles
  return {
    vertices: cube.vertices.map((v) => [v[0] * width, v[1] * height, v[2] * depth] as const),
    triangles: cube.triangles.map((t) => [...t] as [number, number, number]),
    edges: cube.edges.map((e) => [...e] as [number, number]),
  }
}

/**
 * A closed cylinder standing along y, centred on the origin (y from -height/2 to +height/2).
 * Vertices: the bottom ring, the top ring, then the bottom centre and the top centre.
 */
export function createCylinder(radius: number, height: number, segments: number): Mesh {
  const half = height / 2
  const vertices: Mesh['vertices'] = []
  for (const y of [-half, half]) {
    for (let s = 0; s < segments; s++) {
      const angle = (2 * Math.PI * s) / segments
      vertices.push([radius * Math.cos(angle), y, radius * Math.sin(angle)])
    }
  }
  const bottomCentre = vertices.length
  vertices.push([0, -half, 0])
  const topCentre = vertices.length
  vertices.push([0, half, 0])

  const triangles: [number, number, number][] = []
  for (let s = 0; s < segments; s++) {
    const next = (s + 1) % segments
    const bottom = s // ring indices: bottom ring 0..n-1, top ring n..2n-1
    const bottomNext = next
    const top = segments + s
    const topNext = segments + next
    // The side: one quad per segment, two triangles, counter-clockwise seen from outside.
    triangles.push([top, topNext, bottom], [topNext, bottomNext, bottom])
    triangles.push([topCentre, topNext, top]) // top cap, facing up
    triangles.push([bottom, bottomNext, bottomCentre]) // bottom cap, facing down
  }
  return { vertices, triangles, edges: edgesFromTriangles(triangles) }
}

/**
 * A flat floor on y = 0 facing up, `size` wide and deep, cut into divisions x divisions squares.
 * Many small squares (instead of one big one) so lights can shade the floor differently from place to place.
 */
export function createGround(size: number, divisions: number): Mesh {
  const half = size / 2
  const vertices: Mesh['vertices'] = []
  for (let i = 0; i <= divisions; i++) {
    for (let j = 0; j <= divisions; j++) {
      vertices.push([-half + (size * j) / divisions, 0, -half + (size * i) / divisions])
    }
  }
  const at = (i: number, j: number) => i * (divisions + 1) + j
  const triangles: [number, number, number][] = []
  for (let i = 0; i < divisions; i++) {
    for (let j = 0; j < divisions; j++) {
      const a = at(i, j) // x-, z-
      const b = at(i, j + 1) // x+, z-
      const c = at(i + 1, j + 1) // x+, z+
      const d = at(i + 1, j) // x-, z+
      triangles.push([a, d, c], [a, c, b])
    }
  }
  return { vertices, triangles, edges: edgesFromTriangles(triangles) }
}
