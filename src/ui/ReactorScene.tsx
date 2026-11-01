// ReactorScene.tsx - the demo scene, plus a small scene editor around it.
//  - The scene is a list of objects (core/render/sceneEditor.ts), shared with the Scene dock's tree.
//  - Click an object in the picture (or in the tree) to select it; it gets an accent outline.
//  - The inspector edits the selected object live; the Add menu and Delete change the list.
//  - Back-face culling and wireframe can be switched, and the stats strip shows the triangle counts.
// The picture is drawn once per change (not in a loop), so it can be saved or copied to share.

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Vec3 } from '../core/math/vec3'
import type { Camera } from '../core/render/camera'
import { DepthBuffer } from '../core/render/fill'
import { Framebuffer } from '../core/render/framebuffer'
import { drawOutline } from '../core/render/outline'
import { applyBloom } from '../core/render/postfx'
import {
  addObject, deleteObject, modelFromTransform, pickObject, selectObject, toSceneObjects, updateObject,
  type AddableKind, type EditorObject,
} from '../core/render/sceneEditor'
import { meshFor } from '../core/render/sceneMeshes'
import { clearGradient, renderLines3D, renderShaded } from '../core/render/scene'
import FormulaBox from './components/FormulaBox'
import LabLayout from './components/LabLayout'
import NumberRow from './components/NumberRow'
import Section from './components/Section'
import Vec3Row from './components/Vec3Row'
import { useLabLog } from './shell/console'
import { editorStore, reactorBase, useEditorState } from './shell/editorStore'
import Menu from './shell/Menu'

const RESOLUTIONS = { '640x480': [640, 480], '960x720': [960, 720], '1280x960': [1280, 960] } as const
type ResolutionKey = keyof typeof RESOLUTIONS

const ACCENT = [76, 194, 255, 255] as const // the outline colour

const rad = (d: number) => (d * Math.PI) / 180
const deg = (r: number) => (r * 180) / Math.PI

type View = { target: Vec3; yaw: number; pitch: number; dist: number }

// The camera for a view (orbiting around the target) and the picture's width / height.
function makeCamera({ yaw, pitch, dist, target }: View, aspect: number): Camera {
  const eye: Vec3 = [
    target[0] + dist * Math.cos(pitch) * Math.sin(yaw),
    target[1] + dist * Math.sin(pitch),
    target[2] + dist * Math.cos(pitch) * Math.cos(yaw),
  ]
  return { eye, target, up: [0, 1, 0], fovY: rad(62), aspect, near: 0.1, far: 120 }
}

// Colour picker <-> our colours (0..1 per channel).
const toHex = (c: readonly number[]) => '#' + c.map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0')).join('')
const fromHex = (hex: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number]

