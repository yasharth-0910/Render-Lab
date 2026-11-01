// QuaternionLab.tsx - Euler angles vs quaternions, gimbal lock, and slerp vs lerp.
// The maths is in core/math/quat.ts and core/math/quatLab.ts. Here the world is Z-UP:
// the aircraft's nose points along +x, its wings along y, its fin along +z.
// Mode 1 "Euler vs quaternion": the same orientation on both sides (left through the Euler
//   matrix, right through a quaternion), plus an extra axis-angle turn for the quaternion side.
// Mode 2 "Slerp vs lerp": left = slerp, right = normalized lerp, at the same t.

import { useEffect, useMemo, useRef, useState } from 'react'
import { identity, transformPoint, type Mat4 } from '../core/math/mat4'
import { fromAxisAngle, fromEuler, multiply, rotateVec3, slerp, toMat4, type Quat } from '../core/math/quat'
import {
  angleBetween, angularSpeedSamples, eulerToMatrix, gimbalLock, lerpNormalized, nudgeAxis, quatToAxisAngle,
} from '../core/math/quatLab'
import { cross, length, type Vec3 } from '../core/math/vec3'
import { projectToScreen, type Camera } from '../core/render/camera'
import { Framebuffer } from '../core/render/framebuffer'
import { drawLine } from '../core/render/line'
import { createAircraft } from '../core/render/meshes'
import { renderWireframe } from '../core/render/render'
import { Eq, Note, Numbers } from './components/Equation'
import FormulaBox from './components/FormulaBox'
import LabLayout from './components/LabLayout'
import { MatrixView } from './components/OpEditor'
import Vec3Row from './components/Vec3Row'
import NumberRow from './components/NumberRow'
import { theme } from './components/theme'
import { useShell } from './shell/ShellContext'

const SIZE = 360
const rad = (d: number) => (d * Math.PI) / 180
const deg = (r: number) => (r * 180) / Math.PI
const f = (v: number) => (Math.abs(v) < 5e-4 ? 0 : v).toFixed(3)
const f2 = (v: number) => (Math.abs(v) < 5e-3 ? 0 : v).toFixed(2)
const v3 = (v: readonly number[]) => `(${f(v[0])}, ${f(v[1])}, ${f(v[2])})`

// A fixed camera that looks at the origin with z up.
const CAMERA: Camera = { eye: [2.5, -2.7, 1.8], target: [0, 0, 0], up: [0, 0, 1], fovY: rad(55), aspect: 1, near: 0.1, far: 100 }

const PRESETS: { label: string; q: Quat }[] = [
  { label: 'Level (no rotation)', q: [0, 0, 0, 1] },
  { label: 'Yaw 90°', q: fromAxisAngle([0, 0, 1], rad(90)) },
  { label: 'Pitch 90° (nose down)', q: fromAxisAngle([0, 1, 0], rad(90)) },
  { label: 'Flip 170° about (1,1,1)', q: fromAxisAngle([1, 1, 1], rad(170)) },
  { label: 'Roll 350° (really −10°)', q: fromAxisAngle([1, 0, 0], rad(350)) },
]

type Orientation = { model: Mat4 } // what a viewport needs: the model matrix

