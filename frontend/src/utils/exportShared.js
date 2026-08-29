// Shared building blocks for the Excel/PDF exporters (exportUtils.js and
// financeExportUtils.js) — date formatting, the brand palette in both the
// RGB-array form jsPDF wants and the ARGB-hex form ExcelJS wants, and the
// small helpers used to detect amount/numeric columns and trigger a browser
// download from an in-memory Blob.

export const dateSuffix = () => new Date().toISOString().slice(0, 10)
export const dateLong   = () => new Date().toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
export const timeNow    = () => new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })

// Colors (RGB arrays) — used by the PDF (jsPDF wants arrays)
export const C = {
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

// Same palette as ARGB hex — used by Excel (ExcelJS wants "FFRRGGBB" strings)
export const HEX = {
  brand:     'FF6366F1',
  brandDark: 'FF4338CA',
  dark:      'FF0F172A',
  gray:      'FF64748B',
  lightGray: 'FFE2E8F0',
  rowAlt:    'FFF8FAFC',
  totalsBg:  'FFEEF0FF',
  white:     'FFFFFFFF',
  emerald:   'FF10B981',
  amber:     'FFF59E0B',
}

// Detect amount / numeric columns by header keyword
export const isAmountCol  = h => /monto|precio|amount|mxn/i.test(h)
export const isNumericCol = h => /días|visitas|cantidad|num/i.test(h)

export function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

// Every exportTo*() builder below returns a { kind, filename, blob|doc }
// descriptor instead of saving immediately, so the <ExportOverlay/> can hold
// the finished file until its animation is ready and only then hand it to
// the browser — this is the actual "point of no return" for a download.
export function saveExportResult(result) {
  if (!result) return
  if (result.kind === 'pdf') result.doc.save(result.filename)
  else triggerDownload(result.blob, result.filename)
}
