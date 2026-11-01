// mesh.ts - a 3D shape described by numbers.
//
// A mesh is a list of corner points (vertices), a list of triangles that say
// which three vertices make each face piece, and a list of edges for wireframes.
// Triangles are wound COUNTER-CLOCKWISE when seen from outside the shape, so that
// the cross product of two edges points outward (back-face culling uses this in step 4).

import type { Vec3 } from '../math/vec3'

export type Mesh = {
  vertices: Vec3[]
  triangles: [number, number, number][] // each number is an index into vertices
  edges: [number, number][] // each pair is two indices into vertices
}

/** A cube with side length 1, centered on the origin (corners at +-0.5). */
export function createCube(): Mesh {
  const h = 0.5
  return {
    vertices: [
      [-h, -h, -h], // 0
      [h, -h, -h], // 1
      [h, h, -h], // 2
      [-h, h, -h], // 3
      [-h, -h, h], // 4
      [h, -h, h], // 5
      [h, h, h], // 6
      [-h, h, h], // 7
    ],
    // Two triangles per face, 6 faces = 12 triangles.
    triangles: [
      [4, 5, 6], [4, 6, 7], // front  (+z)
      [1, 0, 3], [1, 3, 2], // back   (-z)
      [5, 1, 2], [5, 2, 6], // right  (+x)
      [0, 4, 7], [0, 7, 3], // left   (-x)
      [7, 6, 2], [7, 2, 3], // top    (+y)
      [0, 1, 5], [0, 5, 4], // bottom (-y)
    ],
    // 12 edges: back square, front square, and 4 edges joining them.
    edges: [
      [0, 1], [1, 2], [2, 3], [3, 0],
      [4, 5], [5, 6], [6, 7], [7, 4],
      [0, 4], [1, 5], [2, 6], [3, 7],
    ],
  }
}
