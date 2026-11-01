// SimplifyLab.tsx - Visvalingam-Whyatt simplification lab.
// The algorithm is in core/simplify/visvalingam.ts. It produces the full removal order
// once (the "steps"); the slider only chooses how many of those steps to apply.

import { useEffect, useMemo, useRef, useState } from 'react'
import { maxDistance, polygonArea } from '../core/simplify/metrics'
import { rdpToCount } from '../core/simplify/rdp'
import { createCoastline, createIsland, createSpiral, createStar, parsePoints } from '../core/simplify/shapes'
import { keptMask, triangleArea, visvalingamSteps, type Pt } from '../core/simplify/visvalingam'
import FormulaBox from './components/FormulaBox'
import LabLayout from './components/LabLayout'
import NumberRow from './components/NumberRow'
import { theme } from './components/theme'
import { useLabLog } from './shell/console'

const SIZE = 360 // each of the two canvases is SIZE x SIZE pixels
const ORANGE = '#ff9f43' // RDP comparison
const YELLOW = '#ffd43b' // highlighted vertex

type ShapeKey = 'coastline' | 'island' | 'spiral' | 'star' | 'pasted'

const SAMPLE_PASTE = '0,0\n1,0.2\n2,-0.1\n3,0.1\n4,2\n5,0.1\n6,0\n7,0.05\n8,1.5\n9,0\n10,0'

// Returns a function that maps shape coordinates to canvas pixels:
// fits the original's bounding box into the canvas, same scale on both axes, y flipped (up is up).
function makeFit(points: readonly Pt[]): (p: Pt) => [number, number] {
  const xs = points.map((p) => p[0])
  const ys = points.map((p) => p[1])
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  const width = Math.max(...xs) - minX || 1
  const height = Math.max(...ys) - minY || 1
  const margin = 20
  const scale = Math.min((SIZE - 2 * margin) / width, (SIZE - 2 * margin) / height)
  const offsetX = (SIZE - width * scale) / 2
  const offsetY = (SIZE - height * scale) / 2
  return (p) => [offsetX + (p[0] - minX) * scale, SIZE - (offsetY + (p[1] - minY) * scale)]
}

function strokePath(ctx: CanvasRenderingContext2D, pts: readonly [number, number][], closed: boolean, color: string, width: number) {
  if (pts.length < 2) return
  ctx.beginPath()
  pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)))
  if (closed) ctx.closePath()
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.lineJoin = 'round'
  ctx.stroke()
}

function dot(ctx: CanvasRenderingContext2D, p: readonly [number, number], radius: number, color: string) {
  ctx.beginPath()
  ctx.arc(p[0], p[1], radius, 0, 2 * Math.PI)
  ctx.fillStyle = color
  ctx.fill()
}

const f = (v: number) => v.toFixed(3)
// Areas can be tiny, so switch to scientific notation when 3 decimals would show 0.
const fa = (v: number) => (v !== 0 && Math.abs(v) < 0.001 ? v.toExponential(2) : v.toFixed(3))
const pt = (p: Pt) => `(${f(p[0])}, ${f(p[1])})`

