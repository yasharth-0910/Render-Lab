// sceneEditor.ts - the list of scene objects the editor works with, and the plain functions that
// change it. Pure logic: no React, no drawing. Every function returns a NEW state and leaves the old
// one untouched, so React can see that something changed.
//
// An object = a name, a mesh kind, a position, a rotation (degrees), a scale and a colour.
// Its model matrix is  M = T * Rz * Ry * Rx * S : scale first, then turn (x first, z last), then move.

import { multiply, rotateX, rotateY, rotateZ, scale as scaleMatrix, translate, type Mat4 } from '../math/mat4'
import type { Vec3 } from '../math/vec3'
import type { Camera } from './camera'
import type { Material, Rgb } from './lighting'
import { meshFor, type MeshKind } from './sceneMeshes'
import { pickTriangle } from './renderMesh'
import type { ReactorScene } from './reactorScene'
import type { SceneObject } from './scene'

export type EditorObject = {
  id: number
  name: string
  group: string // the folder it sits in, in the scene tree
  kind: MeshKind
  position: Vec3
  rotation: Vec3 // degrees about x, y, z
  scale: Vec3
  color: Rgb // 0..1 per channel
  glow: number // 0 = a normal lit surface; above 0 = it gives off its own light, this strong
  visible: boolean
}

export type EditorState = { objects: EditorObject[]; selectedId: number | null; nextId: number }

export type AddableKind = 'cube' | 'sphere' | 'cylinder' | 'plane'

export const emptyState = (): EditorState => ({ objects: [], selectedId: null, nextId: 1 })

const toRad = (d: number) => (d * Math.PI) / 180
const toDeg = (r: number) => (r * 180) / Math.PI

/** The model matrix for a position, a rotation in degrees and a scale. */
export function modelFromTransform(position: Vec3, rotation: Vec3, scale: Vec3): Mat4 {
  const turn = multiply(rotateZ(toRad(rotation[2])), multiply(rotateY(toRad(rotation[1])), rotateX(toRad(rotation[0]))))
  return multiply(translate(...position), multiply(turn, scaleMatrix(...scale)))
}

/**
 * The opposite: read position, rotation (degrees) and scale out of a model matrix of the form T * R * S.
 *  - position = the last column.
 *  - scale = the length of each of the three columns (S stretches each column of R).
 *  - rotation = the matrix with every column divided by its length, turned back into the three angles
 *    with the same formulas as quatLab.quatToEuler: y = asin(-R20), x = atan2(R21, R22), z = atan2(R10, R00).
 */
export function decomposeModel(m: Mat4): { position: Vec3; rotation: Vec3; scale: Vec3 } {
  const sx = Math.hypot(m[0], m[4], m[8])
  const sy = Math.hypot(m[1], m[5], m[9])
  const sz = Math.hypot(m[2], m[6], m[10])
  const r20 = m[8] / sx
  let x: number
  let z: number
  const y = Math.asin(Math.max(-1, Math.min(1, -r20)))
  if (Math.abs(r20) > 1 - 1e-9) {
    // gimbal lock (pitch +-90): roll and yaw turn about the same line, so put it all into yaw
    x = 0
    z = Math.atan2(-m[1] / sy, m[5] / sy)
  } else {
    x = Math.atan2(m[9] / sy, m[10] / sz)
    z = Math.atan2(m[4] / sx, m[0] / sx)
  }
  return { position: [m[3], m[7], m[11]], rotation: [toDeg(x), toDeg(y), toDeg(z)], scale: [sx, sy, sz] }
}

/** The lighting material of an object: lit by its colour, or glowing (black surface, emissive colour * glow). */
export function materialOf(obj: EditorObject): Material {
  if (obj.glow > 0) return { color: [0, 0, 0], emissive: [obj.color[0] * obj.glow, obj.color[1] * obj.glow, obj.color[2] * obj.glow] }
  return { color: obj.color }
}

