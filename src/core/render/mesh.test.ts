import { describe, it, expect } from 'vitest'
import { createCube } from './mesh'
import { cross, dot, sub } from '../math/vec3'

describe('createCube', () => {
  const cube = createCube()
  it('has 8 vertices, 12 triangles, 12 edges', () => {
    expect(cube.vertices.length).toBe(8)
    expect(cube.triangles.length).toBe(12)
    expect(cube.edges.length).toBe(12)
  })
  it('is a unit cube centered on the origin', () => {
    for (const v of cube.vertices) for (const c of v) expect(Math.abs(c)).toBe(0.5)
  })
  it('every index is valid', () => {
    for (const t of cube.triangles) for (const i of t) expect(i >= 0 && i < 8).toBe(true)
    for (const e of cube.edges) for (const i of e) expect(i >= 0 && i < 8).toBe(true)
  })
  it('every edge joins two vertices that differ in exactly one coordinate', () => {
    for (const [a, b] of cube.edges) {
      const d = sub(cube.vertices[a], cube.vertices[b]).filter((c) => c !== 0)
      expect(d.length).toBe(1)
    }
  })
  it('no duplicate edges', () => {
    const keys = cube.edges.map(([a, b]) => `${Math.min(a, b)}-${Math.max(a, b)}`)
    expect(new Set(keys).size).toBe(12)
  })
  it('triangle normals (counter-clockwise rule) all point away from the center', () => {
    for (const [a, b, c] of cube.triangles) {
      const va = cube.vertices[a]
      const n = cross(sub(cube.vertices[b], va), sub(cube.vertices[c], va))
      expect(dot(n, va)).toBeGreaterThan(0) // the center is the origin
    }
  })
})
