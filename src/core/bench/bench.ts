// bench.ts - the tools for measuring and reporting: timing, result tables, CSV and markdown.
// The five benchmark suites that use these tools are in suites.ts.
//
// HOW WE TIME: performance.now() gives the time in milliseconds. A function is run several times
// and every run is timed on its own. The first runs are "warm-up" runs that are NOT counted: the
// first call is often slow (the code is still being optimised by the JavaScript engine, caches are
// cold), and we want the speed of the code once it is running normally. From the samples we report
// min, median, mean and max. The MEDIAN is the number to quote in a report: one slow run (the
// computer was busy) hardly moves it, unlike the mean.

export class BenchCancelled extends Error {
  constructor() {
    super('Benchmark cancelled')
    this.name = 'BenchCancelled'
  }
}

export type TimeStats = { min: number; median: number; mean: number; max: number; samples: number[]; reps?: number }

/** min, median, mean and max of a list of times (milliseconds). The samples keep their original order. */
export function summarize(samples: number[]): TimeStats {
  const sorted = [...samples].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  // Odd count: the middle value. Even count: halfway between the two middle values.
  const median = sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
  return {
    min: sorted[0],
    median,
    mean: samples.reduce((sum, v) => sum + v, 0) / samples.length,
    max: sorted[sorted.length - 1],
    samples,
  }
}

/** Run fn `warmup` times without counting, then `runs` times, timing each run. */
export function timeIt(fn: () => void, runs: number, warmup: number): TimeStats {
  for (let i = 0; i < warmup; i++) fn()
  const samples: number[] = []
  for (let i = 0; i < runs; i++) {
    const start = performance.now()
    fn()
    samples.push(performance.now() - start)
  }
  return summarize(samples)
}

/**
 * Like timeIt, but for long jobs in a web page. One run does `totalOps` operations, done in pieces of
 * `chunk` operations: work(n) must do n operations. After every piece we `await pause()`, which lets the
 * page breathe (draw the progress bar, react to the Cancel button). The pauses are NOT part of the
 * measured time: each piece is timed on its own and the pieces of a run are added up.
 */
export async function timeChunked(
  work: (count: number) => void, totalOps: number, chunk: number, runs: number, warmup: number,
  pause: () => Promise<void>, isCancelled: () => boolean = () => false,
): Promise<TimeStats> {
  const samples: number[] = []
  for (let run = 0; run < warmup + runs; run++) {
    if (isCancelled()) throw new BenchCancelled()
    let elapsed = 0
    for (let remaining = totalOps; remaining > 0; remaining -= chunk) {
      const start = performance.now()
      work(Math.min(chunk, remaining))
      elapsed += performance.now() - start
      await pause()
    }
    if (run >= warmup) samples.push(elapsed) // the first `warmup` runs are not counted
  }
  return summarize(samples)
}

/** timeIt with a pause between runs (see timeChunked). */
export function timeItAsync(
  fn: () => void, runs: number, warmup: number, pause: () => Promise<void>, isCancelled?: () => boolean,
): Promise<TimeStats> {
  return timeChunked(() => fn(), 1, 1, runs, warmup, pause, isCancelled)
}

/**
 * For jobs that are too quick to time with the browser's coarse clock (it only ticks every 0.1 ms or so):
 * first find how many times fn must be repeated for the repeats to take at least `minMs` together, then time
 * `runs` runs of that many repeats and report the time of ONE call (run time / repeats). A slow job just gets 1 repeat.
 * The trial runs of the search also act as warm-up.
 */
export async function timeBatched(
  fn: () => void, runs: number, warmup: number, pause: () => Promise<void>, isCancelled: () => boolean = () => false, minMs = 10,
): Promise<TimeStats> {
  let reps = 1
  for (;;) {
    if (isCancelled()) throw new BenchCancelled()
    const start = performance.now()
    for (let i = 0; i < reps; i++) fn()
    const elapsed = performance.now() - start
    await pause()
    if (elapsed >= minMs || reps >= 100_000) break
    reps *= elapsed < minMs / 8 ? 8 : 2
  }
  const total = await timeChunked((count) => { for (let i = 0; i < count; i++) fn() }, reps, reps, runs, warmup, pause, isCancelled)
  return { ...summarize(total.samples.map((sample) => sample / reps)), reps }
}

// A value never read can be thrown away by the engine's optimiser, which would make a test look
// impossibly fast. Benchmarks add their results into this variable so the work really has to be done.
let sink = 0
export const consume = (value: number): void => {
  sink += value
}
export const readSink = (): number => sink

// ---------- result tables ----------

export type BenchRow = Record<string, string | number>

/** One bar chart: `series` are the bars inside each group, `groups` the clusters along the x axis. */
export type ChartSpec = {
  title: string
  yLabel: string
  series: string[]
  groups: { label: string; values: number[] }[] // values[i] belongs to series[i]
  logScale?: boolean // draw bar heights on a log scale (for numbers that differ a lot)
}

export type BenchTable = {
  id: string
  title: string
  columns: string[] // the column names, in order
  rows: BenchRow[] // each row has a value for every column
  chart?: ChartSpec
  notes?: string[] // things to remember when quoting the numbers
  summary?: string[] // one-line findings, printed to the console
}

/** How a value is shown to a reader: whole numbers as they are, other numbers with 4 significant digits. */
export function formatCell(value: string | number): string {
  if (typeof value === 'string') return value
  return Number.isInteger(value) ? String(value) : String(Number(value.toPrecision(4)))
}

// A CSV field: text with a comma, a quote or a line break is wrapped in quotes, and quotes inside are doubled.
function csvField(value: string | number): string {
  const text = String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/** One table as CSV: a header line with the column names, then one line per row, full precision. */
export function toCsv(table: BenchTable): string {
  const lines = [table.columns.map(csvField).join(',')]
  for (const row of table.rows) lines.push(table.columns.map((c) => csvField(row[c] ?? '')).join(','))
  return lines.join('\n')
}

/** Several tables in one CSV text: each starts with a "# title" line. `meta` lines (machine, date) go on top as "# ..." comments. */
export function allToCsv(tables: BenchTable[], meta: string[] = []): string {
  const header = meta.map((line) => `# ${line}`)
  const blocks = tables.map((t) => `# ${t.title}\n${toCsv(t)}`)
  return [...header, ...(header.length > 0 ? [''] : []), blocks.join('\n\n')].join('\n').replace(/^\n/, '')
}

/** One table as a markdown table, ready to paste into a report. */
export function toMarkdown(table: BenchTable): string {
  const cell = (value: string | number) => formatCell(value).replace(/\|/g, '\\|') // a bar inside text would end the cell
  const line = (cells: (string | number)[]) => `| ${cells.map(cell).join(' | ')} |`
  return [
    line(table.columns),
    `| ${table.columns.map(() => '---').join(' | ')} |`,
    ...table.rows.map((row) => line(table.columns.map((c) => row[c] ?? ''))),
  ].join('\n')
}
