import { useState, useRef, useEffect } from 'react'
import { Download, FileSpreadsheet, FileText, ChevronDown, Loader2 } from 'lucide-react'

export default function ExportMenu({ onExportExcel, onExportPDF, loading = false }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function close(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        disabled={loading}
        className="btn-secondary flex items-center gap-2 disabled:opacity-60"
      >
        {loading
          ? <Loader2 className="w-4 h-4 animate-spin" />
          : <Download className="w-4 h-4" />
        }
        Exportar
        <ChevronDown className={`w-3 h-3 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xl z-30 overflow-hidden min-w-[168px]">
          <div className="px-3 py-2 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Formato</p>
          </div>
          <button
            onClick={() => { onExportExcel(); setOpen(false) }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>Excel <span className="text-xs text-gray-400">(.xlsx)</span></span>
          </button>
          <button
            onClick={() => { onExportPDF(); setOpen(false) }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-red-50 hover:text-red-700 transition-colors"
          >
            <FileText className="w-4 h-4 text-red-500 flex-shrink-0" />
            <span>PDF</span>
          </button>
        </div>
      )}
    </div>
  )
}
