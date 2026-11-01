import { describe, it, expect } from 'vitest'
import { meshFor, MESH_KINDS } from './sceneMeshes'

describe('meshFor', () => {
  it('gives a mesh with triangles for every kind', () => {
    for (const kind of MESH_KINDS) {
      const mesh = meshFor(kind)
      expect(mesh.vertices.length).toBeGreaterThan(3)
      expect(mesh.triangles.length).toBeGreaterThan(0)
    }
  })
  it('gives the SAME mesh object each time (it is shared, not rebuilt)', () => {
    expect(meshFor('sphere')).toBe(meshFor('sphere'))
  })
  it('the basic shapes have the documented unit sizes', () => {
    const extent = (kind: 'cube' | 'sphere' | 'cylinder') => Math.max(...meshFor(kind).vertices.map((v) => Math.abs(v[1])))
    expect(extent('cube')).toBeCloseTo(0.5) // a cube is 1 x 1 x 1
    expect(extent('cylinder')).toBeCloseTo(0.5) // a cylinder is 1 tall
    expect(Math.max(...meshFor('cylinder').vertices.map((v) => Math.abs(v[0])))).toBeCloseTo(1) // with radius 1
    expect(extent('sphere')).toBeCloseTo(0.5) // a sphere has diameter 1
  })
})
