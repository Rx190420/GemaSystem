// Renders small, clean chart PNGs on an off-DOM <canvas> so they can be
// embedded as images in the finance Excel/PDF exports. No charting library
// dependency — these are simple bar/line/donut renderers tailored to the
// handful of chart shapes the finance report needs.
//
// Every renderer draws at 2x pixel density (retina-sharp when placed at its
// logical `width`/`height`) and returns { dataUrl, width, height } where
// width/height are the LOGICAL (CSS-pixel-equivalent) size to place the
// image at — not the raw canvas pixel size.

const FONT = 'Helvetica, Arial, sans-serif'
const SCALE = 2

function makeCanvas(width, height) {
  const canvas = document.createElement('canvas')
  canvas.width = width * SCALE
  canvas.height = height * SCALE
  const ctx = canvas.getContext('2d')
  ctx.scale(SCALE, SCALE)
  ctx.textBaseline = 'alphabetic'
  return { canvas, ctx }
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, Math.max(h, 0) / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

function finish({ canvas }, width, height) {
  return { dataUrl: canvas.toDataURL('image/png'), width, height }
}

/**
 * Vertical bar chart. `points`: [{ label, value }]
 */
export function barChartPNG({
  points, color = '#6366F1', width = 620, height = 300, title = '',
  valueFormatter = v => String(v),
}) {
  const c = makeCanvas(width, height)
  const { ctx } = c

  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, width, height)

  const padTop    = title ? 34 : 14
  const padBottom = 30
  const padLeft   = 12
  const padRight  = 12
  const chartW = width - padLeft - padRight
  const chartH = height - padTop - padBottom

  if (title) {
    ctx.fillStyle = '#0F172A'
    ctx.font = `700 14px ${FONT}`
    ctx.fillText(title, padLeft, 22)
  }

  const max = Math.max(1, ...points.map(p => p.value))
  const n = points.length || 1
  const gap = 8
  const barW = Math.max(4, (chartW - gap * (n - 1)) / n)

  // Gridlines (4 horizontal guides)
  ctx.strokeStyle = '#F1F5F9'
  ctx.lineWidth = 1
  for (let i = 1; i <= 3; i++) {
    const y = padTop + chartH - (chartH * i) / 4
    ctx.beginPath()
    ctx.moveTo(padLeft, y)
    ctx.lineTo(padLeft + chartW, y)
    ctx.stroke()
  }

  points.forEach((p, i) => {
    const x = padLeft + i * (barW + gap)
    const h = max > 0 ? (p.value / max) * chartH : 0
    const y = padTop + chartH - h

    ctx.fillStyle = color
    roundRect(ctx, x, y, barW, Math.max(h, 1), 3)
    ctx.fill()

    // Value on top of the bar
    if (h > 0) {
      ctx.fillStyle = '#334155'
      ctx.font = `600 9.5px ${FONT}`
      ctx.textAlign = 'center'
      ctx.fillText(valueFormatter(p.value), x + barW / 2, y - 5)
    }

    // X label
    ctx.fillStyle = '#94A3B8'
    ctx.font = `9.5px ${FONT}`
    ctx.textAlign = 'center'
    ctx.fillText(p.label, x + barW / 2, height - padBottom + 16)
  })
  ctx.textAlign = 'left'

  // Baseline
  ctx.strokeStyle = '#E2E8F0'
  ctx.beginPath()
  ctx.moveTo(padLeft, padTop + chartH)
  ctx.lineTo(padLeft + chartW, padTop + chartH)
  ctx.stroke()

  return finish(c, width, height)
}

/**
 * Smooth-ish line/area chart. `points`: [{ label, value }]
 */
