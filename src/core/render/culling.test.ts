import { describe, it, expect } from 'vitest'
import {
  triangleNormal, isBackFacingView, isBackFacingScreen, cullTriangles,
} from './culling'
import { createCube, type Mesh } from './mesh'
import { createUVSphere } from './meshes'
import type { Camera } from './camera'
import { identity, rotateY, rotateX, multiply, translate } from '../math/mat4'
import { cross, dot, length, sub, type Vec3 } from '../math/vec3'

function camAt(eye: Vec3): Camera {
  return { eye, target: [0, 0, 0], up: [0, 1, 0], fovY: Math.PI / 3, aspect: 1, near: 0.1, far: 100 }
}

describe('triangleNormal', () => {
  it('normal of a triangle in the xy plane (counter-clockwise) is +z', () => {
    const r = triangleNormal([0, 0, 0], [1, 0, 0], [0, 1, 0])
    expect(r.normal).toEqual([0, 0, 1])
    expect(r.area).toBe(0.5)
  })
  it('clockwise order flips the normal to -z', () => {
    expect(triangleNormal([0, 0, 0], [0, 1, 0], [1, 0, 0]).normal).toEqual([0, 0, -1])
  })
  it('area of the 3-4-5 right triangle is 6, and |normal| = 2 * area', () => {
    const r = triangleNormal([0, 0, 0], [4, 0, 0], [0, 3, 0])
    expect(r.area).toBe(6)
    expect(length(r.normal)).toBe(12)
  })
  it('a triangle in 3D: area and a normal perpendicular to both edges', () => {
    const a: Vec3 = [1, 2, 3], b: Vec3 = [4, 2, 3], c: Vec3 = [1, 6, 3]
    const r = triangleNormal(a, b, c)
    expect(r.area).toBe(6)
    expect(dot(r.normal, sub(b, a))).toBe(0)
    expect(dot(r.normal, sub(c, a))).toBe(0)
  })
  it('three points on a line have area 0', () => {
    expect(triangleNormal([0, 0, 0], [1, 1, 1], [2, 2, 2]).area).toBe(0)
  })
})

describe('isBackFacingView', () => {
  const a: Vec3 = [0, 0, 0], b: Vec3 = [1, 0, 0], c: Vec3 = [0, 1, 0] // faces +z
  it('front facing when the eye is on the +z side', () => {
    expect(isBackFacingView(a, b, c, [0, 0, 5])).toBe(false)
  })
  it('back facing when the eye is on the -z side', () => {
    expect(isBackFacingView(a, b, c, [0, 0, -5])).toBe(true)
  })
  it('exactly edge-on (eye in the triangle plane) counts as back facing', () => {
    expect(isBackFacingView(a, b, c, [3, 3, 0])).toBe(true)
  })
})

describe('isBackFacingScreen', () => {
  // Pixel coordinates: y grows DOWN, so a triangle that looks counter-clockwise on screen
  // has a NEGATIVE signed area.
  it('counter-clockwise on screen is front facing', () => {
    expect(isBackFacingScreen([0, 0], [10, 0], [0, -10])).toBe(false)
  })
  it('clockwise on screen is back facing', () => {
    expect(isBackFacingScreen([0, 0], [0, -10], [10, 0])).toBe(true)
  })
  it('collinear points (zero area, edge-on) count as back facing', () => {
    expect(isBackFacingScreen([0, 0], [5, 5], [10, 10])).toBe(true)
  })
})

