import { ChevronLeft, ChevronRight } from 'lucide-react'

const PAGE_SIZE_OPTIONS = [12, 24, 48, 96]

/**
 * Shared pagination bar: prev/next arrows plus a "show N per page" selector.
 * Stays visible whenever there's at least one record, so the page-size
 * selector is always reachable — even once everything already fits on one
 * page (e.g. dropping from 24 back to 12 per page should still be possible).
 * `itemLabel` is the plural noun shown next to the total (e.g. "miembros").
 */
export default function Pagination({
  page, lastPage, total, onPageChange, itemLabel = 'resultados', className = 'px-4',
  pageSize, onPageSizeChange, pageSizeOptions = PAGE_SIZE_OPTIONS,
}) {
  if (!total) return null

  return (
    <div className={`flex flex-wrap items-center justify-between gap-2 ${className} py-3 border-t border-gray-100 bg-gray-50/50`}>
      <p className="text-xs text-gray-500">
        {lastPage > 1 ? `Página ${page} de ${lastPage} · ` : ''}{total} {itemLabel}
      </p>
      <div className="flex items-center gap-3">
        {onPageSizeChange && (
          <label className="flex items-center gap-1.5 text-xs text-gray-500">
            Mostrar
            <select
              value={pageSize}
              onChange={e => onPageSizeChange(Number(e.target.value))}
              className="input py-1 px-2 text-xs w-auto"
            >
              {pageSizeOptions.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        )}
        {lastPage > 1 && (
          <div className="flex gap-2">
            <button onClick={() => onPageChange(p => Math.max(1, p - 1))} disabled={page <= 1} className="btn-secondary py-1.5 px-3 disabled:opacity-40">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={() => onPageChange(p => p + 1)} disabled={page >= lastPage} className="btn-secondary py-1.5 px-3 disabled:opacity-40">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
