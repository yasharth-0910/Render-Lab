// scene.ts - drawing a whole lit scene: solid objects with flat shading, depth-tested 3D lines,
// and a sky gradient. Built from the pieces we already have: projection, culling, the depth
// buffer, fillTriangle and Bresenham.

import { transformPoint, type Mat4 } from '../math/mat4'
import { cross, length, normalize, sub, type Vec3 } from '../math/vec3'
import { projectionMatrix, projectToScreen, viewMatrix, type Camera } from './camera'
import { isBackFacingView } from './culling'
import { fillTriangle, type DepthBuffer } from './fill'
import type { Framebuffer } from './framebuffer'
import { bresenhamSteps } from './line'
import { fogMix, lightAt, type Lighting, type Material, type Rgb } from './lighting'
import type { Mesh } from './mesh'

export type SceneObject = { mesh: Mesh; model: Mat4; material: Material }

export type SceneOptions = {
  lighting: Lighting
  fog?: { color: Rgb; density: number } // colour 0..1
  cullBackFaces?: boolean // default true
}

/**
 * Draw every object. Each triangle is lit once (flat shading): its colour comes from its normal and
 * its centre, then fog, then fillTriangle with the depth test.
 * Triangles with a corner behind the camera are skipped (there is no clipping).
 */
export function renderShaded(
  fb: Framebuffer, depth: DepthBuffer, objects: SceneObject[], camera: Camera, options: SceneOptions,
): { triangles: number; drawn: number } {
  const fogColor = options.fog ? options.fog.color.map((c) => c * 255) : null
  const cull = options.cullBackFaces !== false
  let triangles = 0
  let drawn = 0

  for (const obj of objects) {
    const world = obj.mesh.vertices.map((v) => transformPoint(obj.model, v))
    const screen = obj.mesh.vertices.map((v) => projectToScreen(v, obj.model, camera, fb.width, fb.height))
    for (const [i, j, k] of obj.mesh.triangles) {
      triangles++
      const a = world[i]
      const b = world[j]
      const c = world[k]
      if (cull && isBackFacingView(a, b, c, camera.eye)) continue
      const p0 = screen[i]
      const p1 = screen[j]
      const p2 = screen[k]
      if (!p0 || !p1 || !p2) continue
      const normal = normalize(cross(sub(b, a), sub(c, a)))
      if (normal[0] === 0 && normal[1] === 0 && normal[2] === 0) continue // a triangle with no area

      const centre: Vec3 = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3]
      let colour: readonly number[] = lightAt(obj.material, centre, normal, options.lighting)
      if (fogColor && options.fog) colour = fogMix(colour, length(sub(centre, camera.eye)), fogColor, options.fog.density)
      fillTriangle(fb, depth, p0, p1, p2, [colour[0], colour[1], colour[2], 255])
      drawn++
    }
  }
  return { triangles, drawn }
}

/** The distance in front of the camera that an NDC depth value z stands for (inverse of the projection's depth). */
export function viewDistanceFromNdcZ(z: number, near: number, far: number): number {
  return (2 * far * near) / (far + near - z * (far - near))
}

export type LineSegment = { a: Vec3; b: Vec3 }

/**
 * Draw 3D line segments with the depth test (they hide behind solid things but do not hide anything).
 * A segment that reaches behind the camera is cut at the near plane first. Colours are 0..255; the fog
 * is applied per pixel from the depth, so far lines fade away.
 */
export function renderLines3D(
  fb: Framebuffer, depth: DepthBuffer, segments: readonly LineSegment[], camera: Camera,
  color: readonly [number, number, number], fog?: { color: Rgb; density: number },
): void {
  const view = viewMatrix(camera)
  const projection = projectionMatrix(camera)
  const fogColor = fog ? fog.color.map((c) => c * 255) : null

  for (const segment of segments) {
    let va = transformPoint(view, segment.a) // camera space: visible things have NEGATIVE z
    let vb = transformPoint(view, segment.b)
    if (va[2] > -camera.near && vb[2] > -camera.near) continue
    // Cut the part that is behind the near plane.
    if (va[2] > -camera.near) {
      const t = (-camera.near - va[2]) / (vb[2] - va[2])
      va = [va[0] + (vb[0] - va[0]) * t, va[1] + (vb[1] - va[1]) * t, -camera.near]
    } else if (vb[2] > -camera.near) {
      const t = (-camera.near - vb[2]) / (va[2] - vb[2])
      vb = [vb[0] + (va[0] - vb[0]) * t, vb[1] + (va[1] - vb[1]) * t, -camera.near]
    }
    const na = transformPoint(projection, va) // NDC
    const nb = transformPoint(projection, vb)
    const x0 = Math.round(((na[0] + 1) / 2) * fb.width)
    const y0 = Math.round(((1 - na[1]) / 2) * fb.height)
    const x1 = Math.round(((nb[0] + 1) / 2) * fb.width)
    const y1 = Math.round(((1 - nb[1]) / 2) * fb.height)
    if (Math.abs(x1 - x0) > 200000 || Math.abs(y1 - y0) > 200000) continue

    const steps = bresenhamSteps(x0, y0, x1, y1)
    steps.forEach((step, n) => {
      const t = steps.length > 1 ? n / (steps.length - 1) : 0
      const z = na[2] + (nb[2] - na[2]) * t // depth is linear across the screen
      if (!depth.isNearer(step.x, step.y, z - 2e-4)) return
      let colour: readonly number[] = color
      if (fogColor && fog) colour = fogMix(color, viewDistanceFromNdcZ(z, camera.near, camera.far), fogColor, fog.density)
      fb.setPixel(step.x, step.y, colour[0], colour[1], colour[2], 255)
    })
  }
}

/** Fill the whole image with a vertical blend from `top` to `bottom` (colours 0..255). */
export function clearGradient(fb: Framebuffer, top: readonly number[], bottom: readonly number[]): void {
  for (let y = 0; y < fb.height; y++) {
    const t = fb.height === 1 ? 0 : y / (fb.height - 1)
    const r = top[0] + (bottom[0] - top[0]) * t
    const g = top[1] + (bottom[1] - top[1]) * t
    const b = top[2] + (bottom[2] - top[2]) * t
    for (let x = 0; x < fb.width; x++) fb.setPixel(x, y, r, g, b, 255)
  }
}
