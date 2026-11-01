// transparent.ts - the second drawing pass, for see-through triangles.
//
// Order of a frame:  1) draw all SOLID things (they write the depth buffer),
//                    2) draw the see-through things here.
// Rules for the see-through pass:
//  - Depth test ON: a see-through triangle behind something solid is hidden.
//  - Depth write OFF: see-through triangles must not hide each other.
//  - Sort BACK TO FRONT: "over" is not commutative, so the farthest triangle must be
//    blended first and the nearest last. Without the sort the colours come out wrong.

import { transformPoint, type Mat4 } from '../math/mat4'
import { add, scale } from '../math/vec3'
import type { Rgba } from './alpha'
import { projectToScreen, viewMatrix, type Camera } from './camera'
import { cullTriangles, type CullMode } from './culling'
import { fillTriangleBlended, type DepthBuffer, type ScreenPoint } from './fill'
import type { Framebuffer } from './framebuffer'
import type { Mesh } from './mesh'

export type TransparentItem = { mesh: Mesh; model: Mat4; color: Rgba }

export type TransparentOptions = {
  cullingOn: boolean // skip back-facing triangles?
  mode: CullMode
  sortBackToFront: boolean // false = draw in the order given (shows the wrong result)
}

// One triangle ready to draw.
type Job = { p0: ScreenPoint; p1: ScreenPoint; p2: ScreenPoint; color: Rgba; viewZ: number }

/** Draw all see-through items. Returns the triangle count and how many pixels were blended. */
export function renderTransparent(
  fb: Framebuffer, depth: DepthBuffer, items: TransparentItem[], camera: Camera, options: TransparentOptions,
): { triangles: number; pixelsBlended: number } {
  const view = viewMatrix(camera)
  const jobs: Job[] = []

  for (const item of items) {
    const cull = cullTriangles(item.mesh, item.model, camera, options.mode)
    const list = options.cullingOn ? cull.visible : [...cull.visible, ...cull.culled]
    const screen = item.mesh.vertices.map((v) => projectToScreen(v, item.model, camera, fb.width, fb.height))
    for (const t of list) {
      const [i, j, k] = item.mesh.triangles[t]
      const p0 = screen[i]
      const p1 = screen[j]
      const p2 = screen[k]
      if (!p0 || !p1 || !p2) continue // a corner is behind the camera: skip
      // Distance of the triangle's centre along the view direction.
      // In camera space the camera looks down -z, so FARTHER = MORE NEGATIVE z.
      const world = [i, j, k].map((v) => transformPoint(item.model, item.mesh.vertices[v]))
      const centre = scale(add(add(world[0], world[1]), world[2]), 1 / 3)
      jobs.push({ p0, p1, p2, color: item.color, viewZ: transformPoint(view, centre)[2] })
    }
  }

  // Back to front = most negative z first. (Array.sort keeps equal ones in order.)
  if (options.sortBackToFront) jobs.sort((a, b) => a.viewZ - b.viewZ)

  let pixelsBlended = 0
  for (const job of jobs) pixelsBlended += fillTriangleBlended(fb, depth, job.p0, job.p1, job.p2, job.color)
  return { triangles: jobs.length, pixelsBlended }
}
