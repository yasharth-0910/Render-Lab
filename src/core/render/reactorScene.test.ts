import { describe, it, expect } from 'vitest'
import { createReactorScene } from './reactorScene'
import * as m4 from '../math/mat4'

describe('createReactorScene', () => {
  const scene = createReactorScene()
  it('has plenty of objects, several lights and a floor grid', () => {
    expect(scene.objects.length).toBeGreaterThan(80)
    expect(scene.lighting.lights.length).toBeGreaterThanOrEqual(3)
    expect(scene.gridLines.length).toBeGreaterThan(20)
  })
  it('every object has a usable mesh and a solid (invertible, finite) model matrix', () => {
    for (const o of scene.objects) {
      expect(o.mesh.vertices.length).toBeGreaterThan(3)
      expect(o.model.every(Number.isFinite)).toBe(true)
      expect(Math.abs(m4.determinant(o.model))).toBeGreaterThan(1e-9)
    }
  })
  it('materials and lights use colours between 0 and 1 (emissive may glow brighter)', () => {
    for (const o of scene.objects) for (const c of o.material.color) expect(c >= 0 && c <= 1).toBe(true)
    for (const l of scene.lighting.lights) {
      expect(l.intensity).toBeGreaterThan(0)
      expect(l.range).toBeGreaterThan(0)
    }
  })
  it('every part has a name, a group and a mesh kind, and the names are unique', () => {
    const kinds = ['cube', 'sphere', 'cylinder', 'plane', 'ground']
    for (const o of scene.objects) {
      expect(o.name.length).toBeGreaterThan(0)
      expect(o.group.length).toBeGreaterThan(0)
      expect(kinds).toContain(o.kind)
    }
    expect(new Set(scene.objects.map((o) => o.name)).size).toBe(scene.objects.length)
  })
  it('the parts fall into the expected groups', () => {
    const groups = new Set(scene.objects.map((o) => o.group))
    for (const g of ['Floor', 'Walls', 'Reactor', 'Arms', 'Towers', 'Robot']) expect(groups.has(g)).toBe(true)
  })
  it('is the same every time it is built', () => {
    expect(createReactorScene().objects.length).toBe(scene.objects.length)
  })
  it('suggests a starting camera that looks at the middle of the room', () => {
    expect(scene.view.dist).toBeGreaterThan(1)
    expect(scene.view.target.every(Number.isFinite)).toBe(true)
  })
})
