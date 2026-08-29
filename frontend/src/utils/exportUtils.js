import ExcelJS from 'exceljs'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { dateSuffix, dateLong, timeNow, C, HEX, isAmountCol, isNumericCol } from './exportShared'

// ─────────────────────────────────────────────────────────────────────────────
// EXCEL — built with ExcelJS so real styling (bold, fills, borders) is honored.
// ─────────────────────────────────────────────────────────────────────────────
export async function exportToExcel(rows, columns, filename, opts = {}) {
  const { title = 'Reporte', gymName = 'GemaSystem', subtitle = '' } = opts

  const wb = new ExcelJS.Workbook()
  wb.creator = gymName
  wb.created = new Date()

  const sheetName = title.slice(0, 31).replace(/[:\\/?*[\]]/g, '') || 'Reporte'
  const ws = wb.addWorksheet(sheetName, { views: [{ showGridLines: false }] })

  const ncols = columns.length
  const amountIdxs = columns
    .map((c, i) => (isAmountCol(c.header) ? i : -1))
    .filter(i => i >= 0)

  const thin = { style: 'thin', color: { argb: HEX.lightGray } }
  const borderAll = { top: thin, left: thin, bottom: thin, right: thin }

  // ── Column widths ─────────────────────────────────────────────────────────
  ws.columns = columns.map(c => {
    const maxLen = rows.reduce((m, r) => Math.max(m, String(c.value(r) ?? '').length), c.header.length)
    return { width: Math.min(Math.max(maxLen + 3, 12), 40) }
  })

  // ── Cover block ───────────────────────────────────────────────────────────
  let r = 1

  ws.mergeCells(r, 1, r, ncols)
  ws.getRow(r).height = 28
  const gymCell = ws.getCell(r, 1)
  gymCell.value = gymName
  gymCell.font = { bold: true, size: 16, color: { argb: HEX.white } }
  gymCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
  gymCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEX.brand } }
  r++

  ws.mergeCells(r, 1, r, ncols)
  ws.getRow(r).height = 22
  const titleCell = ws.getCell(r, 1)
  titleCell.value = title
  titleCell.font = { bold: true, size: 13, color: { argb: HEX.dark } }
  titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEX.rowAlt } }
  r++

  if (subtitle) {
    ws.mergeCells(r, 1, r, ncols)
    const subCell = ws.getCell(r, 1)
    subCell.value = subtitle
    subCell.font = { italic: true, size: 10, color: { argb: HEX.gray } }
    subCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
    r++
  }

  ws.mergeCells(r, 1, r, ncols)
  const genCell = ws.getCell(r, 1)
  genCell.value = `Generado el ${dateLong()}, ${timeNow()}`
  genCell.font = { size: 9.5, color: { argb: HEX.gray } }
  genCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
  r++

  ws.mergeCells(r, 1, r, ncols)
  const countCell = ws.getCell(r, 1)
  countCell.value = `Total de registros: ${rows.length}`
  countCell.font = { bold: true, size: 9.5, color: { argb: HEX.dark } }
  countCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
  r++

  r++ // spacer row

  // ── Header row ────────────────────────────────────────────────────────────
  const headerRowNum = r
  const headerRow = ws.getRow(headerRowNum)
  headerRow.height = 22
  columns.forEach((c, i) => {
    const cell = headerRow.getCell(i + 1)
    cell.value = c.header
    cell.font = { bold: true, size: 10, color: { argb: HEX.white } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEX.brandDark } }
    cell.alignment = { vertical: 'middle', horizontal: isAmountCol(c.header) || isNumericCol(c.header) ? 'center' : 'left', indent: 1 }
    cell.border = borderAll
  })
  r++

  // ── Data rows ─────────────────────────────────────────────────────────────
  rows.forEach((row, ri) => {
    const excelRow = ws.getRow(r)
    columns.forEach((c, ci) => {
      const raw = c.value(row)
      const num = parseFloat(raw)
      const cell = excelRow.getCell(ci + 1)
      const isAmount = isAmountCol(c.header)
      const isNumeric = isNumericCol(c.header)

      if (isAmount && !isNaN(num)) {
        cell.value = num
        cell.numFmt = '#,##0.00'
      } else {
        cell.value = raw ?? '—'
      }

      cell.font = ci === 0
        ? { bold: true, size: 10, color: { argb: HEX.dark } }
        : { size: 10, color: { argb: isAmount ? HEX.brandDark : HEX.dark } }

      cell.alignment = { vertical: 'middle', horizontal: (isAmount || isNumeric) ? 'center' : 'left', indent: ci === 0 ? 1 : 0 }
      cell.border = borderAll
      if (ri % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEX.rowAlt } }
      }
    })
    r++
  })

  // ── Totals row (amount columns) ───────────────────────────────────────────
  if (amountIdxs.length > 0) {
    const totalsRow = ws.getRow(r)
    totalsRow.height = 20
    for (let ci = 1; ci <= ncols; ci++) {
      const cell = totalsRow.getCell(ci)
      cell.border = { top: { style: 'medium', color: { argb: HEX.brand } } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEX.totalsBg } }
      cell.font = { bold: true, size: 10, color: { argb: HEX.brandDark } }
    }
    totalsRow.getCell(1).value = 'TOTAL'
    totalsRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
    amountIdxs.forEach(i => {
      const sum = rows.reduce((acc, row) => {
        const n = parseFloat(columns[i].value(row))
        return acc + (isNaN(n) ? 0 : n)
      }, 0)
      const cell = totalsRow.getCell(i + 1)
      cell.value = sum
      cell.numFmt = '#,##0.00'
      cell.alignment = { vertical: 'middle', horizontal: 'center' }
    })
    r++
  }

  // ── Freeze panes below header ────────────────────────────────────────────
  ws.views = [{ state: 'frozen', ySplit: headerRowNum, showGridLines: false }]

  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  return { kind: 'excel', blob, filename: `${filename}_${dateSuffix()}.xlsx` }
}