describe('cullTriangles on the cube', () => {
  const cube = createCube()
  for (const mode of ['view', 'screen'] as const) {
    it(`[${mode}] looking at a corner: 3 faces = 6 triangles visible`, () => {
      const r = cullTriangles(cube, identity(), camAt([3, 3, 3]), mode)
      expect(r.visible.length).toBe(6)
      expect(r.culled.length).toBe(6)
    })
    it(`[${mode}] looking straight at a face: 1 face = 2 triangles visible`, () => {
      const r = cullTriangles(cube, identity(), camAt([0, 0, 3]), mode)
      expect(r.visible.length).toBe(2)
      expect(r.culled.length).toBe(10)
    })
    it(`[${mode}] looking along an edge direction (two faces)`, () => {
      const r = cullTriangles(cube, identity(), camAt([3, 0, 3]), mode)
      expect(r.visible.length).toBe(4)
    })
  }
  it('visible and culled together contain every triangle exactly once', () => {
    const r = cullTriangles(cube, identity(), camAt([3, 2, 4]), 'view')
    expect([...r.visible, ...r.culled].sort((x, y) => x - y)).toEqual([...Array(12).keys()])
  })
  it('returns one unit-length normal per triangle', () => {
    const r = cullTriangles(cube, identity(), camAt([3, 2, 4]), 'view')
    expect(r.normals.length).toBe(12)
    for (const n of r.normals) expect(length(n)).toBeCloseTo(1)
  })
  it('the model matrix is applied: turning the cube 90 degrees keeps 1 face visible', () => {
    const r = cullTriangles(cube, rotateY(Math.PI / 2), camAt([0, 0, 3]), 'view')
    expect(r.visible.length).toBe(2)
  })
  it('a triangle flips from visible to culled when the model turns around', () => {
    const tri: Mesh = { vertices: [[0, 0, 0], [1, 0, 0], [0, 1, 0]], triangles: [[0, 1, 2]], edges: [] }
    expect(cullTriangles(tri, identity(), camAt([0, 0, 5]), 'view').visible).toEqual([0])
    expect(cullTriangles(tri, rotateY(Math.PI), camAt([0, 0, 5]), 'view').culled).toEqual([0])
  })
})

describe('view mode and screen mode agree', () => {
  const eyes: Vec3[] = [[3, 3, 3], [0, 0, 3], [-2, 1, 4], [0.3, 4, 0.5], [5, -2, 1], [-1, -3, -2], [2, 0.1, -3]]
  const models = [identity(), multiply(rotateY(0.7), rotateX(0.4)), multiply(translate(0.3, -0.2, 0.5), rotateY(2))]
  const meshes: [string, Mesh][] = [['cube', createCube()], ['sphere', createUVSphere(12, 8)]]
  for (const [name, mesh] of meshes) {
    it(`gives the same split for every triangle of the ${name}`, () => {
      for (const eye of eyes) for (const model of models) {
        const v = cullTriangles(mesh, model, camAt(eye), 'view')
        const s = cullTriangles(mesh, model, camAt(eye), 'screen')
        expect([...s.culled].sort((x, y) => x - y)).toEqual([...v.culled].sort((x, y) => x - y))
      }
    })
  }
})

describe('culling a closed convex mesh never removes a front-facing triangle', () => {
  // Independent check: a triangle faces the eye if the eye is on the OUTSIDE of its plane.
  // For a convex mesh centered on the origin, "outside" is the side away from the origin.
  const eyes: Vec3[] = [[3, 3, 3], [0, 0, 3], [-2, 1, 4], [0.3, 4, 0.5], [5, -2, 1]]
  const meshes: [string, Mesh][] = [['cube', createCube()], ['sphere', createUVSphere(10, 6)]]
  for (const [name, mesh] of meshes) {
    for (const mode of ['view', 'screen'] as const) {
      it(`${name}, ${mode} mode`, () => {
        for (const eye of eyes) {
          const r = cullTriangles(mesh, identity(), camAt(eye), mode)
          const visible = new Set(r.visible)
          mesh.triangles.forEach(([i, j, k], t) => {
            const a = mesh.vertices[i]
            let n = cross(sub(mesh.vertices[j], a), sub(mesh.vertices[k], a))
            if (dot(n, a) < 0) n = [-n[0], -n[1], -n[2]] // make it point away from the origin
            const eyeIsOutside = dot(n, eye) > dot(n, a)
            expect(visible.has(t)).toBe(eyeIsOutside)
          })
        }
      })
    }
  }
})

describe('edge-on triangles', () => {
  // A triangle lying in the plane x = 0 while the eye is at x = 0: seen exactly edge-on.
  const edgeOn: Mesh = { vertices: [[0, 0, 0], [0, 1, 0], [0, 0, -1]], triangles: [[0, 1, 2]], edges: [] }
  it('is culled by both modes (consistently)', () => {
    expect(cullTriangles(edgeOn, identity(), camAt([0, 0, 5]), 'view').culled).toEqual([0])
    expect(cullTriangles(edgeOn, identity(), camAt([0, 0, 5]), 'screen').culled).toEqual([0])
  })
})

describe('triangles with a vertex behind the camera', () => {
  it('screen mode falls back to the view test instead of crashing', () => {
    const cam = camAt([0, 0, 0.3])
    const r = cullTriangles(createCube(), identity(), cam, 'screen')
    expect(r.visible.length + r.culled.length).toBe(12)
  })
})
