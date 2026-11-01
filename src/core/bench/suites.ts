// suites.ts - the five benchmark suites. Each one runs real code from this project and returns one or
// more result tables (see bench.ts for the timing and the table format).
//
//  1. culling    : the reactor scene and spheres, back-face culling off vs on, filled and wireframe
//  2. bresenham  : drawLine (Bresenham) against the old DDA line, short / medium / long lines
//  3. alpha      : the cost of over() for 1, 2, 4, 8 layers, and the 3D transparent pass sorted vs not
//  4. vw         : Visvalingam-Whyatt (and RDP for comparison) on coastlines of growing size
//  5. transforms : matrix multiply, matrix inverse, quaternion rotation against matrix rotation
//
// The sizes are in SuiteSizes, so the web page can use big ones and the tests tiny ones.

import { identity, inverse, multiply, rotateAxis, rotateX, translate, transformPoint } from '../math/mat4'
import type { Vec3 } from '../math/vec3'
import { fromAxisAngle, rotateVec3 } from '../math/quat'
import { over, type Rgba } from '../render/alpha'
import type { Camera } from '../render/camera'
import { DepthBuffer } from '../render/fill'
import { Framebuffer } from '../render/framebuffer'
import { bresenhamSteps, drawLine } from '../render/line'
import { ddaSteps } from '../render/dda'
import { createGround, createUVSphere } from '../render/meshes'
import { createReactorScene } from '../render/reactorScene'
import { renderShaded, type SceneObject } from '../render/scene'
import { renderTransparent, type TransparentItem } from '../render/transparent'
import { maxDistance, polygonArea } from '../simplify/metrics'
import { rdp } from '../simplify/rdp'
import { createCoastline } from '../simplify/shapes'
import { simplifyToCount, type Pt } from '../simplify/visvalingam'
import { BenchCancelled, consume, timeBatched, timeChunked, type BenchRow, type BenchTable, type TimeStats } from './bench'

export { BenchCancelled }

export type SuiteSizes = {
  culling: { reactor: boolean; sphereSegments: number[]; width: number; height: number }
  bresenham: { lines: number }
  alpha: { width: number; height: number; layers: number[] }
  vw: { sizes: number[] }
  transforms: { ops: number }
}

/** The sizes asked for in the task. */
export const DEFAULT_SIZES: SuiteSizes = {
  culling: { reactor: true, sphereSegments: [8, 16, 32, 64], width: 640, height: 480 },
  bresenham: { lines: 10000 },
  alpha: { width: 640, height: 480, layers: [1, 2, 4, 8] },
  vw: { sizes: [100, 200, 500, 1000, 2000] },
  transforms: { ops: 1_000_000 },
}

/** Tiny sizes, so the tests run in a moment. */
export const TEST_SIZES: SuiteSizes = {
  culling: { reactor: false, sphereSegments: [8, 16], width: 64, height: 48 },
  bresenham: { lines: 40 },
  alpha: { width: 32, height: 24, layers: [1, 2] },
  vw: { sizes: [40, 80] },
  transforms: { ops: 2000 },
}

export type BenchConfig = {
  runs: number // timed runs per measurement
  warmup: number // runs before that, not counted
  pause: () => Promise<void> // awaited between runs: lets the web page breathe
  isCancelled: () => boolean
  onProgress: (done: number, total: number, label: string) => void
  sizes: SuiteSizes
}

export const defaultConfig = (): BenchConfig => ({
  runs: 5, warmup: 2, pause: async () => {}, isCancelled: () => false, onProgress: () => {}, sizes: DEFAULT_SIZES,
})

export type SuiteId = 'culling' | 'bresenham' | 'alpha' | 'vw' | 'transforms'

