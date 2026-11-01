// BenchmarkLab.tsx - runs the benchmark suites of core/bench and shows real numbers for the report:
// a table per suite, a bar chart of the main comparison, and buttons to export everything.
// The measuring is in core/bench (bench.ts, suites.ts). Here we only start it in small pieces, so the
// page stays alive, and show the results.

import { useEffect, useMemo, useRef, useState } from 'react'
import { allToCsv, BenchCancelled, formatCell, toMarkdown, type BenchTable } from '../core/bench/bench'
import { DEFAULT_SIZES, defaultConfig, SUITES, type SuiteId } from '../core/bench/suites'
import { drawChart } from './benchChart'
import { Eq, Note } from './components/Equation'
import FormulaBox from './components/FormulaBox'
import LabLayout from './components/LabLayout'
import NumberRow from './components/NumberRow'
import Section from './components/Section'
import { useLabLog } from './shell/console'

type SuiteResult = { tables: BenchTable[]; ranAt: string; seconds: number; runs: number; warmup: number }
type Results = Partial<Record<SuiteId, SuiteResult>>

// The results stay when you switch to another lab and back.
let savedResults: Results = {}

const CHART_W = 860
const CHART_H = 360

// What the report should say about the computer and the conditions.
function machineLines(): string[] {
  const nav = navigator as Navigator & { deviceMemory?: number }
  return [
    `Browser: ${navigator.userAgent}`,
    `Logical CPU cores: ${navigator.hardwareConcurrency ?? 'unknown'}`,
    ...(nav.deviceMemory ? [`Device memory (approx.): ${nav.deviceMemory} GB`] : []),
    `Screen: ${screen.width} x ${screen.height} at pixel ratio ${window.devicePixelRatio}`,
    `Date: ${new Date().toLocaleString()}`,
  ]
}

function download(blob: Blob, filename: string) {
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.click()
  URL.revokeObjectURL(link.href)
}

const stamp = () => new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '').replace(/^(\d{8})/, '$1-')

