// Geometry3D.tsx - the 3D part of the "Bases and spanning" topic, drawn with our own software renderer:
// three vectors a, b, c (the axes), the box they span, handedness and the triple product (the volume).

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { gramSchmidt, handedness, rank, spansSpace } from '../core/math/geometryLab'
import { identity, multiply, translate, type Mat4 } from '../core/math/mat4'
import type { Vec3 } from '../core/math/vec3'
import { projectToScreen, type Camera } from '../core/render/camera'
import { Framebuffer } from '../core/render/framebuffer'
import { drawLine } from '../core/render/line'
import { createCube } from '../core/render/mesh'
import { renderWireframe } from '../core/render/render'
import { Eq, Note, Numbers } from './components/Equation'
import FormulaBox from './components/FormulaBox'
import LabLayout from './components/LabLayout'
import Section from './components/Section'
import Vec3Row from './components/Vec3Row'

const WIDTH = 640
const HEIGHT = 480
const n2 = (v: number) => v.toFixed(2)
const v3 = (v: readonly number[]) => `(${n2(v[0])}, ${n2(v[1])}, ${n2(v[2])})`

const RIGHT: [Vec3, Vec3, Vec3] = [[1, 0, 0], [0, 1, 0], [0, 0, 1]]
const LEFT: [Vec3, Vec3, Vec3] = [[1, 0, 0], [0, 1, 0], [0, 0, -1]] // flipping one axis makes the system left handed