export function lineChartPNG({
  points, color = '#6366F1', width = 620, height = 300, title = '',
  valueFormatter = v => String(v),
}) {
  const c = makeCanvas(width, height)
  const { ctx } = c

  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, width, height)

  const padTop    = title ? 34 : 14
  const padBottom = 26
  const padLeft   = 12
  const padRight  = 12
  const chartW = width - padLeft - padRight
  const chartH = height - padTop - padBottom

  if (title) {
    ctx.fillStyle = '#0F172A'
    ctx.font = `700 14px ${FONT}`
    ctx.fillText(title, padLeft, 22)
  }

  const max = Math.max(1, ...points.map(p => p.value))
  const n = Math.max(1, points.length - 1)
  const stepX = chartW / n

  ctx.strokeStyle = '#F1F5F9'
  ctx.lineWidth = 1
  for (let i = 1; i <= 3; i++) {
    const y = padTop + chartH - (chartH * i) / 4
    ctx.beginPath()
    ctx.moveTo(padLeft, y)
    ctx.lineTo(padLeft + chartW, y)
    ctx.stroke()
  }

  const xy = points.map((p, i) => ({
    x: padLeft + i * stepX,
    y: padTop + chartH - (max > 0 ? (p.value / max) * chartH : 0),
  }))

  // Area fill
  if (xy.length > 1) {
    ctx.beginPath()
    ctx.moveTo(xy[0].x, padTop + chartH)
    xy.forEach(pt => ctx.lineTo(pt.x, pt.y))
    ctx.lineTo(xy[xy.length - 1].x, padTop + chartH)
    ctx.closePath()
    const grad = ctx.createLinearGradient(0, padTop, 0, padTop + chartH)
    grad.addColorStop(0, color + '33')
    grad.addColorStop(1, color + '02')
    ctx.fillStyle = grad
    ctx.fill()
  }

  // Line
  ctx.beginPath()
  xy.forEach((pt, i) => (i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)))
  ctx.strokeStyle = color
  ctx.lineWidth = 2.25
  ctx.lineJoin = 'round'
  ctx.stroke()

  // Points
  xy.forEach(pt => {
    ctx.beginPath()
    ctx.arc(pt.x, pt.y, 2.75, 0, Math.PI * 2)
    ctx.fillStyle = '#FFFFFF'
    ctx.fill()
    ctx.lineWidth = 1.75
    ctx.strokeStyle = color
    ctx.stroke()
  })

  // X labels (skip some if crowded)
  const labelEvery = points.length > 8 ? 2 : 1
  ctx.fillStyle = '#94A3B8'
  ctx.font = `9.5px ${FONT}`
  ctx.textAlign = 'center'
  points.forEach((p, i) => {
    if (i % labelEvery !== 0 && i !== points.length - 1) return
    ctx.fillText(p.label, xy[i].x, height - padBottom + 16)
  })
  ctx.textAlign = 'left'
  void valueFormatter

  return finish(c, width, height)
}

/**
 * Donut/pie chart with a side legend. `slices`: [{ label, value, color }].
 * `hole` is the inner-radius ratio (0 = solid pie, 0.6 = default donut ring).
 */
export function donutChartPNG({
  slices, width = 420, height = 280, title = '', centerLabel = '', hole = 0.6,
  valueFormatter = v => String(v),
}) {
  const c = makeCanvas(width, height)
  const { ctx } = c

  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, width, height)

  if (title) {
    ctx.fillStyle = '#0F172A'
    ctx.font = `700 14px ${FONT}`
    ctx.fillText(title, 14, 22)
  }

  const total = slices.reduce((s, x) => s + x.value, 0) || 1
  const cx = 100
  const cy = title ? (height + 20) / 2 : height / 2
  const rOuter = Math.min(cy - 20, cx - 20, 78)
  const rInner = rOuter * Math.max(0, hole)

  let start = -Math.PI / 2
  slices.forEach(s => {
    const frac = s.value / total
    const end = start + frac * Math.PI * 2
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.arc(cx, cy, rOuter, start, end)
    ctx.closePath()
    ctx.fillStyle = s.color
    ctx.fill()
    ctx.strokeStyle = '#FFFFFF'
    ctx.lineWidth = 1.5
    ctx.stroke()
    start = end
  })
  // Punch the donut hole (skipped entirely for a solid pie, hole = 0)
  if (rInner > 0) {
    ctx.beginPath()
    ctx.arc(cx, cy, rInner, 0, Math.PI * 2)
    ctx.fillStyle = '#FFFFFF'
    ctx.fill()
  }

  if (centerLabel && rInner > 0) {
    ctx.fillStyle = '#0F172A'
    ctx.font = `700 12px ${FONT}`
    ctx.textAlign = 'center'
    const lines = String(centerLabel).split('\n')
    lines.forEach((line, i) => ctx.fillText(line, cx, cy + (i - (lines.length - 1) / 2) * 14 + 4))
    ctx.textAlign = 'left'
  }

  // Legend
  const legendX = cx + rOuter + 24
  let ly = title ? 44 : 22
  slices.forEach(s => {
    ctx.fillStyle = s.color
    roundRect(ctx, legendX, ly - 8, 10, 10, 2)
    ctx.fill()
    ctx.fillStyle = '#334155'
    ctx.font = `600 10.5px ${FONT}`
    ctx.fillText(s.label, legendX + 16, ly + 1)
    ctx.fillStyle = '#94A3B8'
    ctx.font = `9.5px ${FONT}`
    const pct = ((s.value / total) * 100).toFixed(1)
    ctx.fillText(`${valueFormatter(s.value)}  ·  ${pct}%`, legendX + 16, ly + 13)
    ly += 34
  })

  return finish(c, width, height)
}

/**
 * Solid pie chart (no center hole) — same shape as donutChartPNG, just
 * `hole: 0`. Kept as its own named export since callers ask for "a pie
 * chart" specifically, distinct from the donut used for origin/source.
 */
export function pieChartPNG(opts) {
  return donutChartPNG({ ...opts, hole: 0, centerLabel: '' })
}