// A small seeded random number generator, so every run measures the same lines.
function makeRandom(seed: number): () => number {
  let s = seed
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Time a job (very quick jobs are repeated inside each run, and the time of one call is reported).
const measure = (cfg: BenchConfig, fn: () => void): Promise<TimeStats> => timeBatched(fn, cfg.runs, cfg.warmup, cfg.pause, cfg.isCancelled)

// ======================================================================
// 1. Back-face culling
// ======================================================================

async function cullingSuite(cfg: BenchConfig): Promise<BenchTable[]> {
  const { reactor, sphereSegments, width, height } = cfg.sizes.culling
  const base = createReactorScene()
  const lookAt = (eye: Vec3, target: Vec3): Camera =>
    ({ eye, target, up: [0, 1, 0], fovY: Math.PI / 3, aspect: width / height, near: 0.1, far: 120 })

  // The scenes to draw.
  const scenarios: { name: string; objects: SceneObject[]; camera: Camera }[] = []
  if (reactor) {
    const { yaw, pitch, dist, target } = base.view
    const eye: Vec3 = [
      target[0] + dist * Math.cos(pitch) * Math.sin(yaw), target[1] + dist * Math.sin(pitch), target[2] + dist * Math.cos(pitch) * Math.cos(yaw),
    ]
    scenarios.push({ name: 'Reactor scene', objects: base.objects, camera: lookAt(eye, target) })
  }
  for (const segments of sphereSegments) {
    const mesh = createUVSphere(segments, Math.max(3, Math.floor(segments / 2)))
    scenarios.push({ name: `Sphere ${segments} segments`, objects: [{ mesh, model: identity(), material: { color: [0.7, 0.7, 0.8] } }], camera: lookAt([0, 0.3, 3], [0, 0, 0]) })
  }

  const fb = new Framebuffer(width, height)
  const depth = new DepthBuffer(width, height)
  const rows: BenchRow[] = []
  const summary: string[] = []
  const total = scenarios.length * 4
  let done = 0

  for (const scenario of scenarios) {
    for (const style of ['filled', 'wireframe'] as const) {
      const result = {} as Record<'off' | 'on', { stats: { triangles: number; drawn: number; culled: number }; time: TimeStats }>
      for (const culling of ['off', 'on'] as const) {
        let stats = { triangles: 0, drawn: 0, culled: 0 }
        const time = await measure(cfg, () => {
          fb.clear(0, 0, 0, 255) // clearing is part of drawing a frame, so it is timed too
          depth.clear()
          stats = renderShaded(fb, depth, scenario.objects, scenario.camera, {
            lighting: base.lighting, fog: base.fog, cullBackFaces: culling === 'on', style,
          })
        })
        result[culling] = { stats, time }
        cfg.onProgress(++done, total, `${scenario.name}, ${style}, culling ${culling}`)
      }
      const speedUp = result.off.time.median / result.on.time.median
      for (const culling of ['off', 'on'] as const) {
        const { stats, time } = result[culling]
        rows.push({
          scenario: scenario.name, style, culling, triangles: stats.triangles, drawn: stats.drawn, culled: stats.culled,
          'culled %': stats.triangles === 0 ? 0 : (100 * stats.culled) / stats.triangles,
          'median ms': time.median, 'min ms': time.min, 'speed-up': culling === 'off' ? 1 : speedUp,
        })
      }
      summary.push(`${scenario.name}, ${style}: culling on is ${speedUp.toFixed(2)}x as fast, ${((100 * result.on.stats.culled) / Math.max(1, result.on.stats.triangles)).toFixed(1)}% of triangles culled`)
    }
  }

  return [{
    id: 'culling', title: 'Back-face culling: off vs on',
    columns: ['scenario', 'style', 'culling', 'triangles', 'drawn', 'culled', 'culled %', 'median ms', 'min ms', 'speed-up'],
    rows, summary,
    notes: [`Each frame is ${width} x ${height}. "drawn" are the triangles filled or outlined; "culled" were skipped because they face away.`, 'speed-up = median time with culling off / median time with culling on.'],
    chart: {
      title: 'Frame time, filled triangles', yLabel: 'median ms per frame', series: ['culling off', 'culling on'],
      groups: scenarios.map((s) => ({
        label: s.name,
        values: (['off', 'on'] as const).map((c) => rows.find((r) => r.scenario === s.name && r.style === 'filled' && r.culling === c)!['median ms'] as number),
      })),
    },
  }]
}

// ======================================================================
// 2. Bresenham against DDA
// ======================================================================

async function bresenhamSuite(cfg: BenchConfig): Promise<BenchTable[]> {
  const count = cfg.sizes.bresenham.lines
  const classes = [{ label: 'short (~10 px)', length: 10 }, { label: 'medium (~100 px)', length: 100 }, { label: 'long (~500 px)', length: 500 }]
  const fb = new Framebuffer(1024, 1024)
  const white = [255, 255, 255, 255] as const
  const rows: BenchRow[] = []
  const total = classes.length * 4
  let done = 0

  for (const { label, length } of classes) {
    // Lines from the middle of the picture in random directions: all 8 octants, any slope.
    const random = makeRandom(7)
    const lines: [number, number, number, number][] = []
    for (let i = 0; i < count; i++) {
      const angle = random() * 2 * Math.PI
      const len = length * (0.8 + 0.4 * random())
      lines.push([512, 512, Math.round(512 + len * Math.cos(angle)), Math.round(512 + len * Math.sin(angle))])
    }

    // Not timed: how many pixels each draws, and how many are at a different place.
    let pixelsBresenham = 0
    let pixelsDda = 0
    let differing = 0
    for (const [x0, y0, x1, y1] of lines) {
      const b = bresenhamSteps(x0, y0, x1, y1)
      const d = ddaSteps(x0, y0, x1, y1)
      pixelsBresenham += b.length
      pixelsDda += d.length
      for (let i = 0; i < Math.min(b.length, d.length); i++) if (b[i].x !== d[i].x || b[i].y !== d[i].y) differing++
    }

    const variants: { name: string; run: () => void }[] = [
      { name: 'Bresenham drawLine', run: () => { for (const [a, b, c, d] of lines) drawLine(fb, a, b, c, d, white) } },
      { name: 'DDA + setPixel', run: () => { for (const [a, b, c, d] of lines) for (const p of ddaSteps(a, b, c, d)) fb.setPixel(p.x, p.y, 255, 255, 255, 255) } },
      { name: 'bresenhamSteps only', run: () => { let n = 0; for (const [a, b, c, d] of lines) n += bresenhamSteps(a, b, c, d).length; consume(n) } },
      { name: 'ddaSteps only', run: () => { let n = 0; for (const [a, b, c, d] of lines) n += ddaSteps(a, b, c, d).length; consume(n) } },
    ]
    const times: TimeStats[] = []
    for (const variant of variants) {
      times.push(await measure(cfg, variant.run))
      cfg.onProgress(++done, total, `${label}: ${variant.name}`)
    }
    variants.forEach((variant, i) => {
      const reference = times[i % 2 === 0 ? i : i - 1] // each DDA row is compared with the Bresenham row above it
      rows.push({
        'line length': label, algorithm: variant.name, lines: count, pixels: i % 2 === 0 ? pixelsBresenham : pixelsDda,
        'median ms': times[i].median, 'min ms': times[i].min, 'µs per line': (times[i].median * 1000) / count,
        relative: times[i].median / reference.median, 'pixel count diff': pixelsBresenham - pixelsDda, 'pixels at other places': differing,
      })
    })
  }

  return [{
    id: 'bresenham', title: `Line drawing: Bresenham vs DDA (${count.toLocaleString()} lines per row)`,
    columns: ['line length', 'algorithm', 'lines', 'pixels', 'median ms', 'min ms', 'µs per line', 'relative', 'pixel count diff', 'pixels at other places'],
    rows,
    notes: [
      'relative = time / time of the Bresenham row it is paired with (so Bresenham is always 1).',
      'JavaScript works with floating point numbers everywhere, so Bresenham\'s whole-number arithmetic is not expected to be faster here. Its advantage is on hardware where integers are much cheaper than divisions.',
      'pixel count diff = Bresenham pixels - DDA pixels (0: both draw max(|dx|,|dy|)+1 pixels per line). pixels at other places = pixels that are in a different position (they differ only by rounding).',
    ],
    chart: {
      title: 'Drawing lines (writing the pixels)', yLabel: 'median ms for all lines', series: ['Bresenham drawLine', 'DDA + setPixel'],
      groups: classes.map((c) => ({
        label: c.label,
        values: ['Bresenham drawLine', 'DDA + setPixel'].map((a) => rows.find((r) => r['line length'] === c.label && r.algorithm === a)!['median ms'] as number),
      })),
    },
  }]
}

// ======================================================================
// 3. Alpha compositing
// ======================================================================

async function alphaSuite(cfg: BenchConfig): Promise<BenchTable[]> {
  const { width, height, layers } = cfg.sizes.alpha
  const pixels = width * height
  const colours: Rgba[] = [
    [255, 0, 0, 0.5], [0, 255, 0, 0.5], [0, 0, 255, 0.5], [255, 255, 0, 0.5],
    [0, 255, 255, 0.5], [255, 0, 255, 0.5], [255, 128, 0, 0.5], [128, 0, 255, 0.5],
  ]
  const total = layers.length + 2
  let done = 0

  // Part 1: blend L layers over a background, for every pixel of the buffer.
  const overRows: BenchRow[] = []
  for (const count of layers) {
    const stack = colours.slice(0, count)
    const time = await measure(cfg, () => {
      let acc = 0
      for (let p = 0; p < pixels; p++) {
        let colour: Rgba = [20, 20, 30, 1]
        for (const layer of stack) colour = over(layer, colour)
        acc += colour[0]
      }
      consume(acc)
    })
    overRows.push({ layers: count, pixels, 'over calls': pixels * count, 'median ms': time.median, 'min ms': time.min, 'ns per over call': (time.median * 1e6) / (pixels * count) })
    cfg.onProgress(++done, total, `over() with ${count} layer(s)`)
  }

  // Part 2: the see-through pass of the 3D renderer, panes sorted back to front or not.
  const pane = createGround(2.4, 6) // a flat square cut into small squares, 72 triangles
  const items: TransparentItem[] = [0, 1, 2, 3, 4, 5].map((k) => ({
    mesh: pane,
    model: multiply(translate(-1.2 + k * 0.5, 0.2 * k, -2.5 + k * 1.0), rotateX(Math.PI / 2)),
    color: [60 + k * 30, 120, 255 - k * 30, 0.4] as Rgba,
  }))
  const camera: Camera = { eye: [1.5, 1, 5], target: [0, 0.6, 0], up: [0, 1, 0], fovY: Math.PI / 3, aspect: width / height, near: 0.1, far: 100 }
  const fb = new Framebuffer(width, height)
  const depth = new DepthBuffer(width, height)
  const passRows: BenchRow[] = []
  const times: TimeStats[] = []
  for (const sort of [false, true]) {
    let result = { triangles: 0, pixelsBlended: 0 }
    const time = await measure(cfg, () => {
      fb.clear(20, 20, 30, 255)
      depth.clear()
      result = renderTransparent(fb, depth, items, camera, { cullingOn: false, mode: 'view', sortBackToFront: sort })
    })
    times.push(time)
    passRows.push({ sort: sort ? 'on' : 'off', triangles: result.triangles, 'pixels blended': result.pixelsBlended, 'median ms': time.median, 'min ms': time.min, relative: 0 })
    cfg.onProgress(++done, total, `transparent pass, sort ${sort ? 'on' : 'off'}`)
  }
  for (const row of passRows) row.relative = (row['median ms'] as number) / times[0].median

  return [
    {
      id: 'alpha-over', title: `Alpha compositing: over() on ${width} x ${height} pixels`,
      columns: ['layers', 'pixels', 'over calls', 'median ms', 'min ms', 'ns per over call'],
      rows: overRows,
      notes: ['Every pixel blends the layers one after the other over a background, with over() from alpha.ts.', 'The time should grow in step with the number of layers (the "ns per over call" column stays about the same).'],
      chart: { title: 'Blending cost by number of layers', yLabel: 'median ms for the whole buffer', series: ['over()'], groups: overRows.map((r) => ({ label: `${r.layers} layer${r.layers === 1 ? '' : 's'}`, values: [r['median ms'] as number] })) },
    },
    {
      id: 'alpha-pass', title: 'Alpha compositing: the 3D see-through pass, sorted vs not',
      columns: ['sort', 'triangles', 'pixels blended', 'median ms', 'min ms', 'relative'],
      rows: passRows,
      notes: ['6 overlapping see-through panes. Sorting costs a little, and it is what makes the blend order (and so the colours) correct.', 'relative = time / time with the sort off.'],
      chart: { title: 'See-through pass', yLabel: 'median ms per frame', series: ['sort off', 'sort on'], groups: [{ label: '6 panes', values: times.map((t) => t.median) }] },
    },
  ]
}

// ======================================================================
// 4. Visvalingam-Whyatt (with RDP for comparison)
// ======================================================================

// The smallest tolerance for which RDP keeps at most `target` points (found by halving the search range).
function findEpsilon(points: readonly Pt[], target: number): number {
  let low = 0
  let high = 1
  while (rdp(points, high, false).length > target && high < 1e9) high *= 2
  for (let i = 0; i < 30; i++) {
    const mid = (low + high) / 2
    if (rdp(points, mid, false).length > target) low = mid
    else high = mid
  }
  return high
}

async function vwSuite(cfg: BenchConfig): Promise<BenchTable[]> {
  const { sizes } = cfg.sizes.vw
  const rows: BenchRow[] = []
  const total = sizes.length * 2
  let done = 0
  const previous: Record<string, { n: number; ms: number }> = {}

  for (const n of sizes) {
    const points = createCoastline(n).points
    const target = Math.max(3, Math.round(n * 0.1)) // keep 10% of the points
    const originalArea = polygonArea(points) // the open line closed by joining its two ends

    for (const algorithm of ['VW', 'RDP'] as const) {
      let result: Pt[] = []
      let time: TimeStats
      if (algorithm === 'VW') {
        time = await measure(cfg, () => { result = simplifyToCount(points, false, target) })
      } else {
        const epsilon = findEpsilon(points, target) // found first, not timed: we time RDP itself
        time = await measure(cfg, () => { result = rdp(points, epsilon, false) })
      }
      const before = previous[algorithm]
      rows.push({
        points: n, algorithm, kept: result.length, 'median ms': time.median, 'min ms': time.min,
        'time ratio': before && before.ms > 0 ? time.median / before.ms : '', 'n² ratio': before ? Math.pow(n / before.n, 2) : '',
        'area error %': originalArea === 0 ? 0 : (100 * Math.abs(polygonArea(result) - originalArea)) / originalArea,
        'max distance': maxDistance(points, result, false),
      })
      previous[algorithm] = { n, ms: time.median }
      cfg.onProgress(++done, total, `${algorithm} on ${n} points`)
    }
  }

  // How fast does the VW time grow? Fit time ~ n^k between the smallest and the largest size.
  const vw = rows.filter((r) => r.algorithm === 'VW')
  const first = vw[0]
  const last = vw[vw.length - 1]
  const exponent = vw.length > 1 ? Math.log((last['median ms'] as number) / (first['median ms'] as number)) / Math.log((last.points as number) / (first.points as number)) : NaN
  const summary = [`VW time grows like n^${exponent.toFixed(2)} between ${first.points} and ${last.points} points (n^2 would be 2.00)`]

  return [{
    id: 'vw', title: 'Line simplification: Visvalingam-Whyatt vs RDP on a coastline',
    columns: ['points', 'algorithm', 'kept', 'median ms', 'min ms', 'time ratio', 'n² ratio', 'area error %', 'max distance'],
    rows, summary,
    notes: [
      'Jobs shorter than 10 ms are repeated until a sample lasts at least 10 ms, and the time of ONE call is reported (the browser clock is too coarse for single microseconds).',
      'Each run keeps 10% of the points. The coastline has the same seeded shape at every size (a bigger n samples it more finely).',
      'time ratio = time / time at the previous size. If the algorithm is O(n²), it should be close to n² ratio = (n / previous n)².',
      'Our VW rescans all points for the smallest triangle at every removal (O(n²)); a heap would make it O(n log n).',
      'area error % = difference in the area between the line and the straight line joining its two ends (the open line closed up). max distance = farthest an original point is from the simplified line. RDP is timed at the tolerance that gives about the same number of points.',
    ],
    chart: {
      title: 'Simplification time by number of points (log scale)', yLabel: 'median ms (log)', series: ['VW', 'RDP'], logScale: true,
      groups: sizes.map((n) => ({
        label: `${n}`,
        values: (['VW', 'RDP'] as const).map((a) => rows.find((r) => r.points === n && r.algorithm === a)!['median ms'] as number),
      })),
    },
  }]
}

// ======================================================================
// 5. Transformations
// ======================================================================

async function transformsSuite(cfg: BenchConfig): Promise<BenchTable[]> {
  const { ops } = cfg.sizes.transforms
  const chunk = Math.min(100_000, ops) // the work is done in pieces so the page can breathe
  const a = multiply(translate(1, 2, 3), rotateAxis([1, 2, 3], 0.7))
  const b = multiply(translate(-2, 0.5, 1), rotateAxis([0, 1, 1], -0.4))
  const q = fromAxisAngle([1, 2, 3], 0.7)
  const rotation = rotateAxis([1, 2, 3], 0.7)

  const jobs: { operation: string; work: (count: number) => void }[] = [
    { operation: 'mat4 multiply', work: (n) => { let acc = 0; for (let i = 0; i < n; i++) acc += multiply(a, b)[i & 15]; consume(acc) } },
    { operation: 'mat4 inverse', work: (n) => { let acc = 0; for (let i = 0; i < n; i++) acc += inverse(a)[i & 15]; consume(acc) } },
    { operation: 'quaternion rotateVec3', work: (n) => { let acc = 0; for (let i = 0; i < n; i++) acc += rotateVec3(q, [i * 1e-6, 0.5, 0.2])[0]; consume(acc) } },
    { operation: 'matrix transformPoint', work: (n) => { let acc = 0; for (let i = 0; i < n; i++) acc += transformPoint(rotation, [i * 1e-6, 0.5, 0.2])[0]; consume(acc) } },
  ]

  const rows: BenchRow[] = []
  for (const job of jobs) {
    const time = await timeChunked(job.work, ops, chunk, cfg.runs, cfg.warmup, cfg.pause, cfg.isCancelled)
    rows.push({ operation: job.operation, operations: ops, 'median ms': time.median, 'min ms': time.min, 'ns per op': (time.median * 1e6) / ops, relative: 0 })
    cfg.onProgress(rows.length, jobs.length, job.operation)
  }
  const fastest = Math.min(...rows.map((r) => r['ns per op'] as number))
  for (const row of rows) row.relative = (row['ns per op'] as number) / fastest

  return [{
    id: 'transforms', title: `Transformations: ${ops.toLocaleString()} operations each`,
    columns: ['operation', 'operations', 'median ms', 'min ms', 'ns per op', 'relative'],
    rows,
    notes: [
      'relative = ns per op / the fastest row (so the fastest is 1).',
      'The rotation rows rotate one point. Each call also builds its small result array, which is part of the measured time for every row alike.',
      'A quaternion stores a rotation in 4 numbers and a matrix in 16, which is why rotating with a quaternion needs less memory; building the full matrix costs more.',
    ],
    chart: { title: 'Cost of one operation', yLabel: 'ns per operation', series: ['ns per op'], groups: rows.map((r) => ({ label: r.operation as string, values: [r['ns per op'] as number] })) },
  }]
}

// ======================================================================
// the list of suites
// ======================================================================

export const SUITES: { id: SuiteId; name: string; description: string; run: (cfg: BenchConfig) => Promise<BenchTable[]> }[] = [
  { id: 'culling', name: 'Back-face culling', description: 'reactor scene and spheres, culling off vs on, filled and wireframe', run: cullingSuite },
  { id: 'bresenham', name: 'Bresenham vs DDA', description: '10,000 lines each: short, medium, long', run: bresenhamSuite },
  { id: 'alpha', name: 'Alpha compositing', description: 'over() on 1, 2, 4, 8 layers; sorted vs unsorted pass', run: alphaSuite },
  { id: 'vw', name: 'Visvalingam-Whyatt', description: '100 to 2000 points, with RDP for comparison', run: vwSuite },
  { id: 'transforms', name: 'Transformations', description: 'multiply, inverse, quaternion vs matrix rotation', run: transformsSuite },
]

/** Run one suite by its id. Throws BenchCancelled if cfg.isCancelled() turns true. */
export function runSuite(id: SuiteId, cfg: BenchConfig): Promise<BenchTable[]> {
  return SUITES.find((s) => s.id === id)!.run(cfg)
}
