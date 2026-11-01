// postfx.ts - a finished image can be improved after drawing. Here: BLOOM, the glow around very
// bright things (the orb, neon lights).
//
// Steps:
//  1. Keep only the bright part of each pixel: max(0, colour - threshold).
//  2. Shrink that to a quarter of the size (average each 4x4 block): cheap, and blurring a small
//     image spreads light over a big area.
//  3. Blur it with a box blur, three times (three box blurs look like a smooth gaussian blur).
//  4. Stretch it back to full size (bilinear) and ADD it to the image.
// Adding only ever makes pixels brighter, and the alpha channel is not touched.

import type { Framebuffer } from './framebuffer'

export type BloomOptions = {
  threshold: number // 0..1: brightness above which a pixel glows
  strength: number // how much glow to add back (1 = normal)
}

const SHRINK = 4 // the glow image is this many times smaller than the picture
const BLUR_RADIUS = 2 // box blur reaches this many small pixels each way
const BLUR_PASSES = 3
const GAIN = 2 // makes strength 1 look right

// One box blur along rows, then along columns, on one colour channel (zeros outside the image).
function boxBlur(channel: Float32Array, w: number, h: number): Float32Array {
  const width = 2 * BLUR_RADIUS + 1
  const temp = new Float32Array(channel.length)
  const out = new Float32Array(channel.length)
  for (let y = 0; y < h; y++) {
    let sum = 0
    for (let x = -BLUR_RADIUS; x <= BLUR_RADIUS; x++) if (x >= 0 && x < w) sum += channel[y * w + x]
    for (let x = 0; x < w; x++) {
      temp[y * w + x] = sum / width
      const leaving = x - BLUR_RADIUS
      const entering = x + BLUR_RADIUS + 1
      if (leaving >= 0) sum -= channel[y * w + leaving]
      if (entering < w) sum += channel[y * w + entering]
    }
  }
  for (let x = 0; x < w; x++) {
    let sum = 0
    for (let y = -BLUR_RADIUS; y <= BLUR_RADIUS; y++) if (y >= 0 && y < h) sum += temp[y * w + x]
    for (let y = 0; y < h; y++) {
      out[y * w + x] = sum / width
      const leaving = y - BLUR_RADIUS
      const entering = y + BLUR_RADIUS + 1
      if (leaving >= 0) sum -= temp[leaving * w + x]
      if (entering < h) sum += temp[entering * w + x]
    }
  }
  return out
}

/** Add a glow around the bright parts of the framebuffer, in place. */
export function applyBloom(fb: Framebuffer, { threshold, strength }: BloomOptions): void {
  if (strength <= 0) return
  const w = Math.ceil(fb.width / SHRINK)
  const h = Math.ceil(fb.height / SHRINK)
  const channels = [new Float32Array(w * h), new Float32Array(w * h), new Float32Array(w * h)]

  // 1 + 2: bright part, averaged into small blocks.
  let anyBright = false
  for (let y = 0; y < fb.height; y++) {
    for (let x = 0; x < fb.width; x++) {
      const i = (y * fb.width + x) * 4
      const cell = Math.floor(y / SHRINK) * w + Math.floor(x / SHRINK)
      for (let c = 0; c < 3; c++) {
        const bright = Math.max(0, fb.data[i + c] / 255 - threshold)
        if (bright > 0) {
          channels[c][cell] += bright / (SHRINK * SHRINK)
          anyBright = true
        }
      }
    }
  }
  if (!anyBright) return

  // 3: blur.
  const blurred = channels.map((ch) => {
    let result: Float32Array = ch
    for (let pass = 0; pass < BLUR_PASSES; pass++) result = boxBlur(result, w, h)
    return result
  })

  // 4: stretch back (bilinear) and add.
  for (let y = 0; y < fb.height; y++) {
    const fy = Math.max(0, (y + 0.5) / SHRINK - 0.5)
    const y0 = Math.min(h - 1, Math.floor(fy))
    const y1 = Math.min(h - 1, y0 + 1)
    const ty = fy - y0
    for (let x = 0; x < fb.width; x++) {
      const fx = Math.max(0, (x + 0.5) / SHRINK - 0.5)
      const x0 = Math.min(w - 1, Math.floor(fx))
      const x1 = Math.min(w - 1, x0 + 1)
      const tx = fx - x0
      const i = (y * fb.width + x) * 4
      for (let c = 0; c < 3; c++) {
        const ch = blurred[c]
        const top = ch[y0 * w + x0] * (1 - tx) + ch[y0 * w + x1] * tx
        const bottom = ch[y1 * w + x0] * (1 - tx) + ch[y1 * w + x1] * tx
        const glow = top * (1 - ty) + bottom * ty
        fb.data[i + c] += glow * 255 * strength * GAIN // Uint8ClampedArray rounds and clamps for us
      }
    }
  }
}
