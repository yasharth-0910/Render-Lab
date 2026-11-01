// culling.ts - back-face culling: skip triangles that face away from the camera.
//
// Why it works: on a closed solid object (a cube, a sphere), a triangle that faces away
// from the camera is always hidden behind the triangles that face it. Skipping those
// saves about half of the drawing work.
//
// A triangle's FRONT is the side from which its corners a -> b -> c go counter-clockwise.
// The normal (the arrow sticking out of the front) is found with a cross product.

import { projectToScreen, type Camera } from './camera'
import type { Mesh } from './mesh'
import { transformPoint, type Mat4 } from '../math/mat4'
import { cross, dot, length, normalize, sub, wedge, type Vec3 } from '../math/vec3'

export type CullMode = 'view' | 'screen'

// A triangle seen exactly edge-on has a test value of exactly 0 in pure maths, but
// floating point rounding can turn that into something like 1e-17 of either sign.
// Values this small are treated as edge-on (= back facing) in BOTH tests, so the two
// tests always agree about edge-on triangles.
const EDGE_ON_EPSILON = 1e-9

export type CullResult = {
  visible: number[] // indices of front-facing triangles
  culled: number[] // indices of back-facing triangles
  normals: Vec3[] // one unit-length world-space normal per triangle (0,0,0 if degenerate)
}

/**
 * Normal and area of the triangle a, b, c.
 * Two edges of the triangle: e1 = b - a and e2 = c - a.
 * Normal = e1 x e2 (the cross product), which is NOT unit length: its length is
 * twice the triangle area.
 * Outer product link: the wedge e1 ^ e2 is the oriented parallelogram spanned by the
 * two edges. Its length is the parallelogram's area, so the triangle's area is
 * half of that. The cross product has exactly the same three numbers as the wedge
 * (just stored as an arrow instead of a plane piece), so length(normal) = length(wedge).
 */
export function triangleNormal(a: Vec3, b: Vec3, c: Vec3): { normal: Vec3; area: number } {
  const e1 = sub(b, a)
  const e2 = sub(c, a)
  return { normal: cross(e1, e2), area: length(wedge(e1, e2)) / 2 }
}

/**
 * World-space test. The vector from the eye to the triangle is (a - eye).
 * If the normal points the same general way as that vector (dot >= 0), the triangle
 * faces away from the eye, so it is back facing.
 * Edge-on (dot = 0, give or take rounding) counts as back facing: it covers no pixels.
 */
export function isBackFacingView(a: Vec3, b: Vec3, c: Vec3, eye: Vec3): boolean {
  const { normal } = triangleNormal(a, b, c)
  return dot(normal, sub(a, eye)) > -EDGE_ON_EPSILON
}

/**
 * Screen-space test, using pixel coordinates of the three projected corners.
 * Signed area (times 2) = 2D cross product of the edges p0->p1 and p0->p2:
 *     (x1 - x0) * (y2 - y0) - (y1 - y0) * (x2 - x0)
 * In ordinary maths axes (y up) a counter-clockwise triangle gives a POSITIVE value.
 * But screen pixels have y pointing DOWN, which mirrors the picture, so a triangle that
 * LOOKS counter-clockwise on screen gives a NEGATIVE value.
 * So:  value < 0  -> front facing,   value >= 0 -> back facing (0 = edge-on, give or
 * take rounding).
 */
export function isBackFacingScreen(p0: readonly number[], p1: readonly number[], p2: readonly number[]): boolean {
  const signedArea2 = (p1[0] - p0[0]) * (p2[1] - p0[1]) - (p1[1] - p0[1]) * (p2[0] - p0[0])
  return signedArea2 > -EDGE_ON_EPSILON
}

/**
 * Sort every triangle of the mesh into visible (front facing) and culled (back facing).
 * mode 'view'   : use the world-space dot product test.
 * mode 'screen' : project the corners to the screen and use the signed area test.
 * Both give the same answer; they are two ways to see the same fact.
 * (In screen mode, a triangle with a corner behind the camera cannot be projected, so
 * for that triangle only we use the view test instead.)
 */
export function cullTriangles(mesh: Mesh, model: Mat4, camera: Camera, mode: CullMode): CullResult {
  const world = mesh.vertices.map((v) => transformPoint(model, v))
  // Only the SIGN of the signed area matters, so the screen size we pass does not matter.
  const screen = mode === 'screen' ? mesh.vertices.map((v) => projectToScreen(v, model, camera, 1, 1)) : []

  const result: CullResult = { visible: [], culled: [], normals: [] }
  mesh.triangles.forEach(([i, j, k], t) => {
    const a = world[i]
    const b = world[j]
    const c = world[k]
    result.normals.push(normalize(triangleNormal(a, b, c).normal))

    const p0 = screen[i]
    const p1 = screen[j]
    const p2 = screen[k]
    const useScreen = mode === 'screen' && p0 && p1 && p2
    const back = useScreen ? isBackFacingScreen(p0, p1, p2) : isBackFacingView(a, b, c, camera.eye)
    if (back) result.culled.push(t)
    else result.visible.push(t)
  })
  return result
}
