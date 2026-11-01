// CullingLab.tsx - back-face culling lab.
// All the maths and drawing is in core/render (culling.ts, renderMesh.ts, fill.ts).
// This file only runs the animation loop, orbit camera, buttons and the live numbers.

import { useEffect, useMemo, useRef, useState } from 'react'
import { multiply, rotateX, rotateY, translate, transformPoint, type Mat4 } from '../core/math/mat4'
import { sub, type Vec3 } from '../core/math/vec3'
import type { Camera } from '../core/render/camera'
import { projectToScreen } from '../core/render/camera'
import { isBackFacingScreen, isBackFacingView, triangleNormal, type CullMode } from '../core/render/culling'
import { DepthBuffer } from '../core/render/fill'
import { Framebuffer } from '../core/render/framebuffer'
import { createCube, type Mesh } from '../core/render/mesh'
import { createPlane, createUVSphere } from '../core/render/meshes'
import { pickTriangle, renderMesh, type RenderOptions } from '../core/render/renderMesh'
import { Eq, Note, Numbers } from './components/Equation'
import FormulaBox from './components/FormulaBox'
import LabLayout from './components/LabLayout'
import NumberRow from './components/NumberRow'
import Section from './components/Section'
import { useLabLog } from './shell/console'
import { usePausedRef } from './shell/ShellContext'

const WIDTH = 640
const HEIGHT = 480

type SceneKind = 'cube' | 'sphere' | 'both'
type SceneObject = { mesh: Mesh; model: Mat4 }
type Selection = { obj: number; tri: number }

type Stats = { total: number; visible: number; culled: number }

// Live numbers for the selected triangle.
type TriangleInfo = {
  a: Vec3; b: Vec3; c: Vec3; eye: Vec3
  normal: Vec3; toTriangle: Vec3; dot: number; backView: boolean
  area: number
  signedArea2: number | null // null when a corner is behind the camera
  backScreen: boolean | null
}

const f = (n: number) => (Math.abs(n) < 5e-4 ? 0 : n).toFixed(3)
const v3 = (v: Vec3) => `(${f(v[0])}, ${f(v[1])}, ${f(v[2])})`

