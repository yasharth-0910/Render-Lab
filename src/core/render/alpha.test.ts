import { describe, it, expect } from 'vitest'
import {
  over, toPremultiplied, fromPremultiplied, overPremultiplied, compositeLayers, type Rgba,
} from './alpha'
import { Framebuffer } from './framebuffer'
import { DepthBuffer, fillTriangle } from './fill'
import { renderTransparent } from './transparent'
import type { Camera } from './camera'
import type { Mesh } from './mesh'
import { identity, translate } from '../math/mat4'

const close = (a: readonly number[], b: readonly number[], digits = 9) => {
  expect(a.length).toBe(b.length)
  a.forEach((v, i) => expect(v).toBeCloseTo(b[i], digits))
}

const white: Rgba = [255, 255, 255, 1]

describe('over (straight alpha)', () => {
  it('alpha 1 source replaces the destination', () => {
    expect(over([10, 20, 30, 1], [100, 100, 100, 0.5])).toEqual([10, 20, 30, 1])
  })
  it('alpha 0 source leaves the destination unchanged', () => {
    close(over([10, 20, 30, 0], [100, 110, 120, 0.5]), [100, 110, 120, 0.5])
  })
  it('50% red over white is (255, 128, 128) within rounding', () => {
    const out = over([255, 0, 0, 0.5], white)
    expect(out[3]).toBe(1)
    expect(Math.round(out[0])).toBe(255)
    expect(Math.round(out[1])).toBe(128)
    expect(Math.round(out[2])).toBe(128)
    expect(out[1]).toBeCloseTo(127.5)
  })
  it('output alpha = a_s + a_d * (1 - a_s)', () => {
    expect(over([0, 0, 0, 0.3], [0, 0, 0, 0.5])[3]).toBeCloseTo(0.3 + 0.5 * 0.7)
  })
  it('hand-checked colour: 0.5 red over 0.5 blue', () => {
    // a_out = 0.5 + 0.5*0.5 = 0.75; R = (255*0.5 + 0) / 0.75 = 170; B = (0 + 255*0.5*0.5) / 0.75 = 85
    close(over([255, 0, 0, 0.5], [0, 0, 255, 0.5]), [170, 0, 85, 0.75])
  })
  it('two fully transparent colours give transparent (no NaN)', () => {
    expect(over([1, 2, 3, 0], [4, 5, 6, 0])).toEqual([0, 0, 0, 0])
  })
  it('is associative: (a over b) over c = a over (b over c)', () => {
    const a: Rgba = [200, 30, 40, 0.4]
    const b: Rgba = [20, 220, 60, 0.6]
    const c: Rgba = [30, 40, 250, 0.7]
    close(over(over(a, b), c), over(a, over(b, c)))
  })
  it('is NOT commutative: the order of the layers matters', () => {
    const red: Rgba = [255, 0, 0, 0.5]
    const blue: Rgba = [0, 0, 255, 0.5]
    const redOnTop = over(red, blue)
    const blueOnTop = over(blue, red)
    expect(redOnTop[0]).not.toBeCloseTo(blueOnTop[0])
    expect(redOnTop[2]).not.toBeCloseTo(blueOnTop[2])
    // but the alpha is the same either way
    expect(redOnTop[3]).toBeCloseTo(blueOnTop[3])
  })
})

describe('premultiplied alpha', () => {
  it('toPremultiplied multiplies rgb by alpha, fromPremultiplied undoes it', () => {
    expect(toPremultiplied([200, 100, 50, 0.5])).toEqual([100, 50, 25, 0.5])
    close(fromPremultiplied([100, 50, 25, 0.5]), [200, 100, 50, 0.5])
    expect(fromPremultiplied([0, 0, 0, 0])).toEqual([0, 0, 0, 0])
  })
  it('gives the same result as the straight version', () => {
    const s: Rgba = [230, 40, 90, 0.35]
    const d: Rgba = [20, 180, 220, 0.8]
    const viaPremult = fromPremultiplied(overPremultiplied(toPremultiplied(s), toPremultiplied(d)))
    close(viaPremult, over(s, d))
  })
  it('the premultiplied formula is the same for every channel: out = s + d(1 - a_s)', () => {
    expect(overPremultiplied([0.5, 0, 0, 0.5], [0, 0, 0.8, 0.8])).toEqual([0.5, 0, 0.4, 0.9])
  })
})

describe('compositeLayers', () => {
  const layers: Rgba[] = [[255, 0, 0, 0.5], [0, 255, 0, 0.5], [0, 0, 255, 0.5]]
  it('returns one intermediate step per layer', () => {
    expect(compositeLayers(layers, white).steps.length).toBe(3)
  })
  it('each step blends one layer over the result of the step before', () => {
    const { steps } = compositeLayers(layers, white)
    expect(steps[0].dst).toEqual(white)
    expect(steps[1].dst).toEqual(steps[0].out)
    expect(steps[2].dst).toEqual(steps[1].out)
    expect(steps[0].src).toEqual(layers[0])
    close(steps[0].out, over(layers[0], white))
  })
  it('the stack goes bottom to top: the LAST layer is on top', () => {
    const { result } = compositeLayers(layers, white)
    close(result, over(layers[2], over(layers[1], over(layers[0], white))))
  })
  it('the final result is the last step output', () => {
    const { steps, result } = compositeLayers(layers, white)
    expect(result).toEqual(steps[2].out)
  })
  it('no layers: the result is just the background and there are no steps', () => {
    expect(compositeLayers([], white)).toEqual({ steps: [], result: white })
  })
})

