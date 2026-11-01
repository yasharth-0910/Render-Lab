// framebuffer.ts - the image we draw into, kept in plain memory (no canvas needed).
//
// Pixels are stored as 4 bytes each: red, green, blue, alpha (0..255), in rows
// from the TOP row down. Pixel (x, y) starts at byte index (y * width + x) * 4.
// x = 0 is the left edge, y = 0 is the top edge.

export type Color = readonly [number, number, number, number]

export class Framebuffer {
  readonly width: number
  readonly height: number
  // Uint8ClampedArray forces every value into 0..255 for us (300 becomes 255, -5 becomes 0).
  readonly data: Uint8ClampedArray<ArrayBuffer>

  constructor(width: number, height: number) {
    this.width = width
    this.height = height
    this.data = new Uint8ClampedArray(width * height * 4)
  }

  /** Fill the whole image with one color. */
  clear(r: number, g: number, b: number, a: number): void {
    for (let i = 0; i < this.data.length; i += 4) {
      this.data[i] = r
      this.data[i + 1] = g
      this.data[i + 2] = b
      this.data[i + 3] = a
    }
  }

  /** Write one pixel. Coordinates outside the image are ignored. */
  setPixel(x: number, y: number, r: number, g: number, b: number, a: number): void {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return
    const i = (Math.floor(y) * this.width + Math.floor(x)) * 4
    this.data[i] = r
    this.data[i + 1] = g
    this.data[i + 2] = b
    this.data[i + 3] = a
  }

  /** Read one pixel as [r, g, b, a]. Outside the image gives transparent black. */
  getPixel(x: number, y: number): [number, number, number, number] {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return [0, 0, 0, 0]
    const i = (Math.floor(y) * this.width + Math.floor(x)) * 4
    return [this.data[i], this.data[i + 1], this.data[i + 2], this.data[i + 3]]
  }
}
