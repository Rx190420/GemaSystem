// Dedicated, in-depth Finances export: a multi-sheet Excel workbook (one
// sheet per breakdown, each with its own embedded chart image) and a
// section-by-section PDF. Built on top of the shared styling tokens in
// exportShared.js and the canvas chart renderers in chartImage.js.
import ExcelJS from 'exceljs'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { dateSuffix, dateLong, timeNow, C, HEX } from './exportShared'
import { barChartPNG, lineChartPNG, donutChartPNG, pieChartPNG } from './chartImage'

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const ORIGIN_LABEL = { membership: 'Membresías', visit: 'Visitas', product: 'Productos', manual: 'Manual' }
const ORIGIN_COLOR = { membership: '#6366F1', visit: '#10B981', product: '#F97316', manual: '#F59E0B' }
const METHOD_LABEL = { cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia' }
const METHOD_COLOR = { cash: '#10B981', card: '#818CF8', transfer: '#F59E0B' }
// Extended, varied palette for the "por concepto" pie — concepts are free
// text entered by staff, so this can have more slices than the 3-4 fixed
// categories above.
const CONCEPT_PALETTE = ['#6366F1', '#10B981', '#F97316', '#F59E0B', '#0EA5E9', '#EC4899', '#8B5CF6', '#14B8A6', '#EF4444']
const CONCEPT_OTHER_COLOR = '#94A3B8'
const CONCEPT_TOP_N = 8

const money = v => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 }).format(v ?? 0)
const moneyShort = v => new Intl.NumberFormat('es-MX', { notation: 'compact', maximumFractionDigits: 1 }).format(v ?? 0)
const pct = (v, total) => (total > 0 ? `${((v / total) * 100).toFixed(1)}%` : '0%')

// Normalizes the raw `/finances/summary` payload + the full transaction
// list into the shapes every sheet/section below wants to draw from.
function prepare(summary, transactions) {
  const s = summary?.summary ?? {}
  const byMonthRaw = summary?.by_month ?? []
  const now = new Date()
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1)
    const y = d.getFullYear(), m = d.getMonth() + 1
    const found = byMonthRaw.find(r => Number(r.year) === y && Number(r.month) === m)
    return { year: y, month: m, label: `${MONTH_NAMES[m - 1]} ${String(y).slice(2)}`, total: Number(found?.total ?? 0) }
  })
  const monthsTotal = months.reduce((a, m) => a + m.total, 0)

  const bySource = (summary?.by_source ?? []).map(r => ({
    origin: r.origin,
    label: r.label ?? ORIGIN_LABEL[r.origin] ?? r.origin,
    total: Number(r.value ?? 0),
    color: r.color ?? ORIGIN_COLOR[r.origin] ?? '#6366F1',
  }))
  const sourceTotal = bySource.reduce((a, r) => a + r.total, 0)

  const byMethod = (summary?.by_method ?? []).map(r => ({
    method: r.method,
    label: METHOD_LABEL[r.method] ?? r.method,
    color: METHOD_COLOR[r.method] ?? '#6366F1',
    total: Number(r.total ?? 0),
    count: Number(r.count ?? 0),
    avg: r.count > 0 ? Number(r.total) / Number(r.count) : 0,
  }))
  const methodTotal = byMethod.reduce((a, r) => a + r.total, 0)

  const txList = transactions ?? []

  // Full spending history for every member that appears in `transactions`
  // (not just a top-5 sample) — grouped by member_id, with a trailing
  // "Sin socio asociado" row for manual entries that aren't linked to a
  // member, so every row in the sheet/section still adds up to the total.
  const memberMap = new Map()
  txList.forEach(t => {
    const key = t.member_id ?? '__unlinked__'
    const entry = memberMap.get(key) ?? {
      member: t.member_id ? (t.member ?? '—') : 'Sin socio asociado',
      code: t.member_id ? (t.member_code ?? '—') : '—',
      total: 0, count: 0, unlinked: !t.member_id,
    }
    entry.total += Number(t.amount ?? 0)
    entry.count += 1
    memberMap.set(key, entry)
  })
  const memberHistory = [...memberMap.values()]
    .filter(m => !m.unlinked)
    .sort((a, b) => b.total - a.total)
    .map(m => ({ ...m, avg: m.count > 0 ? m.total / m.count : 0 }))
  const unlinked = memberMap.get('__unlinked__')
  if (unlinked) memberHistory.push({ ...unlinked, avg: unlinked.count > 0 ? unlinked.total / unlinked.count : 0 })
  const memberHistoryTotal = memberHistory.reduce((a, m) => a + m.total, 0)

  // "Qué se compra más / qué genera más ingresos" — grouped by the free-text
  // concept field, top N by revenue with the long tail folded into "Otros".
  const conceptMap = new Map()
  txList.forEach(t => {
    const key = (t.concept ?? '').trim() || 'Sin concepto'
    const entry = conceptMap.get(key) ?? { concept: key, total: 0, count: 0 }
    entry.total += Number(t.amount ?? 0)
    entry.count += 1
    conceptMap.set(key, entry)
  })
  const conceptSorted = [...conceptMap.values()].sort((a, b) => b.total - a.total)
  const conceptTop = conceptSorted.slice(0, CONCEPT_TOP_N)
  const conceptRest = conceptSorted.slice(CONCEPT_TOP_N)
  const byConcept = conceptTop.map((c, i) => ({ ...c, color: CONCEPT_PALETTE[i % CONCEPT_PALETTE.length] }))
  if (conceptRest.length > 0) {
    byConcept.push({
      concept: `Otros (${conceptRest.length})`,
      total: conceptRest.reduce((a, c) => a + c.total, 0),
      count: conceptRest.reduce((a, c) => a + c.count, 0),
      color: CONCEPT_OTHER_COLOR,
    })
  }
  const conceptTotal = byConcept.reduce((a, c) => a + c.total, 0)

  return {
    kpis: s, months, monthsTotal, bySource, sourceTotal, byMethod, methodTotal,
    memberHistory, memberHistoryTotal, byConcept, conceptTotal, transactions: txList,
  }
}

