import { describe, it, expect } from 'vitest'
import { renderShaded, renderLines3D, viewDistanceFromNdcZ, clearGradient, type SceneObject } from './scene'
import { Framebuffer } from './framebuffer'
import { DepthBuffer } from './fill'
import { projectToScreen, type Camera } from './camera'
import type { Lighting } from './lighting'
import type { Mesh } from './mesh'
import { identity, translate } from '../math/mat4'

const cam: Camera = { eye: [0, 0, 3], target: [0, 0, 0], up: [0, 1, 0], fovY: Math.PI / 3, aspect: 1, near: 0.1, far: 100 }
const flat: Lighting = { ambient: [1, 1, 1], lights: [] } // every face gets the same light
// A big triangle facing +z (towards the camera) around the middle of the screen.
const tri: Mesh = { vertices: [[-1.5, -1.5, 0], [1.5, -1.5, 0], [0, 1.5, 0]], triangles: [[0, 1, 2]], edges: [] }
const away: Mesh = { vertices: [[-1.5, -1.5, 0], [0, 1.5, 0], [1.5, -1.5, 0]], triangles: [[0, 1, 2]], edges: [] }
const red = { color: [1, 0, 0] as const }
const green = { color: [0, 1, 0] as const }

function fresh() {
  const fb = new Framebuffer(40, 40)
  fb.clear(0, 0, 0, 255)
  return { fb, depth: new DepthBuffer(40, 40) }
}
const opts = { lighting: flat, cullBackFaces: true }

describe('renderShaded', () => {
  it('draws a lit triangle in its own colour', () => {
    const { fb, depth } = fresh()
    const r = renderShaded(fb, depth, [{ mesh: tri, model: identity(), material: red }], cam, opts)
    const [rr, g, b] = fb.getPixel(20, 22)
    expect(rr).toBeGreaterThan(100)
    expect(g).toBe(0)
    expect(b).toBe(0)
    expect(r).toEqual({ triangles: 1, drawn: 1, culled: 0 })
  })
  it('the nearer triangle wins, whatever the draw order', () => {
    for (const nearFirst of [true, false]) {
      const { fb, depth } = fresh()
      const far: SceneObject = { mesh: tri, model: identity(), material: red }
      const near: SceneObject = { mesh: tri, model: translate(0, 0, 1), material: green }
      renderShaded(fb, depth, nearFirst ? [near, far] : [far, near], cam, opts)
      expect(fb.getPixel(20, 22)[1]).toBeGreaterThan(100)
      expect(fb.getPixel(20, 22)[0]).toBe(0)
    }
  })
  it('skips back-facing triangles when culling is on, draws them when it is off', () => {
    const a = fresh()
    expect(renderShaded(a.fb, a.depth, [{ mesh: away, model: identity(), material: red }], cam, opts).drawn).toBe(0)
    const b = fresh()
    expect(renderShaded(b.fb, b.depth, [{ mesh: away, model: identity(), material: red }], cam, { ...opts, cullBackFaces: false }).drawn).toBe(1)
  })
  it('counts the culled triangles: total = drawn + culled + skipped', () => {
    const { fb, depth } = fresh()
    const r = renderShaded(fb, depth, [
      { mesh: tri, model: identity(), material: red }, // faces us: drawn
      { mesh: away, model: identity(), material: red }, // faces away: culled
      { mesh: away, model: translate(0, 0, 5), material: red }, // behind the camera but turned towards it: skipped
    ], cam, opts)
    expect(r).toEqual({ triangles: 3, drawn: 1, culled: 1 })
  })
  it('wireframe style draws only the edges: the inside of the triangle stays empty', () => {
    const { fb, depth } = fresh()
    renderShaded(fb, depth, [{ mesh: tri, model: identity(), material: red }], cam, { ...opts, style: 'wireframe' })
    expect(fb.getPixel(20, 22)).toEqual([0, 0, 0, 255]) // the middle is not filled
    let lit = 0
    for (let y = 0; y < 40; y++) for (let x = 0; x < 40; x++) if (fb.getPixel(x, y)[0] > 0) lit++
    expect(lit).toBeGreaterThan(20) // but the edges are there
  })
  it('wireframe also skips back-facing triangles when culling is on', () => {
    const { fb, depth } = fresh()
    const r = renderShaded(fb, depth, [{ mesh: away, model: identity(), material: red }], cam, { ...opts, style: 'wireframe' })
    expect(r.culled).toBe(1)
  })
  it('fog pulls far colours towards the fog colour', () => {
    const plain = fresh()
    renderShaded(plain.fb, plain.depth, [{ mesh: tri, model: identity(), material: red }], cam, opts)
    const foggy = fresh()
    renderShaded(foggy.fb, foggy.depth, [{ mesh: tri, model: identity(), material: red }], cam, { ...opts, fog: { color: [1, 1, 1], density: 0.5 } })
    expect(foggy.fb.getPixel(20, 22)[1]).toBeGreaterThan(plain.fb.getPixel(20, 22)[1] + 30)
  })
  it('skips triangles with a corner behind the camera instead of crashing', () => {
    const { fb, depth } = fresh()
    expect(() => renderShaded(fb, depth, [{ mesh: tri, model: translate(0, 0, 5), material: red }], cam, opts)).not.toThrow()
  })
})