// Draw the aircraft with its local axes, on a floor grid, into one canvas.
function drawViewport(
  canvas: HTMLCanvasElement, fb: Framebuffer, mesh: ReturnType<typeof createAircraft>,
  { model }: Orientation, ghosts: Mat4[], vertex: number,
) {
  fb.clear(21, 23, 27, 255)
  const line3D = (a: Vec3, b: Vec3, color: readonly [number, number, number, number]) => {
    const p = projectToScreen(a, identity(), CAMERA, SIZE, SIZE)
    const q = projectToScreen(b, identity(), CAMERA, SIZE, SIZE)
    if (p && q) drawLine(fb, Math.round(p[0]), Math.round(p[1]), Math.round(q[0]), Math.round(q[1]), color)
  }
  // Floor grid on z = 0.
  for (let k = -2; k <= 2; k++) {
    line3D([k, -2, 0], [k, 2, 0], [44, 48, 56, 255])
    line3D([-2, k, 0], [2, k, 0], [44, 48, 56, 255])
  }
  // Ghosts (start and end orientations in slerp mode).
  for (const g of ghosts) renderWireframe(fb, mesh, g, CAMERA, [90, 95, 105, 255])
  // The aircraft.
  renderWireframe(fb, mesh, model, CAMERA, [76, 194, 255, 255])
  // Its local axes: x (nose) red, y (right wing) green, z (up) blue.
  const tip = (v: Vec3) => transformPoint(model, v)
  line3D([0, 0, 0], tip([1.5, 0, 0]), [255, 90, 90, 255])
  line3D([0, 0, 0], tip([0, 1.5, 0]), [90, 230, 120, 255])
  line3D([0, 0, 0], tip([0, 0, 1.5]), [100, 140, 255, 255])
  // The vertex chosen for the formula, as a small yellow square.
  const s = projectToScreen(tip(mesh.vertices[vertex]), identity(), CAMERA, SIZE, SIZE)
  if (s) for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) fb.setPixel(Math.round(s[0]) + dx, Math.round(s[1]) + dy, 255, 212, 59, 255)
  canvas.getContext('2d')!.putImageData(new ImageData(fb.data, SIZE, SIZE), 0, 0)
}