// ── Small Excel styling helpers (local to this file) ────────────────────────
const thin = { style: 'thin', color: { argb: HEX.lightGray } }
const borderAll = { top: thin, left: thin, bottom: thin, right: thin }

function addBanner(ws, ncols, { gymName, sheetTitle, subtitle }) {
  let r = 1
  ws.mergeCells(r, 1, r, ncols)
  ws.getRow(r).height = 26
  const g = ws.getCell(r, 1)
  g.value = gymName
  g.font = { bold: true, size: 15, color: { argb: HEX.white } }
  g.alignment = { vertical: 'middle', indent: 1 }
  g.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEX.brand } }
  r++

  ws.mergeCells(r, 1, r, ncols)
  const t = ws.getCell(r, 1)
  t.value = sheetTitle
  t.font = { bold: true, size: 12, color: { argb: HEX.dark } }
  t.alignment = { vertical: 'middle', indent: 1 }
  t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEX.rowAlt } }
  r++

  if (subtitle) {
    ws.mergeCells(r, 1, r, ncols)
    const s = ws.getCell(r, 1)
    s.value = subtitle
    s.font = { size: 9, color: { argb: HEX.gray } }
    s.alignment = { vertical: 'middle', indent: 1 }
    r++
  }
  return r + 1 // leave one spacer row
}

function addTableHeader(ws, rowNum, headers, aligns = []) {
  const row = ws.getRow(rowNum)
  row.height = 20
  headers.forEach((h, i) => {
    const cell = row.getCell(i + 1)
    cell.value = h
    cell.font = { bold: true, size: 10, color: { argb: HEX.white } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEX.brandDark } }
    cell.alignment = { vertical: 'middle', horizontal: aligns[i] ?? 'left', indent: aligns[i] === 'left' || !aligns[i] ? 1 : 0 }
    cell.border = borderAll
  })
  return rowNum + 1
}

