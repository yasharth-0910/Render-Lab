import { describe, it, expect } from 'vitest'
import { silhouetteEdges, drawOutline } from './outline'
import { Framebuffer } from './framebuffer'
import { createCube } from './mesh'
import { createPlane, createUVSphere } from './meshes'
import { identity, translate } from '../math/mat4'
import type { Camera } from './camera'
import type { Vec3 } from '../math/vec3'

const camAt = (eye: Vec3): Camera => ({ eye, target: [0, 0, 0], up: [0, 1, 0], fovY: Math.PI / 3, aspect: 1, near: 0.1, far: 100 })

describe('silhouetteEdges', () => {
  it('a cube seen from a corner has a hexagon outline: 6 edges', () => {
    expect(silhouetteEdges(createCube(), identity(), camAt([3, 3, 3])).length).toBe(6)
  })
  it('a cube seen face-on has a square outline: 4 edges (the face diagonal is not part of it)', () => {
    expect(silhouetteEdges(createCube(), identity(), camAt([0, 0, 3])).length).toBe(4)
  })
  it('a single-sided plane seen from the front has its 4 border edges, from behind none', () => {
    expect(silhouetteEdges(createPlane(2), identity(), camAt([0, 5, 1])).length).toBe(4)
    expect(silhouetteEdges(createPlane(2), identity(), camAt([0, -5, 1])).length).toBe(0)
  })
  it('a sphere has an outline, and it is much shorter than all its edges', () => {
    const sphere = createUVSphere(16, 10)
    const outline = silhouetteEdges(sphere, identity(), camAt([0, 0.5, 3]))
    expect(outline.length).toBeGreaterThan(8)
    expect(outline.length).toBeLessThan(sphere.edges.length / 3)
  })
  it('every outline edge joins two real vertices', () => {
    const cube = createCube()
    for (const [a, b] of silhouetteEdges(cube, identity(), camAt([3, 2, 4]))) {
      expect(a >= 0 && a < 8 && b >= 0 && b < 8).toBe(true)
    }
  })
})

describe('drawOutline', () => {
  const accent = [76, 194, 255, 255] as const
  function countAccent(fb: Framebuffer) {
    let n = 0
    for (let y = 0; y < fb.height; y++) for (let x = 0; x < fb.width; x++) {
      const p = fb.getPixel(x, y)
      if (p[0] === 76 && p[1] === 194 && p[2] === 255) n++
    }
    return n
  }
  it('draws the outline in the given colour', () => {
    const fb = new Framebuffer(100, 100)
    drawOutline(fb, createCube(), identity(), camAt([3, 3, 3]), accent)
    expect(countAccent(fb)).toBeGreaterThan(100)
  })
  it('leaves the middle of the object alone: only the outline is drawn', () => {
    const fb = new Framebuffer(100, 100)
    drawOutline(fb, createCube(), identity(), camAt([3, 3, 3]), accent)
    expect(fb.getPixel(50, 50)).toEqual([0, 0, 0, 0])
  })
  it('does nothing and does not crash for an object behind the camera', () => {
    const fb = new Framebuffer(100, 100)
    expect(() => drawOutline(fb, createCube(), translate(0, 0, 10), camAt([0, 0, 3]), accent)).not.toThrow()
    expect(countAccent(fb)).toBe(0)
  })
})
