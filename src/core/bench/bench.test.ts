import { describe, it, expect } from 'vitest'
import {
  summarize, timeIt, timeItAsync, timeChunked, timeBatched, BenchCancelled, formatCell, toCsv, allToCsv, toMarkdown, type BenchRow, type BenchTable,
} from './bench'
import { SUITES, TEST_SIZES, defaultConfig, runSuite, type BenchConfig, type SuiteId } from './suites'

const spin = (ms: number) => {
  const end = performance.now() + ms
  while (performance.now() < end) { /* wait */ }
}

describe('summarize', () => {
  it('min, median, mean and max of an odd list', () => {
    expect(summarize([3, 1, 2])).toMatchObject({ min: 1, median: 2, mean: 2, max: 3 })
  })
  it('the median of an even list is the middle of the two middle values', () => {
    expect(summarize([4, 1, 3, 2]).median).toBe(2.5)
  })
  it('keeps the samples in the order they were taken', () => {
    expect(summarize([3, 1, 2]).samples).toEqual([3, 1, 2])
  })
})

describe('timeIt', () => {
  it('returns one sample per run, and min <= median <= max, min <= mean <= max', () => {
    const t = timeIt(() => spin(0.2), 7, 1)
    expect(t.samples.length).toBe(7)
    expect(t.min).toBeLessThanOrEqual(t.median)
    expect(t.median).toBeLessThanOrEqual(t.max)
    expect(t.min).toBeLessThanOrEqual(t.mean)
    expect(t.mean).toBeLessThanOrEqual(t.max)
    expect(t.min).toBeGreaterThan(0)
  })
  it('calls the function warmup + runs times, but only the runs are counted', () => {
    let calls = 0
    const t = timeIt(() => { calls++ }, 5, 3)
    expect(calls).toBe(8)
    expect(t.samples.length).toBe(5)
  })
  it('the slow first run does not count when there is a warm-up, and does when there is not', () => {
    let first = true
    const slowFirst = () => { if (first) { first = false; spin(15) } }
    expect(timeIt(slowFirst, 4, 1).max).toBeLessThan(10)
    first = true
    expect(timeIt(slowFirst, 4, 0).max).toBeGreaterThanOrEqual(14)
  })
})

describe('timeBatched', () => {
  it('repeats a very quick job and reports the time of ONE call, not zero', async () => {
    let calls = 0
    const t = await timeBatched(() => { calls++; spin(0.02) }, 3, 1, async () => {})
    expect(t.reps).toBeGreaterThan(50) // 10 ms / 0.02 ms
    expect(t.median).toBeGreaterThan(0.015)
    expect(t.median).toBeLessThan(0.5)
    expect(calls).toBeGreaterThan(t.reps! * 3) // it really ran the repeats
    expect(t.samples.length).toBe(3)
  })
  it('a slow job is not repeated', async () => {
    const t = await timeBatched(() => spin(12), 2, 0, async () => {})
    expect(t.reps).toBe(1)
    expect(t.median).toBeGreaterThanOrEqual(11)
  })
  it('stops with BenchCancelled when asked', async () => {
    await expect(timeBatched(() => {}, 3, 0, async () => {}, () => true)).rejects.toBeInstanceOf(BenchCancelled)
  })
})

describe('timeItAsync and timeChunked', () => {
  it('give the same kind of result and wait between runs', async () => {
    let pauses = 0
    const pause = async () => { pauses++ }
    const t = await timeItAsync(() => spin(0.1), 4, 2, pause)
    expect(t.samples.length).toBe(4)
    expect(pauses).toBeGreaterThanOrEqual(4)
  })
  it('timeChunked does all the work of a run in pieces and adds the pieces up', async () => {
    const chunks: number[] = []
    const t = await timeChunked((n) => { chunks.push(n); spin(0.1) }, 250, 100, 2, 0, async () => {})
    expect(chunks).toEqual([100, 100, 50, 100, 100, 50]) // two runs of 250, in chunks of 100
    expect(t.samples.length).toBe(2)
    expect(t.min).toBeGreaterThan(0.2) // three chunks of 0.1 ms each were added up
  })
  it('the time spent waiting between chunks is not counted', async () => {
    const t = await timeChunked(() => spin(0.1), 2, 1, 1, 0, () => new Promise((r) => setTimeout(r, 20)))
    expect(t.samples[0]).toBeLessThan(10)
  })
  it('stops with BenchCancelled when asked to cancel', async () => {
    let calls = 0
    await expect(timeItAsync(() => { calls++ }, 10, 0, async () => {}, () => calls >= 2)).rejects.toBeInstanceOf(BenchCancelled)
    expect(calls).toBe(2)
  })
})

const table: BenchTable = {
  id: 't', title: 'Test table', columns: ['name', 'value', 'note'],
  rows: [{ name: 'a', value: 1.23456789, note: 'plain' }, { name: 'b, with comma', value: 2, note: 'say "hi"' }, { name: 'c', value: 1234.5, note: '' }],
}

