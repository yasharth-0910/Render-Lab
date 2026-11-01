// reactorScene.ts - a sci-fi reactor hall made only of boxes, cylinders and spheres:
// a glowing orb held by armoured arms, cyan and orange towers with spiral stairs, a ring of walls,
// a neon grid floor, and a small robot in the foreground. y is up. Everything is built in code.

import { identity, multiply, rotateY, rotateAxis, scale, translate, type Mat4 } from '../math/mat4'
import { cross, dot, length, normalize, sub, type Vec3 } from '../math/vec3'
import type { Lighting, Material } from './lighting'
import { createCube } from './mesh'
import { createCylinder, createGround, createUVSphere } from './meshes'
import type { LineSegment, SceneObject } from './scene'

// One of each basic shape; every part reuses them with its own size and place.
const BOX = createCube() // 1 x 1 x 1
const CYLINDER = createCylinder(1, 1, 28) // radius 1, height 1, along y
const SPHERE = createUVSphere(20, 12) // radius 0.5

// ----- materials -----
const dark = (v: number): Material => ({ color: [v, v * 1.05, v * 1.2] })
const METAL = dark(0.2)
const METAL_DARK = dark(0.09)
const WHITE: Material = { color: [0.85, 0.87, 0.9] }
const TEAL: Material = { color: [0.05, 0.15, 0.17] }
const glow = (r: number, g: number, b: number): Material => ({ color: [0, 0, 0], emissive: [r, g, b] })
const ORANGE = glow(1.2, 0.5, 0.1)
const RED = glow(1.1, 0.12, 0.08)
const CYAN = glow(0.2, 1.5, 1.7)
const ORB = glow(2.2, 1.7, 0.8)

export type ReactorScene = {
  objects: SceneObject[]
  lighting: Lighting
  gridLines: LineSegment[]
  fog: { color: readonly [number, number, number]; density: number }
  sky: { top: readonly [number, number, number]; bottom: readonly [number, number, number] } // 0..255
  view: { target: Vec3; yaw: number; pitch: number; dist: number } // the suggested camera
}

// ----- placing parts -----

// Rotation that turns direction u into direction v (both unit length).
function align(u: Vec3, v: Vec3): Mat4 {
  const axis = cross(u, v)
  const sine = length(axis)
  const cosine = dot(u, v)
  if (sine < 1e-9) return cosine > 0 ? identity() : rotateAxis(Math.abs(u[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0], Math.PI)
  return rotateAxis(axis, Math.atan2(sine, cosine))
}

const model = (...steps: Mat4[]): Mat4 => steps.reduce((total, m) => multiply(total, m), identity()) // first is applied LAST

// A beam from point a to point b with the given cross-section (width, height).
function beam(a: Vec3, b: Vec3, width: number, height: number): Mat4 {
  const d = sub(b, a)
  const mid: Vec3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]
  return model(translate(...mid), align([0, 0, 1], normalize(d)), scale(width, height, length(d)))
}

