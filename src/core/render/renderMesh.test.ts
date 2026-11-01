import { describe, it, expect } from 'vitest'
import { renderMesh, pickTriangle, type RenderOptions } from './renderMesh'
import { Framebuffer } from './framebuffer'
import { DepthBuffer } from './fill'
import { createCube } from './mesh'
import { identity } from '../math/mat4'
import type { Camera } from './camera'

const cam: Camera = { eye: [3, 3, 3], target: [0, 0, 0], up: [0, 1, 0], fovY: Math.PI / 3, aspect: 1, near: 0.1, far: 100 }
const base: RenderOptions = { cullingOn: true, mode: 'view', drawStyle: 'filled', colorByFacing: true }

function render(opts: Partial<RenderOptions>) {
  const fb = new Framebuffer(100, 100)
  const depth = new DepthBuffer(100, 100)
  const stats = renderMesh(fb, depth, createCube(), identity(), cam, { ...base, ...opts })
  return { fb, stats }
}

describe('renderMesh', () => {
  it('reports the triangle counts: culling on removes the 6 back triangles', () => {
    expect(render({}).stats).toEqual({ total: 12, visible: 6, culled: 6 })
  })
  it('culling off draws everything: nothing is culled', () => {
    expect(render({ cullingOn: false }).stats).toEqual({ total: 12, visible: 12, culled: 0 })
  })
  it('filled front faces are green when colored by facing', () => {
    const { fb } = render({})
    expect(fb.getPixel(50, 50)).toEqual([0, 200, 0, 255])
  })
  it('wireframe with culling off shows red back edges that culling on hides', () => {
    const count = (opts: Partial<RenderOptions>) => {
      const { fb } = render({ drawStyle: 'wireframe', ...opts })
      let red = 0
      for (let y = 0; y < 100; y++) for (let x = 0; x < 100; x++) {
        const p = fb.getPixel(x, y)
        if (p[0] === 220 && p[1] === 40 && p[3] === 255) red++
      }
      return red
    }
    expect(count({ cullingOn: true })).toBe(0)
    expect(count({ cullingOn: false })).toBeGreaterThan(0)
  })
  it('draws normals without crashing', () => {
    expect(() => render({ showNormals: true, drawStyle: 'both' })).not.toThrow()
  })
})

describe('pickTriangle', () => {
  it('finds a front triangle at the middle of the screen', () => {
    const hit = pickTriangle(100, 100, createCube(), identity(), cam, base, 50, 50)
    expect(hit).not.toBeNull()
  })
  it('finds nothing in an empty corner', () => {
    expect(pickTriangle(100, 100, createCube(), identity(), cam, base, 1, 1)).toBeNull()
  })
})
