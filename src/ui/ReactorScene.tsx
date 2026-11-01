// ReactorScene.tsx - a sci-fi reactor hall drawn by our own software rasterizer (no WebGL):
// lit triangles, a depth buffer, a neon grid, fog and a bloom glow. The scene itself is built in
// core/render/reactorScene.ts; here it is drawn once per change (not in a loop), so a still
// picture can be saved or copied and sent to a chat.

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Vec3 } from '../core/math/vec3'
import type { Camera } from '../core/render/camera'
import { DepthBuffer } from '../core/render/fill'
import { Framebuffer } from '../core/render/framebuffer'
import { applyBloom } from '../core/render/postfx'
import { createReactorScene } from '../core/render/reactorScene'
import { clearGradient, renderLines3D, renderShaded } from '../core/render/scene'
import FormulaBox from './components/FormulaBox'
import LabLayout from './components/LabLayout'
import NumberRow from './components/NumberRow'
import Section from './components/Section'
import { useLabLog } from './shell/console'

const RESOLUTIONS = { '640x480': [640, 480], '960x720': [960, 720], '1280x960': [1280, 960] } as const
type ResolutionKey = keyof typeof RESOLUTIONS

const rad = (d: number) => (d * Math.PI) / 180
const deg = (r: number) => (r * 180) / Math.PI

type View = { target: Vec3; yaw: number; pitch: number; dist: number }

