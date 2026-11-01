// GeometryLab.tsx - the geometry topics of the syllabus, one mode each, with points you can drag:
//   1. Outer product and area      2. Sine rule and triangle      3. Line intersection      4. Bases and spanning
// The maths is in core/math/geometryLab.ts. This file draws it (helpers in plane2d.ts) and shows the live numbers.
// Mode 4 also has a 3D part, Geometry3D.tsx (right- and left-handed axes, the triple product).

import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  coordinatesInBasis, determinant, gramSchmidt, intersectLines, intersectSegments, lineRelation, orientation2D, rank,
  sineRule, spansSpace, wedge2, type Vec2,
} from '../core/math/geometryLab'
import { Eq, Note, Numbers } from './components/Equation'
import FormulaBox from './components/FormulaBox'
import LabLayout from './components/LabLayout'
import Section from './components/Section'
import Geometry3D from './Geometry3D'
import {
  COLORS, H, W, drawAngle, drawArrow, drawGrid, drawHandle, drawLabel, drawLineThrough, drawPolygon, drawSegment, fromPx, toPx,
} from './plane2d'
import { useLabLog } from './shell/console'

export type Mode = 'outer' | 'sine' | 'lines' | 'bases'
const MODES: { id: Mode; label: string }[] = [
  { id: 'outer', label: 'Outer product and area' },
  { id: 'sine', label: 'Sine rule and triangle' },
  { id: 'lines', label: 'Line intersection' },
  { id: 'bases', label: 'Bases and spanning' },
]

type PointKey = 'a' | 'b' | 'A' | 'B' | 'C' | 'p1' | 'p2' | 'q1' | 'q2' | 'v1' | 'v2' | 'v3' | 't'
type Pts = Record<PointKey, Vec2>
type Options = { snap: boolean; showThird: boolean; showCircle: boolean; showOrthogonal: boolean }

// Where every point starts (so each mode looks good the first time it is opened).
const START: Pts = {
  a: [3, 1], b: [1, 2.5],
  A: [-3, -1.5], B: [4, -1], C: [0.5, 3.2],
  p1: [-4, -2], p2: [3, 3], q1: [-3, 3], q2: [4, -2],
  v1: [2, 1], v2: [-1, 1.5], v3: [3, -1.5], t: [3, 2],
}

const NAMES: Record<PointKey, string> = {
  a: 'a', b: 'b', A: 'A', B: 'B', C: 'C', p1: 'P₁', p2: 'P₂', q1: 'Q₁', q2: 'Q₂', v1: 'v₁', v2: 'v₂', v3: 'v₃', t: 't',
}

// The points you can drag in each mode.
function handlesFor(mode: Mode, opts: Options): PointKey[] {
  if (mode === 'outer') return ['a', 'b']
  if (mode === 'sine') return ['A', 'B', 'C']
  if (mode === 'lines') return ['p1', 'p2', 'q1', 'q2']
  return opts.showThird ? ['v1', 'v2', 'v3', 't'] : ['v1', 'v2', 't']
}

const n2 = (v: number) => v.toFixed(2)
const n3 = (v: number) => v.toFixed(3)
const pt = (p: Vec2) => `(${n2(p[0])}, ${n2(p[1])})`
const deg = (r: number) => `${((r * 180) / Math.PI).toFixed(1)}°`
const dotp = (p: Vec2, q: Vec2) => p[0] * q[0] + p[1] * q[1]
const minus = (p: Vec2, q: Vec2): Vec2 => [p[0] - q[0], p[1] - q[1]]
const plus = (p: Vec2, q: Vec2): Vec2 => [p[0] + q[0], p[1] + q[1]]
const times = (p: Vec2, k: number): Vec2 => [p[0] * k, p[1] * k]
const ORIGIN: Vec2 = [0, 0]