export default function CullingLab() {
  // Settings the user can change.
  const [kind, setKind] = useState<SceneKind>('cube')
  const [segments, setSegments] = useState(16)
  const [cullingOn, setCullingOn] = useState(true)
  const [colorByFacing, setColorByFacing] = useState(true)
  const [drawStyle, setDrawStyle] = useState<RenderOptions['drawStyle']>('wireframe')
  const [mode, setMode] = useState<CullMode>('view')
  const [showNormals, setShowNormals] = useState(false)
  const [paused, setPaused] = useState(false)
  const [selected, setSelected] = useState<Selection | null>(null)
  // Numbers shown on the page, filled in by the animation loop.
  const [stats, setStats] = useState<Stats>({ total: 0, visible: 0, culled: 0 })
  const [info, setInfo] = useState<TriangleInfo | null>(null)

  const log = useLabLog()
  const shellPausedRef = usePausedRef() // the top bar's Pause button also freezes the spin
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const meshes = useMemo(
    () => ({ cube: createCube(), sphere: createUVSphere(segments, Math.max(3, Math.floor(segments / 2))), plane: createPlane(4) }),
    [segments],
  )

  // The animation loop must not restart on every click, so it reads the latest settings
  // from this ref instead of from React state directly.
  const live = useRef({ kind, meshes, cullingOn, colorByFacing, drawStyle, mode, showNormals, paused, selected })
  live.current = { kind, meshes, cullingOn, colorByFacing, drawStyle, mode, showNormals, paused, selected }

  // Console trace: when a setting changes, report the counts a moment later (once the next frame has drawn).
  const statsRef = useRef(stats)
  statsRef.current = stats
  useEffect(() => {
    const id = setTimeout(() => {
      const st = statsRef.current
      if (st.total === 0) return // the first frame has not been drawn yet
      log(`Scene ${kind}: culling ${cullingOn ? 'ON' : 'OFF'} (${mode}-space test): ${st.total} triangles, ${st.visible} drawn, ${st.culled} culled (${st.total === 0 ? 0 : ((100 * st.culled) / st.total).toFixed(1)}%)`)
    }, 250)
    return () => clearTimeout(id)
  }, [kind, segments, cullingOn, mode, stats.total === 0])

  // Orbit camera angles and the spin angle of the objects.
  const view = useRef({ yaw: 0.6, pitch: 0.4, spin: 0 })
  const drag = useRef<{ x: number; y: number; moved: number } | null>(null)

  // A different scene or sphere detail means triangle numbers change: forget the selection.
  useEffect(() => setSelected(null), [kind, segments])

  // The objects to draw at the current spin angle.
  function buildScene(kind: SceneKind, m: typeof meshes, spin: number): SceneObject[] {
    const spinY = rotateY(spin)
    if (kind === 'cube') return [{ mesh: m.cube, model: multiply(spinY, rotateX(0.4)) }]
    if (kind === 'sphere') return [{ mesh: m.sphere, model: spinY }]
    return [
      { mesh: m.plane, model: translate(0, -0.55, 0) },
      { mesh: m.cube, model: multiply(translate(-0.9, 0, 0), spinY) },
      { mesh: m.sphere, model: multiply(translate(0.9, 0, 0), spinY) },
    ]
  }

  // The camera sits on a sphere around the middle of the scene, looking at it.
  function buildCamera(kind: SceneKind): Camera {
    const { yaw, pitch } = view.current
    const dist = kind === 'both' ? 4.5 : 3
    const eye: Vec3 = [
      dist * Math.cos(pitch) * Math.sin(yaw),
      dist * Math.sin(pitch),
      dist * Math.cos(pitch) * Math.cos(yaw),
    ]
    return { eye, target: [0, 0, 0], up: [0, 1, 0], fovY: Math.PI / 3, aspect: WIDTH / HEIGHT, near: 0.1, far: 100 }
  }

  function optionsFor(highlight: number | null): RenderOptions {
    const s = live.current
    return { cullingOn: s.cullingOn, mode: s.mode, drawStyle: s.drawStyle, colorByFacing: s.colorByFacing, showNormals: s.showNormals, highlight }
  }

  // Compute the live numbers for one triangle (same formulas as core/render/culling.ts).
  function describe(obj: SceneObject, tri: number, camera: Camera): TriangleInfo {
    const [i, j, k] = obj.mesh.triangles[tri]
    const world = (idx: number) => transformPoint(obj.model, obj.mesh.vertices[idx])
    const [a, b, c] = [world(i), world(j), world(k)]
    const { normal, area } = triangleNormal(a, b, c)
    const toTriangle = sub(a, camera.eye)
    const dotValue = normal[0] * toTriangle[0] + normal[1] * toTriangle[1] + normal[2] * toTriangle[2]
    const p = [i, j, k].map((idx) => projectToScreen(obj.mesh.vertices[idx], obj.model, camera, WIDTH, HEIGHT))
    const allVisible = p[0] && p[1] && p[2]
    const signedArea2 = allVisible ? (p[1]![0] - p[0]![0]) * (p[2]![1] - p[0]![1]) - (p[1]![1] - p[0]![1]) * (p[2]![0] - p[0]![0]) : null
    return {
      a, b, c, eye: camera.eye, normal, toTriangle, dot: dotValue,
      backView: isBackFacingView(a, b, c, camera.eye), area,
      signedArea2,
      backScreen: allVisible ? isBackFacingScreen(p[0]!, p[1]!, p[2]!) : null,
    }
  }

  // The animation loop: spin, draw, copy to the canvas.
  useEffect(() => {
    const ctx = canvasRef.current!.getContext('2d')!
    const fb = new Framebuffer(WIDTH, HEIGHT)
    const depth = new DepthBuffer(WIDTH, HEIGHT)
    const image = new ImageData(fb.data, WIDTH, HEIGHT) // shares the framebuffer memory
    let frame = 0
    let last = performance.now()
    let lastInfo = 0

    function draw(now: number) {
      const s = live.current
      if (!s.paused && !shellPausedRef.current) view.current.spin += ((now - last) / 1000) * 0.8
      last = now

      const camera = buildCamera(s.kind)
      const objects = buildScene(s.kind, s.meshes, view.current.spin)

      fb.clear(20, 20, 30, 255)
      depth.clear()
      const total: Stats = { total: 0, visible: 0, culled: 0 }
      objects.forEach((o, idx) => {
        const r = renderMesh(fb, depth, o.mesh, o.model, camera, optionsFor(s.selected && s.selected.obj === idx ? s.selected.tri : null))
        total.total += r.total
        total.visible += r.visible
        total.culled += r.culled
      })
      ctx.putImageData(image, 0, 0)

      // Only touch React state when a number really changed.
      setStats((old) => (old.total === total.total && old.visible === total.visible && old.culled === total.culled ? old : total))
      if (now - lastInfo > 100) {
        lastInfo = now
        const sel = s.selected
        setInfo(sel && objects[sel.obj] ? describe(objects[sel.obj], sel.tri, camera) : null)
      }
      frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  }, [])

  // Mouse: drag orbits the camera, a click (almost no movement) selects a triangle.
  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, y: e.clientY, moved: 0 }
  }
  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.x
    const dy = e.clientY - d.y
    d.x = e.clientX
    d.y = e.clientY
    d.moved += Math.abs(dx) + Math.abs(dy)
    view.current.yaw -= dx * 0.01
    // Keep the pitch away from straight up/down, where "up" would be ambiguous.
    view.current.pitch = Math.max(-1.4, Math.min(1.4, view.current.pitch + dy * 0.01))
  }
  function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    const d = drag.current
    drag.current = null
    if (!d || d.moved > 4) return
    // It was a click: find the nearest triangle under the mouse.
    const rect = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * WIDTH
    const py = ((e.clientY - rect.top) / rect.height) * HEIGHT
    const s = live.current
    const camera = buildCamera(s.kind)
    let best: { obj: number; tri: number; depth: number } | null = null
    buildScene(s.kind, s.meshes, view.current.spin).forEach((o, idx) => {
      const hit = pickTriangle(WIDTH, HEIGHT, o.mesh, o.model, camera, optionsFor(null), px, py)
      if (hit && (best === null || hit.depth < best.depth)) best = { obj: idx, tri: hit.triangle, depth: hit.depth }
    })
    setSelected(best ? { obj: (best as { obj: number }).obj, tri: (best as { tri: number }).tri } : null)
    if (best) {
      const hit = best as { obj: number; tri: number }
      const objects = buildScene(s.kind, s.meshes, view.current.spin)
      const d = describe(objects[hit.obj], hit.tri, camera)
      log(`Selected triangle #${hit.tri}: \`n = (b − a) × (c − a)\` = ${v3(d.normal)}, area ${f(d.area)}`)
      log(`  \`n · (a − eye) = ${f(d.dot)}\` → ${d.backView ? 'BACK facing (culled)' : 'FRONT facing (visible)'}; screen test \`2A = ${d.signedArea2 === null ? 'n/a' : f(d.signedArea2)}\``)
    }
  }

  const percent = stats.total === 0 ? 0 : (100 * stats.culled) / stats.total

  const checkbox = (label: string, checked: boolean, set: (v: boolean) => void) => (
    <div><label><input type="checkbox" checked={checked} onChange={(e) => set(e.target.checked)} /> {label}</label></div>
  )

  return (
    <LabLayout
      sections
      gizmo
      canvas={
        <canvas
          ref={canvasRef} width={WIDTH} height={HEIGHT}
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
          style={{ display: 'block', cursor: 'grab', touchAction: 'none' }}
        />
      }
      overlay={`Triangles ${stats.total}\nVisible   ${stats.visible}\nCulled    ${stats.culled} (${percent.toFixed(1)}%)`}
      stats={[`scene: ${kind}`, `${mode}-space test`, `culling ${cullingOn ? 'on' : 'off'}`, 'drag to orbit · click a triangle to select it (yellow)']}
      controls={
        <>
          <Section title="Scene">
            <div className="row">
              <span className="row-label">Scene</span>
              <select value={kind} onChange={(e) => setKind(e.target.value as SceneKind)} style={{ flex: 1 }}>
                <option value="cube">Cube</option>
                <option value="sphere">Sphere</option>
                <option value="both">Cube + sphere on a plane</option>
              </select>
            </div>
            {kind !== 'cube' && <NumberRow label="Segments" value={segments} min={6} max={32} onChange={setSegments} />}
            <button onClick={() => setPaused(!paused)}>{paused ? 'Resume rotation' : 'Pause rotation'}</button>
          </Section>
          <Section title="Culling">
            {checkbox('Back-face culling on', cullingOn, setCullingOn)}
            <div style={{ marginTop: 6, color: 'var(--muted)' }}>Facing test</div>
            <label style={{ display: 'block' }}><input type="radio" name="mode" checked={mode === 'view'} onChange={() => setMode('view')} /> view-space (dot product)</label>
            <label style={{ display: 'block' }}><input type="radio" name="mode" checked={mode === 'screen'} onChange={() => setMode('screen')} /> screen-space (signed area)</label>
          </Section>
          <Section title="Display">
            {checkbox('Colour by facing (front green, back red)', colorByFacing, setColorByFacing)}
            {checkbox('Show normals (cyan)', showNormals, setShowNormals)}
            <div style={{ marginTop: 6, color: 'var(--muted)' }}>Draw style</div>
            {(['wireframe', 'filled', 'both'] as const).map((s) => (
              <label key={s} style={{ marginRight: 10 }}>
                <input type="radio" name="style" checked={drawStyle === s} onChange={() => setDrawStyle(s)} /> {s}
              </label>
            ))}
          </Section>
        </>
      }
      formula={
        <FormulaBox>
          <Eq label="Normal (cross product)">{'n = (b − a) × (c − a)'}</Eq>
          <Eq label="View-space test">{'back facing if   n · (a − eye) ≥ 0'}</Eq>
          <Eq label="Screen-space test">{'2A = (x_1 − x_0)(y_2 − y_0) − (y_1 − y_0)(x_2 − x_0)'}</Eq>
          <Note>On screen y points down, so A &lt; 0 means front facing.</Note>
          {info === null ? (
            <Note>Click a triangle on the canvas to see its numbers.</Note>
          ) : (
            <Numbers
              title="Selected triangle"
              lines={[
                `a = ${v3(info.a)}`, `b = ${v3(info.b)}`, `c = ${v3(info.c)}`, `eye = ${v3(info.eye)}`,
                `n = ${v3(info.normal)},  area = |n| / 2 = ${f(info.area)}`,
                `a − eye = ${v3(info.toTriangle)}`,
                `n · (a − eye) = ${f(info.dot)}   → ${info.backView ? 'BACK facing (culled)' : 'FRONT facing (visible)'}`,
                `signed area 2A = ${info.signedArea2 === null ? 'n/a (a corner is behind the camera)' : f(info.signedArea2)}${info.backScreen !== null ? `   → ${info.backScreen ? 'BACK' : 'FRONT'}` : ''}`,
                `result (${mode} test): ${(mode === 'view' ? info.backView : info.backScreen ?? info.backView) ? 'BACK' : 'FRONT'}`,
              ]}
            />
          )}
        </FormulaBox>
      }
    />
  )
}
