// TransformLab.tsx - transformations lab. A mode switch picks the 2D view (here) or the
// 3D view (Transform3D.tsx). The maths is in core/math/transformLab.ts.
// The operation lists live in this wrapper, so switching mode does not lose your work.

import { useEffect, useRef, useState } from 'react'
import { classifyMatrix, composeOps2D, transformPolygon, type Op2 } from '../core/math/transformLab'
import type { Mat3 } from '../core/math/mat3'
import FormulaBox from './components/FormulaBox'
import LabLayout from './components/LabLayout'
import OpEditor, { makeOp, MatrixView, type Spec, type UiOp } from './components/OpEditor'
import { theme } from './components/theme'
import Transform3D, { defaultOps3D } from './Transform3D'

const SPEC_2D: Spec = {
  translate: { label: 'Translate', fields: [{ key: 'tx', label: 'tx', def: 2 }, { key: 'ty', label: 'ty', def: 1 }] },
  rotate: { label: 'Rotate (about the origin)', fields: [{ key: 'angle', label: 'angle °', def: 30, step: 5 }] },
  scale: { label: 'Scale', fields: [{ key: 'sx', label: 'sx', def: 1.5 }, { key: 'sy', label: 'sy', def: 1 }] },
  shear: { label: 'Shear', fields: [{ key: 'shx', label: 'shear x', def: 0.5 }, { key: 'shy', label: 'shear y', def: 0 }] },
  reflect: { label: 'Reflect', fields: [], axis: true },
  rotateAbout: {
    label: 'Rotate about pivot',
    fields: [{ key: 'angle', label: 'angle °', def: 45, step: 5 }, { key: 'px', label: 'pivot x', def: 2 }, { key: 'py', label: 'pivot y', def: 2 }],
  },
}

const defaultOps2D = (): UiOp[] => [
  makeOp('scale', SPEC_2D, { sx: 1.5, sy: 1 }),
  makeOp('rotate', SPEC_2D, { angle: 30 }),
  makeOp('translate', SPEC_2D, { tx: 3, ty: -2 }),
]

const rad = (deg: number) => (deg * Math.PI) / 180

// Turn what the user typed (degrees, text) into the core's operation (radians).
function toOp2(o: UiOp): Op2 {
  const v = o.v
  switch (o.type) {
    case 'translate': return { type: 'translate', tx: v.tx, ty: v.ty }
    case 'rotate': return { type: 'rotate', angle: rad(v.angle) }
    case 'scale': return { type: 'scale', sx: v.sx, sy: v.sy }
    case 'shear': return { type: 'shear', shx: v.shx, shy: v.shy }
    case 'reflect': return { type: 'reflect', axis: o.axis }
    default: return { type: 'rotateAbout', angle: rad(v.angle), px: v.px, py: v.py }
  }
}

// The letter F, drawn counter-clockwise. It has no symmetry, so any rotation, mirror or
// shear is easy to see. Its area is 6.96.
const F_SHAPE: [number, number][] = [[0, 0], [1, 0], [1, 1.8], [2.2, 1.8], [2.2, 2.6], [1, 2.6], [1, 3], [3, 3], [3, 4], [0, 4]]

const WIDTH = 640
const HEIGHT = 480
const UNIT = 40 // pixels per world unit
const toPx = (x: number, y: number): [number, number] => [WIDTH / 2 + x * UNIT, HEIGHT / 2 - y * UNIT] // y up on screen
const f = (v: number) => (Math.abs(v) < 5e-4 ? 0 : v).toFixed(3)

function arrow(ctx: CanvasRenderingContext2D, from: [number, number], to: [number, number], color: string, label: string) {
  const angle = Math.atan2(to[1] - from[1], to[0] - from[0])
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(from[0], from[1])
  ctx.lineTo(to[0], to[1])
  ctx.stroke()
  ctx.beginPath() // arrow head
  ctx.moveTo(to[0], to[1])
  ctx.lineTo(to[0] - 9 * Math.cos(angle - 0.4), to[1] - 9 * Math.sin(angle - 0.4))
  ctx.lineTo(to[0] - 9 * Math.cos(angle + 0.4), to[1] - 9 * Math.sin(angle + 0.4))
  ctx.closePath()
  ctx.fill()
  ctx.font = 'bold 13px system-ui'
  ctx.fillText(label, to[0] + 6, to[1] - 6)
}

function polygonPath(ctx: CanvasRenderingContext2D, pts: readonly (readonly [number, number])[]) {
  ctx.beginPath()
  pts.forEach(([x, y], i) => {
    const [px, py] = toPx(x, y)
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  })
  ctx.closePath()
}

// What the viewer selection means: "final" or the index of an operation.
export function pickStep<M>(choice: string, steps: M[], final: M): M {
  const i = Number(choice)
  return choice !== 'final' && steps[i] ? steps[i] : final
}

