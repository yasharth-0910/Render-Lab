// AlphaLab.tsx - alpha compositing lab.
// Two modes share this tab: "2D layers" (below) and "3D scene" (AlphaScene3D.tsx).
// The 2D mode blends three coloured circles over a checkerboard, one pixel at a time,
// using over() / compositeLayers() from core/render/alpha.ts.

import { useEffect, useRef, useState } from 'react'
import { compositeLayers, over, type CompositeStep, type Rgba } from '../core/render/alpha'
import { Framebuffer } from '../core/render/framebuffer'
import AlphaScene3D from './AlphaScene3D'
import FormulaBox from './components/FormulaBox'
import LabLayout from './components/LabLayout'
import NumberRow from './components/NumberRow'
import { theme } from './components/theme'
import { useLabLog } from './shell/console'

const WIDTH = 640
const HEIGHT = 480

type Layer = { id: number; name: string; color: string; opacity: number; visible: boolean }

// Where each layer's circle is (by layer id), so reordering changes the stacking, not the place.
const CIRCLES = [
  { cx: 250, cy: 190, r: 125 },
  { cx: 380, cy: 190, r: 125 },
  { cx: 315, cy: 295, r: 125 },
]

// The list is in STACKING order: first = bottom, last = top.
const START_LAYERS: Layer[] = [
  { id: 0, name: 'Red', color: '#e63c3c', opacity: 0.6, visible: true },
  { id: 1, name: 'Green', color: '#3cc85a', opacity: 0.6, visible: true },
  { id: 2, name: 'Blue', color: '#3c64e6', opacity: 0.6, visible: true },
]

const hexToRgb = (hex: string): [number, number, number] => [
  parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16),
]
const asRgba = (hex: string, alpha: number): Rgba => [...hexToRgb(hex), alpha]

// The checkerboard behind everything: 16 pixel squares, two greys, fully solid.
function checker(x: number, y: number): Rgba {
  return (Math.floor(x / 16) + Math.floor(y / 16)) % 2 === 0 ? [200, 200, 200, 1] : [150, 150, 150, 1]
}

const inCircle = (id: number, x: number, y: number) => {
  const c = CIRCLES[id]
  return (x - c.cx) ** 2 + (y - c.cy) ** 2 <= c.r * c.r
}

const n2 = (v: number) => v.toFixed(2)

// Turn one blend step into the formula with the real numbers filled in.
function explain(step: CompositeStep, name: string): string {
  const [as, ad, ao] = [step.src[3], step.dst[3], step.out[3]]
  const lines = [
    `${name} over the pixel below:`,
    `  a_out = ${n2(as)} + ${n2(ad)} × (1 − ${n2(as)}) = ${n2(ao)}`,
  ]
  ;['R', 'G', 'B'].forEach((ch, i) => {
    lines.push(
      `  ${ch} = (${Math.round(step.src[i])}×${n2(as)} + ${Math.round(step.dst[i])}×${n2(ad)}×${n2(1 - as)}) / ${n2(ao)} = ${step.out[i].toFixed(1)}`,
    )
  })
  return lines.join('\n')
}

