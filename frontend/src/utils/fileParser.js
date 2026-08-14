import * as XLSX from 'xlsx'

// Values our own report exports (and many spreadsheets) use to mean "no data".
const EMPTY_TOKENS = new Set(['—', '-', '–', 'n/a', 'na', 'null'])

function cleanValue(v) {
  if (v === null || v === undefined) return ''
  const str = String(v).trim()
  return EMPTY_TOKENS.has(str.toLowerCase()) ? '' : v
}

// Real-world exports (including this app's own "Exportar" reports) often have
// title/date/summary rows before the actual column headers. Instead of always
// assuming row 1 is the header, pick the row with the most non-empty cells
// within the first ~25 rows — metadata rows are usually a single cell, while
// the real header row has one cell per column, same as the data below it.
function findHeaderRowIndex(rows) {
  let bestIdx   = 0
  let bestCount = -1
  const maxScan = Math.min(rows.length, 25)

  for (let i = 0; i < maxScan; i++) {
    const nonEmpty = (rows[i] ?? []).filter(c => c !== '' && c !== null && c !== undefined).length
    if (nonEmpty > bestCount) {
      bestCount = nonEmpty
      bestIdx = i
    }
  }
  return bestIdx
}

function rowsToRecords(rows) {
  const headerIdx  = findHeaderRowIndex(rows)
  const rawHeader  = rows[headerIdx] ?? []

  const seen = new Map()
  const headers = rawHeader.map((h, i) => {
    let name = String(h ?? '').trim() || `Columna ${i + 1}`
    const count = seen.get(name) ?? 0
    seen.set(name, count + 1)
    return count > 0 ? `${name} (${count + 1})` : name
  })

  const records = []
  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r] ?? []

    const isBlank = row.every(c => c === '' || c === null || c === undefined)
    if (isBlank) continue

    // Skip synthetic summary rows some reports append (e.g. a trailing "TOTAL" row).
    if (String(row[0] ?? '').trim().toUpperCase() === 'TOTAL') continue

    const record = {}
    headers.forEach((h, i) => { record[h] = cleanValue(row[i]) })
    records.push(record)
  }
  return records
}

export async function parseFile(file) {
  const ext = file.name.split('.').pop().toLowerCase()

  let wb
  if (ext === 'csv') {
    const text = await file.text()
    wb = XLSX.read(text, { type: 'string' })
  } else if (['xlsx', 'xls', 'ods'].includes(ext)) {
    const buf = await file.arrayBuffer()
    wb = XLSX.read(buf)
  } else {
    throw new Error('Formato no soportado. Usa Excel (.xlsx, .xls), CSV o LibreOffice Calc (.ods).')
  }

  const ws   = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
  return rowsToRecords(rows)
}
