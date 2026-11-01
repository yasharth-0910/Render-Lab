// renderMesh.ts - draws a whole mesh with optional back-face culling.

import { identity, transformPoint, type Mat4 } from '../math/mat4'
import { add, dot, normalize, scale, type Vec3 } from '../math/vec3'
import { projectToScreen, type Camera } from './camera'
import { cullTriangles, type CullMode } from './culling'
import { barycentric, fillTriangle, type DepthBuffer, type ScreenPoint } from './fill'
import type { Color, Framebuffer } from './framebuffer'
import { drawLine } from './line'
import type { Mesh } from './mesh'

export type RenderOptions = {
  cullingOn: boolean // skip back-facing triangles?
  mode: CullMode // which facing test to use
  drawStyle: 'wireframe' | 'filled' | 'both'
  colorByFacing: boolean // front green, back red
  showNormals?: boolean // draw a short line from each triangle's center along its normal
  highlight?: number | null // index of one triangle to outline in yellow
}

export type RenderStats = { total: number; visible: number; culled: number }

const FRONT: Color = [0, 200, 0, 255]
const BACK: Color = [220, 40, 40, 255]
const HIGHLIGHT: Color = [255, 230, 0, 255]
const NORMAL_LINE: Color = [0, 220, 255, 255]
const LIGHT: Vec3 = normalize([0.5, 0.8, 0.6]) // direction towards a light, for plain shading

// Plain grey-blue shading: brighter when the triangle faces the light.
function shaded(normal: Vec3): Color {
  const k = 0.35 + 0.65 * Math.max(0, dot(normal, LIGHT))
  return [170 * k, 180 * k, 220 * k, 255]
}

// Draw the three edges of a screen triangle with Bresenham.
function outline(fb: Framebuffer, p0: ScreenPoint, p1: ScreenPoint, p2: ScreenPoint, color: Color): void {
  const r = Math.round
  drawLine(fb, r(p0[0]), r(p0[1]), r(p1[0]), r(p1[1]), color)
  drawLine(fb, r(p1[0]), r(p1[1]), r(p2[0]), r(p2[1]), color)
  drawLine(fb, r(p2[0]), r(p2[1]), r(p0[0]), r(p0[1]), color)
}

/**
 * Draw the mesh. With culling on, back-facing triangles are skipped completely.
 * With culling off, everything is drawn and (if colorByFacing) back faces show in red.
 * Triangles with a corner behind the camera are skipped (no clipping yet).
 * Returns the counts: total triangles, how many were drawn, how many were culled.
 */
export function renderMesh(
  fb: Framebuffer, depth: DepthBuffer, mesh: Mesh, model: Mat4, camera: Camera, options: RenderOptions,
): RenderStats {
  const cull = cullTriangles(mesh, model, camera, options.mode)
  const backFacing = new Set(cull.culled)
  const toDraw = options.cullingOn ? cull.visible : [...cull.visible, ...cull.culled]
  const screen = mesh.vertices.map((v) => projectToScreen(v, model, camera, fb.width, fb.height))
  const { drawStyle, colorByFacing } = options

  for (const t of toDraw) {
    const [i, j, k] = mesh.triangles[t]
    const p0 = screen[i]
    const p1 = screen[j]
    const p2 = screen[k]
    if (!p0 || !p1 || !p2) continue

    const facingColor = backFacing.has(t) ? BACK : FRONT
    const isHighlighted = options.highlight === t

    if (drawStyle === 'filled' || drawStyle === 'both') {
      const fill = isHighlighted ? HIGHLIGHT : colorByFacing ? facingColor : shaded(cull.normals[t])
      fillTriangle(fb, depth, p0, p1, p2, fill)
    }
    if (drawStyle === 'wireframe' || drawStyle === 'both') {
      // Lines over a filled triangle are dark; otherwise white (or the facing color).
      const plain: Color = drawStyle === 'both' ? [20, 20, 20, 255] : [255, 255, 255, 255]
      outline(fb, p0, p1, p2, colorByFacing ? facingColor : plain)
    }
    if (isHighlighted) outline(fb, p0, p1, p2, HIGHLIGHT)

    if (options.showNormals) {
      // From the triangle's center, a short line along its (world-space) normal.
      const world = [i, j, k].map((v) => transformPoint(model, mesh.vertices[v]))
      const center = scale(add(add(world[0], world[1]), world[2]), 1 / 3)
      const tip = add(center, scale(cull.normals[t], 0.25))
      const c = projectToScreen(center, identity(), camera, fb.width, fb.height)
      const e = projectToScreen(tip, identity(), camera, fb.width, fb.height)
      if (c && e) drawLine(fb, Math.round(c[0]), Math.round(c[1]), Math.round(e[0]), Math.round(e[1]), NORMAL_LINE)
    }
  }
  const culled = options.cullingOn ? cull.culled.length : 0
  return { total: mesh.triangles.length, visible: mesh.triangles.length - culled, culled }
}

/**
 * Which triangle is under the screen point (px, py)? Returns the nearest one that is
 * actually drawn (culled triangles cannot be picked when culling is on), or null.
 */
export function pickTriangle(
  width: number, height: number, mesh: Mesh, model: Mat4, camera: Camera, options: RenderOptions,
  px: number, py: number,
): { triangle: number; depth: number } | null {
  const cull = cullTriangles(mesh, model, camera, options.mode)
  const candidates = options.cullingOn ? cull.visible : [...cull.visible, ...cull.culled]
  const screen = mesh.vertices.map((v) => projectToScreen(v, model, camera, width, height))
  let best: { triangle: number; depth: number } | null = null
  for (const t of candidates) {
    const [i, j, k] = mesh.triangles[t]
    const p0 = screen[i]
    const p1 = screen[j]
    const p2 = screen[k]
    if (!p0 || !p1 || !p2) continue
    const w = barycentric(p0, p1, p2, px, py)
    if (!w || w[0] < 0 || w[1] < 0 || w[2] < 0) continue
    const z = w[0] * p0[2] + w[1] * p1[2] + w[2] * p2[2]
    if (best === null || z < best.depth) best = { triangle: t, depth: z }
  }
  return best
}