// The circle through three points: its centre is where the perpendicular bisectors of two sides meet
// (found with the line intersection of this very lab).
function circumcircle(A: Vec2, B: Vec2, C: Vec2): { center: Vec2; radius: number } | null {
  const bisector = (P: Vec2, Q: Vec2) => ({ point: times(plus(P, Q), 0.5), direction: [-(Q[1] - P[1]), Q[0] - P[0]] as Vec2 })
  const first = bisector(A, B)
  const second = bisector(B, C)
  const hit = intersectLines(first.point, first.direction, second.point, second.direction)
  return hit ? { center: hit.point, radius: Math.hypot(A[0] - hit.point[0], A[1] - hit.point[1]) } : null
}

type Analysis = { stats: string[]; title: string; lines: string[]; formula: ReactNode }

// ---------------------------------------------------------------------------------------------
// the numbers and formulas of each mode
// ---------------------------------------------------------------------------------------------

function analyseOuter({ a, b }: Pts): Analysis {
  const w = wedge2(a, b)
  const la = Math.hypot(...a)
  const lb = Math.hypot(...b)
  const sin = la * lb === 0 ? 0 : w / (la * lb)
  const turn = orientation2D(ORIGIN, a, b)
  const turnText = turn === 'anticlockwise' ? 'b is ANTICLOCKWISE from a: the wedge is positive' : turn === 'clockwise' ? 'b is CLOCKWISE from a: the wedge is negative' : 'a and b are parallel: the wedge is zero'
  return {
    stats: [`a ∧ b = ${n2(w)}`, turn === 'collinear' ? 'parallel' : turn, `triangle area ${n2(Math.abs(w) / 2)}`],
    title: 'Outer product',
    lines: [
      `a = ${pt(a)},  b = ${pt(b)}`,
      `a ∧ b = a₁b₂ − a₂b₁ = ${n2(a[0])}×${n2(b[1])} − ${n2(a[1])}×${n2(b[0])} = ${n2(w)}`,
      `parallelogram area = |a ∧ b| = ${n2(Math.abs(w))}`,
      `triangle area = ½ |a ∧ b| = ${n2(Math.abs(w) / 2)}`,
      turnText,
      `|a| = ${n2(la)},  |b| = ${n2(lb)}`,
      `sin θ = (a ∧ b) / (|a| |b|) = ${n3(sin)},  θ = ${deg(Math.atan2(w, dotp(a, b)))}`,
      `a · b = ${n2(dotp(a, b))}`,
    ],
    formula: (
      <>
        <Eq label="Outer product in 2D">{'a ∧ b = a_1 b_2 − a_2 b_1'}</Eq>
        <Eq label="What its size is">{'|a ∧ b| = |a| |b| sin θ'}</Eq>
        <Eq label="Area of the triangle">{'area = ½ |a ∧ b|'}</Eq>
        <Note>The wedge is the signed area of the parallelogram spanned by a and b. It is positive when b is anticlockwise from a, negative when clockwise, and zero when they are parallel. Swapping a and b flips the sign.</Note>
      </>
    ),
  }
}

