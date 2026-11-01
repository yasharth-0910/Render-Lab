// render.ts - draws a mesh as a wireframe.

import type { Mat4 } from '../math/mat4'
import { projectToScreen, type Camera } from './camera'
import type { Color, Framebuffer } from './framebuffer'
import { drawLine } from './line'
import type { Mesh } from './mesh'

/**
 * Project every vertex to the screen once, then draw one line per mesh edge.
 * An edge with an end behind the camera is skipped (a real renderer would clip it).
 */
export function renderWireframe(
  fb: Framebuffer,
  mesh: Mesh,
  model: Mat4,
  cam: Camera,
  color: Color = [255, 255, 255, 255],
): void {
  const screen = mesh.vertices.map((v) => projectToScreen(v, model, cam, fb.width, fb.height))
  for (const [i, j] of mesh.edges) {
    const a = screen[i]
    const b = screen[j]
    if (a === null || b === null) continue
    drawLine(fb, Math.round(a[0]), Math.round(a[1]), Math.round(b[0]), Math.round(b[1]), color)
  }
}
