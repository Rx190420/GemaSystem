import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// ── Helpers ───────────────────────────────────────────────────────────────────
const dateSuffix = () => new Date().toISOString().slice(0, 10)
const dateLong   = () => new Date().toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
const timeNow    = () => new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })

// Colors (RGB arrays)
const C = {
  brand:    [99,  102, 241],   // indigo-500
  brandDark:[67,  56,  202],   // indigo-700
  dark:     [15,  23,  42],    // slate-900
  gray:     [100, 116, 139],   // slate-500
  lightGray:[226, 232, 240],   // slate-200
  rowAlt:   [248, 250, 252],   // slate-50
  white:    [255, 255, 255],
  emerald:  [16,  185, 129],   // emerald-500
  amber:    [245, 158, 11],    // amber-500
}

// Detect amount columns by header keyword
const isAmountCol = h => /monto|precio|amount|mxn/i.test(h)
const isNumericCol = h => /días|visitas|cantidad|num/i.test(h)

// ─────────────────────────────────────────────────────────────────────────────
// EXCEL
// ─────────────────────────────────────────────────────────────────────────────
export function exportToExcel(rows, columns, filename, opts = {}) {
  const { title = 'Reporte', gymName = 'GemaSystem', subtitle = '' } = opts

  const wb   = XLSX.utils.book_new()
  const aoa  = []  // array-of-arrays

  const ncols = columns.length

  // ── Cover block ───────────────────────────────────────────────────────────
  aoa.push([gymName])
  aoa.push([title])
  if (subtitle) aoa.push([subtitle])
  aoa.push([`Fecha de generación: ${dateLong()} ${timeNow()}`])
  aoa.push([`Total de registros: ${rows.length}`])
  aoa.push([])  // spacer

  const headerRow = aoa.length  // 0-based index of the column header row

  // ── Column headers ────────────────────────────────────────────────────────
  aoa.push(columns.map(c => c.header))

  // ── Data rows ─────────────────────────────────────────────────────────────
  rows.forEach(row => {
    aoa.push(
      columns.map(c => {
        const v = c.value(row)
        const num = parseFloat(v)
        return isAmountCol(c.header) && !isNaN(num) ? num : v
      })
    )
  })

  // ── Totals row (amount columns) ───────────────────────────────────────────
  const amountIdxs = columns
    .map((c, i) => (isAmountCol(c.header) ? i : -1))
    .filter(i => i >= 0)

  if (amountIdxs.length > 0) {
    aoa.push([])
    const totRow = Array(ncols).fill('')
    totRow[0] = 'TOTAL'
    amountIdxs.forEach(i => {
      const sum = rows.reduce((acc, r) => {
        const n = parseFloat(columns[i].value(r))
        return acc + (isNaN(n) ? 0 : n)
      }, 0)
      totRow[i] = sum
    })
    aoa.push(totRow)
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa)

  // ── Column widths ─────────────────────────────────────────────────────────
  const colWidths = columns.map(c => {
    const maxLen = rows.reduce((m, r) => {
      const v = String(c.value(r) ?? '')
      return Math.max(m, v.length)
    }, c.header.length)
    return { wch: Math.min(Math.max(maxLen + 3, 12), 40) }
  })
  ws['!cols'] = colWidths

  // ── Merged cells (title block) ────────────────────────────────────────────
  const merges = []
  for (let r = 0; r < headerRow; r++) {
    if (aoa[r].length > 0 && aoa[r][0] !== '') {
      merges.push({ s: { r, c: 0 }, e: { r, c: ncols - 1 } })
    }
  }
  ws['!merges'] = merges

  // ── Cell number formats ───────────────────────────────────────────────────
  const dataStartRow = headerRow + 1
  rows.forEach((_, ri) => {
    amountIdxs.forEach(ci => {
      const cellAddr = XLSX.utils.encode_cell({ r: dataStartRow + ri, c: ci })
      if (ws[cellAddr] && typeof ws[cellAddr].v === 'number') {
        ws[cellAddr].z = '#,##0.00'
      }
    })
  })

  // ── Freeze header ─────────────────────────────────────────────────────────
  ws['!freeze'] = { xSplit: 0, ySplit: headerRow + 1 }

  const sheetName = title.slice(0, 31).replace(/[:\\/\?*\[\]]/g, '')
  XLSX.utils.book_append_sheet(wb, ws, sheetName || 'Reporte')
  XLSX.writeFile(wb, `${filename}_${dateSuffix()}.xlsx`)
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
  // Gradient-like effect: two rectangles
  doc.setFillColor(...accent)
  doc.rect(0, 0, pageW, 32, 'F')

  // Subtle dark stripe at top
  doc.setFillColor(accent[0] - 20, accent[1] - 20, accent[2] - 20)
  doc.rect(0, 0, pageW, 4, 'F')

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

  const colStyles = {}
  amountColIdxs.forEach(i => {
    colStyles[i] = { halign: 'right', fontStyle: 'bold', textColor: accent }
  })
  numericColIdxs.filter(i => !amountColIdxs.includes(i)).forEach(i => {
    colStyles[i] = { halign: 'center' }
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

  doc.save(`${filename}_${dateSuffix()}.pdf`)
}