function analyseSine({ A, B, C }: Pts, opts: Options): Analysis {
  const r = sineRule(A, B, C)
  const circle = opts.showCircle ? circumcircle(A, B, C) : null
  const turn = orientation2D(A, B, C)
  const spread = Math.max(...r.ratios) - Math.min(...r.ratios)
  return {
    stats: r.degenerate ? ['the points are on one line: no triangle'] : [`a / sin A = ${n2(r.ratios[0])}`, `b / sin B = ${n2(r.ratios[1])}`, `c / sin C = ${n2(r.ratios[2])}`],
    title: 'Triangle ABC',
    lines: [
      `a = |BC| = ${n2(r.sides[0])},  b = |CA| = ${n2(r.sides[1])},  c = |AB| = ${n2(r.sides[2])}`,
      `A = ${deg(r.angles[0])},  B = ${deg(r.angles[1])},  C = ${deg(r.angles[2])}   (sum ${deg(r.angles[0] + r.angles[1] + r.angles[2])})`,
      `sin A = ${n3(r.sines[0])},  sin B = ${n3(r.sines[1])},  sin C = ${n3(r.sines[2])}`,
      ...(r.degenerate
        ? ['the three points are on one line, so there is no triangle']
        : [
            `a / sin A = ${n2(r.sides[0])} / ${n3(r.sines[0])} = ${n3(r.ratios[0])}`,
            `b / sin B = ${n2(r.sides[1])} / ${n3(r.sines[1])} = ${n3(r.ratios[1])}`,
            `c / sin C = ${n2(r.sides[2])} / ${n3(r.sines[2])} = ${n3(r.ratios[2])}`,
            `largest − smallest ratio = ${spread.toExponential(1)}  (zero: they are all equal)`,
          ]),
      `area = ½ |AB ∧ AC| = ${n2(r.area)}`,
      `A → B → C goes ${turn}`,
      ...(circle ? [`the circle through A, B, C has diameter 2R = ${n3(2 * circle.radius)}  (the same number)`] : []),
    ],
    formula: (
      <>
        <Eq label="The sine rule">{'frac{a}{sin A} = frac{b}{sin B} = frac{c}{sin C} = 2R'}</Eq>
        <Eq label="Sine of a corner from the wedge">{'sin A = frac{|u ∧ v|}{|u| |v|},   u = B − A,  v = C − A'}</Eq>
        <Note>Each side divided by the sine of the opposite corner gives the same number: the diameter of the circle through the three corners.</Note>
      </>
    ),
  }
}

function analyseLines({ p1, p2, q1, q2 }: Pts): Analysis {
  const d1 = minus(p2, p1)
  const d2 = minus(q2, q1)
  const relation = lineRelation(p1, d1, q1, d2)
  const hit = intersectLines(p1, d1, q1, d2)
  const between = minus(q1, p1)
  const bottom = wedge2(d1, d2)
  const segment = intersectSegments(p1, p2, q1, q2)
  return {
    stats: hit ? [`meet at ${pt(hit.point)}`, `t = ${n3(hit.t)}`, segment ? 'the segments cross' : 'only the extended lines cross'] : [relation === 'coincident' ? 'the lines coincide' : 'the lines are parallel: no intersection'],
    title: 'Two lines',
    lines: [
      `line 1: P₁ = ${pt(p1)},  d₁ = P₂ − P₁ = ${pt(d1)}`,
      `line 2: Q₁ = ${pt(q1)},  d₂ = Q₂ − Q₁ = ${pt(d2)}`,
      `d₁ ∧ d₂ = ${n2(bottom)}`,
      ...(hit
        ? [
            `(Q₁ − P₁) ∧ d₂ = ${n2(wedge2(between, d2))}`,
            `t = (Q₁ − P₁) ∧ d₂ / (d₁ ∧ d₂) = ${n2(wedge2(between, d2))} / ${n2(bottom)} = ${n3(hit.t)}`,
            `s = (Q₁ − P₁) ∧ d₁ / (d₁ ∧ d₂) = ${n3(hit.s)}`,
            `point = P₁ + t d₁ = ${pt(hit.point)}`,
            `segments cross: ${segment ? 'yes' : 'no'}  (needs 0 ≤ t ≤ 1 and 0 ≤ s ≤ 1)`,
          ]
        : [relation === 'coincident' ? 'd₁ ∧ d₂ = 0 and Q₁ is on line 1: the lines lie on top of each other' : 'd₁ ∧ d₂ = 0: the directions are parallel, so the lines never meet']),
    ],
    formula: (
      <>
        <Eq label="A point on each line">{'p_1 + t d_1 = p_2 + s d_2'}</Eq>
        <Eq label="Wedge both sides with d₂ to remove s">{'t = frac{(p_2 − p_1) ∧ d_2}{d_1 ∧ d_2}'}</Eq>
        <Eq label="and with d₁ to remove t">{'s = frac{(p_2 − p_1) ∧ d_1}{d_1 ∧ d_2}'}</Eq>
        <Note>If d₁ ∧ d₂ = 0 the lines are parallel, and there is no single meeting point. For two segments the point only counts if 0 ≤ t ≤ 1 and 0 ≤ s ≤ 1.</Note>
      </>
    ),
  }
}

