// Transform3D.tsx - the 3D mode of the transformations lab.
// The unit cube is drawn with the software rasterizer (wireframe): a grey ghost of the
// original and the transformed cube in the accent colour.

import { useEffect, useMemo, useRef, useState } from 'react'
import { classifyMatrix, composeOps3D, type Op3 } from '../core/math/transformLab'
import { identity, transformPoint } from '../core/math/mat4'
import { normalize, type Vec3 } from '../core/math/vec3'
import { projectToScreen, type Camera } from '../core/render/camera'
import { Framebuffer } from '../core/render/framebuffer'
import { drawLine } from '../core/render/line'
import { createCube } from '../core/render/mesh'
import { renderWireframe } from '../core/render/render'
import FormulaBox from './components/FormulaBox'
import LabLayout from './components/LabLayout'
import OpEditor, { makeOp, MatrixView, type Spec, type UiOp } from './components/OpEditor'
import { theme } from './components/theme'

export const SPEC_3D: Spec = {
  translate: { label: 'Translate', fields: [{ key: 'tx', label: 'tx', def: 1 }, { key: 'ty', label: 'ty', def: 0 }, { key: 'tz', label: 'tz', def: 0 }] },
  rotateX: { label: 'Rotate about X', fields: [{ key: 'angle', label: 'angle °', def: 30, step: 5 }] },
  rotateY: { label: 'Rotate about Y', fields: [{ key: 'angle', label: 'angle °', def: 30, step: 5 }] },
  rotateZ: { label: 'Rotate about Z', fields: [{ key: 'angle', label: 'angle °', def: 30, step: 5 }] },
  rotateAxis: {
    label: 'Rotate about axis',
    fields: [{ key: 'ax', label: 'axis x', def: 1 }, { key: 'ay', label: 'y', def: 1 }, { key: 'az', label: 'z', def: 0 }, { key: 'angle', label: 'angle °', def: 45, step: 5 }],
  },
  rotateAbout: {
    label: 'Rotate about pivot',
    fields: [
      { key: 'ax', label: 'axis x', def: 0 }, { key: 'ay', label: 'y', def: 1 }, { key: 'az', label: 'z', def: 0 }, { key: 'angle', label: 'angle °', def: 45, step: 5 },
      { key: 'px', label: 'pivot x', def: 1 }, { key: 'py', label: 'y', def: 0 }, { key: 'pz', label: 'z', def: 0 },
    ],
  },
  scale: { label: 'Scale', fields: [{ key: 'sx', label: 'sx', def: 1.5 }, { key: 'sy', label: 'sy', def: 1 }, { key: 'sz', label: 'sz', def: 1 }] },
  shear: {
    label: 'Shear',
    fields: [
      { key: 'xy', label: 'x+=k·y', def: 0.5 }, { key: 'xz', label: 'x+=k·z', def: 0 }, { key: 'yx', label: 'y+=k·x', def: 0 },
      { key: 'yz', label: 'y+=k·z', def: 0 }, { key: 'zx', label: 'z+=k·x', def: 0 }, { key: 'zy', label: 'z+=k·y', def: 0 },
    ],
  },
}

export const defaultOps3D = (): UiOp[] => [
  makeOp('rotateAxis', SPEC_3D, { ax: 1, ay: 1, az: 0, angle: 40 }),
  makeOp('translate', SPEC_3D, { tx: 1.5, ty: 0.5, tz: 0 }),
]

const rad = (deg: number) => (deg * Math.PI) / 180

function toOp3(o: UiOp): Op3 {
  const v = o.v
  switch (o.type) {
    case 'translate': return { type: 'translate', tx: v.tx, ty: v.ty, tz: v.tz }
    case 'rotateX': return { type: 'rotateX', angle: rad(v.angle) }
    case 'rotateY': return { type: 'rotateY', angle: rad(v.angle) }
    case 'rotateZ': return { type: 'rotateZ', angle: rad(v.angle) }
    case 'rotateAxis': return { type: 'rotateAxis', ax: v.ax, ay: v.ay, az: v.az, angle: rad(v.angle) }
    case 'rotateAbout': return { type: 'rotateAbout', ax: v.ax, ay: v.ay, az: v.az, angle: rad(v.angle), px: v.px, py: v.py, pz: v.pz }
    case 'scale': return { type: 'scale', sx: v.sx, sy: v.sy, sz: v.sz }
    default: return { type: 'shear', xy: v.xy, xz: v.xz, yx: v.yx, yz: v.yz, zx: v.zx, zy: v.zy }
  }
}