export default function Geometry3D({ modeSwitch }: { modeSwitch: ReactNode }) {
  const [vectors, setVectors] = useState<[Vec3, Vec3, Vec3]>(RIGHT)
  const [showBox, setShowBox] = useState(true)
  const [showOrthogonal, setShowOrthogonal] = useState(false)
  const [view, setView] = useState({ yaw: 0.8, pitch: 0.5 })
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drag = useRef<{ x: number; y: number } | null>(null)
  const cube = useMemo(() => createCube(), [])
  const fb = useMemo(() => new Framebuffer(WIDTH, HEIGHT), [])

  const [a, b, c] = vectors
  const { value: volume, hand } = handedness(a, b, c)
  const independent = rank(vectors.map((v) => [...v]))
  const gs = gramSchmidt(vectors.map((v) => [...v]))
  const isPreset = (preset: [Vec3, Vec3, Vec3]) => vectors.every((v, i) => v.every((x, k) => x === preset[i][k]))

  useEffect(() => {
    const dist = 7.5
    const eye: Vec3 = [dist * Math.cos(view.pitch) * Math.sin(view.yaw), dist * Math.sin(view.pitch), dist * Math.cos(view.pitch) * Math.cos(view.yaw)]
    const cam: Camera = { eye, target: [0, 0.3, 0], up: [0, 1, 0], fovY: Math.PI / 3, aspect: WIDTH / HEIGHT, near: 0.1, far: 100 }
    fb.clear(27, 31, 38, 255)
    const line3D = (p: Vec3, q: Vec3, color: readonly [number, number, number, number]) => {
      const s = projectToScreen(p, identity(), cam, WIDTH, HEIGHT)
      const e = projectToScreen(q, identity(), cam, WIDTH, HEIGHT)
      if (s && e) drawLine(fb, Math.round(s[0]), Math.round(s[1]), Math.round(e[0]), Math.round(e[1]), color)
    }
    const marker = (p: Vec3, color: readonly [number, number, number]) => {
      const s = projectToScreen(p, identity(), cam, WIDTH, HEIGHT)
      if (s) for (let dx = -3; dx <= 3; dx++) for (let dy = -3; dy <= 3; dy++) fb.setPixel(Math.round(s[0]) + dx, Math.round(s[1]) + dy, color[0], color[1], color[2], 255)
    }

    // A floor grid for orientation.
    for (let k = -4; k <= 4; k++) {
      line3D([k, 0, -4], [k, 0, 4], [44, 50, 60, 255])
      line3D([-4, 0, k], [4, 0, k], [44, 50, 60, 255])
    }
    // The box the three vectors span (a unit cube when they are the unit axes), blue for right handed, orange for left handed.
    if (showBox) {
      const columns: Mat4 = [a[0], b[0], c[0], 0, a[1], b[1], c[1], 0, a[2], b[2], c[2], 0, 0, 0, 0, 1]
      // The cube mesh has corners at +-0.5; moving it by 0.5 first puts its corners at 0..1, so it grows from the origin along a, b, c.
      renderWireframe(fb, cube, multiply(columns, translate(0.5, 0.5, 0.5)), cam, hand === 'left' ? [255, 159, 67, 255] : [76, 194, 255, 255])
    }
    // The three axes: a red, b green, c blue.
    const colours: [number, number, number][] = [[255, 95, 95], [95, 229, 138], [108, 155, 255]]
    vectors.forEach((v, i) => {
      line3D([0, 0, 0], [v[0] * 3, v[1] * 3, v[2] * 3], [colours[i][0], colours[i][1], colours[i][2], 255])
      marker([v[0] * 3, v[1] * 3, v[2] * 3], colours[i])
    })
    if (showOrthogonal) {
      for (const u of gs.orthogonal) line3D([0, 0, 0], [u[0] * 2, u[1] * 2, u[2] * 2], [255, 255, 255, 255])
    }
    canvasRef.current!.getContext('2d')!.putImageData(new ImageData(fb.data, WIDTH, HEIGHT), 0, 0)
  }, [vectors, view, showBox, showOrthogonal])

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.x
    const dy = e.clientY - d.y
    d.x = e.clientX
    d.y = e.clientY
    setView((v) => ({ yaw: v.yaw - dx * 0.01, pitch: Math.max(-1.3, Math.min(1.3, v.pitch + dy * 0.01)) }))
  }

  const setVector = (index: number) => (v: Vec3) => setVectors((old) => old.map((x, i) => (i === index ? v : x)) as [Vec3, Vec3, Vec3])
  const handText = hand === 'right' ? 'RIGHT handed (positive)' : hand === 'left' ? 'LEFT handed (negative)' : 'flat: no volume, not an axis system'

  return (
    <LabLayout
      sections
      gizmo
      canvas={
        <canvas
          ref={canvasRef} width={WIDTH} height={HEIGHT}
          onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY } }}
          onPointerMove={onPointerMove} onPointerUp={() => (drag.current = null)}
          style={{ display: 'block', cursor: 'grab', touchAction: 'none', maxWidth: '100%', height: 'auto' }}
        />
      }
      overlay={`a red, b green, c blue\n${hand}-handed system\nvolume ${n2(volume)}`}
      stats={[`a · (b × c) = ${n2(volume)}`, handText, `rank ${independent}`, independent === 3 ? 'spans space' : 'does NOT span space']}
      controls={
        <>
          {modeSwitch}
          <Section title="Axis system">
            <label style={{ display: 'block' }}><input type="radio" name="hand" checked={isPreset(RIGHT)} onChange={() => setVectors(RIGHT)} /> right handed (x, y, z)</label>
            <label style={{ display: 'block' }}><input type="radio" name="hand" checked={isPreset(LEFT)} onChange={() => setVectors(LEFT)} /> left handed (z flipped)</label>
            <div style={{ color: 'var(--muted)', marginTop: 4 }}>Flipping one axis (or swapping two) changes the sign of the triple product.</div>
          </Section>
          <Section title="Vectors">
            <Vec3Row label="a" value={a} onChange={setVector(0)} />
            <Vec3Row label="b" value={b} onChange={setVector(1)} />
            <Vec3Row label="c" value={c} onChange={setVector(2)} />
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button onClick={() => setVectors([b, a, c])}>Swap a and b</button>
              <button onClick={() => setVectors([a, b, [a[0] + b[0], a[1] + b[1], a[2] + b[2]]])}>Make c = a + b (flat)</button>
            </div>
          </Section>
          <Section title="Show">
            <div><label><input type="checkbox" checked={showBox} onChange={(e) => setShowBox(e.target.checked)} /> The box spanned by a, b, c</label></div>
            <div><label><input type="checkbox" checked={showOrthogonal} onChange={(e) => setShowOrthogonal(e.target.checked)} /> Gram–Schmidt axes (white)</label></div>
            <div style={{ color: 'var(--muted)', marginTop: 4 }}>Drag the picture to orbit. The box is blue when right handed, orange when left handed.</div>
          </Section>
        </>
      }
      formula={
        <FormulaBox>
          <Eq label="Triple product = oriented volume">{'a ∧ b ∧ c = a · (b × c) = det [a b c]'}</Eq>
          <Eq label="Handedness">{'a · (b × c) > 0  →  right handed,     < 0  →  left handed'}</Eq>
          <Note>The size of the number is the volume of the box (a unit cube has volume 1). Swapping two vectors, or flipping one, changes the sign but not the volume.</Note>
          <Numbers
            title="Live numbers"
            lines={[
              `a = ${v3(a)}`, `b = ${v3(b)}`, `c = ${v3(c)}`,
              `a · (b × c) = ${n2(volume)}  →  ${handText}`,
              `volume of the box = |${n2(volume)}| = ${n2(Math.abs(volume))}`,
              `rank = ${independent}  →  ${spansSpace(vectors.map((v) => [...v]), 3) ? 'a, b, c span the whole space' : 'a, b, c do NOT span the whole space'}`,
              ...gs.orthogonal.map((u, i) => `Gram–Schmidt u${['₁', '₂', '₃'][i]} = ${v3(u)}`),
              ...gs.dependent.map((i) => `${['a', 'b', 'c'][i]} is dependent: it lies in the span of the earlier ones`),
            ]}
          />
        </FormulaBox>
      }
    />
  )
}
