// plane2d.ts - drawing helpers for the Geometry Lab's flat (2D) canvas.
// World coordinates: the origin is in the middle of the canvas, x grows to the right and y UP (a normal maths
// plane), 40 pixels per unit. Canvas pixels have y pointing DOWN, so every helper flips y when it draws.

import type { Vec2 } from '../core/math/geometryLab'

export const W = 640
export const H = 480
export const UNIT = 40

export const COLORS = {
  bg: '#1b1f26', grid: '#2a303a', axis: '#6c7686', text: '#dfe3ea', muted: '#98a1b0',
  accent: '#4cc2ff', orange: '#ff9f43', green: '#6ee7a0', purple: '#c792ea', white: '#ffffff',
}

/** World point -> canvas pixel. */
export const toPx = (p: Vec2): [number, number] => [W / 2 + p[0] * UNIT, H / 2 - p[1] * UNIT]
/** Canvas pixel -> world point. */
export const fromPx = (x: number, y: number): Vec2 => [(x - W / 2) / UNIT, (H / 2 - y) / UNIT]

/** Background, a grid line at every whole number, the two axes with arrow heads, and numbers along the axes. */
export function drawGrid(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = COLORS.bg
  ctx.fillRect(0, 0, W, H)
  ctx.lineWidth = 1
  ctx.strokeStyle = COLORS.grid
  ctx.beginPath()
  for (let x = -8; x <= 8; x++) {
    const px = toPx([x, 0])[0] + 0.5
    ctx.moveTo(px, 0)
    ctx.lineTo(px, H)
  }
  for (let y = -6; y <= 6; y++) {
    const py = toPx([0, y])[1] + 0.5
    ctx.moveTo(0, py)
    ctx.lineTo(W, py)
  }
  ctx.stroke()
  drawArrow(ctx, [-8, 0], [7.85, 0], COLORS.axis, 'x', 1.5)
  drawArrow(ctx, [0, -6], [0, 5.85], COLORS.axis, 'y', 1.5)
  ctx.fillStyle = COLORS.muted
  ctx.font = '11px system-ui'
  ctx.textAlign = 'center'
  for (let x = -7; x <= 7; x += 1) if (x !== 0) ctx.fillText(String(x), toPx([x, 0])[0], toPx([0, 0])[1] + 14)
  ctx.textAlign = 'right'
  for (let y = -5; y <= 5; y += 1) if (y !== 0) ctx.fillText(String(y), toPx([0, 0])[0] - 6, toPx([0, y])[1] + 4)
}

/** An arrow from one world point to another, with an optional label by the tip. */
export function drawArrow(ctx: CanvasRenderingContext2D, from: Vec2, to: Vec2, color: string, label?: string, width = 2.5): void {
  const [x0, y0] = toPx(from)
  const [x1, y1] = toPx(to)
  const angle = Math.atan2(y1 - y0, x1 - x0)
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = width
  ctx.beginPath()
  ctx.moveTo(x0, y0)
  ctx.lineTo(x1, y1)
  ctx.stroke()
  if (Math.hypot(x1 - x0, y1 - y0) > 6) {
    ctx.beginPath() // the arrow head: a small triangle at the tip
    ctx.moveTo(x1, y1)
    ctx.lineTo(x1 - 10 * Math.cos(angle - 0.4), y1 - 10 * Math.sin(angle - 0.4))
    ctx.lineTo(x1 - 10 * Math.cos(angle + 0.4), y1 - 10 * Math.sin(angle + 0.4))
    ctx.closePath()
    ctx.fill()
  }
  if (label) {
    ctx.font = 'italic bold 14px "STIX Two Math", "Times New Roman", serif'
    ctx.textAlign = 'left'
    ctx.fillText(label, x1 + 8, y1 - 8)
  }
}

