import { describe, it, expect } from 'vitest'
import { createUVSphere, createPlane, createAircraft, createBox, createCylinder, createGround } from './meshes'
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

describe('createBox', () => {
  const box = createBox(2, 4, 6)
  it('is centred, with the asked size, 8 vertices and 12 triangles', () => {
    expect(box.vertices.length).toBe(8)
    expect(box.triangles.length).toBe(12)
    expect(Math.max(...box.vertices.map((v) => v[0]))).toBe(1)
    expect(Math.max(...box.vertices.map((v) => v[1]))).toBe(2)
    expect(Math.max(...box.vertices.map((v) => v[2]))).toBe(3)
  })
  it('every triangle faces outward', () => {
    for (const [i, j, k] of box.triangles) {
      const a = box.vertices[i]
      expect(dot(cross(sub(box.vertices[j], a), sub(box.vertices[k], a)), a)).toBeGreaterThan(0)
    }
  })
})

describe('createCylinder', () => {
  const n = 12
  const cyl = createCylinder(1, 2, n)
  it('has the expected counts: 2 rings + 2 centres, side quads + 2 caps', () => {
    expect(cyl.vertices.length).toBe(2 * n + 2)
    expect(cyl.triangles.length).toBe(2 * n + 2 * n)
  })
  it('stands along y from -1 to +1 with radius 1', () => {
    for (const [x, y, z] of cyl.vertices) {
      expect(Math.abs(y)).toBeLessThanOrEqual(1)
      expect(Math.hypot(x, z)).toBeLessThanOrEqual(1 + 1e-9)
    }
  })
  it('every triangle faces outward and none is degenerate', () => {
    for (const [i, j, k] of cyl.triangles) {
      const a = cyl.vertices[i]
      const normal = cross(sub(cyl.vertices[j], a), sub(cyl.vertices[k], a))
      expect(dot(normal, a)).toBeGreaterThan(0)
    }
  })
})

describe('createGround', () => {
  const ground = createGround(10, 5)
  it('is a grid of 5 x 5 squares: 36 vertices, 50 triangles, all at y = 0 facing up', () => {
    expect(ground.vertices.length).toBe(36)
    expect(ground.triangles.length).toBe(50)
    for (const v of ground.vertices) expect(v[1]).toBe(0)
    for (const [i, j, k] of ground.triangles) {
      const a = ground.vertices[i]
      const n = cross(sub(ground.vertices[j], a), sub(ground.vertices[k], a))
      expect(n[1]).toBeGreaterThan(0)
    }
  })
  it('spans -5 to +5 on x and z', () => {
    expect(Math.min(...ground.vertices.map((v) => v[0]))).toBe(-5)
    expect(Math.max(...ground.vertices.map((v) => v[2]))).toBe(5)
  })
})