// values: array of cell descriptors { v, numFmt?, align?, bold?, italic? }
function addTableRow(ws, rowNum, values, { banded = false, boldFirst = true } = {}) {
  const row = ws.getRow(rowNum)
  values.forEach((cellDef, i) => {
    const cell = row.getCell(i + 1)
    const { v, numFmt, align, bold, italic } = cellDef
    cell.value = v
    if (numFmt) cell.numFmt = numFmt
    cell.font = { bold: bold ?? (boldFirst && i === 0), italic: !!italic, size: 10, color: { argb: italic ? HEX.gray : HEX.dark } }
    cell.alignment = { vertical: 'middle', horizontal: align ?? 'left', indent: (align ?? 'left') === 'left' ? 1 : 0 }
    cell.border = borderAll
    if (banded) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEX.rowAlt } }
  })
  return rowNum + 1
}

function addTotalsRow(ws, rowNum, ncols, label, sums /* { colIndex(1-based): {v, numFmt} } */) {
  const row = ws.getRow(rowNum)
  row.height = 20
  for (let c = 1; c <= ncols; c++) {
    const cell = row.getCell(c)
    cell.border = { top: { style: 'medium', color: { argb: HEX.brand } } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEX.totalsBg } }
    cell.font = { bold: true, size: 10, color: { argb: HEX.brandDark } }
  }
  row.getCell(1).value = label
  row.getCell(1).alignment = { vertical: 'middle', indent: 1 }
  Object.entries(sums).forEach(([col, def]) => {
    const cell = row.getCell(Number(col))
    cell.value = def.v
    if (def.numFmt) cell.numFmt = def.numFmt
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
  })
  return rowNum + 1
}

function embedImage(wb, ws, { dataUrl, width, height }, col, row) {
  const imageId = wb.addImage({ base64: dataUrl, extension: 'png' })
  ws.addImage(imageId, { tl: { col, row }, ext: { width, height } })
  return Math.ceil(height / 20) + row + 2 // next free row (≈20px default row height) + spacer
}