export default function ReactorScene() {
  const state = useEditorState()
  const selected: EditorObject | null = state.objects.find((o) => o.id === state.selectedId) ?? null
  const sceneObjects = useMemo(() => toSceneObjects(state.objects), [state.objects])

  const [view, setView] = useState<View>(reactorBase.view)
  const [resolution, setResolution] = useState<ResolutionKey>('960x720')
  const [bloomOn, setBloomOn] = useState(true)
  const [bloomStrength, setBloomStrength] = useState(1)
  const [fogDensity, setFogDensity] = useState(reactorBase.fog.density)
  const [gridOn, setGridOn] = useState(true)
  const [cullingOn, setCullingOn] = useState(true) // back-face culling
  const [wireframe, setWireframe] = useState(false) // wireframe instead of filled triangles
  const [dragging, setDragging] = useState(false)
  const [info, setInfo] = useState({ triangles: 0, drawn: 0, culled: 0, ms: 0, width: 0, height: 0 })

  const log = useLabLog()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drag = useRef<{ x: number; y: number; moved: number } | null>(null)
  const [width, height] = RESOLUTIONS[resolution]

  // Draw the whole picture into a new framebuffer of w x h pixels. `withOutline` adds the selection outline
  // (left out when the picture is saved or copied).
  function renderPicture(w: number, h: number, withOutline: boolean) {
    const fb = new Framebuffer(w, h)
    const depth = new DepthBuffer(w, h)
    const camera = makeCamera(view, width / height)
    const fog = { color: reactorBase.fog.color, density: fogDensity }
    clearGradient(fb, reactorBase.sky.top, reactorBase.sky.bottom)
    const stats = renderShaded(fb, depth, sceneObjects, camera, {
      lighting: reactorBase.lighting, fog, cullBackFaces: cullingOn, style: wireframe ? 'wireframe' : 'filled',
    })
    if (gridOn) renderLines3D(fb, depth, reactorBase.gridLines, camera, [185, 140, 255], fog)
    if (bloomOn) applyBloom(fb, { threshold: 0.5, strength: bloomStrength })
    if (withOutline && selected && selected.visible) {
      drawOutline(fb, meshFor(selected.kind), modelFromTransform(selected.position, selected.rotation, selected.scale), camera, ACCENT)
    }
    return { fb, stats }
  }

  // Draw whenever something changes. While you drag the camera it is drawn at half size (faster) and
  // stretched up; when you let go it is drawn again at full size.
  useEffect(() => {
    const t0 = performance.now()
    const quality = dragging ? 0.5 : 1
    const w = Math.round(width * quality)
    const h = Math.round(height * quality)
    const { fb, stats } = renderPicture(w, h, true)

    const ctx = canvasRef.current!.getContext('2d')!
    const image = new ImageData(fb.data, w, h)
    if (quality === 1) {
      ctx.putImageData(image, 0, 0)
    } else {
      const small = document.createElement('canvas')
      small.width = w
      small.height = h
      small.getContext('2d')!.putImageData(image, 0, 0)
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(small, 0, 0, width, height)
    }
    setInfo({ ...stats, ms: performance.now() - t0, width: w, height: h })
  }, [sceneObjects, state.selectedId, view, width, height, bloomOn, bloomStrength, fogDensity, gridOn, cullingOn, wireframe, dragging])

  // Console trace: one line per finished picture (a moment after the last change).
  useEffect(() => {
    if (dragging || info.drawn === 0) return
    const id = setTimeout(() => {
      log(`Rendered ${info.width}x${info.height} (${wireframe ? 'wireframe' : 'filled'}): ${info.triangles.toLocaleString()} triangles, ${info.drawn.toLocaleString()} drawn, ${info.culled.toLocaleString()} culled by back-face culling (${cullingOn ? 'on' : 'off'}), ${info.ms.toFixed(0)} ms`)
    }, 400)
    return () => clearTimeout(id)
  }, [info, dragging, wireframe, cullingOn])

  // The Delete key removes the selected object (unless you are typing in a box).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (e.key === 'Delete' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) removeSelected()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // ----- editing the list -----
  function add(kind: AddableKind) {
    editorStore.update((s) => addObject(s, kind))
    log(`Added a ${kind}`, 'info')
  }
  function removeSelected() {
    const current = editorStore.getState()
    const doomed = current.objects.find((o) => o.id === current.selectedId)
    if (!doomed) return
    editorStore.update((s) => deleteObject(s, doomed.id))
    log(`Deleted "${doomed.name}"`, 'info')
  }
  const change = (patch: Partial<Omit<EditorObject, 'id'>>) => selected && editorStore.update((s) => updateObject(s, selected.id, patch))

  // ----- mouse: drag orbits the camera, a click (almost no movement) picks the object under it -----
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
    if (d.moved <= 4) return // still a click, not a drag
    if (!dragging) setDragging(true)
    setView((v) => ({ ...v, yaw: v.yaw - dx * 0.006, pitch: Math.max(-0.5, Math.min(1.3, v.pitch + dy * 0.006)) }))
  }
  function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    const d = drag.current
    drag.current = null
    setDragging(false)
    if (!d || d.moved > 4) return
    // A click: turn the mouse position into a pixel of the picture and ask which object is there.
    const rect = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * width
    const py = ((e.clientY - rect.top) / rect.height) * height
    const hit = pickObject(state.objects, makeCamera(view, width / height), width, height, px, py, { cullingOn })
    editorStore.update((s) => selectObject(s, hit ? hit.id : null))
    const picked = hit && state.objects.find((o) => o.id === hit.id)
    log(picked ? `Picked "${picked.name}" (${picked.group}), depth ${hit!.depth.toFixed(4)}` : 'Clicked empty space: nothing selected')
  }
  function onWheel(e: React.WheelEvent<HTMLCanvasElement>) {
    setView((v) => ({ ...v, dist: Math.max(3, Math.min(40, v.dist * (e.deltaY > 0 ? 1.08 : 0.92))) }))
  }

  // ----- save / copy the picture (drawn again without the outline) -----
  function toPng(then: (blob: Blob) => void) {
    const { fb } = renderPicture(width, height, false)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    canvas.getContext('2d')!.putImageData(new ImageData(fb.data, width, height), 0, 0)
    canvas.toBlob((blob) => blob && then(blob), 'image/png')
  }
  function savePng() {
    toPng((blob) => {
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = 'renderlab-reactor-scene.png'
      link.click()
      URL.revokeObjectURL(link.href)
      log(`Saved renderlab-reactor-scene.png (${width}x${height})`, 'info')
    })
  }
  function copyPng() {
    toPng((blob) => {
      navigator.clipboard
        .write([new ClipboardItem({ 'image/png': blob })])
        .then(() => log('Copied the picture. Paste it into your chat with Ctrl+V / Cmd+V.', 'info'))
        .catch(() => log('The browser did not allow copying. Use Save PNG instead.', 'warn'))
    })
  }

  const preset = (v: View) => () => setView(v)
  const button = { marginRight: 6, marginBottom: 6 } as const
  const skipped = info.triangles - info.drawn - info.culled
  const percent = info.triangles === 0 ? 0 : (100 * info.culled) / info.triangles

  return (
    <LabLayout
      sections
      gizmo
      canvas={
        <canvas
          ref={canvasRef} width={width} height={height}
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
          onPointerCancel={() => { drag.current = null; setDragging(false) }} onWheel={onWheel}
          style={{ display: 'block', cursor: 'crosshair', touchAction: 'none', maxWidth: '100%', height: 'auto' }}
        />
      }
      overlay={`${info.drawn.toLocaleString()} drawn\n${info.ms.toFixed(0)} ms render\n${width} × ${height}`}
      stats={[
        `${sceneObjects.length} objects`,
        `${info.triangles.toLocaleString()} triangles`,
        `${info.drawn.toLocaleString()} drawn`,
        `${info.culled.toLocaleString()} culled (${percent.toFixed(1)}%)`,
        ...(skipped > 0 ? [`${skipped.toLocaleString()} behind the camera`] : []),
        'click to select · drag to orbit · wheel to zoom',
      ]}
      controls={
        <>
          <Section title="Scene">
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <Menu
                title="Add ▾"
                items={(['cube', 'sphere', 'cylinder', 'plane'] as const).map((kind) => ({ label: kind[0].toUpperCase() + kind.slice(1), onClick: () => add(kind) }))}
              />
              <button onClick={removeSelected} disabled={!selected}>Delete</button>
              <button onClick={() => { editorStore.reset(); log('Scene reset to the original', 'info') }}>Reset scene</button>
            </div>
            <div style={{ color: 'var(--muted)', marginTop: 4 }}>{state.objects.length} objects ({state.objects.filter((o) => !o.visible).length} hidden). The Delete key also deletes.</div>
          </Section>

          <Section title={selected ? `Selected: ${selected.name}` : 'Selected object'}>
            {selected ? (
              <>
                <div className="row">
                  <span className="row-label">Name</span>
                  <input type="text" value={selected.name} onChange={(e) => change({ name: e.target.value })} style={{ flex: 1, minWidth: 0 }} />
                </div>
                <div style={{ color: 'var(--muted)', marginBottom: 4 }}>{selected.kind} · folder {selected.group}</div>
                <Vec3Row label="Position" value={selected.position} onChange={(v) => change({ position: v })} />
                <Vec3Row label="Rotation °" value={selected.rotation} step={5} onChange={(v) => change({ rotation: v })} />
                <Vec3Row label="Scale" value={selected.scale} onChange={(v) => change({ scale: v })} />
                <div className="row">
                  <span className="row-label">Colour</span>
                  <input type="color" value={toHex(selected.color)} onChange={(e) => change({ color: fromHex(e.target.value) })} />
                </div>
                <NumberRow label="Glow" value={selected.glow} min={0} max={4} step={0.05} onChange={(v) => change({ glow: v })} format={(v) => v.toFixed(2)} />
                <label><input type="checkbox" checked={selected.visible} onChange={(e) => change({ visible: e.target.checked })} /> Visible</label>
              </>
            ) : (
              <div style={{ color: 'var(--muted)' }}>Click an object in the picture, or pick one in the Scene tree on the left.</div>
            )}
          </Section>

          <Section title="Render">
            <div><label><input type="checkbox" checked={cullingOn} onChange={(e) => setCullingOn(e.target.checked)} /> Back-face culling</label></div>
            <div><label><input type="checkbox" checked={wireframe} onChange={(e) => setWireframe(e.target.checked)} /> Wireframe (off = filled)</label></div>
            <div className="row">
              <span className="row-label">Size</span>
              <select value={resolution} onChange={(e) => setResolution(e.target.value as ResolutionKey)} style={{ flex: 1 }}>
                <option value="640x480">640 × 480 (fast)</option>
                <option value="960x720">960 × 720</option>
                <option value="1280x960">1280 × 960 (best, slower)</option>
              </select>
            </div>
            <div><label><input type="checkbox" checked={bloomOn} onChange={(e) => setBloomOn(e.target.checked)} /> Bloom (glow)</label></div>
            {bloomOn && <NumberRow label="Glow amt" value={bloomStrength} min={0.2} max={2.5} step={0.05} onChange={setBloomStrength} format={(v) => v.toFixed(2)} />}
            <NumberRow label="Fog" value={fogDensity} min={0} max={0.06} step={0.002} onChange={setFogDensity} format={(v) => v.toFixed(3)} />
            <div><label><input type="checkbox" checked={gridOn} onChange={(e) => setGridOn(e.target.checked)} /> Neon floor grid</label></div>
          </Section>

          <Section title="Camera" defaultOpen={false}>
            <div>
              <button style={button} onClick={preset(reactorBase.view)}>Hero view</button>
              <button style={button} onClick={preset({ target: [-2.6, 2.1, 1.2], yaw: 0.8, pitch: 0.05, dist: 5.5 })}>Robot close-up</button>
              <button style={button} onClick={preset({ target: [0, 3, -6], yaw: 0.6, pitch: 0.55, dist: 22 })}>High angle</button>
            </div>
            <NumberRow label="Turn" value={Math.round(deg(view.yaw))} min={-180} max={180} onChange={(d) => setView({ ...view, yaw: rad(d) })} format={(v) => `${v}°`} />
            <NumberRow label="Tilt" value={Math.round(deg(view.pitch))} min={-28} max={75} onChange={(d) => setView({ ...view, pitch: rad(d) })} format={(v) => `${v}°`} />
            <NumberRow label="Distance" value={Math.round(view.dist * 10) / 10} min={3} max={40} step={0.5} onChange={(d) => setView({ ...view, dist: d })} />
          </Section>

          <Section title="Share" defaultOpen={false}>
            <button style={button} onClick={savePng}>Save PNG</button>
            <button style={button} onClick={copyPng}>Copy image</button>
            <div style={{ color: 'var(--muted)' }}>
              Saves or copies the picture without the selection outline. Attach the PNG in WhatsApp, or paste the copied
              image (Ctrl+V / Cmd+V) into WhatsApp Web. Pick 1280 × 960 first for the sharpest picture.
            </div>
          </Section>
        </>
      }
      formula={
        <FormulaBox>
          {'M = T · Rz · Ry · Rx · S   (scale, then turn, then move)\n'}
          {'back facing if n · (a − eye) ≥ 0  → culled when culling is on\n'}
          {'pick: the object whose triangle under the mouse has the smallest depth\n\n'}
          {'colour = albedo × (ambient + Σ lamp × max(0, n·l) × 1/(1+(d/range)²)) + emissive\n'}
          {'fog: mix(colour, fogColour, 1 − e^(−density × distance))'}
        </FormulaBox>
      }
    />
  )
}