export default function BenchmarkLab() {
  const log = useLabLog()
  const [runs, setRuns] = useState(5)
  const [warmup, setWarmup] = useState(2)
  const [results, setResults] = useState<Results>(savedResults)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState({ fraction: 0, label: '' })
  const [chartId, setChartId] = useState('')
  const cancelled = useRef(false)
  const alive = useRef(true)
  const chartRef = useRef<HTMLCanvasElement>(null)

  // If you leave the tab while it runs, stop the run.
  useEffect(() => {
    alive.current = true
    return () => { alive.current = false }
  }, [])

  const machine = useMemo(machineLines, [])
  const orderedTables = SUITES.flatMap((s) => results[s.id]?.tables ?? [])
  const chartTables = orderedTables.filter((t) => t.chart)
  const chartTable = chartTables.find((t) => t.id === chartId) ?? chartTables[0] ?? null

  // Redraw the chart when the results or the chosen chart change.
  useEffect(() => {
    drawChart(chartRef.current!.getContext('2d')!, CHART_W, CHART_H, chartTable?.chart ?? null)
  }, [chartTable])

  // Run the given suites one after the other. After every small piece of work the page gets a moment to draw.
  async function run(ids: SuiteId[]) {
    cancelled.current = false
    setRunning(true)
    log(`Benchmark started: ${ids.map((id) => SUITES.find((s) => s.id === id)!.name).join(', ')} (${runs} timed runs, ${warmup} warm-up runs)`, 'info')
    let latest = results
    for (let i = 0; i < ids.length; i++) {
      const suite = SUITES.find((s) => s.id === ids[i])!
      const started = performance.now()
      try {
        const tables = await suite.run({
          ...defaultConfig(), runs, warmup, sizes: DEFAULT_SIZES,
          pause: () => new Promise((resolve) => setTimeout(resolve, 0)),
          isCancelled: () => cancelled.current || !alive.current,
          onProgress: (done, total, label) => alive.current && setProgress({ fraction: (i + done / total) / ids.length, label: `${suite.name}: ${label}` }),
        })
        const seconds = (performance.now() - started) / 1000
        latest = { ...latest, [suite.id]: { tables, ranAt: new Date().toLocaleString(), seconds, runs, warmup } }
        savedResults = latest
        if (alive.current) setResults(latest)
        log(`Suite "${suite.name}" finished: ${tables.reduce((n, t) => n + t.rows.length, 0)} rows in ${seconds.toFixed(1)} s`, 'info')
        for (const line of tables.flatMap((t) => t.summary ?? [])) log(`  ${line}`)
      } catch (error) {
        if (error instanceof BenchCancelled) {
          if (alive.current) log(`Cancelled during "${suite.name}"`, 'warn')
          break
        }
        throw error
      }
    }
    if (alive.current) {
      setRunning(false)
      setProgress({ fraction: 0, label: '' })
    }
  }

  // ----- export -----
  const meta = () => [...machine, `Settings: ${runs} timed runs after ${warmup} warm-up runs; the median is reported`]
  function downloadCsv() {
    download(new Blob([allToCsv(orderedTables, meta())], { type: 'text/csv' }), `renderlab-benchmarks-${stamp()}.csv`)
    log('Downloaded the CSV file', 'info')
  }
  function copyMarkdown() {
    const text = [
      '## RenderLab benchmark results', '',
      ...meta().map((line) => `- ${line}`), '',
      ...orderedTables.flatMap((t) => [`### ${t.title}`, '', toMarkdown(t), '', ...(t.notes ?? []).map((n) => `> ${n}`), '']),
    ].join('\n')
    navigator.clipboard.writeText(text)
      .then(() => log(`Copied ${orderedTables.length} markdown tables`, 'info'))
      .catch(() => log('The browser did not allow copying.', 'warn'))
  }
  function saveChart() {
    // The saved picture uses light colours and a white background, which is better for a printed report.
    const canvas = document.createElement('canvas')
    canvas.width = CHART_W
    canvas.height = CHART_H
    drawChart(canvas.getContext('2d')!, CHART_W, CHART_H, chartTable?.chart ?? null, true)
    canvas.toBlob((blob) => blob && download(blob, `renderlab-chart-${chartTable?.id ?? 'empty'}.png`), 'image/png')
    log('Saved the chart as a PNG', 'info')
  }

  const hasResults = orderedTables.length > 0

  return (
    <LabLayout
      sections
      canvas={
        <div style={{ lineHeight: 'normal', width: CHART_W }}>
          <canvas ref={chartRef} width={CHART_W} height={CHART_H} style={{ display: 'block' }} />
          {SUITES.map((suite) => {
            const result = results[suite.id]
            return (
              <div key={suite.id} className="bench-block">
                <h3>{suite.name}</h3>
                {!result ? (
                  <div className="bench-empty">Not run yet. {suite.description}.</div>
                ) : (
                  <>
                    <div className="bench-meta">run {result.ranAt} · {result.seconds.toFixed(1)} s · {result.runs} timed runs + {result.warmup} warm-up</div>
                    {result.tables.map((table) => (
                      <div key={table.id} style={{ marginBottom: 14 }}>
                        <div className="bench-title">{table.title}</div>
                        <div style={{ overflowX: 'auto' }}>
                          <table className="bench-table">
                            <thead><tr>{table.columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
                            <tbody>
                              {table.rows.map((row, i) => (
                                <tr key={i}>{table.columns.map((c) => <td key={c} className={typeof row[c] === 'number' ? 'num' : ''}>{formatCell(row[c] ?? '')}</td>)}</tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {(table.summary ?? []).map((line, i) => <div key={i} className="bench-summary">▸ {line}</div>)}
                        {(table.notes ?? []).map((line, i) => <div key={i} className="bench-note">{line}</div>)}
                      </div>
                    ))}
                  </>
                )}
              </div>
            )
          })}
        </div>
      }
      stats={[
        `${orderedTables.length} result tables`,
        `${runs} timed runs + ${warmup} warm-up`,
        running ? `running: ${progress.label}` : hasResults ? 'median of the timed runs is reported' : 'press Run all',
      ]}
      controls={
        <>
          <Section title="Run">
            <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
              <button disabled={running} onClick={() => run(SUITES.map((s) => s.id))}>Run all</button>
              <button disabled={!running} onClick={() => { cancelled.current = true }}>Cancel</button>
            </div>
            {SUITES.map((suite) => (
              <div key={suite.id} className="row">
                <button disabled={running} onClick={() => run([suite.id])} style={{ flex: 1, textAlign: 'left' }} title={suite.description}>{suite.name}</button>
                <span style={{ color: 'var(--muted)', fontSize: 11.5 }}>{results[suite.id] ? `${results[suite.id]!.seconds.toFixed(1)} s` : ''}</span>
              </div>
            ))}
            <progress className="bench-progress" value={running ? progress.fraction : 0} max={1} />
            <div style={{ color: 'var(--muted)', minHeight: 32 }}>{running ? progress.label : 'Run all takes about a minute or two.'}</div>
            <div style={{ color: '#ffcf5c' }}>Keep this tab open and in focus while it runs: browsers slow background tabs down and that changes the numbers.</div>
          </Section>

          <Section title="Settings">
            <NumberRow label="Timed runs" value={runs} min={1} max={30} onChange={setRuns} />
            <NumberRow label="Warm-up" value={warmup} min={0} max={10} onChange={setWarmup} />
            <div style={{ color: 'var(--muted)' }}>Warm-up runs are done first and not counted. More timed runs give a steadier median but take longer.</div>
          </Section>

          <Section title="Chart">
            <select value={chartTable?.id ?? ''} onChange={(e) => setChartId(e.target.value)} style={{ width: '100%' }} disabled={chartTables.length === 0}>
              {chartTables.length === 0 && <option value="">(no results yet)</option>}
              {chartTables.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </Section>

          <Section title="Export">
            <button style={{ marginRight: 6, marginBottom: 6 }} disabled={!hasResults} onClick={downloadCsv}>Download CSV</button>
            <button style={{ marginRight: 6, marginBottom: 6 }} disabled={!hasResults} onClick={copyMarkdown}>Copy markdown tables</button>
            <button style={{ marginBottom: 6 }} disabled={!chartTable} onClick={saveChart}>Save chart PNG</button>
            <div style={{ color: 'var(--muted)' }}>The CSV and the markdown start with the machine details below and the settings, ready for the "experimental conditions" part of the report.</div>
          </Section>

          <Section title="Machine and conditions">
            <div style={{ font: 'var(--font-mono)', fontSize: 11.5, color: 'var(--muted)', wordBreak: 'break-word' }}>
              {machine.map((line) => <div key={line} style={{ marginBottom: 3 }}>{line}</div>)}
            </div>
          </Section>
        </>
      }
      formula={
        <FormulaBox>
          <Eq label="One sample">{'t = after − before   (performance.now)'}</Eq>
          <Note>Warm-up runs are thrown away. The median is the middle of the sorted times, so one slow run hardly changes it.</Note>
          <Eq label="Culling speed-up">{'speed-up = frac{median(culling off)}{median(culling on)}'}</Eq>
          <Eq label="How the time grows (O(n²) check)">{'time ratio = frac{t(n)}{t(previous n)}  ≈  (frac{n}{previous n})^2'}</Eq>
          <Eq label="Growth exponent">{'t ∝ n^k,    k = frac{ln(t_2 / t_1)}{ln(n_2 / n_1)}'}</Eq>
        </FormulaBox>
      }
    />
  )
}