// ─────────────────────────────────────────────────────────────────────────────
// EXCEL — one workbook, one sheet per breakdown.
// ─────────────────────────────────────────────────────────────────────────────
export async function exportFinancesExcel({ summary, transactions, txColumns, gymName = 'GemaSystem', subtitle = '' }) {
  const d = prepare(summary, transactions)
  const wb = new ExcelJS.Workbook()
  wb.creator = gymName
  wb.created = new Date()
  const genLine = `Generado el ${dateLong()}, ${timeNow()}${subtitle ? ' · ' + subtitle : ''}`

  // ── Sheet 1: Resumen ───────────────────────────────────────────────────
  {
    const ws = wb.addWorksheet('Resumen', { views: [{ showGridLines: false }] })
    ws.columns = [{ width: 26 }, { width: 18 }, { width: 3 }, { width: 3 }, { width: 3 }, { width: 3 }, { width: 3 }, { width: 3 }]
    let r = addBanner(ws, 8, { gymName, sheetTitle: 'Resumen financiero', subtitle: genLine })

    r = addTableHeader(ws, r, ['Métrica', 'Valor'], ['left', 'center'])
    const kpiRows = [
      ['Total histórico', d.kpis.total],
      ['Ingresos este mes', d.kpis.this_month],
      ['Ingresos mes anterior', d.kpis.last_month],
      ['Ingresos este año', d.kpis.this_year],
      ['Ingresos esta semana', d.kpis.this_week],
    ]
    kpiRows.forEach(([label, val], i) => {
      r = addTableRow(ws, r, [
        { v: label },
        { v: Number(val ?? 0), numFmt: '#,##0.00', align: 'center', bold: true },
      ], { banded: i % 2 === 1 })
    })
    r = addTableRow(ws, r, [
      { v: 'Transacciones totales' },
      { v: Number(d.kpis.total_tx ?? 0), align: 'center', bold: true },
    ])
    r = addTableRow(ws, r, [
      { v: 'Promedio por transacción' },
      { v: Number(d.kpis.avg_amount ?? 0), numFmt: '#,##0.00', align: 'center', bold: true },
    ], { banded: true })

    // Charts to the right of the KPI table
    const bar = barChartPNG({
      points: d.months.map(m => ({ label: m.label, value: m.total })),
      color: '#6366F1', width: 460, height: 230,
      title: 'Ingresos por mes (últimos 12 meses)',
      valueFormatter: moneyShort,
    })
    embedImage(wb, ws, bar, 2.3, 6)

    const donut = donutChartPNG({
      slices: d.bySource.map(s => ({ label: s.label, value: s.total, color: s.color })),
      width: 460, height: 240,
      title: 'Ingresos por origen',
      centerLabel: moneyShort(d.sourceTotal),
      valueFormatter: money,
    })
    embedImage(wb, ws, donut, 2.3, 19)

    ws.getRow(r).height = 4
  }

  // ── Sheet 2: Por mes ──────────────────────────────────────────────────
  {
    const ws = wb.addWorksheet('Por mes', { views: [{ showGridLines: false }] })
    ws.columns = [{ width: 14 }, { width: 20 }, { width: 14 }]
    let r = addBanner(ws, 3, { gymName, sheetTitle: 'Ingresos por mes', subtitle: genLine })
    r = addTableHeader(ws, r, ['Mes', 'Total (MXN)', '% del total'], ['left', 'center', 'center'])
    d.months.forEach((m, i) => {
      r = addTableRow(ws, r, [
        { v: m.label },
        { v: m.total, numFmt: '#,##0.00', align: 'center' },
        { v: pct(m.total, d.monthsTotal), align: 'center', bold: false },
      ], { banded: i % 2 === 1 })
    })
    r = addTotalsRow(ws, r, 3, 'TOTAL', { 2: { v: d.monthsTotal, numFmt: '#,##0.00' } })
    r += 1

    const chart = lineChartPNG({
      points: d.months.map(m => ({ label: m.label, value: m.total })),
      color: '#6366F1', width: 560, height: 260,
      title: 'Tendencia mensual', valueFormatter: moneyShort,
    })
    embedImage(wb, ws, chart, 0.2, r)
  }

  // ── Sheet 3: Por origen ───────────────────────────────────────────────
  {
    const ws = wb.addWorksheet('Por origen', { views: [{ showGridLines: false }] })
    ws.columns = [{ width: 20 }, { width: 18 }, { width: 14 }]
    let r = addBanner(ws, 3, { gymName, sheetTitle: 'Ingresos por origen', subtitle: genLine })
    r = addTableHeader(ws, r, ['Origen', 'Total (MXN)', '% del total'], ['left', 'center', 'center'])
    d.bySource.forEach((s, i) => {
      r = addTableRow(ws, r, [
        { v: s.label },
        { v: s.total, numFmt: '#,##0.00', align: 'center' },
        { v: pct(s.total, d.sourceTotal), align: 'center' },
      ], { banded: i % 2 === 1 })
    })
    r = addTotalsRow(ws, r, 3, 'TOTAL', { 2: { v: d.sourceTotal, numFmt: '#,##0.00' } })
    r += 1

    const donut = donutChartPNG({
      slices: d.bySource.map(s => ({ label: s.label, value: s.total, color: s.color })),
      width: 460, height: 260,
      title: 'Distribución por origen', centerLabel: moneyShort(d.sourceTotal), valueFormatter: money,
    })
    embedImage(wb, ws, donut, 0.2, r)
  }

  // ── Sheet 4: Por método de pago ───────────────────────────────────────
  {
    const ws = wb.addWorksheet('Por método de pago', { views: [{ showGridLines: false }] })
    ws.columns = [{ width: 18 }, { width: 14 }, { width: 16 }, { width: 14 }, { width: 12 }]
    let r = addBanner(ws, 5, { gymName, sheetTitle: 'Ingresos por método de pago', subtitle: genLine })
    r = addTableHeader(ws, r, ['Método', 'Transacciones', 'Total (MXN)', 'Promedio', '% del total'], ['left', 'center', 'center', 'center', 'center'])
    d.byMethod.forEach((m, i) => {
      r = addTableRow(ws, r, [
        { v: m.label },
        { v: m.count, align: 'center' },
        { v: m.total, numFmt: '#,##0.00', align: 'center' },
        { v: m.avg, numFmt: '#,##0.00', align: 'center' },
        { v: pct(m.total, d.methodTotal), align: 'center' },
      ], { banded: i % 2 === 1 })
    })
    r = addTotalsRow(ws, r, 5, 'TOTAL', {
      2: { v: d.byMethod.reduce((a, m) => a + m.count, 0) },
      3: { v: d.methodTotal, numFmt: '#,##0.00' },
    })
    r += 1

    const bar = barChartPNG({
      points: d.byMethod.map(m => ({ label: m.label, value: m.total })),
      color: '#818CF8', width: 460, height: 240,
      title: 'Total por método de pago', valueFormatter: moneyShort,
    })
    embedImage(wb, ws, bar, 0.2, r)
  }

  // ── Sheet 5: Historial de socios ──────────────────────────────────────
  {
    const ncols = 6
    const ws = wb.addWorksheet('Historial de socios', { views: [{ showGridLines: false }] })
    ws.columns = [{ width: 6 }, { width: 26 }, { width: 14 }, { width: 14 }, { width: 16 }, { width: 16 }]
    let r = addBanner(ws, ncols, {
      gymName, sheetTitle: 'Historial de gastos por socio',
      subtitle: `${genLine} · ${d.memberHistory.length} socios`,
    })

    // "Qué genera más ingresos" pie, by concept — placed above the table.
    if (d.byConcept.length > 0) {
      const pie = pieChartPNG({
        slices: d.byConcept.map(c => ({ label: c.concept, value: c.total, color: c.color })),
        width: 620, height: 260,
        title: 'Qué genera más ingresos (por concepto)', valueFormatter: money,
      })
      r = embedImage(wb, ws, pie, 0.2, r)
    }

    const headerRowNum = r
    r = addTableHeader(ws, r, ['#', 'Socio', 'Código', 'Transacciones', 'Total (MXN)', 'Ticket promedio'], ['center', 'left', 'center', 'center', 'center', 'center'])
    d.memberHistory.forEach((m, i) => {
      r = addTableRow(ws, r, [
        { v: i + 1, align: 'center', bold: false },
        { v: m.member, bold: !m.unlinked, italic: m.unlinked },
        { v: m.code, align: 'center', bold: false },
        { v: m.count, align: 'center', bold: false },
        { v: m.total, numFmt: '#,##0.00', align: 'center', bold: false },
        { v: m.avg, numFmt: '#,##0.00', align: 'center', bold: false },
      ], { banded: i % 2 === 1 })
    })
    r = addTotalsRow(ws, r, ncols, 'TOTAL', {
      4: { v: d.memberHistory.reduce((a, m) => a + m.count, 0) },
      5: { v: d.memberHistoryTotal, numFmt: '#,##0.00' },
    })

    ws.views = [{ state: 'frozen', ySplit: headerRowNum, showGridLines: false }]
  }

  // ── Sheet 6: Transacciones (full detail) ─────────────────────────────
  {
    const ncols = txColumns.length
    const ws = wb.addWorksheet('Transacciones', { views: [{ showGridLines: false }] })
    ws.columns = txColumns.map(c => {
      const maxLen = d.transactions.reduce((m, row) => Math.max(m, String(c.value(row) ?? '').length), c.header.length)
      return { width: Math.min(Math.max(maxLen + 3, 12), 40) }
    })
    let r = addBanner(ws, ncols, { gymName, sheetTitle: 'Detalle de transacciones', subtitle: `${genLine} · ${d.transactions.length} registros` })

    const amountIdxs = txColumns.map((c, i) => (/monto|mxn/i.test(c.header) ? i : -1)).filter(i => i >= 0)
    const headerRowNum = r
    r = addTableHeader(ws, r, txColumns.map(c => c.header), txColumns.map((c, i) => (amountIdxs.includes(i) ? 'center' : 'left')))

    d.transactions.forEach((row, ri) => {
      const cells = txColumns.map((c, ci) => {
        const raw = c.value(row)
        const isAmount = amountIdxs.includes(ci)
        const num = parseFloat(raw)
        return isAmount && !isNaN(num)
          ? { v: num, numFmt: '#,##0.00', align: 'center', bold: false }
          : { v: raw ?? '—', bold: ci === 0 }
      })
      r = addTableRow(ws, r, cells, { banded: ri % 2 === 1, boldFirst: true })
    })

    if (amountIdxs.length > 0) {
      const sums = {}
      amountIdxs.forEach(i => {
        const sum = d.transactions.reduce((acc, row) => {
          const n = parseFloat(txColumns[i].value(row))
          return acc + (isNaN(n) ? 0 : n)
        }, 0)
        sums[i + 1] = { v: sum, numFmt: '#,##0.00' }
      })
      r = addTotalsRow(ws, r, ncols, 'TOTAL', sums)
    }

    ws.views = [{ state: 'frozen', ySplit: headerRowNum, showGridLines: false }]
  }

  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  return { kind: 'excel', blob, filename: `finanzas_desglose_${dateSuffix()}.xlsx` }
}