function analyseBases(pts: Pts, opts: Options): Analysis {
  const { v1, v2, v3, t } = pts
  const list = opts.showThird ? [v1, v2, v3] : [v1, v2]
  const vectors = list.map((v) => [...v])
  const r = rank(vectors)
  const spans = spansSpace(vectors, 2)
  const gs = gramSchmidt(vectors)
  const det = determinant([[...v1], [...v2]])
  const coords = det !== 0 && Math.abs(det) > 1e-9 ? coordinatesInBasis([...t], [[...v1], [...v2]]) : null
  const u = gs.orthogonal.map((x) => [x[0], x[1]] as Vec2)
  const e = gs.orthonormal.map((x) => [x[0], x[1]] as Vec2)
  return {
    stats: [`rank ${r}`, spans ? 'spans the plane' : 'does NOT span the plane', coords ? `t = ${n2(coords.coefficients[0])} v₁ + ${n2(coords.coefficients[1])} v₂` : 'v₁, v₂ are not a basis'],
    title: 'Vectors, basis and target',
    lines: [
      `v₁ = ${pt(v1)},  v₂ = ${pt(v2)}${opts.showThird ? `,  v₃ = ${pt(v3)}` : ''}`,
      `rank = ${r}  →  ${spans ? 'they span the whole plane' : r === 1 ? 'they all lie on one line: they do NOT span the plane' : 'they do not span the plane'}`,
      `det [v₁ v₂] = ${n2(det)}  (not 0 means v₁, v₂ are independent)`,
      ...(u.length > 0 ? [`Gram–Schmidt: u₁ = v₁ = ${pt(u[0])}`] : []),
      ...(u.length > 1 ? [`u₂ = v₂ − (v₂·u₁)/(u₁·u₁) u₁ = ${pt(u[1])}`, `u₁ · u₂ = ${n3(dotp(u[0], u[1]))}  (0: perpendicular)`] : []),
      ...gs.dependent.map((i) => `v${['₁', '₂', '₃'][i]} is dependent: it adds nothing new, so Gram–Schmidt left it out`),
      ...(e.length > 1 ? [`orthonormal: e₁ = ${pt(e[0])},  e₂ = ${pt(e[1])}`] : []),
      `target t = ${pt(t)}`,
      ...(coords
        ? [
            `t = c₁ v₁ + c₂ v₂  with  c₁ = ${n3(coords.coefficients[0])},  c₂ = ${n3(coords.coefficients[1])}`,
            `check: c₁ v₁ + c₂ v₂ = ${pt(plus(times(v1, coords.coefficients[0]), times(v2, coords.coefficients[1])))}`,
          ]
        : ['t has no coordinates, because v₁ and v₂ are not independent']),
    ],
    formula: (
      <>
        <Eq label="Coordinates in a basis">{'t = c_1 v_1 + c_2 v_2'}</Eq>
        <Eq label="Gram–Schmidt (make them perpendicular)">{'u_k = v_k − Σ frac{v_k · u_j}{u_j · u_j} u_j'}</Eq>
        <Eq label="Do they span the plane?">{'rank = 2   ⇔   det [v_1 v_2] ≠ 0'}</Eq>
        <Note>Two independent vectors span the whole plane: every point is a combination of them. A vector that is a combination of the earlier ones adds nothing, and Gram–Schmidt drops it.</Note>
      </>
    ),
  }
}

// ---------------------------------------------------------------------------------------------
// drawing of each mode
// ---------------------------------------------------------------------------------------------