export default function QuaternionLab() {
  const [mode, setMode] = useState<'euler' | 'slerp'>('euler')
  // Euler sliders (degrees)
  const [yaw, setYaw] = useState(30)
  const [pitch, setPitch] = useState(20)
  const [roll, setRoll] = useState(0)
  // Extra axis-angle turn for the quaternion side
  const [axis, setAxis] = useState<Vec3>([1, 0, 0])
  const [extra, setExtra] = useState(0)
  // Slerp section
  const [startKey, setStartKey] = useState('0')
  const [endKey, setEndKey] = useState('3')
  const [t, setT] = useState(0.5)
  const [playing, setPlaying] = useState(false)
  const [vertex, setVertex] = useState(0)

  const { paused: shellPaused } = useShell() // the top bar's Pause button stops Play
  const leftRef = useRef<HTMLCanvasElement>(null)
  const rightRef = useRef<HTMLCanvasElement>(null)
  const plotRef = useRef<HTMLCanvasElement>(null)
  const mesh = useMemo(() => createAircraft(), [])
  const fbLeft = useMemo(() => new Framebuffer(SIZE, SIZE), [])
  const fbRight = useMemo(() => new Framebuffer(SIZE, SIZE), [])

  // ----- the orientations -----
  const [x, y, z] = [rad(roll), rad(pitch), rad(yaw)] // roll about x, pitch about y, yaw about z
  const qEuler = fromEuler(x, y, z)
  const axisLength = length(axis)
  // The extra turn (a zero axis means no turn).
  const qExtra: Quat = axisLength === 0 ? [0, 0, 0, 1] : fromAxisAngle(axis, rad(extra))
  const qCurrent = multiply(qExtra, qEuler) // the quaternion side: extra turn applied after the Euler turn
  const lock = gimbalLock(x, y, z)

  const pick = (key: string): Quat => (key === 'current' ? qCurrent : PRESETS[Number(key)].q)
  const qStart = pick(startKey)
  const qEnd = pick(endKey)
  const qSlerp = slerp(qStart, qEnd, t)
  const qLerp = lerpNormalized(qStart, qEnd, t)

  // The quaternion shown in the readout and used in the formula.
  const qShownRaw = mode === 'euler' ? qCurrent : qSlerp
  const qShown: Quat = qShownRaw[3] < 0 ? [-qShownRaw[0], -qShownRaw[1], -qShownRaw[2], -qShownRaw[3]] : qShownRaw // same rotation, w >= 0
  const aa = quatToAxisAngle(qShown)

  // ----- draw the two viewports -----
  useEffect(() => {
    if (mode === 'euler') {
      drawViewport(leftRef.current!, fbLeft, mesh, { model: eulerToMatrix(x, y, z) }, [], vertex)
      drawViewport(rightRef.current!, fbRight, mesh, { model: toMat4(qCurrent) }, [], vertex)
    } else {
      const ghosts = [toMat4(qStart), toMat4(qEnd)]
      drawViewport(leftRef.current!, fbLeft, mesh, { model: toMat4(qSlerp) }, ghosts, vertex)
      drawViewport(rightRef.current!, fbRight, mesh, { model: toMat4(qLerp) }, ghosts, vertex)
    }
  })

  // ----- the plot of angle moved per step (slerp mode) -----
  const STEPS = 24
  useEffect(() => {
    const canvas = plotRef.current
    if (mode !== 'slerp' || !canvas) return
    const ctx = canvas.getContext('2d')!
    const w = canvas.width
    const h = canvas.height
    ctx.fillStyle = theme.panel
    ctx.fillRect(0, 0, w, h)
    const slerpSteps = angularSpeedSamples(qStart, qEnd, STEPS, 'slerp').map(deg)
    const lerpSteps = angularSpeedSamples(qStart, qEnd, STEPS, 'lerp').map(deg)
    const top = Math.max(...slerpSteps, ...lerpSteps, 1e-6) * 1.15
    const barWidth = (w - 50) / STEPS
    ctx.font = '11px system-ui'
    ctx.fillStyle = theme.muted
    ctx.fillText(`${top.toFixed(1)}°`, 4, 14)
    ctx.fillText('0°', 4, h - 16)
    for (let i = 0; i < STEPS; i++) {
      const x0 = 44 + i * barWidth
      const hs = (slerpSteps[i] / top) * (h - 30)
      const hl = (lerpSteps[i] / top) * (h - 30)
      ctx.fillStyle = theme.accent
      ctx.fillRect(x0, h - 20 - hs, barWidth / 2 - 1, hs)
      ctx.fillStyle = '#e6e6e6'
      ctx.fillRect(x0 + barWidth / 2, h - 20 - hl, barWidth / 2 - 1, hl)
    }
    ctx.fillStyle = theme.muted
    ctx.fillText('step 1', 44, h - 5)
    ctx.fillText(`step ${STEPS}`, w - 52, h - 5)
  })

  // ----- Play: t runs 0 -> 1 in 3 seconds, then starts over -----
  useEffect(() => {
    if (!playing || shellPaused) return
    let frame = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = (now - last) / 1000
      last = now
      setT((old) => (old + dt / 3 > 1 ? old + dt / 3 - 1 : old + dt / 3))
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing, shellPaused])

  // ----- text for the panel -----
  const matrix4 = toMat4(qShown)
  const matrix3 = [matrix4[0], matrix4[1], matrix4[2], matrix4[4], matrix4[5], matrix4[6], matrix4[8], matrix4[9], matrix4[10]]

  // Formula: real numbers for one vertex.
  const v = mesh.vertices[vertex]
  const u: Vec3 = [qShown[0], qShown[1], qShown[2]]
  const uv = cross(u, v)
  const uuv = cross(u, uv)
  const half = aa.angle / 2
  const vOut = rotateVec3(qShown, v)
  const formula = (
    <FormulaBox>
      <Eq label="Quaternion from axis and angle">{'q = ( cos frac{a}{2},  sin frac{a}{2} · axis )'}</Eq>
      <Eq label="Rotate a vector">{"v′ = q v q*"}</Eq>
      <Eq>{'v′ = v + 2w (u × v) + 2 u × (u × v)'}</Eq>
      <Note>u = (x, y, z) is the vector part of q and w its last number.</Note>
      <Numbers
        title={`Vertex ${vertex}`}
        lines={[
          `a = ${f2(deg(aa.angle))}°,  axis = ${v3(aa.axis)}`,
          `cos(a/2) = ${f(Math.cos(half))},  sin(a/2) = ${f(Math.sin(half))}`,
          `q = [x, y, z, w] = [${f(qShown[0])}, ${f(qShown[1])}, ${f(qShown[2])}, ${f(qShown[3])}]`,
          `v = ${v3(v)}`,
          `u = ${v3(u)},  w = ${f(qShown[3])}`,
          `u × v = ${v3(uv)}`,
          `u × (u × v) = ${v3(uuv)}`,
          `v′ = ${v3(v)} + 2·${f(qShown[3])}·${v3(uv)} + 2·${v3(uuv)}`,
          `   = ${v3(vOut)}`,
        ]}
      />
    </FormulaBox>
  )

  // ----- small pieces of layout -----
  const viewport = (title: string, subtitle: string, ref: React.RefObject<HTMLCanvasElement | null>, badge: boolean) => (
    <div>
      <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: 1 }}>{title}</div>
      <div style={{ color: theme.muted, fontSize: 12, marginBottom: 4, minHeight: 16, fontFamily: 'ui-monospace, Menlo, monospace' }}>{subtitle}</div>
      <div style={{ position: 'relative', lineHeight: 0 }}>
        <canvas ref={ref} width={SIZE} height={SIZE} style={{ border: `1px solid ${theme.border}`, borderRadius: 4 }} />
        {badge && (
          <div style={{
            position: 'absolute', top: 8, left: 8, background: '#d32f2f', color: '#fff', fontWeight: 800,
            padding: '3px 10px', borderRadius: 3, letterSpacing: 1, lineHeight: 'normal',
          }}>
            GIMBAL LOCK
          </div>
        )}
      </div>
    </div>
  )

  const select = (value: string, onChange: (v: string) => void) => (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={{ width: '100%' }}>
      {PRESETS.map((p, i) => <option key={i} value={String(i)}>{p.label}</option>)}
      <option value="current">Current (Euler sliders + extra turn)</option>
    </select>
  )

  const yawAxis = nudgeAxis(x, y, z, 'z')
  const rollAxis = nudgeAxis(x, y, z, 'x')
  const button = { background: 'none', color: theme.text, border: `1px solid ${theme.border}`, borderRadius: 3, cursor: 'pointer', padding: '2px 8px' } as const

  const stats =
    mode === 'euler'
      ? [`rotation angle ${f2(deg(aa.angle))}°`, `|q| = ${Math.hypot(...qShown).toFixed(6)}`, lock.locked ? 'GIMBAL LOCK' : 'no gimbal lock']
      : [`start → end ${f2(deg(angleBetween(qStart, qEnd)))}°`, `t = ${t.toFixed(2)}`, `|q| = ${Math.hypot(...qShown).toFixed(6)}`]

  return (
    <LabLayout
      gizmo
      zUp
      canvas={
        <div style={{ lineHeight: 'normal' }}>
          <div style={{ display: 'flex', gap: 12 }}>
            {mode === 'euler'
              ? <>
                  {viewport('EULER ANGLES', `yaw ${yaw}°  pitch ${pitch}°  roll ${roll}°`, leftRef, lock.locked)}
                  {viewport('QUATERNION', `q = [${f2(qShown[0])}, ${f2(qShown[1])}, ${f2(qShown[2])}, ${f2(qShown[3])}]`, rightRef, false)}
                </>
              : <>
                  {viewport('SLERP', 'constant speed', leftRef, false)}
                  {viewport('NORMALIZED LERP', 'speed changes', rightRef, false)}
                </>}
          </div>
          {mode === 'euler' ? (
            <div style={{ marginTop: 8, color: lock.locked ? '#ff8a80' : theme.muted, fontSize: 13, maxWidth: 732 }}>
              {lock.locked
                ? `${lock.explanation} Yaw turns about ${v3(yawAxis)} and roll about ${v3(rollAxis)}: the same line. The quaternion side still turns about any axis: use the axis-angle control.`
                : 'Drag pitch to +90° or −90° to see gimbal lock. Axes: x red (nose), y green (wing), z blue (up).'}
            </div>
          ) : (
            <div style={{ marginTop: 8 }}>
              <canvas ref={plotRef} width={732} height={130} style={{ border: `1px solid ${theme.border}`, borderRadius: 4 }} />
              <div style={{ color: theme.muted, fontSize: 12, maxWidth: 732 }}>
                Angle moved per step (24 equal steps in t). <span style={{ color: theme.accent }}>■</span> slerp: all bars equal.{' '}
                <span style={{ color: '#e6e6e6' }}>■</span> normalized lerp: short at the ends, tall in the middle. Grey outlines = start and end.
              </div>
            </div>
          )}
        </div>
      }
      stats={stats}
      controls={
        <>
          <div style={{ display: 'flex', gap: 12, marginBottom: 6 }}>
            {([['euler', 'Euler vs quaternion'], ['slerp', 'Slerp vs lerp']] as const).map(([k, label]) => (
              <label key={k}>
                <input type="radio" name="quat-mode" checked={mode === k} onChange={() => setMode(k)} style={{ accentColor: theme.accent }} /> {label}
              </label>
            ))}
          </div>

          {mode === 'euler' ? (
            <>
              <NumberRow label="Yaw (z)" value={yaw} min={-180} max={180} onChange={setYaw} format={(n) => `${n}°`} />
              <NumberRow label="Pitch (y)" value={pitch} min={-90} max={90} onChange={setPitch} format={(n) => `${n}°`} />
              <NumberRow label="Roll (x)" value={roll} min={-180} max={180} onChange={setRoll} format={(n) => `${n}°`} />
              <div style={{ margin: '4px 0 8px' }}>
                <button style={button} onClick={() => setPitch(90)}>Pitch to 90° (lock)</button>{' '}
                <button style={button} onClick={() => { setYaw(30); setPitch(20); setRoll(0); setAxis([1, 0, 0]); setExtra(0) }}>Reset</button>
              </div>
              <div style={{ color: theme.muted, margin: '6px 0 2px' }}>Quaternion side: extra turn (axis-angle)</div>
              <Vec3Row label="Axis" value={axis} onChange={setAxis} />
              <NumberRow label="Angle" value={extra} min={-180} max={180} onChange={setExtra} format={(n) => `${n}°`} />
            </>
          ) : (
            <>
              <div style={{ color: theme.muted }}>Start</div>
              {select(startKey, setStartKey)}
              <div style={{ color: theme.muted, marginTop: 4 }}>End</div>
              {select(endKey, setEndKey)}
              <NumberRow label="t" value={t} min={0} max={1} step={0.01} onChange={(n) => { setT(n); setPlaying(false) }} format={(n) => n.toFixed(2)} />
              <button style={button} onClick={() => setPlaying(!playing)}>{playing ? 'Pause' : 'Play'}</button>
            </>
          )}

          <div style={{ color: theme.muted, margin: '10px 0 2px' }}>{mode === 'euler' ? 'Quaternion (right side)' : 'Slerp result'}</div>
          <div style={{ font: theme.mono }}>
            <div>q = [{f(qShown[0])}, {f(qShown[1])}, {f(qShown[2])}, {f(qShown[3])}]</div>
            <div>|q| = {Math.hypot(...qShown).toFixed(6)}</div>
            <div>axis = {v3(aa.axis)}</div>
            <div>angle = {f2(deg(aa.angle))}°</div>
          </div>
          <div style={{ margin: '6px 0 2px', color: theme.muted }}>Same rotation as a 3×3 matrix</div>
          <MatrixView m={matrix3} size={3} />
          <div style={{ marginTop: 6 }}>
            <label style={{ color: theme.muted }}>Vertex for the formula{' '}
              <select value={vertex} onChange={(e) => setVertex(Number(e.target.value))}>
                {mesh.vertices.map((_, i) => <option key={i} value={i}>{i}{i === 0 ? ' (nose)' : ''}</option>)}
              </select>
            </label>
          </div>
        </>
      }
      formula={formula}
    />
  )
}