// ─────────────────────────────────────────────────────────────────────────────
// PDF — same breakdown, organized as sections in one continuous report.
// ─────────────────────────────────────────────────────────────────────────────
export function exportFinancesPDF({ summary, transactions, txColumns, gymName = 'GemaSystem', subtitle = '' }) {
  const d = prepare(summary, transactions)
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm' })
  const pageW = 210, pageH = 297, margin = 14
  let curY = 0

  function drawPageHeader() {
    doc.setFillColor(...C.brand)
    doc.rect(0, 0, pageW, 28, 'F')
    doc.setFillColor(C.brand[0] - 20, C.brand[1] - 20, C.brand[2] - 20)
    doc.rect(0, 0, pageW, 4, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.setTextColor(...C.white)
    doc.text(gymName, margin, 14)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(220, 220, 255)
    doc.text('REPORTE FINANCIERO COMPLETO', margin, 21)
    doc.setFontSize(7)
    doc.setTextColor(200, 200, 245)
    doc.text(`${dateLong()}, ${timeNow()}`, pageW - margin, 13, { align: 'right' })
    if (subtitle) doc.text(subtitle, pageW - margin, 18, { align: 'right' })
    curY = 36
  }
  function ensureSpace(h) {
    if (curY + h > pageH - 16) { doc.addPage(); curY = 14 }
  }
  function sectionHeader(text) {
    ensureSpace(14)
    doc.setFillColor(...C.brandDark)
    doc.roundedRect(margin, curY, pageW - margin * 2, 8.5, 1.2, 1.2, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9.5)
    doc.setTextColor(...C.white)
    doc.text(text, margin + 3, curY + 5.8)
    curY += 13
  }
  function addImageBlock(dataUrl, wPx, hPx, x) {
    const wMM = wPx * 0.264583, hMM = hPx * 0.264583
    const scale = Math.min(1, (pageW - margin * 2) / wMM)
    const w = wMM * scale, h = hMM * scale
    ensureSpace(h + 4)
    doc.addImage(dataUrl, 'PNG', x ?? margin, curY, w, h)
    curY += h + 6
  }

  drawPageHeader()

  // ── Section: Resumen ──────────────────────────────────────────────────
  sectionHeader('RESUMEN GENERAL')
  const kpis = [
    ['Total histórico', money(d.kpis.total)],
    ['Este mes', money(d.kpis.this_month)],
    ['Mes anterior', money(d.kpis.last_month)],
    ['Este año', money(d.kpis.this_year)],
    ['Transacciones', String(d.kpis.total_tx ?? 0)],
    ['Promedio / transacción', money(d.kpis.avg_amount)],
  ]
  const cardW = (pageW - margin * 2 - 3 * 3) / 3
  kpis.forEach((k, i) => {
    const col = i % 3, row = Math.floor(i / 3)
    const x = margin + col * (cardW + 3)
    const y = curY + row * 16
    doc.setFillColor(...C.rowAlt)
    doc.setDrawColor(...C.lightGray)
    doc.roundedRect(x, y, cardW, 13.5, 1.5, 1.5, 'FD')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.8)
    doc.setTextColor(...C.gray)
    doc.text(k[0], x + cardW / 2, y + 4.8, { align: 'center' })
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...C.dark)
    doc.text(k[1], x + cardW / 2, y + 10.3, { align: 'center' })
  })
  curY += Math.ceil(kpis.length / 3) * 16 + 4

  const barMonths = barChartPNG({
    points: d.months.map(m => ({ label: m.label, value: m.total })),
    color: '#6366F1', width: 700, height: 300, title: 'Ingresos por mes (últimos 12 meses)', valueFormatter: moneyShort,
  })
  addImageBlock(barMonths.dataUrl, barMonths.width, barMonths.height)

  const donutSource = donutChartPNG({
    slices: d.bySource.map(s => ({ label: s.label, value: s.total, color: s.color })),
    width: 560, height: 300, title: 'Ingresos por origen', centerLabel: moneyShort(d.sourceTotal), valueFormatter: money,
  })
  addImageBlock(donutSource.dataUrl, donutSource.width, donutSource.height)

  // ── Section: Por mes ──────────────────────────────────────────────────
  sectionHeader('DESGLOSE POR MES')
  autoTable(doc, {
    startY: curY,
    head: [['Mes', 'Total (MXN)', '% del total']],
    body: d.months.map(m => [m.label, money(m.total), pct(m.total, d.monthsTotal)]),
    foot: [['TOTAL', money(d.monthsTotal), '100%']],
    theme: 'grid',
    styles: { fontSize: 7.5, cellPadding: 2.5, lineColor: C.lightGray, lineWidth: 0.15, textColor: C.dark },
    headStyles: { fillColor: C.brand, textColor: C.white, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: C.rowAlt },
    footStyles: { fillColor: [240, 242, 255], textColor: C.brandDark, fontStyle: 'bold' },
    columnStyles: { 1: { halign: 'right', fontStyle: 'bold' }, 2: { halign: 'center' } },
    margin: { left: margin, right: margin },
  })
  curY = doc.lastAutoTable.finalY + 8

  // ── Section: Por origen ───────────────────────────────────────────────
  sectionHeader('DESGLOSE POR ORIGEN')
  autoTable(doc, {
    startY: curY,
    head: [['Origen', 'Total (MXN)', '% del total']],
    body: d.bySource.map(s => [s.label, money(s.total), pct(s.total, d.sourceTotal)]),
    foot: [['TOTAL', money(d.sourceTotal), '100%']],
    theme: 'grid',
    styles: { fontSize: 7.5, cellPadding: 2.5, lineColor: C.lightGray, lineWidth: 0.15, textColor: C.dark },
    headStyles: { fillColor: C.brand, textColor: C.white, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: C.rowAlt },
    footStyles: { fillColor: [240, 242, 255], textColor: C.brandDark, fontStyle: 'bold' },
    columnStyles: { 1: { halign: 'right', fontStyle: 'bold' }, 2: { halign: 'center' } },
    margin: { left: margin, right: margin },
  })
  curY = doc.lastAutoTable.finalY + 8

  // ── Section: Por método de pago ───────────────────────────────────────
  sectionHeader('DESGLOSE POR MÉTODO DE PAGO')
  autoTable(doc, {
    startY: curY,
    head: [['Método', 'Transacciones', 'Total (MXN)', 'Promedio', '% del total']],
    body: d.byMethod.map(m => [m.label, String(m.count), money(m.total), money(m.avg), pct(m.total, d.methodTotal)]),
    foot: [['TOTAL', String(d.byMethod.reduce((a, m) => a + m.count, 0)), money(d.methodTotal), '', '100%']],
    theme: 'grid',
    styles: { fontSize: 7.5, cellPadding: 2.5, lineColor: C.lightGray, lineWidth: 0.15, textColor: C.dark },
    headStyles: { fillColor: C.brand, textColor: C.white, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: C.rowAlt },
    footStyles: { fillColor: [240, 242, 255], textColor: C.brandDark, fontStyle: 'bold' },
    columnStyles: { 1: { halign: 'center' }, 2: { halign: 'right', fontStyle: 'bold' }, 3: { halign: 'right' }, 4: { halign: 'center' } },
    margin: { left: margin, right: margin },
  })
  curY = doc.lastAutoTable.finalY + 8

  // ── Section: Historial de socios ──────────────────────────────────────
  if (d.memberHistory.length > 0) {
    doc.addPage()
    curY = 14
    sectionHeader(`HISTORIAL DE GASTOS POR SOCIO (${d.memberHistory.length})`)

    if (d.byConcept.length > 0) {
      const pieConcept = pieChartPNG({
        slices: d.byConcept.map(c => ({ label: c.concept, value: c.total, color: c.color })),
        width: 560, height: 300, title: 'Qué genera más ingresos (por concepto)', valueFormatter: money,
      })
      addImageBlock(pieConcept.dataUrl, pieConcept.width, pieConcept.height)
    }

    autoTable(doc, {
      startY: curY,
      head: [['#', 'Socio', 'Código', 'Transacciones', 'Total (MXN)', 'Ticket promedio']],
      body: d.memberHistory.map((m, i) => [String(i + 1), m.member, m.code, String(m.count), money(m.total), money(m.avg)]),
      foot: [['', 'TOTAL', '', String(d.memberHistory.reduce((a, m) => a + m.count, 0)), money(d.memberHistoryTotal), '']],
      theme: 'grid',
      styles: { fontSize: 7.5, cellPadding: 2.5, lineColor: C.lightGray, lineWidth: 0.15, textColor: C.dark },
      headStyles: { fillColor: C.brand, textColor: C.white, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: C.rowAlt },
      footStyles: { fillColor: [240, 242, 255], textColor: C.brandDark, fontStyle: 'bold' },
      columnStyles: { 0: { halign: 'center' }, 1: { fontStyle: 'bold' }, 3: { halign: 'center' }, 4: { halign: 'right', fontStyle: 'bold', textColor: C.brand }, 5: { halign: 'right' } },
      margin: { left: margin, right: margin },
      didParseCell: data => {
        if (data.section === 'body' && d.memberHistory[data.row.index]?.unlinked && data.column.index === 1) {
          data.cell.styles.fontStyle = 'italic'
          data.cell.styles.textColor = C.gray
        }
      },
    })
    curY = doc.lastAutoTable.finalY + 8
  }

  // ── Section: Detalle de transacciones ────────────────────────────────
  doc.addPage()
  curY = 14
  sectionHeader(`DETALLE DE TRANSACCIONES (${d.transactions.length})`)
  const amountIdxs = txColumns.map((c, i) => (/monto|mxn/i.test(c.header) ? i : -1)).filter(i => i >= 0)
  const colStyles = { 0: { fontStyle: 'bold', textColor: C.dark } }
  amountIdxs.forEach(i => { colStyles[i] = { halign: 'right', fontStyle: 'bold', textColor: C.brand } })
  const footRow = amountIdxs.length > 0
    ? [txColumns.map((c, i) => {
        if (i === 0) return 'TOTAL'
        if (!amountIdxs.includes(i)) return ''
        const sum = d.transactions.reduce((acc, r) => acc + (parseFloat(c.value(r)) || 0), 0)
        return new Intl.NumberFormat('es-MX', { minimumFractionDigits: 2 }).format(sum)
      })]
    : undefined
  autoTable(doc, {
    startY: curY,
    head: [txColumns.map(c => c.header)],
    body: d.transactions.map(row => txColumns.map(c => c.value(row))),
    ...(footRow ? { foot: footRow } : {}),
    theme: 'grid',
    styles: { fontSize: 6.8, cellPadding: 2, overflow: 'linebreak', lineColor: C.lightGray, lineWidth: 0.15, textColor: C.dark },
    headStyles: { fillColor: C.brand, textColor: C.white, fontStyle: 'bold', fontSize: 6.8 },
    alternateRowStyles: { fillColor: C.rowAlt },
    footStyles: { fillColor: [240, 242, 255], textColor: C.brand, fontStyle: 'bold', fontSize: 6.8 },
    columnStyles: colStyles,
    margin: { left: margin, right: margin, bottom: 16 },
    rowPageBreak: 'avoid',
    didDrawPage: ({ pageNumber }) => {
      const total = doc.internal.getNumberOfPages()
      doc.setDrawColor(...C.lightGray)
      doc.setLineWidth(0.3)
      doc.line(margin, pageH - 12, pageW - margin, pageH - 12)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(6.5)
      doc.setTextColor(...C.gray)
      doc.text(`Generado por ${gymName} · ${dateLong()} ${timeNow()}`, margin, pageH - 8)
      doc.text(`Página ${pageNumber} de ${total}`, pageW - margin, pageH - 8, { align: 'right' })
    },
  })

  return { kind: 'pdf', doc, filename: `finanzas_desglose_${dateSuffix()}.pdf` }
}