function draw(ctx: CanvasRenderingContext2D, mode: Mode, pts: Pts, opts: Options, active: PointKey | null): void {
  drawGrid(ctx)

  if (mode === 'outer') {
    const { a, b } = pts
    const w = wedge2(a, b)
    const colour = w >= 0 ? COLORS.accent : COLORS.orange // anticlockwise: blue, clockwise: orange
    drawPolygon(ctx, [ORIGIN, a, plus(a, b), b], colour + '30', colour, 1.5) // the parallelogram
    drawPolygon(ctx, [ORIGIN, a, b], colour + '55', null) // the triangle (half of it)
    drawSegment(ctx, a, plus(a, b), colour, 1, [4, 4])
    drawSegment(ctx, b, plus(a, b), colour, 1, [4, 4])
    drawArrow(ctx, ORIGIN, a, COLORS.white)
    drawArrow(ctx, ORIGIN, b, COLORS.green)
    drawAngle(ctx, ORIGIN, a, b, 30, colour, deg(Math.atan2(w, dotp(a, b))))
    drawLabel(ctx, times(plus(a, b), 0.5), `a ∧ b = ${n2(w)}`, COLORS.white, -28, 4, 14)
  }

  if (mode === 'sine') {
    const { A, B, C } = pts
    const r = sineRule(A, B, C)
    const circle = opts.showCircle ? circumcircle(A, B, C) : null
    if (circle && circle.radius < 40) {
      const [cx, cy] = toPx(circle.center)
      ctx.strokeStyle = COLORS.purple
      ctx.lineWidth = 1.2
      ctx.setLineDash([6, 5])
      ctx.beginPath()
      ctx.arc(cx, cy, circle.radius * 40, 0, 2 * Math.PI)
      ctx.stroke()
      ctx.setLineDash([])
    }
    drawPolygon(ctx, [A, B, C], COLORS.accent + '22', COLORS.accent, 2)
    // Each side is named after the corner opposite it, and its length is written beside it.
    const sideLabel = (P: Vec2, Q: Vec2, R: Vec2, name: string, length: number) => {
      const mid = times(plus(P, Q), 0.5)
      const away = minus(mid, R) // pointing away from the opposite corner, so the label is outside the triangle
      const size = Math.hypot(...away) || 1
      drawLabel(ctx, plus(mid, times(away, 0.5 / size)), `${name} = ${n2(length)}`, COLORS.orange, -22, 4, 13)
    }
    sideLabel(B, C, A, 'a', r.sides[0])
    sideLabel(C, A, B, 'b', r.sides[1])
    sideLabel(A, B, C, 'c', r.sides[2])
    if (!r.degenerate) {
      drawAngle(ctx, A, B, C, 26, COLORS.green, deg(r.angles[0]))
      drawAngle(ctx, B, C, A, 26, COLORS.green, deg(r.angles[1]))
      drawAngle(ctx, C, A, B, 26, COLORS.green, deg(r.angles[2]))
    }
  }

  if (mode === 'lines') {
    const { p1, p2, q1, q2 } = pts
    drawLineThrough(ctx, p1, minus(p2, p1), COLORS.accent + '66', 1.2, [6, 5]) // the lines continue forever
    drawLineThrough(ctx, q1, minus(q2, q1), COLORS.orange + '66', 1.2, [6, 5])
    drawSegment(ctx, p1, p2, COLORS.accent, 3)
    drawSegment(ctx, q1, q2, COLORS.orange, 3)
    const hit = intersectLines(p1, minus(p2, p1), q1, minus(q2, q1))
    if (hit) {
      const [x, y] = toPx(hit.point)
      ctx.fillStyle = COLORS.green
      ctx.beginPath()
      ctx.arc(x, y, 7, 0, 2 * Math.PI)
      ctx.fill()
      ctx.strokeStyle = '#000'
      ctx.lineWidth = 1.5
      ctx.stroke()
      drawLabel(ctx, hit.point, pt(hit.point), COLORS.green, 12, 22, 13)
    } else {
      drawLabel(ctx, [-3, -5], 'parallel: d₁ ∧ d₂ = 0, no intersection', COLORS.orange, 0, 0, 14)
    }
  }

  if (mode === 'bases') {
    const { v1, v2, v3, t } = pts
    const list = opts.showThird ? [v1, v2, v3] : [v1, v2]
    const gs = gramSchmidt(list.map((v) => [...v]))
    const det = determinant([[...v1], [...v2]])
    const coords = Math.abs(det) > 1e-9 ? coordinatesInBasis([...t], [[...v1], [...v2]]) : null
    if (coords) {
      // The way to t: go c1 along v1, then c2 along v2.
      const corner = times(v1, coords.coefficients[0])
      drawSegment(ctx, ORIGIN, corner, COLORS.accent, 2, [5, 4])
      drawSegment(ctx, corner, t, COLORS.orange, 2, [5, 4])
    }
    if (opts.showOrthogonal) {
      gs.orthogonal.forEach((u) => drawArrow(ctx, ORIGIN, [u[0], u[1]], COLORS.purple, undefined, 3.5))
      if (gs.orthogonal.length > 1) {
        const [u1, u2] = gs.orthogonal.map((u) => times([u[0], u[1]], 0.35 / Math.hypot(u[0], u[1])))
        drawPolygon(ctx, [ORIGIN, u1, plus(u1, u2), u2], null, COLORS.purple, 1.2) // the little square marks a right angle
      }
    }
    drawArrow(ctx, ORIGIN, v1, COLORS.accent)
    drawArrow(ctx, ORIGIN, v2, COLORS.orange)
    if (opts.showThird) drawArrow(ctx, ORIGIN, v3, COLORS.green)
    drawArrow(ctx, ORIGIN, t, COLORS.white, undefined, 1.2)
  }

  // The draggable points go on top of everything.
  const colours: Partial<Record<PointKey, string>> = { a: COLORS.white, b: COLORS.green, p1: COLORS.accent, p2: COLORS.accent, q1: COLORS.orange, q2: COLORS.orange, v1: COLORS.accent, v2: COLORS.orange, v3: COLORS.green, t: COLORS.white }
  for (const key of handlesFor(mode, opts)) drawHandle(ctx, pts[key], colours[key] ?? COLORS.accent, NAMES[key], key === active)
}

