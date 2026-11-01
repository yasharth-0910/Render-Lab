// benchChart.ts - draws one grouped bar chart (a ChartSpec from core/bench) on a canvas.
// Used on screen (dark colours) and to save a picture for the report (light colours, white background).

import { formatCell, type ChartSpec } from '../core/bench/bench'

const DARK = { bg: '#1f232b', text: '#dfe3ea', muted: '#98a1b0', grid: '#3b4352', series: ['#4cc2ff', '#ff9f43', '#6ee7a0', '#c792ea'] }
const LIGHT = { bg: '#ffffff', text: '#1a1a1a', muted: '#555555', grid: '#d4d4d4', series: ['#1976d2', '#ef6c00', '#2e7d32', '#7b1fa2'] }
const FONT = 'Inter, system-ui, sans-serif'

// Round a number up to 1, 2, 5 or 10 times a power of ten, so the axis ends on a round number.
function niceCeil(value: number): number {
  const exponent = Math.floor(Math.log10(value))
  const fraction = value / 10 ** exponent
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10
  return nice * 10 ** exponent
}

// Shorten text with "…" until it fits in `width` pixels.
function fit(ctx: CanvasRenderingContext2D, text: string, width: number): string {
  if (ctx.measureText(text).width <= width) return text
  while (text.length > 1 && ctx.measureText(text + '…').width > width) text = text.slice(0, -1)
  return text + '…'
}

/** Draw the chart (or a hint when there is none) into the whole canvas. */
export function drawChart(ctx: CanvasRenderingContext2D, width: number, height: number, spec: ChartSpec | null, light = false): void {
  const c = light ? LIGHT : DARK
  ctx.fillStyle = c.bg
  ctx.fillRect(0, 0, width, height)
  ctx.textAlign = 'center'
  if (!spec) {
    ctx.fillStyle = c.muted
    ctx.font = `14px ${FONT}`
    ctx.fillText('Run a suite to see its chart here.', width / 2, height / 2)
    return
  }

  const left = 78
  const right = 20
  const top = 66
  const bottom = 52
  const plotW = width - left - right
  const plotH = height - top - bottom
  const values = spec.groups.flatMap((g) => g.values).filter((v) => v > 0)
  const maxValue = Math.max(...values, 1e-12)

  // The vertical scale: a function from a value to a y position, and the tick marks to draw.
  let yOf: (v: number) => number
  const ticks: number[] = []
  if (spec.logScale) {
    const low = Math.floor(Math.log10(Math.min(...values, maxValue)))
    let high = Math.ceil(Math.log10(maxValue))
    if (high === low) high = low + 1
    for (let e = low; e <= high; e++) ticks.push(10 ** e)
    yOf = (v) => top + plotH * (1 - (Math.log10(Math.max(v, 10 ** low)) - low) / (high - low))
  } else {
    const niceMax = niceCeil(maxValue)
    for (let i = 0; i <= 5; i++) ticks.push((niceMax * i) / 5)
    yOf = (v) => top + plotH * (1 - v / niceMax)
  }

  // Grid lines and the numbers on the y axis.
  ctx.font = `11px ${FONT}`
  ctx.lineWidth = 1
  for (const tick of ticks) {
    const y = Math.round(yOf(tick)) + 0.5
    ctx.strokeStyle = c.grid
    ctx.beginPath()
    ctx.moveTo(left, y)
    ctx.lineTo(width - right, y)
    ctx.stroke()
    ctx.fillStyle = c.muted
    ctx.textAlign = 'right'
    ctx.fillText(formatCell(tick), left - 6, y + 4)
  }

  // The bars: one cluster per group, one bar per series.
  const groupWidth = plotW / spec.groups.length
  const barWidth = Math.min(54, (groupWidth * 0.8) / spec.series.length)
  const baseline = top + plotH
  spec.groups.forEach((group, i) => {
    const x0 = left + i * groupWidth + (groupWidth - barWidth * spec.series.length) / 2
    group.values.forEach((value, j) => {
      const y = value > 0 ? yOf(value) : baseline
      ctx.fillStyle = c.series[j % c.series.length]
      ctx.fillRect(x0 + j * barWidth + 1, y, barWidth - 2, baseline - y)
      ctx.fillStyle = c.text
      ctx.font = `10.5px ${FONT}`
      ctx.textAlign = 'center'
      ctx.fillText(formatCell(value), x0 + j * barWidth + barWidth / 2, y - 4)
    })
    ctx.fillStyle = c.text
    ctx.font = `11px ${FONT}`
    ctx.textAlign = 'center'
    ctx.fillText(fit(ctx, group.label, groupWidth - 6), left + i * groupWidth + groupWidth / 2, baseline + 18)
  })

  // The x axis line, the title, the legend and the y axis label.
  ctx.strokeStyle = c.text
  ctx.beginPath()
  ctx.moveTo(left, baseline + 0.5)
  ctx.lineTo(width - right, baseline + 0.5)
  ctx.stroke()

  ctx.fillStyle = c.text
  ctx.font = `bold 15px ${FONT}`
  ctx.textAlign = 'left'
  ctx.fillText(spec.title, left, 24)
  ctx.font = `12px ${FONT}`
  let x = left
  spec.series.forEach((name, j) => {
    ctx.fillStyle = c.series[j % c.series.length]
    ctx.fillRect(x, 38, 12, 12)
    ctx.fillStyle = c.text
    ctx.fillText(name, x + 17, 49)
    x += 17 + ctx.measureText(name).width + 22
  })

  ctx.save()
  ctx.translate(16, top + plotH / 2)
  ctx.rotate(-Math.PI / 2)
  ctx.fillStyle = c.muted
  ctx.font = `11.5px ${FONT}`
  ctx.textAlign = 'center'
  ctx.fillText(spec.yLabel, 0, 0)
  ctx.restore()
}
