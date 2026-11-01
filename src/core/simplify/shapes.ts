// shapes.ts - sample shapes made in code (no downloads), plus a reader for pasted data.
// Every random number comes from a seeded generator, so the shapes are the same every time.

import type { Pt } from './visvalingam'

export type Shape = { name: string; points: Pt[]; closed: boolean }

// A small seeded random number generator (mulberry32): same seed, same numbers.
function makeRandom(seed: number): () => number {
  let s = seed
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// A table of 256 random numbers in -1..1. Noise is made by blending between table entries.
function makeLattice(seed: number): number[] {
  const random = makeRandom(seed)
  return Array.from({ length: 256 }, () => random() * 2 - 1)
}

// Smooth value noise at position t. The table repeats every `period` entries.
function noise(lattice: number[], t: number, period: number): number {
  const i = Math.floor(t)
  const f = t - i
  const at = (k: number) => lattice[((k % period) + period) % period]
  const smooth = f * f * (3 - 2 * f) // eases the blend so there are no sharp creases
  return at(i) + (at(i + 1) - at(i)) * smooth
}

// Fractal noise: add noise at doubling frequencies and halving-ish strength.
// Result is scaled to stay roughly within -1..1.
function fractal(lattice: number[], t: number, octaves: number, persistence: number, basePeriod: number): number {
  let sum = 0
  let amplitude = 1
  let total = 0
  for (let k = 0; k < octaves; k++) {
    const frequency = 2 ** k
    sum += amplitude * noise(lattice, t * frequency, basePeriod * frequency)
    total += amplitude
    amplitude *= persistence
  }
  return sum / total
}

/** A wiggly coastline: an open polyline of 500 points running left to right. */
export function createCoastline(): Shape {
  const lattice = makeLattice(1)
  const points: Pt[] = []
  for (let i = 0; i < 500; i++) {
    const x = (i / 499) * 10
    // period 200 is longer than the line, so the pattern never repeats along it
    points.push([x, 3 * fractal(lattice, x * 0.5, 6, 0.55, 200)])
  }
  return { name: 'Coastline', points, closed: false }
}

/** An island outline: a closed polygon of 400 points, a circle pushed in and out by noise. */
export function createIsland(): Shape {
  const lattice = makeLattice(2)
  const points: Pt[] = []
  for (let i = 0; i < 400; i++) {
    const u = i / 400 // 0..1 once around
    const angle = 2 * Math.PI * u
    // basePeriod 3: the noise repeats every 3 lattice cells, so the end joins the start
    const radius = 1 + 0.35 * fractal(lattice, u * 3, 6, 0.55, 3)
    points.push([radius * Math.cos(angle), radius * Math.sin(angle)])
  }
  return { name: 'Island', points, closed: true }
}

/** A spiral: an open polyline of 300 points, 4 turns. */
export function createSpiral(): Shape {
  const points: Pt[] = []
  for (let i = 0; i < 300; i++) {
    const angle = (i / 299) * 8 * Math.PI
    const radius = 0.05 + angle * 0.04
    points.push([radius * Math.cos(angle), radius * Math.sin(angle)])
  }
  return { name: 'Spiral', points, closed: false }
}

/** A hand-drawn style 5-point star: closed, 400 points, with a gentle wobble. */
export function createStar(): Shape {
  const wobbleX = makeLattice(3)
  const wobbleY = makeLattice(4)
  // The 10 corners of the star: outer and inner radius alternate.
  const corners: Pt[] = []
  for (let k = 0; k < 10; k++) {
    const angle = Math.PI / 2 + (k * Math.PI) / 5
    const radius = k % 2 === 0 ? 1 : 0.45
    corners.push([radius * Math.cos(angle), radius * Math.sin(angle)])
  }
  const points: Pt[] = []
  for (let k = 0; k < 10; k++) {
    const a = corners[k]
    const b = corners[(k + 1) % 10]
    for (let j = 0; j < 40; j++) {
      const t = j / 40 // how far along this edge
      const u = (k * 40 + j) / 400 // how far around the whole outline
      points.push([
        a[0] + (b[0] - a[0]) * t + 0.03 * fractal(wobbleX, u * 5, 4, 0.5, 5),
        a[1] + (b[1] - a[1]) * t + 0.03 * fractal(wobbleY, u * 5, 4, 0.5, 5),
      ])
    }
  }
  return { name: 'Star', points, closed: true }
}

/**
 * Read points from pasted text: one point per line, "x,y" (a space or ; also works).
 * Blank lines and lines starting with # are ignored. Other unreadable lines are counted in `bad`.
 */
export function parsePoints(text: string): { points: Pt[]; bad: number } {
  const points: Pt[] = []
  let bad = 0
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (line === '' || line.startsWith('#')) continue
    const parts = line.split(/[,;\s]+/)
    const x = Number(parts[0])
    const y = Number(parts[1])
    if (parts.length === 2 && parts[0] !== '' && parts[1] !== '' && Number.isFinite(x) && Number.isFinite(y)) {
      points.push([x, y])
    } else {
      bad++
    }
  }
  return { points, bad }
}