describe('Framebuffer.blendPixel', () => {
  it('50% red over a white pixel gives (255, 128, 128, 255)', () => {
    const fb = new Framebuffer(2, 2)
    fb.setPixel(0, 0, 255, 255, 255, 255)
    fb.blendPixel(0, 0, [255, 0, 0, 0.5])
    expect(fb.getPixel(0, 0)).toEqual([255, 128, 128, 255])
  })
  it('over an empty (transparent) pixel it keeps the colour and the alpha', () => {
    const fb = new Framebuffer(2, 2)
    fb.blendPixel(1, 1, [10, 20, 30, 0.5])
    expect(fb.getPixel(1, 1)).toEqual([10, 20, 30, 128])
  })
  it('ignores pixels outside the image', () => {
    const fb = new Framebuffer(2, 2)
    fb.blendPixel(-1, 0, [255, 0, 0, 1])
    fb.blendPixel(2, 2, [255, 0, 0, 1])
    expect(Array.from(fb.data).every((v) => v === 0)).toBe(true)
  })
})

// ---------- transparent triangles in 3D ----------

const cam: Camera = { eye: [0, 0, 3], target: [0, 0, 0], up: [0, 1, 0], fovY: Math.PI / 3, aspect: 1, near: 0.1, far: 100 }
// One big triangle facing +z (towards the camera) that covers the middle of the screen.
const tri: Mesh = { vertices: [[-1, -1, 0], [1, -1, 0], [0, 1, 0]], triangles: [[0, 1, 2]], edges: [] }
const opts = { cullingOn: false, mode: 'view' as const, sortBackToFront: true }

function newScene() {
  const fb = new Framebuffer(40, 40)
  fb.clear(255, 255, 255, 255)
  return { fb, depth: new DepthBuffer(40, 40) }
}

describe('renderTransparent', () => {
  const far = { mesh: tri, model: identity(), color: [255, 0, 0, 0.5] as Rgba } // z = 0
  const near = { mesh: tri, model: translate(0, 0, 1), color: [0, 0, 255, 0.5] as Rgba } // z = 1, closer to the camera
  // What the middle pixel should be: far red first, then near blue on top of it.
  const correct = (() => {
    const o = over(near.color, over(far.color, white))
    return [Math.round(o[0]), Math.round(o[1]), Math.round(o[2])]
  })()
  const middle = (fb: Framebuffer) => fb.getPixel(20, 20).slice(0, 3)

  it('sorted back to front, overlapping triangles blend in the correct order', () => {
    const { fb, depth } = newScene()
    // Given in the "wrong" order (near first); sorting must fix it.
    renderTransparent(fb, depth, [near, far], cam, { ...opts, sortBackToFront: true })
    // The framebuffer rounds after every blend, so allow 1 unit of rounding difference.
    middle(fb).forEach((v, i) => expect(Math.abs(v - correct[i])).toBeLessThanOrEqual(1))
  })
  it('not sorted, the same input blends in the wrong order', () => {
    const { fb, depth } = newScene()
    renderTransparent(fb, depth, [near, far], cam, { ...opts, sortBackToFront: false })
    const wrong = middle(fb)
    expect(Math.abs(wrong[0] - correct[0]) + Math.abs(wrong[2] - correct[2])).toBeGreaterThan(50)
    // wrong order = red on top of blue, so red is the stronger channel
    expect(wrong[0]).toBeGreaterThan(wrong[2])
    expect(correct[2]).toBeGreaterThan(correct[0])
  })
  it('returns how many pixels were blended', () => {
    const { fb, depth } = newScene()
    const r = renderTransparent(fb, depth, [far], cam, opts)
    expect(r.triangles).toBe(1)
    expect(r.pixelsBlended).toBeGreaterThan(50)
  })
  it('depth test is ON: a transparent triangle behind an opaque one is hidden', () => {
    const { fb, depth } = newScene()
    // opaque green triangle in front (z = 2)
    const front: [number, number, number][] = [[0, 0, 0], [40, 0, 0], [0, 40, 0]]
    fillTriangle(fb, depth, front[0], front[1], front[2], [0, 255, 0, 255])
    // transparent triangle at z = 0 projects somewhere around the middle with depth > 0
    renderTransparent(fb, depth, [far], cam, opts)
    expect(fb.getPixel(5, 5)).toEqual([0, 255, 0, 255]) // still green, not blended
  })
  it('depth WRITE is off: the depth buffer is unchanged by the transparent pass', () => {
    const { fb, depth } = newScene()
    renderTransparent(fb, depth, [far], cam, opts)
    expect(Array.from(depth.data).every((d) => d === Infinity)).toBe(true)
  })
  it('back-face culling stays available: a triangle facing away is skipped when culling is on', () => {
    const away: Mesh = { vertices: [[-1, -1, 0], [0, 1, 0], [1, -1, 0]], triangles: [[0, 1, 2]], edges: [] } // faces -z
    const a = newScene()
    const on = renderTransparent(a.fb, a.depth, [{ ...far, mesh: away }], cam, { ...opts, cullingOn: true })
    const b = newScene()
    const off = renderTransparent(b.fb, b.depth, [{ ...far, mesh: away }], cam, { ...opts, cullingOn: false })
    expect(on.pixelsBlended).toBe(0)
    expect(off.pixelsBlended).toBeGreaterThan(0)
  })
})