// ─────────────────────────────────────────────────────────────────────────────
// PDF
// ─────────────────────────────────────────────────────────────────────────────
export function exportToPDF(rows, columns, filename, opts = {}) {
  const {
    title    = 'Reporte',
    gymName  = 'GemaSystem',
    subtitle = '',
    accent   = C.brand,
  } = opts

  const landscape = columns.length > 5
  const doc = new jsPDF({ orientation: landscape ? 'landscape' : 'portrait', unit: 'mm' })
  const pageW  = landscape ? 297 : 210
  const pageH  = landscape ? 210 : 297
  const margin = 14

  // ── Header bar ────────────────────────────────────────────────────────────
  doc.setFillColor(...accent)
  doc.rect(0, 0, pageW, 32, 'F')

  // Subtle dark stripe at top + a hairline seam under the bar for a flatter,
  // more deliberate edge than a plain solid block.
  doc.setFillColor(accent[0] - 20, accent[1] - 20, accent[2] - 20)
  doc.rect(0, 0, pageW, 4, 'F')
  doc.setDrawColor(accent[0] - 30, accent[1] - 30, accent[2] - 30)
  doc.setLineWidth(0.3)
  doc.line(0, 32, pageW, 32)

  // Gym name
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.setTextColor(...C.white)
  doc.text(gymName, margin, 15)

  // Report title
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(220, 220, 255)
  doc.text(title.toUpperCase(), margin, 23)

  // Date — right side
  doc.setFontSize(7.5)
  doc.setTextColor(200, 200, 245)
  doc.text(`${dateLong()}`, pageW - margin, 14, { align: 'right' })
  doc.text(`${timeNow()}`, pageW - margin, 20, { align: 'right' })

  let curY = 40

  // ── Stats bar ─────────────────────────────────────────────────────────────
  const amountCols = columns.filter(c => isAmountCol(c.header))
  const statsItems = [{ label: 'Registros', value: String(rows.length) }]

  amountCols.forEach(col => {
    const sum = rows.reduce((acc, r) => {
      const n = parseFloat(col.value(r)); return acc + (isNaN(n) ? 0 : n)
    }, 0)
    statsItems.push({
      label: `Total ${col.header.replace(/\s*\(MXN\)/, '')}`,
      value: new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 }).format(sum),
    })
  })

  if (subtitle) statsItems.push({ label: 'Filtro', value: subtitle })

  // Draw stats cards
  const cardW    = (pageW - margin * 2 - (statsItems.length - 1) * 3) / Math.min(statsItems.length, 4)
  const maxCards = Math.min(statsItems.length, 4)

  for (let i = 0; i < maxCards; i++) {
    const x = margin + i * (cardW + 3)
    doc.setFillColor(...C.rowAlt)
    doc.setDrawColor(...C.lightGray)
    doc.roundedRect(x, curY, cardW, 13, 1.5, 1.5, 'FD')
    // Thin accent tick on the left edge of each card for a touch of color
    doc.setFillColor(...accent)
    doc.roundedRect(x, curY, 1.4, 13, 0.7, 0.7, 'F')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    doc.setTextColor(...C.gray)
    doc.text(statsItems[i].label, x + cardW / 2, curY + 4.5, { align: 'center' })
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(...C.dark)
    doc.text(statsItems[i].value, x + cardW / 2, curY + 10, { align: 'center' })
  }

  curY += 19

  // ── Table ─────────────────────────────────────────────────────────────────
  const amountColIdxs = columns
    .map((c, i) => isAmountCol(c.header) ? i : -1)
    .filter(i => i >= 0)
  const numericColIdxs = columns
    .map((c, i) => (isNumericCol(c.header) || isAmountCol(c.header)) ? i : -1)
    .filter(i => i >= 0)

  const colStyles = {
    // The first column is always the row's primary/identifying field
    // (name, member, etc.) — bold it so it reads as the anchor of the row.
    0: { fontStyle: 'bold', textColor: C.dark },
  }
  amountColIdxs.forEach(i => {
    colStyles[i] = { halign: 'right', fontStyle: 'bold', textColor: accent }
  })
  numericColIdxs.filter(i => !amountColIdxs.includes(i)).forEach(i => {
    colStyles[i] = { ...colStyles[i], halign: 'center' }
  })

  // Compute totals for foot row
  const footRow = amountColIdxs.length > 0
    ? [columns.map((c, i) => {
        if (i === 0) return 'TOTAL'
        if (!amountColIdxs.includes(i)) return ''
        const sum = rows.reduce((acc, r) => {
          const n = parseFloat(c.value(r)); return acc + (isNaN(n) ? 0 : n)
        }, 0)
        return new Intl.NumberFormat('es-MX', { minimumFractionDigits: 2 }).format(sum)
      })]
    : undefined

  autoTable(doc, {
    startY: curY,
    head: [columns.map(c => c.header)],
    body: rows.map(row => columns.map(c => c.value(row))),
    ...(footRow ? { foot: footRow } : {}),
    theme: 'grid',
    styles: {
      fontSize: 7.5,
      cellPadding: { top: 3, bottom: 3, left: 4, right: 4 },
      overflow: 'linebreak',
      lineColor: C.lightGray,
      lineWidth: 0.15,
      textColor: C.dark,
      font: 'helvetica',
    },
    headStyles: {
      fillColor: accent,
      textColor: C.white,
      fontStyle: 'bold',
      fontSize: 7.5,
      cellPadding: { top: 4, bottom: 4, left: 4, right: 4 },
    },
    alternateRowStyles: { fillColor: C.rowAlt },
    footStyles: {
      fillColor: [240, 242, 255],
      textColor: accent,
      fontStyle: 'bold',
      fontSize: 7.5,
    },
    columnStyles: colStyles,
    margin: { left: margin, right: margin, bottom: 16 },
    rowPageBreak: 'avoid',
    didDrawPage: ({ pageNumber }) => {
      const total = doc.internal.getNumberOfPages()
      // Footer line
      doc.setDrawColor(...C.lightGray)
      doc.setLineWidth(0.3)
      doc.line(margin, pageH - 12, pageW - margin, pageH - 12)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(6.5)
      doc.setTextColor(...C.gray)
      doc.text(`Generado por GemaSystem · ${dateLong()} ${timeNow()}`, margin, pageH - 8)
      doc.text(`Página ${pageNumber} de ${total}`, pageW - margin, pageH - 8, { align: 'right' })
    },
  })

  return { kind: 'pdf', doc, filename: `${filename}_${dateSuffix()}.pdf` }
}
