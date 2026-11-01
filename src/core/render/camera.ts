// camera.ts - turns 3D points into pixel positions.
//
// The journey of a point (all matrices are row-major, points are column vectors):
//   model space --model--> world space --view--> camera space --projection--> clip space
//   --divide by w--> NDC (-1..1 on each axis) --viewport--> pixels
// The camera looks down its own -z axis.

import { lookAt, perspective, transformPoint, type Mat4 } from '../math/mat4'
import type { Vec3 } from '../math/vec3'

export type Camera = {
  eye: Vec3 // where the camera sits
  target: Vec3 // the point it looks at
  up: Vec3 // which way is "up" (usually [0, 1, 0])
  fovY: number // vertical field of view, radians
  aspect: number // width / height of the image
  near: number // closest distance that is drawn
  far: number // farthest distance that is drawn
}

/** World space -> camera space. */
export function viewMatrix(cam: Camera): Mat4 {
  return lookAt(cam.eye, cam.target, cam.up)
}

/** Camera space -> clip space (this is where perspective happens). */
export function projectionMatrix(cam: Camera): Mat4 {
  return perspective(cam.fovY, cam.aspect, cam.near, cam.far)
}

/**
 * Take a model-space point all the way to pixel coordinates [x, y, z].
 * z is the depth in NDC (-1 = near plane, +1 = far plane); smaller means closer.
 * Returns null if the point is behind the camera (or closer than the near plane),
 * because dividing by w there would flip it upside down and give nonsense.
 */
export function projectToScreen(
  point: Vec3,
  model: Mat4,
  cam: Camera,
  screenWidth: number,
  screenHeight: number,
): [number, number, number] | null {
  const world = transformPoint(model, point)
  const inCamera = transformPoint(viewMatrix(cam), world)
  // The camera looks down -z, so visible points have NEGATIVE z.
  // Anything with z above -near is behind (or too close to) the camera.
  if (inCamera[2] > -cam.near) return null

  // transformPoint also divides by w, so this is already NDC: x, y, z all in -1..1.
  const ndc = transformPoint(projectionMatrix(cam), inCamera)

  // Viewport: map -1..1 to 0..width, and flip y because screen y grows downward
  // while NDC y grows upward.
  const px = ((ndc[0] + 1) / 2) * screenWidth
  const py = ((1 - ndc[1]) / 2) * screenHeight
  return [px, py, ndc[2]]
}