describe('formatCell', () => {
  it('whole numbers stay as they are, others get 4 significant digits, text stays text', () => {
    expect(formatCell(7)).toBe('7')
    expect(formatCell(1.23456789)).toBe('1.235')
    expect(formatCell(0.00123456)).toBe('0.001235')
    expect(formatCell('x')).toBe('x')
  })
})

describe('toCsv / allToCsv', () => {
  const lines = toCsv(table).split('\n')
  it('has the column names as its header and one line per row', () => {
    expect(lines[0]).toBe('name,value,note')
    expect(lines.length).toBe(1 + table.rows.length)
  })
  it('keeps full precision for numbers', () => {
    expect(lines[1]).toBe('a,1.23456789,plain')
  })
  it('puts quotes around text with a comma or a quote, and doubles the quotes', () => {
    expect(lines[2]).toBe('"b, with comma",2,"say ""hi"""')
  })
  it('every line has the same number of fields when read back', () => {
    // a tiny CSV reader that understands quotes: a comma only splits a field outside quotes
    const readFields = (line: string) => {
      const fields: string[] = []
      let current = ''
      let inQuotes = false
      for (let i = 0; i < line.length; i++) {
        const ch = line[i]
        if (inQuotes) {
          if (ch === '"' && line[i + 1] === '"') { current += '"'; i++ } // a doubled quote is one quote
          else if (ch === '"') inQuotes = false
          else current += ch
        } else if (ch === '"') inQuotes = true
        else if (ch === ',') { fields.push(current); current = '' }
        else current += ch
      }
      fields.push(current)
      return fields
    }
    for (const line of lines) expect(readFields(line).length).toBe(3)
    expect(readFields(lines[2])).toEqual(['b, with comma', '2', 'say "hi"'])
  })
  it('allToCsv gives every table its title line and header, and puts the machine notes on top', () => {
    const csv = allToCsv([table, { ...table, id: 'u', title: 'Second' }], ['machine: test', 'date: today'])
    expect(csv.startsWith('# machine: test\n# date: today\n')).toBe(true)
    expect(csv).toContain('# Test table\nname,value,note')
    expect(csv).toContain('# Second\nname,value,note')
  })
})

describe('toMarkdown', () => {
  const md = toMarkdown(table).split('\n')
  const cells = (line: string) => line.split(/(?<!\\)\|/).length - 2 // text between the outer bars
  it('has a header, a separator and one line per row', () => {
    expect(md.length).toBe(2 + table.rows.length)
    expect(md[1]).toBe('| --- | --- | --- |')
  })
  it('has the same number of columns on every line', () => {
    for (const line of md) expect(cells(line)).toBe(table.columns.length)
  })
  it('formats numbers readably and escapes a bar inside text', () => {
    expect(md[2]).toContain('1.235')
    expect(toMarkdown({ ...table, rows: [{ name: 'a|b', value: 1, note: '' }] })).toContain('a\\|b')
  })
})

// ---------- the suites (with tiny sizes so the tests are fast) ----------

const cfg = (change: Partial<BenchConfig> = {}): BenchConfig => ({ ...defaultConfig(), runs: 1, warmup: 0, sizes: TEST_SIZES, ...change })

describe('suite list', () => {
  it('has the five suites', () => {
    expect(SUITES.map((s) => s.id)).toEqual(['culling', 'bresenham', 'alpha', 'vw', 'transforms'])
  })
})

describe('culling suite', () => {
  it('reports fewer drawn triangles with culling on, for filled and for wireframe', async () => {
    const [t] = await runSuite('culling', cfg())
    expect(t.rows.length).toBe(TEST_SIZES.culling.sphereSegments.length * 2 * 2)
    const key = (r: BenchRow) => `${r.scenario}/${r.style}`
    for (const row of t.rows.filter((r) => r.culling === 'on')) {
      const off = t.rows.find((r) => r.culling === 'off' && key(r) === key(row))!
      expect(row.drawn).toBeLessThan(off.drawn as number)
      expect(row.triangles).toBe(off.triangles)
      expect(row.culled).toBeGreaterThan(0)
      expect(off.culled).toBe(0)
      expect(row['culled %']).toBeGreaterThan(30)
    }
  })
  it('has the columns a report needs, and a chart with an off and an on bar per scene', async () => {
    const [t] = await runSuite('culling', cfg())
    for (const c of ['scenario', 'style', 'culling', 'triangles', 'drawn', 'culled', 'culled %', 'median ms', 'speed-up']) expect(t.columns).toContain(c)
    expect(t.chart!.series).toEqual(['culling off', 'culling on'])
    expect(t.chart!.groups.length).toBe(TEST_SIZES.culling.sphereSegments.length)
    for (const g of t.chart!.groups) expect(g.values.every((v) => v > 0)).toBe(true)
  })
  it('works on the reactor scene too', async () => {
    const [t] = await runSuite('culling', cfg({ sizes: { ...TEST_SIZES, culling: { reactor: true, sphereSegments: [], width: 64, height: 48 } } }))
    expect(t.rows.length).toBe(4)
    const on = t.rows.find((r) => r.culling === 'on' && r.style === 'filled')!
    expect(on.culled).toBeGreaterThan(1000)
  })
})

