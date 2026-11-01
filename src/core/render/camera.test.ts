import { describe, it, expect } from 'vitest'
import { projectToScreen, viewMatrix, projectionMatrix, type Camera } from './camera'
import { identity, translate } from '../math/mat4'
import { createCube } from './mesh'

const W = 200
const H = 100
const cam: Camera = {
  eye: [0, 0, 5], target: [0, 0, 0], up: [0, 1, 0],
  fovY: Math.PI / 2, aspect: W / H, near: 0.1, far: 100,
}

describe('camera', () => {
  it('a point on the view axis projects to the screen center', () => {
    const p = projectToScreen([0, 0, 0], identity(), cam, W, H)
    expect(p).not.toBeNull()
    expect(p![0]).toBeCloseTo(W / 2)
    expect(p![1]).toBeCloseTo(H / 2)
  })
  it('a point behind the camera returns null', () => {
    expect(projectToScreen([0, 0, 10], identity(), cam, W, H)).toBeNull()
  })
  it('up is up on screen: a point with larger y has a smaller pixel y', () => {
    const high = projectToScreen([0, 1, 0], identity(), cam, W, H)!
    expect(high[1]).toBeLessThan(H / 2)
  })
  it('right is right on screen: a point with larger x has a larger pixel x', () => {
    const right = projectToScreen([1, 0, 0], identity(), cam, W, H)!
    expect(right[0]).toBeGreaterThan(W / 2)
  })
  it('the model matrix is applied: moving the model right moves it right', () => {
    const p = projectToScreen([0, 0, 0], translate(1, 0, 0), cam, W, H)!
    expect(p[0]).toBeGreaterThan(W / 2)
  })
  it('farther points are closer to the center (perspective)', () => {
    const near = projectToScreen([1, 0, 0], identity(), cam, W, H)!
    const far = projectToScreen([1, 0, -5], identity(), cam, W, H)!
    expect(far[0] - W / 2).toBeLessThan(near[0] - W / 2)
  })
  it('the cube projects to 8 finite screen points', () => {
    const pts = createCube().vertices.map((v) => projectToScreen(v, identity(), cam, W, H))
    expect(pts.length).toBe(8)
    for (const p of pts) {
      expect(p).not.toBeNull()
      expect(Number.isFinite(p![0])).toBe(true)
      expect(Number.isFinite(p![1])).toBe(true)
    }
  })
  it('viewMatrix and projectionMatrix are 4x4', () => {
    expect(viewMatrix(cam).length).toBe(16)
    expect(projectionMatrix(cam).length).toBe(16)
  })
})