function Transform2D({ ops, setOps, modeSwitch }: { ops: UiOp[]; setOps: (o: UiOp[]) => void; modeSwitch: React.ReactNode }) {
  const [choice, setChoice] = useState('final') // which matrix to view: 'final' or an operation index
  const [showPivot, setShowPivot] = useState(true)
  const [showArea, setShowArea] = useState(true)
  const [vertex, setVertex] = useState(3)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const coreOps = ops.map(toOp2)
  const composed = composeOps2D(coreOps)
  const m: Mat3 = pickStep(choice, composed.steps, composed.matrix)
  const info = classifyMatrix(m)
  const poly = transformPolygon(m, F_SHAPE)

  useEffect(() => {
    const ctx = canvasRef.current!.getContext('2d')!
    ctx.fillStyle = theme.panel
    ctx.fillRect(0, 0, WIDTH, HEIGHT)

    // Grid, axes and tick numbers.
    ctx.lineWidth = 1
    for (let x = -8; x <= 8; x++) {
      ctx.strokeStyle = x === 0 ? '#777' : '#2a2d35'
      ctx.beginPath(); ctx.moveTo(toPx(x, 0)[0] + 0.5, 0); ctx.lineTo(toPx(x, 0)[0] + 0.5, HEIGHT); ctx.stroke()
    }
    for (let y = -6; y <= 6; y++) {
      ctx.strokeStyle = y === 0 ? '#777' : '#2a2d35'
      ctx.beginPath(); ctx.moveTo(0, toPx(0, y)[1] + 0.5); ctx.lineTo(WIDTH, toPx(0, y)[1] + 0.5); ctx.stroke()
    }
    ctx.fillStyle = theme.muted
    ctx.font = '11px system-ui'
    for (let x = -8; x <= 8; x += 2) if (x !== 0) ctx.fillText(String(x), toPx(x, 0)[0] - 4, toPx(0, 0)[1] + 14)
    for (let y = -6; y <= 6; y += 2) if (y !== 0) ctx.fillText(String(y), toPx(0, 0)[0] + 5, toPx(0, y)[1] + 4)

    // Ghost of the original F (dashed).
    polygonPath(ctx, F_SHAPE)
    ctx.fillStyle = 'rgba(255,255,255,0.05)'
    ctx.fill()
    ctx.setLineDash([5, 4])
    ctx.strokeStyle = '#8a8f99'
    ctx.stroke()
    ctx.setLineDash([])

    // The transformed F.
    polygonPath(ctx, poly.points)
    ctx.fillStyle = 'rgba(76,194,255,0.35)'
    ctx.fill()
    ctx.strokeStyle = theme.accent
    ctx.lineWidth = 2
    ctx.stroke()

    // The transformed unit square, and the two basis vectors: they ARE the columns of the matrix.
    const origin = [m[2], m[5]] as const // where (0,0) goes: the last column
    const iEnd = [m[0] + m[2], m[3] + m[5]] as const // where (1,0) goes: origin + first column
    const jEnd = [m[1] + m[2], m[4] + m[5]] as const // where (0,1) goes: origin + second column
    polygonPath(ctx, [[origin[0], origin[1]], [iEnd[0], iEnd[1]], [iEnd[0] + m[1], iEnd[1] + m[4]], [jEnd[0], jEnd[1]]])
    ctx.setLineDash([3, 3])
    ctx.strokeStyle = '#ddd'
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.setLineDash([])
    arrow(ctx, toPx(origin[0], origin[1]), toPx(iEnd[0], iEnd[1]), '#fff', "i'")
    arrow(ctx, toPx(origin[0], origin[1]), toPx(jEnd[0], jEnd[1]), '#fff', "j'")

    // Pivots of every "rotate about pivot" operation.
    if (showPivot) {
      ops.forEach((o, i) => {
        if (o.type !== 'rotateAbout') return
        const [px, py] = toPx(o.v.px, o.v.py)
        ctx.strokeStyle = '#ffd43b'
        ctx.lineWidth = 1.5
        ctx.beginPath(); ctx.arc(px, py, 7, 0, 2 * Math.PI); ctx.moveTo(px - 11, py); ctx.lineTo(px + 11, py); ctx.moveTo(px, py - 11); ctx.lineTo(px, py + 11); ctx.stroke()
        ctx.fillStyle = '#ffd43b'
        ctx.font = '12px system-ui'
        ctx.fillText(`pivot ${i + 1}`, px + 10, py - 8)
      })
    }

    // The vertex chosen for the formula box: before (ghost) and after.
    const v = F_SHAPE[vertex]
    const after = poly.points[vertex]
    for (const [p, label] of [[v, 'p'], [after, "p'"]] as const) {
      const [px, py] = toPx(p[0], p[1])
      ctx.fillStyle = '#ffd43b'
      ctx.beginPath(); ctx.arc(px, py, 4, 0, 2 * Math.PI); ctx.fill()
      ctx.font = 'bold 12px system-ui'
      ctx.fillText(label, px + 7, py + 14)
    }
  })

  // Formula box: p' = M p for the chosen vertex, with the numbers.
  const [x, y] = F_SHAPE[vertex]
  const [x2, y2] = poly.points[vertex]
  const formula = (
    <FormulaBox>
      {`p' = M p     (p = [x, y, 1])\n\n`}
      {`vertex ${vertex}: p = (${f(x)}, ${f(y)}, 1)\n\n`}
      {`x' = ${f(m[0])}·${f(x)} + ${f(m[1])}·${f(y)} + ${f(m[2])}·1\n   = ${f(x2)}\n`}
      {`y' = ${f(m[3])}·${f(x)} + ${f(m[4])}·${f(y)} + ${f(m[5])}·1\n   = ${f(y2)}\n\n`}
      {`columns of M: i' = (${f(m[0])}, ${f(m[3])}), j' = (${f(m[1])}, ${f(m[4])}), origin → (${f(m[2])}, ${f(m[5])})`}
    </FormulaBox>
  )

  const viewLabel = choice === 'final' || !composed.steps[Number(choice)] ? 'final matrix' : `after operation ${Number(choice) + 1}`

  return (
    <LabLayout
      canvas={<canvas ref={canvasRef} width={WIDTH} height={HEIGHT} style={{ borderRadius: 4 }} />}
      overlay={showArea ? `Area before: ${poly.areaBefore.toFixed(2)}\nArea after:  ${poly.areaAfter.toFixed(2)}\n= |det| × before = ${info.scaleFactor.toFixed(3)} × ${poly.areaBefore.toFixed(2)}` : undefined}
      stats={[`${ops.length} operations`, `viewing: ${viewLabel}`, `det = ${f(info.determinant)}`, `area × ${info.scaleFactor.toFixed(3)}`]}
      controls={
        <>
          {modeSwitch}
          <OpEditor ops={ops} spec={SPEC_2D} onChange={setOps} onReset={() => { setOps(defaultOps2D()); setChoice('final') }} />
          <div style={{ margin: '10px 0 4px', color: theme.muted }}>Matrix to view</div>
          <select value={choice} onChange={(e) => setChoice(e.target.value)} style={{ width: '100%' }}>
            <option value="final">Final (all {ops.length} operations)</option>
            {ops.map((o, i) => <option key={o.id} value={String(i)}>After operation {i + 1}: {SPEC_2D[o.type].label}</option>)}
          </select>
          <div style={{ margin: '6px 0' }}><MatrixView m={m} size={3} /></div>
          <div style={{ fontSize: 34, fontWeight: 700, lineHeight: 1.1, color: info.singular ? '#ffd43b' : theme.text }}>
            det = {f(info.determinant)}
          </div>
          <div style={{ color: theme.muted, marginBottom: 6 }}>{info.description}</div>
          <div><label><input type="checkbox" checked={showPivot} onChange={(e) => setShowPivot(e.target.checked)} style={{ accentColor: theme.accent }} /> Show pivot points</label></div>
          <div><label><input type="checkbox" checked={showArea} onChange={(e) => setShowArea(e.target.checked)} style={{ accentColor: theme.accent }} /> Show area before and after</label></div>
          <label style={{ color: theme.muted }}>Vertex for the formula{' '}
            <select value={vertex} onChange={(e) => setVertex(Number(e.target.value))}>
              {F_SHAPE.map((_, i) => <option key={i} value={i}>{i}</option>)}
            </select>
          </label>
        </>
      }
      formula={formula}
    />
  )
}

export default function TransformLab() {
  const [mode, setMode] = useState<'2d' | '3d'>('2d')
  const [ops2, setOps2] = useState<UiOp[]>(defaultOps2D)
  const [ops3, setOps3] = useState<UiOp[]>(defaultOps3D)
  const modeSwitch = (
    <div style={{ display: 'flex', gap: 12 }}>
      {([['2d', '2D (matrix 3×3)'], ['3d', '3D (matrix 4×4)']] as const).map(([k, label]) => (
        <label key={k}>
          <input type="radio" name="transform-mode" checked={mode === k} onChange={() => setMode(k)} style={{ accentColor: theme.accent }} /> {label}
        </label>
      ))}
    </div>
  )
  return mode === '2d'
    ? <Transform2D ops={ops2} setOps={setOps2} modeSwitch={modeSwitch} />
    : <Transform3D ops={ops3} setOps={setOps3} modeSwitch={modeSwitch} />
}