export function createReactorScene(): ReactorScene {
  const objects: SceneObject[] = []
  const add = (mesh: SceneObject['mesh'], m: Mat4, material: Material) => objects.push({ mesh, model: m, material })
  const box = (c: Vec3, size: Vec3, material: Material, turnY = 0) => add(BOX, model(translate(...c), rotateY(turnY), scale(...size)), material)
  const cylinder = (c: Vec3, radius: number, height: number, material: Material) => add(CYLINDER, model(translate(...c), scale(radius, height, radius)), material)
  const ball = (c: Vec3, radius: number, material: Material) => add(SPHERE, model(translate(...c), scale(radius * 2, radius * 2, radius * 2)), material)

  const hall: Vec3 = [0, 0, -6] // the middle of the room

  // ===== floor =====
  add(createGround(44, 22), translate(hall[0], 0, hall[2]), dark(0.03))

  // ===== walls: a ring of panels with glowing strips =====
  const panels = 18
  for (let k = 0; k < panels; k++) {
    const angle = (2 * Math.PI * k) / panels
    const radius = 17
    const at = (r: number, y: number): Vec3 => [hall[0] + r * Math.sin(angle), y, hall[2] + r * Math.cos(angle)]
    add(BOX, model(translate(...at(radius, 6.5)), rotateY(angle), scale(6.7, 13, 1)), k % 3 === 0 ? { color: [0.2, 0.11, 0.09] } : { color: [0.12, 0.07, 0.07] })
    add(BOX, model(translate(...at(radius - 0.55, 2.3)), rotateY(angle), scale(5.4, 0.2, 0.12)), k % 2 === 0 ? ORANGE : RED)
    add(BOX, model(translate(...at(radius - 0.55, 8.6)), rotateY(angle), scale(5.4, 0.16, 0.12)), ORANGE)
    if (k % 3 === 1) add(BOX, model(translate(...at(radius - 0.55, 5.4)), rotateY(angle), scale(0.5, 2.6, 0.12)), RED)
  }

  // ===== the reactor: base, column, glowing orb, and the arms that hold it =====
  cylinder([hall[0], 0.2, hall[2]], 3.4, 0.4, METAL_DARK) // base disc
  cylinder([hall[0], 0.36, hall[2]], 3.5, 0.08, ORANGE) // glowing rim
  cylinder([hall[0], 0.42, hall[2]], 2.3, 0.04, glow(0.5, 0.2, 0.05)) // inner glow
  cylinder([hall[0], 1.3, hall[2]], 0.5, 1.8, METAL) // column
  cylinder([hall[0], 0.8, hall[2]], 0.7, 0.25, METAL_DARK)
  cylinder([hall[0], 1.9, hall[2]], 0.65, 0.2, METAL_DARK)
  const orb: Vec3 = [hall[0], 2.9, hall[2]]
  ball(orb, 0.7, ORB)

  // lower arms rising from the base to the orb, in four directions
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const from: Vec3 = [hall[0] + dx * 3.1, 0.5, hall[2] + dz * 3.1]
    const to: Vec3 = [hall[0] + dx * 0.7, 2.5, hall[2] + dz * 0.7]
    add(BOX, beam(from, to, 0.9, 0.9), METAL)
    ball(from, 0.55, METAL_DARK)
    const stripA: Vec3 = [(from[0] * 2 + to[0]) / 3, (from[1] * 2 + to[1]) / 3 + 0.5, (from[2] * 2 + to[2]) / 3]
    const stripB: Vec3 = [(from[0] + to[0] * 2) / 3, (from[1] + to[1] * 2) / 3 + 0.5, (from[2] + to[2] * 2) / 3]
    add(BOX, beam(stripA, stripB, 0.18, 0.12), ORANGE)
  }

  // the big upper arms from the ceiling hub down to the orb
  const hub: Vec3 = [hall[0], 12.5, hall[2]]
  box(hub, [7, 1.8, 7], METAL_DARK)
  for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const top: Vec3 = [hall[0] + sx * 5.2, 11.4, hall[2] + sz * 2.6]
    const mid: Vec3 = [hall[0] + sx * 3.1, 7.8, hall[2] + sz * 1.3]
    const bottom: Vec3 = [hall[0] + sx * 0.9, 3.9, hall[2] + sz * 0.35]
    add(BOX, beam(top, mid, 2, 1.7), METAL_DARK)
    add(BOX, beam(mid, bottom, 1.4, 1.2), METAL)
    ball(mid, 1.0, METAL_DARK)
    const stripTop: Vec3 = [top[0] + sx * -0.1, top[1] - 0.6, top[2]]
    add(BOX, beam(stripTop, [mid[0], mid[1] + 0.4, mid[2]], 0.2, 0.14), ORANGE)
    add(BOX, beam([mid[0], mid[1] - 0.2, mid[2]], [bottom[0], bottom[1] + 0.3, bottom[2]], 0.16, 0.12), RED)
    ball(bottom, 0.5, METAL)
  }

  // ===== towers with glowing rings and a spiral stair =====
  const tower = (x: number, z: number, height: number, ringMaterial: Material, railMaterial: Material) => {
    cylinder([x, height / 2, z], 1.4, height, TEAL)
    for (const y of [height * 0.25, height * 0.5, height * 0.75]) {
      cylinder([x, y, z], 1.48, 0.36, ringMaterial)
      cylinder([x, y + 0.7, z], 1.48, 0.2, ringMaterial)
    }
    cylinder([x, 0.3, z], 1.9, 0.6, METAL_DARK)
    const stepCount = Math.floor(height * 2.3)
    for (let k = 0; k < stepCount; k++) {
      const angle = k * 0.45
      const radius = 2.5
      const y = 0.5 + k * 0.4
      const px = x + radius * Math.cos(angle)
      const pz = z + radius * Math.sin(angle)
      add(BOX, model(translate(px, y, pz), rotateY(-angle), scale(1.6, 0.1, 0.6)), METAL)
      if (k % 2 === 0) {
        const rx = x + (radius + 0.85) * Math.cos(angle)
        const rz = z + (radius + 0.85) * Math.sin(angle)
        add(BOX, model(translate(rx, y + 0.45, rz), scale(0.06, 0.9, 0.06)), railMaterial)
      }
    }
  }
  tower(-8.5, -9, 14, CYAN, ORANGE)
  tower(9.5, -10, 11, ORANGE, CYAN)
  tower(-13, -3, 9, CYAN, ORANGE)

  // ===== the robot (built facing +x, then turned and placed) =====
  const robotAt = model(translate(-2.9, 0, 1.6), rotateY(0.5), scale(1, 1, 1))
  const part = (mesh: SceneObject['mesh'], local: Mat4, material: Material) => add(mesh, multiply(robotAt, local), material)
  const rbox = (c: Vec3, size: Vec3, material: Material) => part(BOX, model(translate(...c), scale(...size)), material)
  const rball = (c: Vec3, radius: number, material: Material) => part(SPHERE, model(translate(...c), scale(radius * 2, radius * 2, radius * 2)), material)
  const rlimb = (a: Vec3, b: Vec3, w: number, material: Material) => part(BOX, beam(a, b, w, w), material)
  for (const side of [1, -1]) {
    rbox([0.12, 0.09, side * 0.3], [0.62, 0.18, 0.34], METAL_DARK) // foot
    rlimb([0, 0.25, side * 0.3], [0.06, 0.85, side * 0.3], 0.24, WHITE) // lower leg
    rball([0.06, 0.88, side * 0.3], 0.15, METAL_DARK) // knee
    rlimb([0.06, 0.88, side * 0.3], [0, 1.4, side * 0.27], 0.3, WHITE) // thigh
  }
  rbox([0, 1.45, 0], [0.5, 0.3, 0.8], METAL_DARK) // pelvis
  rbox([0, 2.05, 0], [0.62, 0.9, 0.85], WHITE) // torso
  rbox([0.33, 2.12, 0], [0.08, 0.45, 0.5], METAL_DARK) // chest plate
  rbox([0.38, 2.15, 0], [0.04, 0.12, 0.3], ORANGE) // chest light
  part(CYLINDER, model(translate(-0.5, 2.1, 0), scale(0.24, 0.8, 0.24)), METAL_DARK) // backpack
  rball([0, 2.38, 0.52], 0.2, METAL_DARK) // shoulders
  rball([0, 2.38, -0.52], 0.2, METAL_DARK)
  rlimb([0, 2.38, 0.52], [0.4, 2.02, 0.6], 0.2, WHITE) // arm out to the front, holding a tool
  rlimb([0.4, 2.02, 0.6], [1.0, 2.05, 0.6], 0.18, WHITE)
  rbox([1.25, 2.05, 0.6], [0.55, 0.16, 0.16], METAL_DARK)
  rbox([1.55, 2.05, 0.6], [0.08, 0.1, 0.1], CYAN)
  rlimb([0, 2.38, -0.52], [0.15, 1.8, -0.62], 0.2, WHITE) // arm bent down at the side
  rlimb([0.15, 1.8, -0.62], [0.6, 1.72, -0.5], 0.18, WHITE)
  part(CYLINDER, model(translate(0.05, 2.62, 0), scale(0.12, 0.25, 0.12)), METAL_DARK) // neck
  // head: a drum lying along x, with a dark lens and a cyan eye at the front
  part(CYLINDER, model(translate(0.12, 2.92, 0), rotateAxis([0, 0, 1], -Math.PI / 2), scale(0.3, 0.8, 0.3)), WHITE)
  part(CYLINDER, model(translate(0.54, 2.92, 0), rotateAxis([0, 0, 1], -Math.PI / 2), scale(0.22, 0.1, 0.22)), METAL_DARK)
  rball([0.6, 2.92, 0], 0.11, CYAN)
  part(CYLINDER, model(translate(-0.3, 2.92, 0), rotateAxis([0, 0, 1], -Math.PI / 2), scale(0.26, 0.06, 0.26)), METAL_DARK)

  // ===== neon floor grid: lines every unit, just above the floor =====
  const gridLines: LineSegment[] = []
  for (let x = -14; x <= 14; x++) gridLines.push({ a: [x, 0.012, hall[2] - 20], b: [x, 0.012, hall[2] + 14] })
  for (let z = -26; z <= 8; z++) gridLines.push({ a: [-14, 0.012, z], b: [14, 0.012, z] })

  // ===== lights =====
  const lighting: Lighting = {
    ambient: [0.07, 0.065, 0.1],
    lights: [
      { position: [orb[0], orb[1], orb[2] + 0.5], color: [1, 0.55, 0.2], intensity: 12, range: 8 }, // the orb: warm and strong
      { position: [-6, 5.5, -7], color: [0.1, 0.8, 1], intensity: 10, range: 9 }, // cyan tower
      { position: [0, 6, -17], color: [1, 0.4, 0.14], intensity: 5, range: 15 }, // warm light on the back wall
      { position: [9, 4, -9], color: [1, 0.35, 0.1], intensity: 5, range: 9 }, // orange tower on the right
      { position: [0, 9, -4], color: [1, 0.3, 0.14], intensity: 3.5, range: 10 }, // red-orange from above
      { position: [2.5, 4, 8], color: [0.6, 0.7, 1], intensity: 1.4, range: 10 }, // soft fill so the foreground reads
    ],
    directional: { direction: normalize([0.1, 1, 0.3]), color: [0.16, 0.12, 0.3] },
  }

  return {
    objects,
    lighting,
    gridLines,
    fog: { color: [0.07, 0.035, 0.04], density: 0.02 },
    sky: { top: [10, 8, 16], bottom: [40, 18, 14] },
    view: { target: [0.3, 2.5, -4.5], yaw: 0.1, pitch: -0.03, dist: 12.5 },
  }
}
