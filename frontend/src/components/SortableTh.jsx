import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'

/**
 * <th> with a click-to-sort arrow, for use with the useSort hook.
 * Pass sortKey=null for a column that shouldn't be sortable (renders plain).
 */
export default function SortableTh({ children, sortKey, sort, onSort, className = '', align = 'left' }) {
  if (!sortKey) return <th className={className}>{children}</th>

  const active = sort?.by === sortKey
  const dir = active ? sort.dir : null

  return (
    <th className={className}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 hover:text-gray-700 transition-colors ${active ? 'text-gray-700' : ''} ${align === 'right' ? 'flex-row-reverse' : ''}`}
      >
        {children}
        {active
          ? (dir === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-indigo-600" /> : <ChevronDown className="w-3.5 h-3.5 text-indigo-600" />)
          : <ChevronsUpDown className="w-3.5 h-3.5 text-gray-300" />}
      </button>
    </th>
  )
}
