// BresenhamLab.tsx - step through Bresenham's line algorithm on a big pixel grid.
// The algorithm itself lives in core/render/line.ts; this file only draws it and
// handles the buttons. Grid (0,0) is the TOP-LEFT cell, x grows right, y grows down
// (the same as the framebuffer).

import { useEffect, useMemo, useRef, useState } from 'react'
import { bresenhamSteps } from '../core/render/line'
import { ddaSteps } from '../core/render/dda'
import FormulaBox from './components/FormulaBox'
import LabLayout from './components/LabLayout'
import NumberRow from './components/NumberRow'
import Section from './components/Section'
import { useLabLog } from './shell/console'
import { useShell } from './shell/ShellContext'

const COLS = 32
const ROWS = 24

type Point = { x: number; y: number }

// Keep a typed number inside the grid and make it a whole number.
const clamp = (v: number, max: number) => Math.max(0, Math.min(max, Math.round(v) || 0))

export default function BresenhamLab() {
  const [a, setA] = useState<Point>({ x: 2, y: 3 })
  const [b, setB] = useState<Point>({ x: 28, y: 15 })
  const [cell, setCell] = useState(20) // zoom: pixel size of one grid cell
  const [shown, setShown] = useState(0) // how many steps are revealed so far
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(6) // steps per second
  const [showDda, setShowDda] = useState(false)
  const [nextClickIsA, setNextClickIsA] = useState(true)

  const log = useLabLog()
  const { paused: shellPaused } = useShell() // the top bar's Pause button stops Play
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const tableBoxRef = useRef<HTMLDivElement>(null)

  // Recompute the algorithm only when the end points change.
  const steps = useMemo(() => bresenhamSteps(a.x, a.y, b.x, b.y), [a, b])
  const dda = useMemo(() => ddaSteps(a.x, a.y, b.x, b.y), [a, b])

  // Changing an end point restarts the animation.
  function setPoints(newA: Point, newB: Point) {
    setA(newA)
    setB(newB)
    setShown(0)
    setPlaying(false)
  }

  function onCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const p = {
      x: clamp(Math.floor((e.clientX - rect.left) / cell), COLS - 1),
      y: clamp(Math.floor((e.clientY - rect.top) / cell), ROWS - 1),
    }
    // Clicks alternate: first sets A, second sets B.
    if (nextClickIsA) setPoints(p, b)
    else setPoints(a, p)
    setNextClickIsA(!nextClickIsA)
  }

  // Play: reveal one more step every 1/speed seconds, stop at the end.
  useEffect(() => {
    if (!playing || shellPaused) return
    if (shown >= steps.length) {
      setPlaying(false)
      return
    }
    const id = setTimeout(() => setShown((s) => s + 1), 1000 / speed)
    return () => clearTimeout(id)
  }, [playing, shellPaused, shown, speed, steps.length])

  // Console trace: the line, then each step as it is revealed.
  useEffect(() => {
    const dx = Math.abs(b.x - a.x)
    const dy = Math.abs(b.y - a.y)
    const major = Math.max(dx, dy)
    const minor = Math.min(dx, dy)
    log(`Line A(${a.x},${a.y}) -> B(${b.x},${b.y}): dx=${dx} dy=${dy}, major axis ${dy > dx ? 'y' : 'x'}, ${steps.length} pixels`)
    log(`  initial error e0 = 2*minor - major = 2*${minor} - ${major} = ${2 * minor - major}`)
  }, [a, b])
  useEffect(() => {
    if (shown === 0) return
    const s = steps[shown - 1]
    log(`step ${shown}: pixel (${s.x},${s.y})  error ${s.errorBefore} -> ${s.errorAfter}  ${s.move === 'none' ? 'end of line' : s.move}`)
  }, [shown])
  const ddaDiffs = dda.length === 0 ? 0 : steps.filter((st) => !dda.some((p) => p.x === st.x && p.y === st.y)).length
  useEffect(() => {
    if (showDda) log(ddaDiffs === 0 ? 'DDA overlay: same pixels as Bresenham' : `DDA overlay: ${ddaDiffs} pixel(s) differ from Bresenham`)
  }, [showDda, a, b])

  // Keep the newest table row visible by scrolling the table box (not the whole page).
  useEffect(() => {
    const box = tableBoxRef.current
    if (box) box.scrollTop = box.scrollHeight
  }, [shown])

  // Redraw the grid whenever anything it shows changes.
  useEffect(() => {
    const ctx = canvasRef.current!.getContext('2d')!
    const w = COLS * cell
    const h = ROWS * cell
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = '#1b1e25'
    ctx.fillRect(0, 0, w, h)

    // Cells chosen so far (green), the newest one in orange.
    for (let i = 0; i < shown; i++) {
      ctx.fillStyle = i === shown - 1 ? '#ff9800' : '#3a9d62'
      ctx.fillRect(steps[i].x * cell, steps[i].y * cell, cell, cell)
    }

    // Grid lines.
    ctx.strokeStyle = '#2d323d'
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let x = 0; x <= COLS; x++) {
      ctx.moveTo(x * cell + 0.5, 0)
      ctx.lineTo(x * cell + 0.5, h)
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx.moveTo(0, y * cell + 0.5)
      ctx.lineTo(w, y * cell + 0.5)
    }
    ctx.stroke()

    // Old DDA pixels as blue outlines, for comparison.
    if (showDda) {
      ctx.strokeStyle = '#64b5f6'
      ctx.lineWidth = 2
      for (const p of dda) ctx.strokeRect(p.x * cell + 3, p.y * cell + 3, cell - 6, cell - 6)
    }

    // The ideal line goes from the centre of cell A to the centre of cell B.
    ctx.strokeStyle = '#ff6b6b'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo((a.x + 0.5) * cell, (a.y + 0.5) * cell)
    ctx.lineTo((b.x + 0.5) * cell, (b.y + 0.5) * cell)
    ctx.stroke()

    // Labels for the two end points.
    ctx.fillStyle = '#fff'
    ctx.font = `bold ${Math.max(10, cell * 0.6)}px sans-serif`
    ctx.fillText('A', a.x * cell + 2, a.y * cell + cell - 3)
    ctx.fillText('B', b.x * cell + 2, b.y * cell + cell - 3)
  }, [a, b, cell, shown, steps, dda, showDda])

  // Numbers for the explanation text.
  const dx = Math.abs(b.x - a.x)
  const dy = Math.abs(b.y - a.y)
  const major = Math.max(dx, dy)
  const minor = Math.min(dx, dy)
  const e0 = 2 * minor - major
  const ddaKeys = new Set(dda.map((p) => `${p.x},${p.y}`))
  const diffCount = steps.filter((s) => !ddaKeys.has(`${s.x},${s.y}`)).length

  const numberInput = (label: string, value: number, max: number, onChange: (v: number) => void) => (
    <label style={{ marginRight: 6 }}>
      {label}{' '}
      <input
        type="number" min={0} max={max} value={value} style={{ width: 56 }}
        onChange={(e) => onChange(clamp(Number(e.target.value), max))}
      />
    </label>
  )

  return (
    <LabLayout
      sections
      canvas={
        <canvas ref={canvasRef} width={COLS * cell} height={ROWS * cell} onClick={onCanvasClick} style={{ display: 'block', cursor: 'crosshair' }} />
      }
      stats={[`${steps.length} pixels`, `dx ${dx}, dy ${dy}`, `major axis ${dy > dx ? 'y' : 'x'}`, `step ${shown}/${steps.length}`, 'green = chosen, orange = current, red line = ideal']}
      controls={
        <>
          <Section title="Points">
            <div className="row"><b>A</b> {numberInput('x', a.x, COLS - 1, (x) => setPoints({ ...a, x }, b))}{numberInput('y', a.y, ROWS - 1, (y) => setPoints({ ...a, y }, b))}</div>
            <div className="row"><b>B</b> {numberInput('x', b.x, COLS - 1, (x) => setPoints(a, { ...b, x }))}{numberInput('y', b.y, ROWS - 1, (y) => setPoints(a, { ...b, y }))}</div>
            <div className="hint" style={{ color: 'var(--muted)' }}>Or click the grid: the next click sets {nextClickIsA ? 'A' : 'B'}.</div>
          </Section>
          <Section title="Playback">
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button onClick={() => setShown((s) => Math.max(0, s - 1))} disabled={shown === 0}>Previous</button>
              <button onClick={() => setShown((s) => Math.min(steps.length, s + 1))} disabled={shown >= steps.length}>Next</button>
              <button
                onClick={() => {
                  if (!playing && shown >= steps.length) setShown(0) // replay from the start
                  setPlaying(!playing)
                }}
              >
                {playing ? 'Pause' : 'Play'}
              </button>
              <button onClick={() => { setShown(0); setPlaying(false) }}>Reset</button>
            </div>
            <NumberRow label="Speed" value={speed} min={1} max={30} onChange={setSpeed} format={(v) => `${v}/s`} />
            <NumberRow label="Zoom" value={cell} min={10} max={40} onChange={setCell} format={(v) => `${v}px`} />
          </Section>
          <Section title="Compare">
            <label><input type="checkbox" checked={showDda} onChange={(e) => setShowDda(e.target.checked)} /> Overlay old DDA result (blue outlines)</label>
            {showDda && <div style={{ color: 'var(--muted)' }}>{diffCount === 0 ? 'DDA and Bresenham chose the same pixels.' : `${diffCount} Bresenham pixel(s) differ from DDA.`}</div>}
          </Section>
          <Section title="Steps">
            <div ref={tableBoxRef} style={{ maxHeight: 240, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 4 }}>
              <table style={{ width: '100%', font: '12px var(--font-mono)' }}>
                <thead style={{ position: 'sticky', top: 0, background: 'var(--panel-raised)' }}>
                  <tr><th>Step</th><th>x</th><th>y</th><th>Err before</th><th>Err after</th><th>Move</th></tr>
                </thead>
                <tbody>
                  {steps.slice(0, shown).map((s, i) => (
                    <tr key={i} style={{ textAlign: 'center', background: i === shown - 1 ? 'rgba(255,152,0,0.22)' : undefined }}>
                      <td>{i + 1}</td><td>{s.x}</td><td>{s.y}</td><td>{s.errorBefore}</td><td>{s.errorAfter}</td>
                      <td>{s.move === 'none' ? 'end' : s.move}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ color: 'var(--muted)', marginTop: 4 }}>
              Each row: the pixel drawn and the error used to decide the move to the next pixel. 'straight' moves along the major axis only; 'diagonal' moves along both.
            </div>
          </Section>
        </>
      }
      formula={
        <FormulaBox>
          {`dx = |${b.x} − ${a.x}| = ${dx}, dy = |${b.y} − ${a.y}| = ${dy}\n`}
          {`major axis = ${dy > dx ? 'y' : 'x'} (${major} moves), minor axis = ${dy > dx ? 'x' : 'y'} (${minor})\n`}
          {`Start: error = 2·minor − major = 2·${minor} − ${major} = ${e0}\n`}
          {`Rule at each pixel:\n`}
          {`  error > 0 → diagonal move, error += 2·(minor − major) = ${2 * (minor - major)}\n`}
          {`  error ≤ 0 → straight move, error += 2·minor = ${2 * minor}\n`}
          {`  (a tie, error = 0, goes to the larger minor coordinate)`}
        </FormulaBox>
      }
    />
  )
}