export default function ReactorScene() {
  const scene = useMemo(() => createReactorScene(), [])
  const [view, setView] = useState<View>(scene.view)
  const [resolution, setResolution] = useState<ResolutionKey>('960x720')
  const [bloomOn, setBloomOn] = useState(true)
  const [bloomStrength, setBloomStrength] = useState(1)
  const [fogDensity, setFogDensity] = useState(scene.fog.density)
  const [gridOn, setGridOn] = useState(true)
  const [dragging, setDragging] = useState(false)
  const [info, setInfo] = useState({ triangles: 0, drawn: 0, ms: 0, width: 0, height: 0 })

  const log = useLabLog()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drag = useRef<{ x: number; y: number } | null>(null)
  const [width, height] = RESOLUTIONS[resolution]

  // Draw the picture whenever something changes. While you drag the camera it is drawn at half
  // size (faster) and stretched up; when you let go it is drawn again at full size.
  useEffect(() => {
    const t0 = performance.now()
    const quality = dragging ? 0.5 : 1
    const w = Math.round(width * quality)
    const h = Math.round(height * quality)
    const fb = new Framebuffer(w, h)
    const depth = new DepthBuffer(w, h)

    const { yaw, pitch, dist, target } = view
    const eye: Vec3 = [
      target[0] + dist * Math.cos(pitch) * Math.sin(yaw),
      target[1] + dist * Math.sin(pitch),
      target[2] + dist * Math.cos(pitch) * Math.cos(yaw),
    ]
    const camera: Camera = { eye, target, up: [0, 1, 0], fovY: rad(62), aspect: width / height, near: 0.1, far: 120 }
    const fog = { color: scene.fog.color, density: fogDensity }

    clearGradient(fb, scene.sky.top, scene.sky.bottom)
    const stats = renderShaded(fb, depth, scene.objects, camera, { lighting: scene.lighting, fog, cullBackFaces: true })
    if (gridOn) renderLines3D(fb, depth, scene.gridLines, camera, [185, 140, 255], fog)
    if (bloomOn) applyBloom(fb, { threshold: 0.5, strength: bloomStrength })

    // Put the pixels on the canvas (stretched, with sharp pixels, when drawn at half size).
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
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
    setInfo({ triangles: stats.triangles, drawn: stats.drawn, ms: performance.now() - t0, width: w, height: h })
  }, [scene, view, width, height, bloomOn, bloomStrength, fogDensity, gridOn, dragging])

  // Console trace: one line per finished picture (a moment after the last change).
  useEffect(() => {
    if (dragging || info.drawn === 0) return
    const id = setTimeout(() => {
      log(`Rendered ${info.width}x${info.height}: ${info.drawn.toLocaleString()} of ${info.triangles.toLocaleString()} triangles drawn (the rest face away or are behind the camera), ${info.ms.toFixed(0)} ms${bloomOn ? ', with bloom' : ''}`)
    }, 400)
    return () => clearTimeout(id)
  }, [info, dragging, bloomOn])

  // Mouse: drag to orbit around the target, wheel to zoom.
  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, y: e.clientY }
    setDragging(true)
  }
  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.x
    const dy = e.clientY - d.y
    d.x = e.clientX
    d.y = e.clientY
    setView((v) => ({ ...v, yaw: v.yaw - dx * 0.006, pitch: Math.max(-0.5, Math.min(1.3, v.pitch + dy * 0.006)) }))
  }
  function endDrag() {
    drag.current = null
    setDragging(false)
  }
  function onWheel(e: React.WheelEvent<HTMLCanvasElement>) {
    setView((v) => ({ ...v, dist: Math.max(3, Math.min(40, v.dist * (e.deltaY > 0 ? 1.08 : 0.92))) }))
  }

  // Save / copy the picture.
  function toPng(then: (blob: Blob) => void) {
    canvasRef.current!.toBlob((blob) => blob && then(blob), 'image/png')
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

  return (
    <LabLayout
      sections
      gizmo
      canvas={
        <canvas
          ref={canvasRef} width={width} height={height}
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={endDrag} onWheel={onWheel}
          style={{ display: 'block', cursor: 'grab', touchAction: 'none', maxWidth: '100%', height: 'auto' }}
        />
      }
      overlay={`${info.drawn.toLocaleString()} triangles\n${info.ms.toFixed(0)} ms render\n${width} × ${height}`}
      stats={[`${scene.objects.length} objects`, `${scene.lighting.lights.length} point lights + ambient`, 'drag to orbit · wheel to zoom']}
      controls={
        <>
          <Section title="Render">
            <div className="row">
              <span className="row-label">Size</span>
              <select value={resolution} onChange={(e) => setResolution(e.target.value as ResolutionKey)} style={{ flex: 1 }}>
                <option value="640x480">640 × 480 (fast)</option>
                <option value="960x720">960 × 720</option>
                <option value="1280x960">1280 × 960 (best, slower)</option>
              </select>
            </div>
            <div><label><input type="checkbox" checked={bloomOn} onChange={(e) => setBloomOn(e.target.checked)} /> Bloom (glow)</label></div>
            {bloomOn && <NumberRow label="Glow" value={bloomStrength} min={0.2} max={2.5} step={0.05} onChange={setBloomStrength} format={(v) => v.toFixed(2)} />}
            <NumberRow label="Fog" value={fogDensity} min={0} max={0.06} step={0.002} onChange={setFogDensity} format={(v) => v.toFixed(3)} />
            <div><label><input type="checkbox" checked={gridOn} onChange={(e) => setGridOn(e.target.checked)} /> Neon floor grid</label></div>
          </Section>
          <Section title="Camera">
            <div>
              <button style={button} onClick={preset(scene.view)}>Hero view</button>
              <button style={button} onClick={preset({ target: [-2.6, 2.1, 1.2], yaw: 0.8, pitch: 0.05, dist: 5.5 })}>Robot close-up</button>
              <button style={button} onClick={preset({ target: [0, 3, -6], yaw: 0.6, pitch: 0.55, dist: 22 })}>High angle</button>
            </div>
            <NumberRow label="Turn" value={Math.round(deg(view.yaw))} min={-180} max={180} onChange={(d) => setView({ ...view, yaw: rad(d) })} format={(v) => `${v}°`} />
            <NumberRow label="Tilt" value={Math.round(deg(view.pitch))} min={-28} max={75} onChange={(d) => setView({ ...view, pitch: rad(d) })} format={(v) => `${v}°`} />
            <NumberRow label="Distance" value={Math.round(view.dist * 10) / 10} min={3} max={40} step={0.5} onChange={(d) => setView({ ...view, dist: d })} />
          </Section>
          <Section title="Share">
            <button style={button} onClick={savePng}>Save PNG</button>
            <button style={button} onClick={copyPng}>Copy image</button>
            <div style={{ color: 'var(--muted)' }}>
              Save the PNG and attach it in WhatsApp, or press Copy image and paste it (Ctrl+V / Cmd+V) into WhatsApp Web.
              Pick 1280 × 960 first for the sharpest picture.
            </div>
          </Section>
        </>
      }
      formula={
        <FormulaBox>
          {'colour = albedo × (ambient + Σ lamp × max(0, n·l) × 1/(1+(d/range)²)) + emissive\n'}
          {'fog: mix(colour, fogColour, 1 − e^(−density × distance))\n'}
          {'bloom: blur the bright part (above the threshold) and add it back\n\n'}
          {'n = triangle normal (cross product), l = direction to the lamp,\nd = distance to the lamp. Each triangle is lit once (flat shading).'}
        </FormulaBox>
      }
    />
  )
}
