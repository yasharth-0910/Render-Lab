// RasterCanvas.tsx - shows the software rasterizer on a <canvas>.
// All drawing happens in our own Framebuffer (core/render). The canvas is only used to
// put the finished pixels on screen once per frame.

import { useEffect, useRef, useState } from 'react'
import { multiply, rotateX, rotateY } from '../core/math/mat4'
import type { Camera } from '../core/render/camera'
import { Framebuffer } from '../core/render/framebuffer'
import { createCube } from '../core/render/mesh'
import { renderWireframe } from '../core/render/render'

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
  const [fps, setFps] = useState(0)

  useEffect(() => {
    const ctx = canvasRef.current!.getContext('2d')!
    const fb = new Framebuffer(WIDTH, HEIGHT)
    // This ImageData wraps the framebuffer's own memory, so no copying is needed.
    const image = new ImageData(fb.data, WIDTH, HEIGHT)
    const cube = createCube()

    let frame = 0
    let frames = 0 // frames drawn since the last FPS update
    let lastFpsTime = performance.now()

    function draw(now: number) {
      const t = now / 1000 // seconds, so the speed doesn't depend on the frame rate
      // Spin: 1 radian/s around y, 0.6 radian/s around x. Right matrix applies first.
      const model = multiply(rotateY(t), rotateX(t * 0.6))

      fb.clear(20, 20, 30, 255)
      renderWireframe(fb, cube, model, camera, [120, 255, 160, 255])
      ctx.putImageData(image, 0, 0)

      // Update the FPS number twice a second.
      frames++
      if (now - lastFpsTime >= 500) {
        setFps((frames * 1000) / (now - lastFpsTime))
        frames = 0
        lastFpsTime = now
      }
      frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame) // stop the loop when the component goes away
  }, [])

  return (
    <div style={{ position: 'relative', width: WIDTH, height: HEIGHT }}>
      <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} />
      <div style={{ position: 'absolute', top: 8, left: 8, color: '#fff', fontFamily: 'monospace' }}>
        {fps.toFixed(0)} FPS
      </div>
    </div>
  )
}
