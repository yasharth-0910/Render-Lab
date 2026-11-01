// RasterCanvas.tsx - shows the software rasterizer on a <canvas>.
// All drawing happens in our own Framebuffer (core/render). The canvas is only used to
// put the finished pixels on screen once per frame.

import { useEffect, useRef, useState } from 'react'
import { multiply, rotateX, rotateY } from '../core/math/mat4'
import type { Camera } from '../core/render/camera'
import { Framebuffer } from '../core/render/framebuffer'
import { createCube } from '../core/render/mesh'
import { renderWireframe } from '../core/render/render'
import FormulaBox from './components/FormulaBox'
import LabLayout from './components/LabLayout'
import { usePausedRef } from './shell/ShellContext'

const WIDTH = 640
const HEIGHT = 480

const camera: Camera = {
  eye: [0, 0, 3],
  target: [0, 0, 0],
  up: [0, 1, 0],
  fovY: Math.PI / 3,
  aspect: WIDTH / HEIGHT,
  near: 0.1,
  far: 100,
}

export default function RasterCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pausedRef = usePausedRef() // the top bar's Pause button freezes the spin
  const [readout, setReadout] = useState({ fps: 0, ms: 0 })

  useEffect(() => {
    const ctx = canvasRef.current!.getContext('2d')!
    const fb = new Framebuffer(WIDTH, HEIGHT)
    // This ImageData wraps the framebuffer's own memory, so no copying is needed.
    const image = new ImageData(fb.data, WIDTH, HEIGHT)
    const cube = createCube()

    let frame = 0
    let frames = 0 // frames drawn since the last FPS update
    let lastFpsTime = performance.now()
    let spinSeconds = 0 // how long the cube has been spinning (does not advance while paused)
    let last = lastFpsTime
    let renderMs = 0

    function draw(now: number) {
      if (!pausedRef.current) spinSeconds += (now - last) / 1000 // seconds, so the speed doesn't depend on the frame rate
      last = now
      // Spin: 1 radian/s around y, 0.6 radian/s around x. Right matrix applies first.
      const model = multiply(rotateY(spinSeconds), rotateX(spinSeconds * 0.6))

      const t0 = performance.now()
      fb.clear(20, 20, 30, 255)
      renderWireframe(fb, cube, model, camera, [120, 255, 160, 255])
      ctx.putImageData(image, 0, 0)
      renderMs = performance.now() - t0

      // Update the FPS number twice a second.
      frames++
      if (now - lastFpsTime >= 500) {
        setReadout({ fps: (frames * 1000) / (now - lastFpsTime), ms: renderMs })
        frames = 0
        lastFpsTime = now
      }
      frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame) // stop the loop when the component goes away
  }, [pausedRef])

  return (
    <LabLayout
      gizmo
      canvas={<canvas ref={canvasRef} width={WIDTH} height={HEIGHT} />}
      overlay={`${readout.fps.toFixed(0)} FPS\n12 triangles\n${readout.ms.toFixed(1)} ms/frame`}
      stats={['640 × 480 software rasterizer', '8 vertices, 12 edges', 'edges drawn with Bresenham']}
      controls={
        <div style={{ color: 'var(--muted)' }}>
          A cube rotating about y and x. Every corner goes through the model, view and projection matrices, then the
          divide by w, and the edges are drawn into our own pixel array. Use the Pause button in the top bar to freeze it.
        </div>
      }
      formula={<FormulaBox>{'p_screen = viewport( P · V · M · p )\nM = rotateY(t) · rotateX(0.6 t)\nP = perspective(60°, 4:3, 0.1, 100)'}</FormulaBox>}
    />
  )
}