export default function SimplifyLab() {
  const [shapeKey, setShapeKey] = useState<ShapeKey>('coastline')
  const [pastedText, setPastedText] = useState(SAMPLE_PASTE)
  const [pastedClosed, setPastedClosed] = useState(false)
  const [keep, setKeep] = useState(75)
  const [showRemoved, setShowRemoved] = useState(true)
  const [showKept, setShowKept] = useState(true)
  const [colorByArea, setColorByArea] = useState(false)
  const [showRdp, setShowRdp] = useState(false)
  const [stepMode, setStepMode] = useState(false)

  const log = useLabLog()
  const leftRef = useRef<HTMLCanvasElement>(null)
  const rightRef = useRef<HTMLCanvasElement>(null)

  // The built-in shapes are made once.
  const samples = useMemo(
    () => ({ coastline: createCoastline(), island: createIsland(), spiral: createSpiral(), star: createStar() }),
    [],
  )
  const pasted = useMemo(() => parsePoints(pastedText), [pastedText])
  const points: Pt[] = shapeKey === 'pasted' ? pasted.points : samples[shapeKey].points
  const closed = shapeKey === 'pasted' ? pastedClosed : samples[shapeKey].closed

  // Run Visvalingam-Whyatt once per shape and time it.
  const vw = useMemo(() => {
    const t0 = performance.now()
    const steps = visvalingamSteps(points, closed)
    return { steps, ms: performance.now() - t0 }
  }, [points, closed])

  // A new shape starts at about 15% of its vertices.
  const minKeep = Math.min(points.length, closed ? 3 : 2)
  useEffect(() => {
    setKeep(Math.max(minKeep, Math.round(points.length * 0.15)))
  }, [shapeKey])

  const n = points.length
  const keepCount = Math.max(minKeep, Math.min(n, keep))
  const removeCount = n - keepCount // how many steps are applied
  const kept = useMemo(() => keptMask(n, vw.steps, removeCount), [n, vw.steps, removeCount])
  const simplified = useMemo(() => points.filter((_, i) => kept[i]), [points, kept])

  // Comparison numbers.
  const quality = useMemo(() => {
    const areaBefore = closed ? polygonArea(points) : 0
    const areaAfter = closed ? polygonArea(simplified) : 0
    return {
      areaError: Math.abs(areaAfter - areaBefore),
      areaErrorPct: areaBefore === 0 ? 0 : (100 * Math.abs(areaAfter - areaBefore)) / areaBefore,
      maxDist: n < 2 ? 0 : maxDistance(points, simplified, closed),
    }
  }, [points, simplified, closed, n])
  const rdpResult = useMemo(() => (showRdp && n >= 3 ? rdpToCount(points, closed, keepCount) : []), [showRdp, points, closed, keepCount, n])
  const rdpMaxDist = useMemo(() => (rdpResult.length > 0 ? maxDistance(points, rdpResult, closed) : 0), [rdpResult, points, closed])

  // The removal the highlight shows: the most recently applied step.
  const highlighted = stepMode && removeCount > 0 ? vw.steps[removeCount - 1] : null

  // Colour scale for "colour by area": log scale between the smallest and largest positive area.
  const areaRange = useMemo(() => {
    const positive = vw.steps.map((s) => s.area).filter((a) => a > 0)
    return { min: Math.min(...positive, Infinity), max: Math.max(...positive, 0) }
  }, [vw.steps])

  // Console trace: the removal order once per shape, then the result a moment after the slider stops.
  useEffect(() => {
    log(`Visvalingam-Whyatt on ${n} points (${closed ? 'closed polygon' : 'open polyline'}): ${vw.steps.length} removal steps in ${vw.ms.toFixed(1)} ms`)
    if (vw.steps.length > 0) log(`  first removals: ${vw.steps.slice(0, 4).map((s) => `#${s.index} (area ${fa(s.area)})`).join(', ')}`)
  }, [points, closed])
  useEffect(() => {
    const id = setTimeout(() => {
      log(`Keep ${keepCount} of ${n}: removed ${removeCount}, max distance ${f(quality.maxDist)}${closed ? `, area error ${quality.areaErrorPct.toFixed(2)}%` : ''}`)
      const last = vw.steps[removeCount - 1]
      if (stepMode && last) log(`  last removal: vertex #${last.index}, area ${fa(last.area)} (raw ${fa(last.rawArea)}), neighbours #${last.prev} and #${last.next}`)
    }, 250)
    return () => clearTimeout(id)
  }, [keepCount, points, closed, stepMode])

  // Draw both canvases.
  useEffect(() => {
    if (n === 0) {
      for (const ref of [leftRef, rightRef]) ref.current!.getContext('2d')!.clearRect(0, 0, SIZE, SIZE)
      return
    }
    const fit = makeFit(points)
    const screen = points.map(fit)

    // Left: the original.
    const left = leftRef.current!.getContext('2d')!
    left.clearRect(0, 0, SIZE, SIZE)
    strokePath(left, screen, closed, '#9aa0aa', 1.2)
    if (n <= 200) screen.forEach((p) => dot(left, p, 1.8, 'rgba(255,255,255,0.35)'))

    // Right: the simplified shape and everything around it.
    const right = rightRef.current!.getContext('2d')!
    right.clearRect(0, 0, SIZE, SIZE)
    if (showRdp) strokePath(right, rdpResult.map(fit), closed, ORANGE, 1.5)
    if (showRemoved) {
      for (let i = 0; i < removeCount; i++) {
        const step = vw.steps[i]
        let color = 'rgba(255,255,255,0.22)'
        if (colorByArea) {
          // small area = dim, large area = bright
          const t = areaRange.max > areaRange.min && step.area > 0
            ? (Math.log(step.area) - Math.log(areaRange.min)) / (Math.log(areaRange.max) - Math.log(areaRange.min))
            : 0
          color = `hsl(200 90% ${15 + 60 * Math.max(0, Math.min(1, t))}%)`
        }
        dot(right, screen[step.index], colorByArea ? 2.6 : 1.8, color)
      }
    }
    strokePath(right, simplified.map(fit), closed, theme.accent, 2)
    if (showKept) simplified.forEach((p) => dot(right, fit(p), 3, theme.accent))
    if (highlighted) {
      const a = screen[highlighted.prev]
      const b = screen[highlighted.index]
      const c = screen[highlighted.next]
      right.beginPath()
      right.moveTo(a[0], a[1])
      right.lineTo(b[0], b[1])
      right.lineTo(c[0], c[1])
      right.closePath()
      right.fillStyle = 'rgba(255,212,59,0.3)'
      right.fill()
      right.strokeStyle = YELLOW
      right.lineWidth = 1.5
      right.stroke()
      right.beginPath()
      right.arc(b[0], b[1], 6, 0, 2 * Math.PI)
      right.stroke()
    }
  }, [points, closed, n, simplified, removeCount, vw.steps, showRemoved, showKept, colorByArea, showRdp, rdpResult, highlighted, areaRange])

  // Formula box.
  let formula: React.ReactNode
  const header = 'area = 0.5 × |(b − a) × (c − a)|\n(b−a)×(c−a) = (bx−ax)(cy−ay) − (by−ay)(cx−ax)\n\n'
  if (highlighted) {
    const a = points[highlighted.prev]
    const b = points[highlighted.index]
    const c = points[highlighted.next]
    const u: Pt = [b[0] - a[0], b[1] - a[1]]
    const v: Pt = [c[0] - a[0], c[1] - a[1]]
    const cross = u[0] * v[1] - u[1] * v[0]
    formula = (
      <>
        {header}
        {`Vertex #${highlighted.index} (last removed)\n`}
        {`a = #${highlighted.prev} ${pt(a)}\nb = #${highlighted.index} ${pt(b)}\nc = #${highlighted.next} ${pt(c)}\n\n`}
        {`b − a = ${pt(u)}\nc − a = ${pt(v)}\n`}
        {`cross = ${f(u[0])}×${f(v[1])} − ${f(u[1])}×${f(v[0])} = ${fa(cross)}\n`}
        {`area = 0.5 × |${fa(cross)}| = ${fa(triangleArea(a, b, c))}`}
        {highlighted.area > highlighted.rawArea + 1e-12
          ? `\nRanked area = max(area, last removed) = ${fa(highlighted.area)}\n(the monotonic rule raised it)`
          : ''}
      </>
    )
  } else {
    formula = <>{header}{'Turn on Step mode and remove a vertex to see its numbers here.'}</>
  }

  const checkbox = (label: string, checked: boolean, set: (v: boolean) => void) => (
    <div><label><input type="checkbox" checked={checked} onChange={(e) => set(e.target.checked)} style={{ accentColor: theme.accent }} /> {label}</label></div>
  )
  const button = { background: 'none', color: theme.text, border: `1px solid ${theme.border}`, borderRadius: 3, cursor: 'pointer', padding: '2px 8px' } as const

  const side = (title: string, count: number, ref: React.RefObject<HTMLCanvasElement | null>, accent: boolean) => (
    <div>
      <div className="compare-title">{title}</div>
      <div className="compare-count" style={{ color: accent ? theme.accent : theme.text, marginBottom: 6 }}>{count.toLocaleString()}<small>VERTICES</small></div>
      <canvas ref={ref} width={SIZE} height={SIZE} style={{ background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: 4 }} />
    </div>
  )

  // The last few removals, newest first.
  const recent = vw.steps.slice(Math.max(0, removeCount - 6), removeCount).map((s, i, arr) => ({ s, number: removeCount - arr.length + i + 1 })).reverse()

  const stats = [
    `${n} → ${keepCount} vertices (${n === 0 ? 0 : ((100 * removeCount) / n).toFixed(0)}% removed)`,
    closed ? `area error ${quality.areaErrorPct.toFixed(2)}%` : 'area error n/a (open line)',
    `max distance ${f(quality.maxDist)}`,
    ...(showRdp ? [`RDP max distance ${f(rdpMaxDist)}`] : []),
    `VW ${vw.ms.toFixed(1)} ms`,
  ]

  return (
    <LabLayout
      canvas={
        <div style={{ display: 'flex', gap: 12, lineHeight: 'normal' }}>
          {side('Original', n, leftRef, false)}
          {side('Simplified', keepCount, rightRef, true)}
        </div>
      }
      stats={stats}
      controls={
        <>
          <label>Shape{' '}
            <select value={shapeKey} onChange={(e) => setShapeKey(e.target.value as ShapeKey)}>
              <option value="coastline">Coastline (open, 500)</option>
              <option value="island">Island (closed, 400)</option>
              <option value="spiral">Spiral (open, 300)</option>
              <option value="star">Star (closed, 400)</option>
              <option value="pasted">Pasted data</option>
            </select>
          </label>
          {shapeKey === 'pasted' && (
            <div style={{ margin: '6px 0' }}>
              <textarea
                value={pastedText} onChange={(e) => setPastedText(e.target.value)} rows={5}
                style={{ width: '100%', boxSizing: 'border-box', background: theme.panel, color: theme.text, border: `1px solid ${theme.border}`, font: theme.mono }}
              />
              {checkbox('Closed polygon', pastedClosed, setPastedClosed)}
              <div style={{ color: theme.muted, fontSize: 12 }}>One "x,y" per line. {pasted.points.length} points read{pasted.bad > 0 ? `, ${pasted.bad} bad line(s) skipped` : ''}.</div>
            </div>
          )}
          <NumberRow label="Keep" value={keepCount} min={minKeep} max={Math.max(minKeep, n)} onChange={setKeep} />
          <div style={{ margin: '4px 0' }}>
            {checkbox('Show removed vertices (faint dots)', showRemoved, setShowRemoved)}
            {checkbox('Colour removed by area (dim → bright)', colorByArea, setColorByArea)}
            {checkbox('Show kept vertices (dots)', showKept, setShowKept)}
            {checkbox('Compare with RDP (orange)', showRdp, setShowRdp)}
            {checkbox('Step mode', stepMode, setStepMode)}
          </div>
          {stepMode && (
            <div>
              <button style={button} disabled={removeCount === 0} onClick={() => setKeep(keepCount + 1)}>◀ Restore one</button>{' '}
              <button style={button} disabled={removeCount >= vw.steps.length} onClick={() => setKeep(keepCount - 1)}>Remove one ▶</button>
              <table style={{ marginTop: 6, width: '100%', fontFamily: theme.mono.split(' ').slice(1).join(' '), fontSize: 12.5, textAlign: 'center' }}>
                <thead style={{ color: theme.muted }}><tr><th>Removal</th><th>Vertex</th><th>Area</th></tr></thead>
                <tbody>
                  {recent.map(({ s, number }, i) => (
                    <tr key={number} style={{ background: i === 0 ? 'rgba(255,212,59,0.18)' : undefined }}>
                      <td>#{number}</td><td>{s.index}</td><td>{fa(s.area)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      }
      formula={<FormulaBox>{formula}</FormulaBox>}
    />
  )
}
