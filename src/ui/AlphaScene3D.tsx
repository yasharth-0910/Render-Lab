// AlphaScene3D.tsx - the "3D scene" mode of the alpha lab.
// A solid cube and sphere, with one or two see-through panes in front of them.
// Frame = solid pass (renderMesh, writes depth) then see-through pass (renderTransparent).

import { useEffect, useMemo, useRef, useState } from 'react'
import { multiply, rotateX, rotateY, translate } from '../core/math/mat4'
import type { Vec3 } from '../core/math/vec3'
import type { Rgba } from '../core/render/alpha'
import type { Camera } from '../core/render/camera'
import { DepthBuffer } from '../core/render/fill'
import { Framebuffer } from '../core/render/framebuffer'
import { createCube } from '../core/render/mesh'
import { createPlane, createUVSphere } from '../core/render/meshes'
import { renderMesh } from '../core/render/renderMesh'
import { renderTransparent, type TransparentItem } from '../core/render/transparent'
import FormulaBox from './components/FormulaBox'
import LabLayout from './components/LabLayout'
import NumberRow from './components/NumberRow'
import { theme } from './components/theme'
import { useLabLog } from './shell/console'
import { usePausedRef } from './shell/ShellContext'

const WIDTH = 640
const HEIGHT = 480

export default function AlphaScene3D({ modeSwitch }: { modeSwitch: React.ReactNode }) {
  const [sortOn, setSortOn] = useState(true)
  const [paneCount, setPaneCount] = useState<1 | 2>(2)
  const [opacity, setOpacity] = useState(0.5)
  const [cullPanes, setCullPanes] = useState(false)
  const [readout, setReadout] = useState({ fps: 0, frameMs: 0, triangles: 0, blended: 0, blendMs: 0, panes: 2 })

  const log = useLabLog()
  const shellPausedRef = usePausedRef() // the top bar's Pause button freezes the spin
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const meshes = useMemo(() => ({ cube: createCube(), sphere: createUVSphere(16, 8), pane: createPlane(1.8) }), [])

  // The loop reads the latest settings from this ref so it never has to restart.
  const live = useRef({ sortOn, paneCount, opacity, cullPanes })
  live.current = { sortOn, paneCount, opacity, cullPanes }
  const view = useRef({ yaw: 0.6, pitch: 0.25, spin: 0 })
  const drag = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const ctx = canvasRef.current!.getContext('2d')!
    const fb = new Framebuffer(WIDTH, HEIGHT)
    const depth = new DepthBuffer(WIDTH, HEIGHT)
    const image = new ImageData(fb.data, WIDTH, HEIGHT)
    let frame = 0
    let last = performance.now()
    let frames = 0
    let lastFlush = last

    function draw(now: number) {
      const t0 = performance.now()
      const s = live.current
      if (!shellPausedRef.current) view.current.spin += ((now - last) / 1000) * 0.6
      last = now
      const { yaw, pitch, spin } = view.current

      const dist = 3.8
      const eye: Vec3 = [dist * Math.cos(pitch) * Math.sin(yaw), dist * Math.sin(pitch), dist * Math.cos(pitch) * Math.cos(yaw)]
      const camera: Camera = { eye, target: [0, 0, 0], up: [0, 1, 0], fovY: Math.PI / 3, aspect: WIDTH / HEIGHT, near: 0.1, far: 100 }

      fb.clear(20, 20, 30, 255)
      depth.clear()

      // 1) Solid pass.
      const solid = { cullingOn: true, mode: 'view' as const, drawStyle: 'filled' as const, colorByFacing: false }
      const cubeStats = renderMesh(fb, depth, meshes.cube, multiply(translate(-0.7, 0, 0), multiply(rotateY(spin), rotateX(0.4))), camera, solid)
      const sphereStats = renderMesh(fb, depth, meshes.sphere, multiply(translate(0.7, 0, 0), rotateY(spin)), camera, solid)

      // 2) See-through pass. A plane faces up, so turn it 90 degrees to stand it upright.
      const upright = rotateX(Math.PI / 2)
      // Listed NEAR pane first on purpose: with sorting OFF that is the wrong order
      // when you look from the front.
      const panes: TransparentItem[] = [
        { mesh: meshes.pane, model: multiply(translate(0.4, 0.1, 1.5), upright), color: [60, 110, 235, s.opacity] as Rgba },
        { mesh: meshes.pane, model: multiply(translate(-0.3, 0, 0.9), upright), color: [230, 60, 60, s.opacity] as Rgba },
      ].slice(0, s.paneCount === 2 ? 2 : 1)
      const t1 = performance.now()
      const tr = renderTransparent(fb, depth, panes, camera, { cullingOn: s.cullPanes, mode: 'view', sortBackToFront: s.sortOn })
      const blendMs = performance.now() - t1

      ctx.putImageData(image, 0, 0)

      frames++
      if (now - lastFlush >= 500) {
        setReadout({
          fps: (frames * 1000) / (now - lastFlush), frameMs: performance.now() - t0,
          triangles: cubeStats.visible + sphereStats.visible + tr.triangles,
          blended: tr.pixelsBlended, blendMs, panes: panes.length,
        })
        frames = 0
        lastFlush = now
      }
      frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  }, [meshes, shellPausedRef])

  // Console trace: what the see-through pass does with the current settings.
  useEffect(() => {
    log(`See-through pass: ${paneCount} pane(s), opacity ${opacity.toFixed(2)}, ${sortOn ? 'sorted back to front (correct blend order)' : 'NOT sorted: draw order = list order, blend order can be wrong'}`, sortOn ? 'trace' : 'warn')
  }, [sortOn, paneCount, cullPanes]) // eslint-disable-line react-hooks/exhaustive-deps

  // Drag to orbit the camera.
  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, y: e.clientY }
  }
  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const d = drag.current
    if (!d) return
    view.current.yaw -= (e.clientX - d.x) * 0.01
    view.current.pitch = Math.max(-1.4, Math.min(1.4, view.current.pitch + (e.clientY - d.y) * 0.01))
    d.x = e.clientX
    d.y = e.clientY
  }

  const checkbox = (label: string, checked: boolean, set: (v: boolean) => void) => (
    <div><label><input type="checkbox" checked={checked} onChange={(e) => set(e.target.checked)} style={{ accentColor: theme.accent }} /> {label}</label></div>
  )

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
      overlay={`${readout.fps.toFixed(0)} FPS\n${readout.triangles} triangles\n${readout.frameMs.toFixed(1)} ms/frame`}
      stats={[`${readout.panes} layers (panes)`, `${readout.blended.toLocaleString()} pixels blended`, `${readout.blendMs.toFixed(2)} ms for the see-through pass`]}
      controls={
        <>
          {modeSwitch}
          <div style={{ margin: '8px 0' }}>
            {checkbox('Sort see-through triangles back to front', sortOn, setSortOn)}
            {checkbox('Cull back faces of the panes', cullPanes, setCullPanes)}
            <div>
              Panes:{' '}
              {([1, 2] as const).map((n) => (
                <label key={n} style={{ marginRight: 8 }}>
                  <input type="radio" name="panes" checked={paneCount === n} onChange={() => setPaneCount(n)} style={{ accentColor: theme.accent }} /> {n}
                </label>
              ))}
            </div>
            <NumberRow label="Pane opacity" value={opacity} min={0.05} max={1} step={0.01} onChange={setOpacity} format={(v) => v.toFixed(2)} />
          </div>
          <div style={{ color: theme.muted }}>Drag the canvas to orbit. Turn sorting off and look at the overlap of the two panes: the colours swap.</div>
        </>
      }
      formula={
        <FormulaBox>
          {'out_a = a_s + a_d (1 − a_s)\nout_rgb = (c_s a_s + c_d a_d (1 − a_s)) / out_a\n\nOrder per frame:\n1. solid things (write depth)\n2. see-through, far to near\n   (test depth, no depth write)'}
        </FormulaBox>
      }
    />
  )
}
