// Shared helpers for the "last N months" trend charts used across
// Members/Memberships/Finances/Visits/Products.

// Members/Memberships/Finances/Visits each chart a fixed "last 12 months"
// series (Products uses 6). For a gym whose whole history is the current
// month (the common case right after signup, or for the seeded demo
// account), that leaves every other bucket at zero and a single bar
// stranded at the far-right edge — reads as a broken/empty chart rather
// than a real trend. There's nothing to trend on fewer than two non-zero
// buckets, so callers should show an empty state instead of the chart.
export function isSparseTrend(data, key = 'count') {
  if (!Array.isArray(data)) return false
  return data.filter(d => Number(d?.[key]) > 0).length <= 1
}

// A gym whose real history only spans, say, the last 7 of the fixed 12-month
// window ends up with 5 empty leading buckets — every real bar gets
// stranded/bunched against the right edge instead of spread across the
// chart. Trims those always-zero leading months off, but never below
// `minMonths` so a chart with real (if recent) data doesn't collapse to a
// single bar either.
export function trimLeadingEmpty(data, key = 'count', minMonths = 6) {
  if (!Array.isArray(data) || data.length <= minMonths) return data
  const firstActive = data.findIndex(d => Number(d?.[key]) > 0)
  if (firstActive <= 0) return data
  const start = Math.min(firstActive, data.length - minMonths)
  return data.slice(start)
}
