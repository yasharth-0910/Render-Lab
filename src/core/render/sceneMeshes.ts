// sceneMeshes.ts - the few basic shapes every scene part is made from. ONE copy of each is shared by
// all parts; a part only adds its own position, rotation and size (its model matrix).
//
// Unit sizes (what a scale of 1 means):
//   cube     1 x 1 x 1
//   sphere   diameter 1 (radius 0.5)
//   cylinder radius 1, height 1, standing along y
//   plane    1 x 1, flat on y = 0, facing up (one-sided)
//   ground   44 x 44, cut into 2 x 2 squares (used for the reactor floor)

import { createCube, type Mesh } from './mesh'
import { createCylinder, createGround, createPlane, createUVSphere } from './meshes'

export type MeshKind = 'cube' | 'sphere' | 'cylinder' | 'plane' | 'ground'
export const MESH_KINDS: readonly MeshKind[] = ['cube', 'sphere', 'cylinder', 'plane', 'ground']

const MESHES: Record<MeshKind, Mesh> = {
  cube: createCube(),
  sphere: createUVSphere(20, 12),
  cylinder: createCylinder(1, 1, 28),
  plane: createPlane(1),
  ground: createGround(44, 22),
}

/** The shared mesh for a kind. */
export const meshFor = (kind: MeshKind): Mesh => MESHES[kind]

/** Which kind a shared mesh is (or null if it is some other mesh). */
export function kindOf(mesh: Mesh): MeshKind | null {
  return MESH_KINDS.find((kind) => MESHES[kind] === mesh) ?? null
}
