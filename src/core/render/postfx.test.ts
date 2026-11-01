import { describe, it, expect } from 'vitest'
import { applyBloom } from './postfx'
import { Framebuffer } from './framebuffer'

function darkImage() {
  const fb = new Framebuffer(64, 64)
  fb.clear(10, 10, 10, 255)
  return fb
}

describe('applyBloom', () => {
  it('leaves an image with nothing bright in it alone', () => {
    const fb = darkImage()
    const before = Array.from(fb.data)
    applyBloom(fb, { threshold: 0.6, strength: 1 })
    expect(Array.from(fb.data)).toEqual(before)
  })
  it('strength 0 changes nothing', () => {
    const fb = darkImage()
    for (let y = 28; y < 36; y++) for (let x = 28; x < 36; x++) fb.setPixel(x, y, 255, 255, 255, 255)
    const before = Array.from(fb.data)
    applyBloom(fb, { threshold: 0.6, strength: 0 })
    expect(Array.from(fb.data)).toEqual(before)
  })
  it('a bright patch spills light onto its dark neighbours, and far corners stay dark', () => {
    const fb = darkImage()
    for (let y = 28; y < 36; y++) for (let x = 28; x < 36; x++) fb.setPixel(x, y, 255, 255, 255, 255)
    applyBloom(fb, { threshold: 0.6, strength: 1 })
    expect(fb.getPixel(24, 32)[0]).toBeGreaterThan(10 + 5) // next to the patch: glowing
    expect(fb.getPixel(2, 2)[0]).toBe(10) // far away: untouched
  })
  it('only adds light: no pixel gets darker, alpha stays 255', () => {
    const fb = darkImage()
    fb.setPixel(32, 32, 255, 200, 0, 255)
    const before = Array.from(fb.data)
    applyBloom(fb, { threshold: 0.5, strength: 1 })
    for (let i = 0; i < before.length; i += 4) {
      expect(fb.data[i]).toBeGreaterThanOrEqual(before[i])
      expect(fb.data[i + 3]).toBe(255)
    }
  })
  it('the glow keeps the colour of the bright thing (an orange patch glows orange, not blue)', () => {
    const fb = darkImage()
    for (let y = 28; y < 36; y++) for (let x = 28; x < 36; x++) fb.setPixel(x, y, 255, 140, 20, 255)
    applyBloom(fb, { threshold: 0.4, strength: 1 })
    const p = fb.getPixel(24, 32)
    expect(p[0] - 10).toBeGreaterThan(p[2] - 10)
  })
})
