import { describe, it, expect } from 'vitest'
import { createUVSphere, createPlane, createAircraft } from './meshes'
import { cross, dot, length, sub } from '../math/vec3'

describe('createUVSphere', () => {
  const seg = 12
  const rings = 6
  const s = createUVSphere(seg, rings)
  it('has the expected counts', () => {
    expect(s.vertices.length).toBe(2 + seg * (rings - 1))
    expect(s.triangles.length).toBe(2 * seg * (rings - 1))
  })
  it('all vertices lie on a sphere of radius 0.5', () => {
    for (const v of s.vertices) expect(length(v)).toBeCloseTo(0.5)
  })
  it('every triangle is counter-clockwise seen from outside (normal points away from the center)', () => {
    for (const [i, j, k] of s.triangles) {
      const a = s.vertices[i]
      const n = cross(sub(s.vertices[j], a), sub(s.vertices[k], a))
      expect(dot(n, a)).toBeGreaterThan(0)
    }
  })
  it('has no degenerate triangles and valid indices', () => {
    for (const t of s.triangles) {
      expect(new Set(t).size).toBe(3)
      for (const i of t) expect(i >= 0 && i < s.vertices.length).toBe(true)
    }
  })
  it('edges are unique and each triangle edge is listed', () => {
    const keys = s.edges.map(([a, b]) => `${Math.min(a, b)}-${Math.max(a, b)}`)
    expect(new Set(keys).size).toBe(keys.length)
    for (const [i, j, k] of s.triangles) {
      for (const [a, b] of [[i, j], [j, k], [k, i]]) expect(keys).toContain(`${Math.min(a, b)}-${Math.max(a, b)}`)
    }
  })
})

describe('createPlane', () => {
  it('is a flat square of the given size facing +y', () => {
    const p = createPlane(4)
    expect(p.vertices.length).toBe(4)
    expect(p.triangles.length).toBe(2)
    for (const v of p.vertices) { expect(v[1]).toBe(0); expect(Math.abs(v[0])).toBe(2); expect(Math.abs(v[2])).toBe(2) }
    for (const [i, j, k] of p.triangles) {
      const a = p.vertices[i]
      const n = cross(sub(p.vertices[j], a), sub(p.vertices[k], a))
      expect(n[0]).toBe(0); expect(n[2]).toBe(0); expect(n[1]).toBeGreaterThan(0)
    }
  })
})

describe('createAircraft', () => {
  const plane = createAircraft()
  it('is a wireframe with valid edges (no triangles) and the nose at +x', () => {
    expect(plane.triangles.length).toBe(0)
    expect(plane.edges.length).toBeGreaterThan(8)
    for (const e of plane.edges) for (const i of e) expect(i >= 0 && i < plane.vertices.length).toBe(true)
    const noseX = Math.max(...plane.vertices.map((v) => v[0]))
    expect(plane.vertices[0]).toEqual([noseX, 0, 0])
  })
  it('is left-right symmetric (every vertex has a mirror image across y = 0)', () => {
    for (const [x, y, z] of plane.vertices) {
      expect(plane.vertices.some((v) => v[0] === x && v[1] === -y && v[2] === z)).toBe(true)
    }
  })
})