/** The editor objects for the reactor scene: every part, with its matrix split into the three numbers. */
export function fromReactorScene(scene: ReactorScene): EditorState {
  const objects = scene.objects.map((part, i): EditorObject => {
    const { position, rotation, scale } = decomposeModel(part.model)
    const emissive = part.material.emissive
    const glow = emissive ? Math.max(emissive[0], emissive[1], emissive[2]) : 0
    const color: Rgb = glow > 0 && emissive ? [emissive[0] / glow, emissive[1] / glow, emissive[2] / glow] : part.material.color
    return { id: i + 1, name: part.name, group: part.group, kind: part.kind, position, rotation, scale, color, glow: glow > 0 ? glow : 0, visible: true }
  })
  return { objects, selectedId: null, nextId: objects.length + 1 }
}

/** What the renderer draws: the visible objects, as mesh + model matrix + material. */
export function toSceneObjects(objects: readonly EditorObject[]): SceneObject[] {
  return objects.filter((o) => o.visible).map((o) => ({
    mesh: meshFor(o.kind),
    model: modelFromTransform(o.position, o.rotation, o.scale),
    material: materialOf(o),
  }))
}

// How a new object of each kind starts: about one unit big, a little in front of the reactor.
const DEFAULTS: Record<AddableKind, { label: string; scale: Vec3 }> = {
  cube: { label: 'Cube', scale: [1, 1, 1] },
  sphere: { label: 'Sphere', scale: [1, 1, 1] },
  cylinder: { label: 'Cylinder', scale: [0.5, 1, 0.5] },
  plane: { label: 'Plane', scale: [2, 1, 2] },
}

/** Add a new object of this kind, give it the next free name ("Cube 3"), and select it. */
export function addObject(state: EditorState, kind: AddableKind): EditorState {
  const { label, scale } = DEFAULTS[kind]
  // The next number after the highest "Label n" already used, so names stay unique even after deletes.
  let highest = 0
  for (const o of state.objects) {
    const match = new RegExp(`^${label} (\\d+)$`).exec(o.name)
    if (match) highest = Math.max(highest, Number(match[1]))
  }
  const object: EditorObject = {
    id: state.nextId, name: `${label} ${highest + 1}`, group: 'Added', kind,
    position: [0, 1, 0], rotation: [0, 0, 0], scale, color: [0.75, 0.75, 0.8], glow: 0, visible: true,
  }
  return { objects: [...state.objects, object], selectedId: object.id, nextId: state.nextId + 1 }
}

/** Remove an object. If it was the selected one, nothing is selected afterwards. */
export function deleteObject(state: EditorState, id: number): EditorState {
  if (!state.objects.some((o) => o.id === id)) return state
  return { ...state, objects: state.objects.filter((o) => o.id !== id), selectedId: state.selectedId === id ? null : state.selectedId }
}

/** Select an object (or nothing, with null). An id that does not exist selects nothing. */
export function selectObject(state: EditorState, id: number | null): EditorState {
  return { ...state, selectedId: id !== null && state.objects.some((o) => o.id === id) ? id : null }
}

/** Change some fields of one object. */
export function updateObject(state: EditorState, id: number, patch: Partial<Omit<EditorObject, 'id'>>): EditorState {
  return { ...state, objects: state.objects.map((o) => (o.id === id ? { ...o, ...patch } : o)) }
}

/**
 * Which object is under the pixel (px, py)? Asks every visible object which of its triangles is
 * there (the same picking as the culling lab) and keeps the one with the smallest depth = nearest.
 */
export function pickObject(
  objects: readonly EditorObject[], camera: Camera, width: number, height: number, px: number, py: number,
  { cullingOn }: { cullingOn: boolean },
): { id: number; depth: number } | null {
  let best: { id: number; depth: number } | null = null
  for (const o of objects) {
    if (!o.visible) continue
    const hit = pickTriangle(width, height, meshFor(o.kind), modelFromTransform(o.position, o.rotation, o.scale), camera,
      { cullingOn, mode: 'view', drawStyle: 'filled', colorByFacing: false }, px, py)
    if (hit && (best === null || hit.depth < best.depth)) best = { id: o.id, depth: hit.depth }
  }
  return best
}

