// outline.ts - the outline drawn around the selected object.
//
// The outline of a solid is made of the edges where a triangle that faces the camera meets one that
// faces away (the "silhouette"), plus the border edges of a one-sided surface that faces the camera.
// We reuse the back-face test from culling.ts to decide which triangles face the camera.

import { transformPoint, type Mat4 } from '../math/mat4'
import { projectToScreen, type Camera } from './camera'
import { isBackFacingView } from './culling'
import type { Color, Framebuffer } from './framebuffer'
import { drawLine } from './line'
import type { Mesh } from './mesh'

/** The edges (pairs of vertex numbers) that form the outline of the mesh as seen from the camera. */
export function silhouetteEdges(mesh: Mesh, model: Mat4, camera: Camera): [number, number][] {
  const world = mesh.vertices.map((v) => transformPoint(model, v))
  // For every edge count how many of its triangles face the camera and how many face away.
  const edges = new Map<string, { a: number; b: number; front: number; back: number }>()
  for (const [i, j, k] of mesh.triangles) {
    const front = !isBackFacingView(world[i], world[j], world[k], camera.eye)
    for (const [a, b] of [[i, j], [j, k], [k, i]]) {
      const key = `${Math.min(a, b)}-${Math.max(a, b)}`
      const entry = edges.get(key) ?? { a, b, front: 0, back: 0 }
      if (front) entry.front++
      else entry.back++
      edges.set(key, entry)
    }
  }
  const outline: [number, number][] = []
  for (const e of edges.values()) {
    // front meets back: a silhouette edge. Only one triangle and it faces us: a border edge.
    if (e.front >= 1 && (e.back >= 1 || e.front === 1)) outline.push([e.a, e.b])
  }
  return outline
}

/** Draw the outline, 2 pixels thick, on top of everything (so a hidden object is still easy to find). */
export function drawOutline(fb: Framebuffer, mesh: Mesh, model: Mat4, camera: Camera, color: Color): void {
  const screen = mesh.vertices.map((v) => projectToScreen(v, model, camera, fb.width, fb.height))
  for (const [a, b] of silhouetteEdges(mesh, model, camera)) {
    const p = screen[a]
    const q = screen[b]
    if (!p || !q) continue // an end is behind the camera: skip this edge
    const [x0, y0, x1, y1] = [Math.round(p[0]), Math.round(p[1]), Math.round(q[0]), Math.round(q[1])]
    drawLine(fb, x0, y0, x1, y1, color)
    drawLine(fb, x0 + 1, y0, x1 + 1, y1, color) // a second line one pixel over makes it thicker
    drawLine(fb, x0, y0 + 1, x1, y1 + 1, color)
  }
}