function Layers2D({ modeSwitch }: { modeSwitch: React.ReactNode }) {
  const [layers, setLayers] = useState<Layer[]>(START_LAYERS)
  const [bgColor, setBgColor] = useState('#ffffff')
  const [bgOpacity, setBgOpacity] = useState(0.25)
  const [picked, setPicked] = useState<{ x: number; y: number } | null>({ x: 315, y: 215 })
  const [stats, setStats] = useState({ blended: 0, ms: 0 })
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const log = useLabLog()
  const statsRef = useRef(stats)
  statsRef.current = stats

  // The stack at one pixel, bottom to top: the background layer, then every visible
  // layer whose circle covers the pixel. Returns the names too, for the explanation.
  function stackAt(x: number, y: number) {
    const names = ['Background']
    const colors: Rgba[] = [asRgba(bgColor, bgOpacity)]
    for (const layer of layers) {
      if (layer.visible && inCircle(layer.id, x, y)) {
        names.push(layer.name)
        colors.push(asRgba(layer.color, layer.opacity))
      }
    }
    return { names, colors }
  }

  // Redraw whenever anything changes: composite every pixel with our own code.
  useEffect(() => {
    const t0 = performance.now()
    const fb = new Framebuffer(WIDTH, HEIGHT)
    const bg = asRgba(bgColor, bgOpacity)
    const stack = layers.map((l) => ({ layer: l, rgba: asRgba(l.color, l.opacity) }))
    let blended = 0
    for (let y = 0; y < HEIGHT; y++) {
      for (let x = 0; x < WIDTH; x++) {
        // Start from the checkerboard, lay the background on it, then each layer (bottom first).
        let c = over(bg, checker(x, y))
        let covered = false
        for (const s of stack) {
          if (s.layer.visible && inCircle(s.layer.id, x, y)) {
            c = over(s.rgba, c)
            covered = true
          }
        }
        if (covered) blended++
        fb.setPixel(x, y, c[0], c[1], c[2], 255) // the checkerboard is solid, so the result is too
      }
    }
    const ctx = canvasRef.current!.getContext('2d')!
    ctx.putImageData(new ImageData(fb.data, WIDTH, HEIGHT), 0, 0)
    // Mark the picked pixel.
    if (picked) {
      ctx.strokeStyle = '#000'
      ctx.lineWidth = 3
      ctx.strokeRect(picked.x - 5, picked.y - 5, 11, 11)
      ctx.strokeStyle = theme.accent
      ctx.lineWidth = 1.5
      ctx.strokeRect(picked.x - 5, picked.y - 5, 11, 11)
    }
    setStats({ blended, ms: performance.now() - t0 })
  }, [layers, bgColor, bgOpacity, picked])

  // Console trace: a moment after the last change, report the blend and the picked pixel's steps.
  useEffect(() => {
    const id = setTimeout(() => {
      const visible = layers.filter((l) => l.visible)
      log(`Composite (bottom to top): ${['Background', ...visible.map((l) => l.name)].join(' < ')}; ${statsRef.current.blended.toLocaleString()} pixels blended in ${statsRef.current.ms.toFixed(1)} ms`)
      if (picked) {
        const { names, colors } = stackAt(picked.x, picked.y)
        const base = checker(picked.x, picked.y)
        const { steps, result } = compositeLayers(colors, base)
        log(`Pixel (${picked.x},${picked.y}): checkerboard (${base[0]},${base[1]},${base[2]})`)
        steps.forEach((s, i) => {
          log(`  ${names[i]} over: a_out = ${n2(s.out[3])}, RGB (${s.dst.slice(0, 3).map(Math.round).join(',')}) -> (${s.out.slice(0, 3).map(Math.round).join(',')})`)
        })
        log(`  final RGB (${Math.round(result[0])},${Math.round(result[1])},${Math.round(result[2])}) alpha ${n2(result[3])}`)
      }
    }, 300)
    return () => clearTimeout(id)
  }, [layers, bgColor, bgOpacity, picked])

  function update(id: number, change: Partial<Layer>) {
    setLayers((ls) => ls.map((l) => (l.id === id ? { ...l, ...change } : l)))
  }
  // direction +1 = towards the top of the stack, -1 = towards the bottom.
  function move(id: number, direction: 1 | -1) {
    setLayers((ls) => {
      const i = ls.findIndex((l) => l.id === id)
      const j = i + direction
      if (j < 0 || j >= ls.length) return ls
      const copy = [...ls]
      ;[copy[i], copy[j]] = [copy[j], copy[i]]
      return copy
    })
  }

  function onCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    setPicked({
      x: Math.floor(((e.clientX - rect.left) / rect.width) * WIDTH),
      y: Math.floor(((e.clientY - rect.top) / rect.height) * HEIGHT),
    })
  }

  // The formula box: real numbers for the picked pixel.
  let formula: React.ReactNode
  if (picked) {
    const { names, colors } = stackAt(picked.x, picked.y)
    const base = checker(picked.x, picked.y)
    const { steps, result } = compositeLayers(colors, base)
    formula = (
      <>
        {'out_a = a_s + a_d (1 − a_s)\nout_rgb = (c_s a_s + c_d a_d (1 − a_s)) / out_a\n\n'}
        {`Pixel (${picked.x}, ${picked.y})\nCheckerboard: (${base[0]}, ${base[1]}, ${base[2]}), alpha 1.00\n\n`}
        {steps.map((s, i) => explain(s, names[i])).join('\n\n')}
        {`\n\nFinal: RGB (${Math.round(result[0])}, ${Math.round(result[1])}, ${Math.round(result[2])}), alpha ${n2(result[3])}`}
      </>
    )
  } else {
    formula = 'Click the canvas to pick a pixel and see the numbers.'
  }

  const small = { background: 'none', color: theme.text, border: `1px solid ${theme.border}`, borderRadius: 3, cursor: 'pointer', padding: '0 6px' } as const
  const visibleLayers = layers.filter((l) => l.visible).length

  return (
    <LabLayout
      canvas={<canvas ref={canvasRef} width={WIDTH} height={HEIGHT} onClick={onCanvasClick} style={{ cursor: 'crosshair', borderRadius: 4 }} />}
      stats={[`${visibleLayers} layers`, `${stats.blended.toLocaleString()} pixels blended`, `${stats.ms.toFixed(1)} ms to composite`]}
      controls={
        <>
          {modeSwitch}
          <div style={{ color: theme.muted, margin: '8px 0 4px' }}>Layers (top of stack first)</div>
          {[...layers].reverse().map((l, idx) => (
            <div key={l.id} style={{ borderTop: `1px solid ${theme.border}`, padding: '4px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={l.visible} onChange={(e) => update(l.id, { visible: e.target.checked })} title="visible" style={{ accentColor: theme.accent }} />
                <input type="color" value={l.color} onChange={(e) => update(l.id, { color: e.target.value })} />
                <span style={{ flex: 1 }}>{l.name}</span>
                <button style={small} disabled={idx === 0} onClick={() => move(l.id, 1)} title="move up">▲</button>
                <button style={small} disabled={idx === layers.length - 1} onClick={() => move(l.id, -1)} title="move down">▼</button>
              </div>
              <NumberRow label="Opacity" value={l.opacity} min={0} max={1} step={0.01} onChange={(v) => update(l.id, { opacity: v })} format={n2} />
            </div>
          ))}
          <div style={{ borderTop: `1px solid ${theme.border}`, padding: '4px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} />
              <span>Background</span>
            </div>
            <NumberRow label="Opacity" value={bgOpacity} min={0} max={1} step={0.01} onChange={setBgOpacity} format={n2} />
          </div>
        </>
      }
      formula={<FormulaBox>{formula}</FormulaBox>}
    />
  )
}

export default function AlphaLab() {
  const [mode, setMode] = useState<'2d' | '3d'>('2d')
  const modeSwitch = (
    <div style={{ display: 'flex', gap: 12 }}>
      {([['2d', '2D layers'], ['3d', '3D scene']] as const).map(([m, label]) => (
        <label key={m}>
          <input type="radio" name="alpha-mode" checked={mode === m} onChange={() => setMode(m)} style={{ accentColor: theme.accent }} /> {label}
        </label>
      ))}
    </div>
  )
  return mode === '2d' ? <Layers2D modeSwitch={modeSwitch} /> : <AlphaScene3D modeSwitch={modeSwitch} />
}
