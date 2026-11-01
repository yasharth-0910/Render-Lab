import { describe, it, expect } from 'vitest'
import { lightAt, fogMix, type Lighting, type Material } from './lighting'

const white: Material = { color: [1, 1, 1] }
const dark: Lighting = { ambient: [0.2, 0.2, 0.2], lights: [] }

describe('lightAt', () => {
  it('with no lights every direction gets the same ambient grey', () => {
    expect(lightAt(white, [0, 0, 0], [0, 1, 0], dark)).toEqual(lightAt(white, [0, 0, 0], [0, -1, 0], dark))
  })
  it('a lamp above lights an upward face but not a downward one', () => {
    const lit: Lighting = { ambient: [0.05, 0.05, 0.05], lights: [{ position: [0, 3, 0], color: [1, 1, 1], intensity: 2, range: 5 }] }
    const up = lightAt(white, [0, 0, 0], [0, 1, 0], lit)
    const down = lightAt(white, [0, 0, 0], [0, -1, 0], lit)
    expect(up[0]).toBeGreaterThan(down[0] + 30)
    expect(down[0]).toBeCloseTo(lightAt(white, [0, 0, 0], [0, -1, 0], { ...lit, lights: [] })[0])
  })
  it('a lamp that is farther away gives less light', () => {
    const at = (y: number): Lighting => ({ ambient: [0, 0, 0], lights: [{ position: [0, y, 0], color: [1, 1, 1], intensity: 2, range: 3 }] })
    expect(lightAt(white, [0, 0, 0], [0, 1, 0], at(2))[0]).toBeGreaterThan(lightAt(white, [0, 0, 0], [0, 1, 0], at(8))[0])
  })
  it('light colour tints the surface', () => {
    const red: Lighting = { ambient: [0, 0, 0], lights: [{ position: [0, 2, 0], color: [1, 0, 0], intensity: 2, range: 5 }] }
    const c = lightAt(white, [0, 0, 0], [0, 1, 0], red)
    expect(c[0]).toBeGreaterThan(100)
    expect(c[1]).toBe(0)
  })
  it('emissive colour glows even in the dark', () => {
    const glow = lightAt({ color: [0, 0, 0], emissive: [1, 0.2, 0] }, [0, 0, 0], [0, 1, 0], { ambient: [0, 0, 0], lights: [] })
    expect(glow[0]).toBeGreaterThan(100)
    expect(glow[0]).toBeGreaterThan(glow[1])
    expect(glow[2]).toBe(0)
  })
  it('a directional light lights faces that point towards it', () => {
    const sun: Lighting = { ambient: [0, 0, 0], lights: [], directional: { direction: [0, 1, 0], color: [1, 1, 1] } }
    expect(lightAt(white, [0, 0, 0], [0, 1, 0], sun)[0]).toBeGreaterThan(50)
    expect(lightAt(white, [0, 0, 0], [0, -1, 0], sun)[0]).toBe(0)
  })
  it('never goes above 255, however bright the light, and never below 0', () => {
    const blazing: Lighting = { ambient: [50, 50, 50], lights: [] }
    for (const v of lightAt(white, [0, 0, 0], [0, 1, 0], blazing)) expect(v <= 255 && v >= 0).toBe(true)
  })
  it('brighter light never gives a darker pixel', () => {
    let last = -1
    for (const intensity of [0, 0.5, 1, 2, 4, 8]) {
      const c = lightAt(white, [0, 0, 0], [0, 1, 0], { ambient: [0, 0, 0], lights: [{ position: [0, 2, 0], color: [1, 1, 1], intensity, range: 4 }] })[0]
      expect(c).toBeGreaterThanOrEqual(last)
      last = c
    }
  })
})

describe('fogMix', () => {
  it('no fog (density 0) leaves the colour alone', () => {
    expect(fogMix([200, 100, 50], 30, [0, 0, 0], 0)).toEqual([200, 100, 50])
  })
  it('far away the colour becomes the fog colour', () => {
    const c = fogMix([200, 100, 50], 1000, [10, 20, 30], 0.5)
    expect(c[0]).toBeCloseTo(10, 0)
    expect(c[2]).toBeCloseTo(30, 0)
  })
  it('farther is foggier', () => {
    expect(fogMix([200, 0, 0], 20, [0, 0, 0], 0.05)[0]).toBeLessThan(fogMix([200, 0, 0], 5, [0, 0, 0], 0.05)[0])
  })
})
