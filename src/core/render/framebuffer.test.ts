import { describe, it, expect } from 'vitest'
import { Framebuffer } from './framebuffer'

describe('Framebuffer', () => {
  it('has width*height*4 bytes, all zero at the start', () => {
    const fb = new Framebuffer(4, 3)
    expect(fb.data.length).toBe(4 * 3 * 4)
    expect(Array.from(fb.data).every((v) => v === 0)).toBe(true)
  })
  it('setPixel then getPixel returns the same color', () => {
    const fb = new Framebuffer(4, 3)
    fb.setPixel(2, 1, 10, 20, 30, 255)
    expect(fb.getPixel(2, 1)).toEqual([10, 20, 30, 255])
  })
  it('stores pixels row by row: pixel (x,y) starts at (y*width + x)*4', () => {
    const fb = new Framebuffer(4, 3)
    fb.setPixel(2, 1, 1, 2, 3, 4)
    const i = (1 * 4 + 2) * 4
    expect(Array.from(fb.data.slice(i, i + 4))).toEqual([1, 2, 3, 4])
  })
  it('setPixel outside the buffer does nothing (and does not crash)', () => {
    const fb = new Framebuffer(4, 3)
    fb.setPixel(-1, 0, 255, 255, 255, 255)
    fb.setPixel(4, 0, 255, 255, 255, 255)
    fb.setPixel(0, -1, 255, 255, 255, 255)
    fb.setPixel(0, 3, 255, 255, 255, 255)
    expect(Array.from(fb.data).every((v) => v === 0)).toBe(true)
  })
  it('getPixel outside the buffer returns transparent black', () => {
    expect(new Framebuffer(2, 2).getPixel(5, 5)).toEqual([0, 0, 0, 0])
  })
  it('clear fills every pixel', () => {
    const fb = new Framebuffer(3, 3)
    fb.clear(1, 2, 3, 4)
    expect(fb.getPixel(0, 0)).toEqual([1, 2, 3, 4])
    expect(fb.getPixel(2, 2)).toEqual([1, 2, 3, 4])
  })
  it('values are clamped to 0..255', () => {
    const fb = new Framebuffer(1, 1)
    fb.setPixel(0, 0, 300, -5, 0, 255)
    expect(fb.getPixel(0, 0)).toEqual([255, 0, 0, 255])
  })
})
