import { describe, it, expect } from 'vitest'
import {
  modelFromTransform, decomposeModel, emptyState, fromReactorScene, toSceneObjects,
  addObject, deleteObject, selectObject, updateObject, pickObject, materialOf, type EditorState,
} from './sceneEditor'
import { createReactorScene } from './reactorScene'
import { identity, multiply, rotateX, rotateY, rotateZ, scale, translate, transformPoint } from '../math/mat4'
import { expectClose } from '../math/helpers.test-util'
import type { Camera } from './camera'

const deg = (d: number) => (d * Math.PI) / 180

describe('modelFromTransform', () => {
  it('no move, no turn, size 1 is the identity', () => {
    expectClose(modelFromTransform([0, 0, 0], [0, 0, 0], [1, 1, 1]), identity())
  })
  it('scales first, then turns, then moves', () => {
    const m = modelFromTransform([5, 0, 0], [0, 0, 90], [2, 1, 1])
    // x axis point (1,0,0): scaled to (2,0,0), turned 90 degrees about z to (0,2,0), moved to (5,2,0)
    expectClose(transformPoint(m, [1, 0, 0]), [5, 2, 0])
  })
  it('rotation order: x first, then y, then z (same as the quaternion lab)', () => {
    const m = modelFromTransform([0, 0, 0], [30, 40, 50], [1, 1, 1])
    expectClose(m, multiply(rotateZ(deg(50)), multiply(rotateY(deg(40)), rotateX(deg(30)))))
  })
})

describe('decomposeModel', () => {
  it('reads back position, rotation (degrees) and scale', () => {
    const d = decomposeModel(modelFromTransform([1, 2, 3], [20, -35, 70], [2, 0.5, 3]))
    expectClose(d.position, [1, 2, 3])
    expectClose(d.rotation, [20, -35, 70], 6)
    expectClose(d.scale, [2, 0.5, 3])
  })
  it('turning the numbers back into a matrix gives the same matrix, also at gimbal lock', () => {
    for (const rot of [[0, 0, 0], [10, 20, 30], [-120, 45, 160], [40, 90, 15], [-10, -90, 70]]) {
      const m = modelFromTransform([0.5, -2, 4], rot as [number, number, number], [1.5, 2, 0.25])
      const d = decomposeModel(m)
      expectClose(modelFromTransform(d.position, d.rotation, d.scale), m, 8)
    }
  })
  it('works for a matrix that was built as translate * rotate * scale in other ways', () => {
    const m = multiply(translate(3, 1, -2), multiply(rotateY(0.7), scale(4, 1, 2)))
    const d = decomposeModel(m)
    expectClose(modelFromTransform(d.position, d.rotation, d.scale), m, 8)
  })
})

describe('the reactor scene as editor objects', () => {
  const scene = createReactorScene()
  const state = fromReactorScene(scene)
  it('has one editor object per part, with unique ids, nothing selected', () => {
    expect(state.objects.length).toBe(scene.objects.length)
    expect(new Set(state.objects.map((o) => o.id)).size).toBe(state.objects.length)
    expect(state.selectedId).toBeNull()
    expect(state.nextId).toBeGreaterThan(Math.max(...state.objects.map((o) => o.id)))
  })
  it('turning them back into scene objects reproduces every model matrix and material', () => {
    const back = toSceneObjects(state.objects)
    back.forEach((b, i) => {
      expectClose(b.model, scene.objects[i].model, 8)
      expect(b.mesh).toBe(scene.objects[i].mesh)
      expectClose(b.material.color, scene.objects[i].material.color, 9)
      expectClose(b.material.emissive ?? [0, 0, 0], scene.objects[i].material.emissive ?? [0, 0, 0], 9)
    })
  })
})

describe('materialOf', () => {
  it('a plain colour is lit; a glowing one has black albedo and emissive = colour * glow', () => {
    const base = { color: [0.2, 0.4, 0.6] as const }
    expect(materialOf({ ...fromReactorScene(createReactorScene()).objects[0], color: base.color, glow: 0 })).toEqual({ color: [0.2, 0.4, 0.6] })
    const g = materialOf({ ...fromReactorScene(createReactorScene()).objects[0], color: [1, 0.5, 0], glow: 2 })
    expect(g.color).toEqual([0, 0, 0])
    expect(g.emissive).toEqual([2, 1, 0])
  })
})