/** A closed shape with an optional fill and outline. */
export function drawPolygon(ctx: CanvasRenderingContext2D, points: Vec2[], fill: string | null, stroke: string | null, width = 1.5): void {
  ctx.beginPath()
  points.forEach((p, i) => {
    const [x, y] = toPx(p)
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  })
  ctx.closePath()
  if (fill) {
    ctx.fillStyle = fill
    ctx.fill()
  }
  if (stroke) {
    ctx.strokeStyle = stroke
    ctx.lineWidth = width
    ctx.stroke()
  }
}

/** A straight segment between two world points. */
export function drawSegment(ctx: CanvasRenderingContext2D, a: Vec2, b: Vec2, color: string, width = 2, dash: number[] = []): void {
  const [x0, y0] = toPx(a)
  const [x1, y1] = toPx(b)
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.setLineDash(dash)
  ctx.beginPath()
  ctx.moveTo(x0, y0)
  ctx.lineTo(x1, y1)
  ctx.stroke()
  ctx.setLineDash([])
}

/** The whole line through p in direction d, running off both edges of the canvas. */
export function drawLineThrough(ctx: CanvasRenderingContext2D, p: Vec2, d: Vec2, color: string, width = 1.5, dash: number[] = []): void {
  const length = Math.hypot(d[0], d[1])
  if (length === 0) return
  const far = 30 / length // 30 units each way is much more than the canvas
  drawSegment(ctx, [p[0] - far * d[0], p[1] - far * d[1]], [p[0] + far * d[0], p[1] + far * d[1]], color, width, dash)
}

/** A small text label next to a world point. */
export function drawLabel(ctx: CanvasRenderingContext2D, p: Vec2, text: string, color: string, dx = 8, dy = -8, size = 13): void {
  const [x, y] = toPx(p)
  ctx.fillStyle = color
  ctx.font = `${size}px system-ui`
  ctx.textAlign = 'left'
  ctx.fillText(text, x + dx, y + dy)
}

/** A draggable point: a filled circle with a ring (bigger while it is being dragged) and a name beside it. */
export function drawHandle(ctx: CanvasRenderingContext2D, p: Vec2, color: string, name: string, active: boolean): void {
  const [x, y] = toPx(p)
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(x, y, active ? 7 : 5.5, 0, 2 * Math.PI)
  ctx.fill()
  ctx.strokeStyle = '#000'
  ctx.lineWidth = 1.5
  ctx.stroke()
  ctx.strokeStyle = color
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.arc(x, y, active ? 12 : 9.5, 0, 2 * Math.PI)
  ctx.stroke()
  ctx.fillStyle = COLORS.text
  ctx.font = 'italic bold 14px "STIX Two Math", "Times New Roman", serif'
  ctx.textAlign = 'left'
  ctx.fillText(name, x + 13, y - 11)
}

/** An arc at `vertex` between the directions to two other points, with text (the angle) beside it. */
export function drawAngle(ctx: CanvasRenderingContext2D, vertex: Vec2, toward1: Vec2, toward2: Vec2, radiusPx: number, color: string, text: string): void {
  const [cx, cy] = toPx(vertex)
  // Directions as canvas angles (the canvas y axis points down, so the world y is negated).
  const a1 = Math.atan2(-(toward1[1] - vertex[1]), toward1[0] - vertex[0])
  const a2 = Math.atan2(-(toward2[1] - vertex[1]), toward2[0] - vertex[0])
  let delta = a2 - a1
  while (delta > Math.PI) delta -= 2 * Math.PI // take the short way round
  while (delta < -Math.PI) delta += 2 * Math.PI
  ctx.strokeStyle = color
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.arc(cx, cy, radiusPx, a1, a1 + delta, delta < 0)
  ctx.stroke()
  const mid = a1 + delta / 2
  ctx.fillStyle = color
  ctx.font = '12px system-ui'
  ctx.textAlign = 'center'
  ctx.fillText(text, cx + (radiusPx + 16) * Math.cos(mid), cy + (radiusPx + 16) * Math.sin(mid) + 4)
}