describe('renderLines3D', () => {
  const line = [{ a: [-2, 0, 0] as const, b: [2, 0, 0] as const }]
  it('draws a line of the asked colour', () => {
    const { fb, depth } = fresh()
    renderLines3D(fb, depth, line, cam, [255, 0, 255])
    let lit = 0
    for (let x = 0; x < 40; x++) if (fb.getPixel(x, 20)[0] === 255 || fb.getPixel(x, 19)[0] === 255 || fb.getPixel(x, 21)[0] === 255) lit++
    expect(lit).toBeGreaterThan(10)
  })
  it('is hidden by a nearer solid triangle (depth test)', () => {
    const { fb, depth } = fresh()
    renderShaded(fb, depth, [{ mesh: tri, model: translate(0, 0, 1), material: green }], cam, opts)
    renderLines3D(fb, depth, line, cam, [255, 0, 255])
    expect(fb.getPixel(20, 20)[0]).toBe(0) // the green triangle is still on top at the middle
    expect(fb.getPixel(20, 20)[1]).toBeGreaterThan(100)
  })
  it('a line that runs behind the camera is clipped, not dropped', () => {
    const { fb, depth } = fresh()
    renderLines3D(fb, depth, [{ a: [0, -0.5, 10], b: [0, -0.5, -10] }], cam, [255, 255, 0])
    let lit = 0
    for (let y = 0; y < 40; y++) for (let x = 0; x < 40; x++) if (fb.getPixel(x, y)[0] === 255) lit++
    expect(lit).toBeGreaterThan(5)
  })
})

describe('helpers', () => {
  it('viewDistanceFromNdcZ undoes the projection: a point 5 units ahead comes back as distance 5', () => {
    const p = projectToScreen([0, 0, -2], identity(), cam, 100, 100)! // eye is at z = 3, so 5 ahead
    expect(viewDistanceFromNdcZ(p[2], cam.near, cam.far)).toBeCloseTo(5, 6)
  })
  it('clearGradient: top row is the top colour, bottom row the bottom colour', () => {
    const fb = new Framebuffer(4, 10)
    clearGradient(fb, [100, 0, 0], [0, 0, 100])
    expect(fb.getPixel(0, 0).slice(0, 3)).toEqual([100, 0, 0])
    expect(fb.getPixel(3, 9).slice(0, 3)).toEqual([0, 0, 100])
    expect(fb.getPixel(0, 5)[3]).toBe(255)
  })
})
