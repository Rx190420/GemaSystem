// Shared money-formatting helpers — used by the checkout/payment UI and
// anywhere else that needs consistent MXN formatting.

export function fmtMXN(val) {
  return `$${parseFloat(val || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function roundUpTo(n, step) {
  return Math.ceil(n / step) * step
}

// Quick cash-received suggestions: the exact amount, plus a few round-number
// bills above it (dedupes anything that collapses onto the exact amount).
export function cashSuggestions(amount) {
  const raw = [amount, roundUpTo(amount, 50), roundUpTo(amount, 100), roundUpTo(amount, 500)]
  return [...new Set(raw)].slice(0, 4)
}