const WIDTH = 640
const HEIGHT = 480
const f = (v: number) => (Math.abs(v) < 5e-4 ? 0 : v).toFixed(3)

type Props = { ops: UiOp[]; setOps: (o: UiOp[]) => void; modeSwitch: React.ReactNode }

export default function Transform3D({ ops, setOps, modeSwitch }: Props) {
  const [choice, setChoice] = useState('final')
  const [showPivot, setShowPivot] = useState(true)
  const [vertex, setVertex] = useState(6)
  const [view, setView] = useState({ yaw: 0.7, pitch: 0.45 })
  const [renderMs, setRenderMs] = useState(0)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drag = useRef<{ x: number; y: number } | null>(null)
  const cube = useMemo(() => createCube(), [])
  const fb = useMemo(() => new Framebuffer(WIDTH, HEIGHT), [])

  const composed = composeOps3D(ops.map(toOp3))
  const i = Number(choice)
  const m = choice !== 'final' && composed.steps[i] ? composed.steps[i] : composed.matrix
  const info = classifyMatrix(m)

  useEffect(() => {
    const t0 = performance.now()
    const dist = 7
    const eye: Vec3 = [dist * Math.cos(view.pitch) * Math.sin(view.yaw), dist * Math.sin(view.pitch), dist * Math.cos(view.pitch) * Math.cos(view.yaw)]
    const cam: Camera = { eye, target: [0, 0, 0], up: [0, 1, 0], fovY: Math.PI / 3, aspect: WIDTH / HEIGHT, near: 0.1, far: 100 }
    fb.clear(21, 23, 27, 255)

    // A line between two world points (skipped if either end is behind the camera).
    const line3D = (a: Vec3, b: Vec3, color: readonly [number, number, number, number]) => {
      const p = projectToScreen(a, identity(), cam, WIDTH, HEIGHT)
      const q = projectToScreen(b, identity(), cam, WIDTH, HEIGHT)
      if (p && q) drawLine(fb, Math.round(p[0]), Math.round(p[1]), Math.round(q[0]), Math.round(q[1]), color)
    }

    // Floor grid on y = 0, then the x (red), y (green), z (blue) axes.
    for (let k = -3; k <= 3; k++) {
      line3D([k, 0, -3], [k, 0, 3], [48, 52, 60, 255])
      line3D([-3, 0, k], [3, 0, k], [48, 52, 60, 255])
    }
    line3D([0, 0, 0], [3.5, 0, 0], [255, 90, 90, 255])
    line3D([0, 0, 0], [0, 3.5, 0], [90, 230, 120, 255])
    line3D([0, 0, 0], [0, 0, 3.5], [100, 140, 255, 255])

    // Pivots and rotation axes of the rotation operations.
    if (showPivot) {
      const yellow = [255, 212, 59, 255] as const
      for (const o of ops) {
        if (o.type !== 'rotateAxis' && o.type !== 'rotateAbout') continue
        const axis = normalize([o.v.ax, o.v.ay, o.v.az])
        const c: Vec3 = o.type === 'rotateAbout' ? [o.v.px, o.v.py, o.v.pz] : [0, 0, 0]
        line3D([c[0] - 2 * axis[0], c[1] - 2 * axis[1], c[2] - 2 * axis[2]], [c[0] + 2 * axis[0], c[1] + 2 * axis[1], c[2] + 2 * axis[2]], yellow)
        if (o.type === 'rotateAbout') {
          for (const d of [[0.2, 0, 0], [0, 0.2, 0], [0, 0, 0.2]] as Vec3[]) {
            line3D([c[0] - d[0], c[1] - d[1], c[2] - d[2]], [c[0] + d[0], c[1] + d[1], c[2] + d[2]], yellow)
          }
        }
      }
    }

    // Ghost of the original cube, then the transformed cube.
    renderWireframe(fb, cube, identity(), cam, [120, 125, 135, 255])
    renderWireframe(fb, cube, m, cam, [76, 194, 255, 255])

    // The chosen vertex, before and after, as small yellow squares.
    for (const p of [cube.vertices[vertex], transformPoint(m, cube.vertices[vertex])] as Vec3[]) {
      const s = projectToScreen(p, identity(), cam, WIDTH, HEIGHT)
      if (s) for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) fb.setPixel(Math.round(s[0]) + dx, Math.round(s[1]) + dy, 255, 212, 59, 255)
    }

    canvasRef.current!.getContext('2d')!.putImageData(new ImageData(fb.data, WIDTH, HEIGHT), 0, 0)
    setRenderMs(performance.now() - t0)
  }, [m, view, showPivot, vertex, ops])

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, y: e.clientY }
  }
  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.x
    const dy = e.clientY - d.y
    d.x = e.clientX
    d.y = e.clientY
    setView((v) => ({ yaw: v.yaw - dx * 0.01, pitch: Math.max(-1.4, Math.min(1.4, v.pitch + dy * 0.01)) }))
  }

  const [x, y, z] = cube.vertices[vertex]
  const [x2, y2, z2] = transformPoint(m, cube.vertices[vertex])
  const formula = (
    <FormulaBox>
      {`p' = M p     (p = [x, y, z, 1])\n\n`}
      {`vertex ${vertex}: p = (${f(x)}, ${f(y)}, ${f(z)}, 1)\n\n`}
      {`x' = ${f(m[0])}·${f(x)} + ${f(m[1])}·${f(y)} + ${f(m[2])}·${f(z)} + ${f(m[3])}\n   = ${f(x2)}\n`}
      {`y' = ${f(m[4])}·${f(x)} + ${f(m[5])}·${f(y)} + ${f(m[6])}·${f(z)} + ${f(m[7])}\n   = ${f(y2)}\n`}
      {`z' = ${f(m[8])}·${f(x)} + ${f(m[9])}·${f(y)} + ${f(m[10])}·${f(z)} + ${f(m[11])}\n   = ${f(z2)}`}
    </FormulaBox>
  )
  const viewLabel = choice === 'final' || !composed.steps[i] ? 'final matrix' : `after operation ${i + 1}`

  return (
    <LabLayout
      gizmo
      canvas={
        <canvas
          ref={canvasRef} width={WIDTH} height={HEIGHT}
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={() => (drag.current = null)}
          style={{ cursor: 'grab', touchAction: 'none', borderRadius: 4 }}
        />
      }
      overlay={`${renderMs.toFixed(1)} ms/frame\n8 vertices, 12 edges\naxes: x red, y green, z blue`}
      stats={[`${ops.length} operations`, `viewing: ${viewLabel}`, `det = ${f(info.determinant)}`, `volume × ${info.scaleFactor.toFixed(3)}`]}
      controls={
        <>
          {modeSwitch}
          <OpEditor ops={ops} spec={SPEC_3D} onChange={setOps} onReset={() => { setOps(defaultOps3D()); setChoice('final') }} />
          <div style={{ margin: '10px 0 4px', color: theme.muted }}>Matrix to view</div>
          <select value={choice} onChange={(e) => setChoice(e.target.value)} style={{ width: '100%' }}>
            <option value="final">Final (all {ops.length} operations)</option>
            {ops.map((o, k) => <option key={o.id} value={String(k)}>After operation {k + 1}: {SPEC_3D[o.type].label}</option>)}
          </select>
          <div style={{ margin: '6px 0' }}><MatrixView m={m} size={4} /></div>
          <div style={{ fontSize: 34, fontWeight: 700, lineHeight: 1.1, color: info.singular ? '#ffd43b' : theme.text }}>det = {f(info.determinant)}</div>
          <div style={{ color: theme.muted, marginBottom: 6 }}>{info.description}</div>
          <div><label><input type="checkbox" checked={showPivot} onChange={(e) => setShowPivot(e.target.checked)} style={{ accentColor: theme.accent }} /> Show pivots and rotation axes (yellow)</label></div>
          <label style={{ color: theme.muted }}>Vertex for the formula{' '}
            <select value={vertex} onChange={(e) => setVertex(Number(e.target.value))}>
              {cube.vertices.map((_, k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </label>
          <div style={{ color: theme.muted, marginTop: 6 }}>Drag the canvas to orbit.</div>
        </>
      }
      formula={formula}
    />
  )
}