// ---------------------------------------------------------------------------------------------
// the lab
// ---------------------------------------------------------------------------------------------

export default function GeometryLab() {
  const [mode, setMode] = useState<Mode>('outer')
  const [space, setSpace] = useState<'2d' | '3d'>('2d') // for the "bases" mode
  const [pts, setPts] = useState<Pts>(START)
  const [opts, setOpts] = useState<Options>({ snap: true, showThird: false, showCircle: true, showOrthogonal: true })
  const [active, setActive] = useState<PointKey | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const log = useLabLog()

  const analysis =
    mode === 'outer' ? analyseOuter(pts) : mode === 'sine' ? analyseSine(pts, opts) : mode === 'lines' ? analyseLines(pts) : analyseBases(pts, opts)

  useEffect(() => {
    if (mode === 'bases' && space === '3d') return
    draw(canvasRef.current!.getContext('2d')!, mode, pts, opts, active)
  }, [mode, space, pts, opts, active])

  // Console trace: the result a moment after the last change.
  useEffect(() => {
    const id = setTimeout(() => log(`${analysis.title}: ${analysis.stats.join(' · ')}`), 400)
    return () => clearTimeout(id)
  }, [analysis.stats.join('|')]) // eslint-disable-line react-hooks/exhaustive-deps

  // ----- dragging the points -----
  const pixel = (e: React.PointerEvent<HTMLCanvasElement>): [number, number] => {
    const rect = e.currentTarget.getBoundingClientRect()
    return [((e.clientX - rect.left) / rect.width) * W, ((e.clientY - rect.top) / rect.height) * H]
  }
  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const [x, y] = pixel(e)
    // The nearest draggable point, if the mouse is close enough to it (16 pixels).
    let best: PointKey | null = null
    let bestDistance = 16
    for (const key of handlesFor(mode, opts)) {
      const [px, py] = toPx(pts[key])
      const d = Math.hypot(px - x, py - y)
      if (d < bestDistance) {
        best = key
        bestDistance = d
      }
    }
    if (best) {
      e.currentTarget.setPointerCapture(e.pointerId)
      setActive(best)
    }
  }
  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!active) return
    const [x, y] = pixel(e)
    let [wx, wy] = fromPx(x, y)
    if (opts.snap) {
      wx = Math.round(wx * 4) / 4 // snap to quarter units, so the numbers stay tidy
      wy = Math.round(wy * 4) / 4
    }
    const point: Vec2 = [Math.max(-7.9, Math.min(7.9, wx)), Math.max(-5.9, Math.min(5.9, wy))]
    setPts((old) => ({ ...old, [active]: point }))
  }

  const setOption = (change: Partial<Options>) => setOpts((o) => ({ ...o, ...change }))
  const checkbox = (label: string, checked: boolean, onChange: (v: boolean) => void) => (
    <div><label><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /> {label}</label></div>
  )

  // The mode switch, shared by the 2D and the 3D parts.
  const modeSwitch: ReactNode = (
    <Section title="Topic">
      {MODES.map((m) => (
        <label key={m.id} style={{ display: 'block', margin: '2px 0' }}>
          <input type="radio" name="geometry-mode" checked={mode === m.id} onChange={() => setMode(m.id)} /> {m.label}
        </label>
      ))}
      {mode === 'bases' && (
        <div style={{ marginTop: 6, paddingLeft: 18 }}>
          <label style={{ marginRight: 10 }}><input type="radio" name="geometry-space" checked={space === '2d'} onChange={() => setSpace('2d')} /> plane (2D)</label>
          <label><input type="radio" name="geometry-space" checked={space === '3d'} onChange={() => setSpace('3d')} /> space (3D)</label>
        </div>
      )}
    </Section>
  )

  if (mode === 'bases' && space === '3d') return <Geometry3D modeSwitch={modeSwitch} />

  return (
    <LabLayout
      sections
      canvas={
        <canvas
          ref={canvasRef} width={W} height={H}
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={() => setActive(null)} onPointerCancel={() => setActive(null)}
          style={{ display: 'block', cursor: active ? 'grabbing' : 'crosshair', touchAction: 'none', maxWidth: '100%', height: 'auto' }}
        />
      }
      stats={analysis.stats}
      controls={
        <>
          {modeSwitch}
          <Section title="Points">
            <div style={{ color: 'var(--muted)', marginBottom: 6 }}>Drag the labelled points on the picture.</div>
            {checkbox('Snap to quarter units', opts.snap, (v) => setOption({ snap: v }))}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
              <button onClick={() => setPts(START)}>Reset points</button>
              {mode === 'outer' && <button onClick={() => setPts((p) => ({ ...p, a: p.b, b: p.a }))}>Swap a and b</button>}
              {mode === 'sine' && <button onClick={() => setPts((p) => ({ ...p, B: p.C, C: p.B }))}>Swap B and C</button>}
              {mode === 'lines' && <button onClick={() => setPts((p) => ({ ...p, q2: plus(p.q1, minus(p.p2, p.p1)) }))}>Make them parallel</button>}
              {mode === 'bases' && <button onClick={() => setPts((p) => ({ ...p, v2: times(p.v1, -1.5) }))}>Make v₂ parallel to v₁</button>}
            </div>
          </Section>
          {mode === 'sine' && (
            <Section title="Show">{checkbox('Circle through A, B, C (its diameter is the common ratio)', opts.showCircle, (v) => setOption({ showCircle: v }))}</Section>
          )}
          {mode === 'bases' && (
            <Section title="Show">
              {checkbox('Add a third vector v₃', opts.showThird, (v) => setOption({ showThird: v }))}
              {checkbox('Gram–Schmidt arrows (purple)', opts.showOrthogonal, (v) => setOption({ showOrthogonal: v }))}
            </Section>
          )}
        </>
      }
      formula={
        <FormulaBox>
          {analysis.formula}
          <Numbers title="Live numbers" lines={analysis.lines} />
        </FormulaBox>
      }
    />
  )
}