describe('add, select, delete, update', () => {
  const base = emptyState()
  it('adding creates an object of that kind with a fresh id and a numbered name, and selects it', () => {
    let s = addObject(base, 'cube')
    s = addObject(s, 'cube')
    s = addObject(s, 'sphere')
    expect(s.objects.map((o) => o.name)).toEqual(['Cube 1', 'Cube 2', 'Sphere 1'])
    expect(s.objects.map((o) => o.kind)).toEqual(['cube', 'cube', 'sphere'])
    expect(new Set(s.objects.map((o) => o.id)).size).toBe(3)
    expect(s.selectedId).toBe(s.objects[2].id)
    expect(base.objects.length).toBe(0) // the old state was not changed
  })
  it('all four kinds can be added and are visible with a sensible size', () => {
    let s: EditorState = base
    for (const kind of ['cube', 'sphere', 'cylinder', 'plane'] as const) s = addObject(s, kind)
    expect(s.objects.map((o) => o.kind)).toEqual(['cube', 'sphere', 'cylinder', 'plane'])
    for (const o of s.objects) {
      expect(o.visible).toBe(true)
      expect(o.scale.every((v) => v > 0)).toBe(true)
    }
  })
  it('names stay unique even after a delete', () => {
    let s = addObject(addObject(base, 'cube'), 'cube') // Cube 1, Cube 2
    s = deleteObject(s, s.objects[0].id) // remove Cube 1
    s = addObject(s, 'cube')
    expect(new Set(s.objects.map((o) => o.name)).size).toBe(2)
  })
  it('deleting removes the object; deleting the selected one clears the selection', () => {
    let s = addObject(addObject(base, 'cube'), 'sphere')
    const [cube, sphere] = s.objects
    s = selectObject(s, cube.id)
    s = deleteObject(s, cube.id)
    expect(s.objects).toEqual([sphere])
    expect(s.selectedId).toBeNull()
  })
  it('deleting another object keeps the selection', () => {
    let s = addObject(addObject(base, 'cube'), 'sphere')
    const [cube, sphere] = s.objects
    s = selectObject(s, sphere.id)
    s = deleteObject(s, cube.id)
    expect(s.selectedId).toBe(sphere.id)
  })
  it('deleting an id that does not exist changes nothing', () => {
    const s = addObject(base, 'cube')
    expect(deleteObject(s, 9999)).toEqual(s)
  })
  it('select picks one object, null clears, an unknown id clears', () => {
    const s = addObject(addObject(base, 'cube'), 'sphere')
    expect(selectObject(s, s.objects[0].id).selectedId).toBe(s.objects[0].id)
    expect(selectObject(s, null).selectedId).toBeNull()
    expect(selectObject(s, 12345).selectedId).toBeNull()
  })
  it('update changes only that object and leaves the old state alone', () => {
    const s = addObject(addObject(base, 'cube'), 'sphere')
    const [a, b] = s.objects
    const t = updateObject(s, a.id, { position: [1, 2, 3], visible: false, name: 'Crate' })
    expect(t.objects[0]).toMatchObject({ position: [1, 2, 3], visible: false, name: 'Crate', kind: 'cube', id: a.id })
    expect(t.objects[1]).toBe(b)
    expect(s.objects[0].position).toEqual(a.position)
  })
  it('toSceneObjects leaves out invisible objects', () => {
    let s = addObject(addObject(base, 'cube'), 'sphere')
    s = updateObject(s, s.objects[0].id, { visible: false })
    expect(toSceneObjects(s.objects).length).toBe(1)
  })
})

describe('pickObject: the nearest object under the mouse', () => {
  const cam: Camera = { eye: [0, 0, 6], target: [0, 0, 0], up: [0, 1, 0], fovY: Math.PI / 3, aspect: 1, near: 0.1, far: 100 }
  const W = 200
  const H = 200
  let state: EditorState = emptyState()
  state = addObject(state, 'cube') // near one
  state = updateObject(state, state.objects[0].id, { position: [0, 0, 0], scale: [2, 2, 2] })
  state = addObject(state, 'cube') // far one, straight behind it
  state = updateObject(state, state.objects[1].id, { position: [0, 0, -4], scale: [2, 2, 2] })
  const [near, far] = state.objects
  const opts = { cullingOn: true }

  it('picks the nearer of two objects on the same line of sight', () => {
    expect(pickObject(state.objects, cam, W, H, 100, 100, opts)?.id).toBe(near.id)
  })
  it('picks the farther one when the nearer is hidden (invisible objects cannot be picked)', () => {
    const s = updateObject(state, near.id, { visible: false })
    expect(pickObject(s.objects, cam, W, H, 100, 100, opts)?.id).toBe(far.id)
  })
  it('picks the one that was moved into the way, whatever the list order', () => {
    const s = updateObject(state, far.id, { position: [0, 0, 2] }) // now closer to the camera than `near`
    expect(pickObject(s.objects, cam, W, H, 100, 100, opts)?.id).toBe(far.id)
    expect(pickObject([...s.objects].reverse(), cam, W, H, 100, 100, opts)?.id).toBe(far.id)
  })
  it('returns null over empty space', () => {
    expect(pickObject(state.objects, cam, W, H, 3, 3, opts)).toBeNull()
  })
  it('works with culling off too', () => {
    expect(pickObject(state.objects, cam, W, H, 100, 100, { cullingOn: false })?.id).toBe(near.id)
  })
  it('returns the depth, smaller for the nearer object', () => {
    const a = pickObject(state.objects, cam, W, H, 100, 100, opts)!
    const b = pickObject(updateObject(state, near.id, { visible: false }).objects, cam, W, H, 100, 100, opts)!
    expect(a.depth).toBeLessThan(b.depth)
  })
})