describe('bresenham suite', () => {
  it('times Bresenham against DDA for short, medium and long lines', async () => {
    const [t] = await runSuite('bresenham', cfg())
    expect(t.rows.length).toBe(3 * 4)
    expect(new Set(t.rows.map((r) => r['line length'])).size).toBe(3)
    for (const r of t.rows) {
      expect(r.lines).toBe(TEST_SIZES.bresenham.lines)
      expect(r['median ms'] as number).toBeGreaterThanOrEqual(0)
    }
  })
  it('both draw the same NUMBER of pixels (difference 0); a few may sit at another place (rounding at exact ties)', async () => {
    const [t] = await runSuite('bresenham', cfg())
    for (const r of t.rows) {
      expect(r['pixel count diff']).toBe(0)
      expect(r['pixels at other places']).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('alpha suite', () => {
  it('times over() for each layer count, and the cost goes up with the layers', async () => {
    const [over] = await runSuite('alpha', cfg())
    expect(over.rows.map((r) => r.layers)).toEqual(TEST_SIZES.alpha.layers)
    for (const r of over.rows) expect(r['over calls']).toBe((r.pixels as number) * (r.layers as number))
    const first = over.rows[0]['over calls'] as number
    const last = over.rows[over.rows.length - 1]['over calls'] as number
    expect(last).toBeGreaterThan(first)
  })
  it('the transparent pass blends the same pixels with the sort on and off', async () => {
    const tables = await runSuite('alpha', cfg())
    const pass = tables[1]
    expect(pass.rows.length).toBe(2)
    expect(pass.rows.map((r) => r.sort)).toEqual(['off', 'on'])
    expect(pass.rows[0].triangles).toBe(pass.rows[1].triangles)
    expect(pass.rows[0]['pixels blended']).toBe(pass.rows[1]['pixels blended'])
    expect(pass.rows[0]['pixels blended']).toBeGreaterThan(0)
  })
})

describe('Visvalingam-Whyatt suite', () => {
  it('has a VW row and an RDP row for every size, and the sizes match', async () => {
    const [t] = await runSuite('vw', cfg())
    const sizes = TEST_SIZES.vw.sizes
    expect(t.rows.length).toBe(sizes.length * 2)
    for (const n of sizes) {
      const rows = t.rows.filter((r) => r.points === n)
      expect(rows.map((r) => r.algorithm).sort()).toEqual(['RDP', 'VW'])
    }
  })
  it('times are positive, and both keep about the asked number of points', async () => {
    const [t] = await runSuite('vw', cfg())
    for (const r of t.rows) {
      expect(r['median ms'] as number).toBeGreaterThan(0)
      const target = Math.round((r.points as number) * 0.1)
      if (r.algorithm === 'VW') expect(r.kept).toBe(target)
      else expect(r.kept as number).toBeLessThanOrEqual(target)
    }
  })
  it('reports the error of each result, and the VW time ratio between sizes', async () => {
    const [t] = await runSuite('vw', cfg())
    for (const r of t.rows) {
      expect(r['max distance'] as number).toBeGreaterThan(0)
      expect(r['area error %'] as number).toBeGreaterThanOrEqual(0)
    }
    const vw = t.rows.filter((r) => r.algorithm === 'VW')
    expect(vw[0]['time ratio']).toBe('')
    expect(vw[1]['time ratio'] as number).toBeGreaterThan(0)
    expect(vw[1]['n² ratio']).toBe(Math.pow(TEST_SIZES.vw.sizes[1] / TEST_SIZES.vw.sizes[0], 2))
    expect(t.summary!.join(' ')).toContain('n^')
  })
})

describe('transformations suite', () => {
  it('times the four operations', async () => {
    const [t] = await runSuite('transforms', cfg())
    expect(t.rows.map((r) => r.operation)).toEqual(['mat4 multiply', 'mat4 inverse', 'quaternion rotateVec3', 'matrix transformPoint'])
    for (const r of t.rows) {
      expect(r.operations).toBe(TEST_SIZES.transforms.ops)
      expect(r['ns per op'] as number).toBeGreaterThan(0)
    }
    expect(Math.min(...t.rows.map((r) => r['relative'] as number))).toBe(1)
  })
})

describe('running a suite', () => {
  it('reports progress up to the end', async () => {
    const seen: [number, number][] = []
    await runSuite('transforms', cfg({ onProgress: (done, total) => seen.push([done, total]) }))
    expect(seen.length).toBeGreaterThan(0)
    const last = seen[seen.length - 1]
    expect(last[0]).toBe(last[1])
  })
  it('can be cancelled', async () => {
    let asked = 0
    const id: SuiteId = 'transforms'
    await expect(runSuite(id, cfg({ isCancelled: () => ++asked > 1 }))).rejects.toBeInstanceOf(BenchCancelled)
  })
})
