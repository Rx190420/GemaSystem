import { useState } from 'react'
import { Plus, Check, X, Loader2 } from 'lucide-react'

/**
 * Chip/pill selector that replaces <input list> + <datalist>.
 *
 * Props:
 *   options    – array of { id, name } or strings
 *   value      – currently selected value (string)
 *   onChange   – (name: string) => void
 *   onAdd      – async (name: string) => void  — called when user creates a new chip
 *                omit to hide the "+ Nueva" button
 *   allowNone  – show a "Ninguna" chip (value becomes '')
 *   subLabel   – (opt) => string | null  — extra text shown inside the chip (e.g. "-20%")
 *   placeholder– placeholder text inside the inline add input
 */
export default function ChipSelect({
  options = [],
  value,
  onChange,
  onAdd,
  allowNone = false,
  subLabel,
  placeholder = 'Nueva opción...',
}) {
  const [adding, setAdding]   = useState(false)
  const [inputVal, setInput]  = useState('')
  const [saving, setSaving]   = useState(false)

  async function handleAdd() {
    const name = inputVal.trim()
    if (!name) return
    setSaving(true)
    try {
      await onAdd(name)
      setInput('')
      setAdding(false)
    } finally {
      setSaving(false)
    }
  }

  function getLabel(opt) {
    return typeof opt === 'string' ? opt : opt.name
  }

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {allowNone && (
        <button
          type="button"
          onClick={() => onChange('')}
          className={`px-3 py-1.5 rounded-full border-2 text-xs font-medium transition-all
            ${!value
              ? 'border-gray-500 bg-gray-100 text-gray-800'
              : 'border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600'}`}
        >
          Ninguna
        </button>
      )}

      {options.map(opt => {
        const label = getLabel(opt)
        const sub   = subLabel ? subLabel(opt) : null
        const sel   = value === label
        const color = typeof opt === 'object' ? opt.color : null

        return (
          <button
            type="button"
            key={typeof opt === 'string' ? opt : opt.id}
            onClick={() => onChange(label)}
            className={`px-3 py-1.5 rounded-full border-2 text-xs font-medium transition-all flex items-center gap-1
              ${color ? '' : sel
                ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:text-gray-800'}`}
            style={color ? {
              borderColor: sel ? color : `color-mix(in srgb, ${color} 35%, transparent)`,
              background: sel ? `color-mix(in srgb, ${color} 14%, transparent)` : 'transparent',
              color: sel ? color : `color-mix(in srgb, ${color} 75%, #6B7280)`,
            } : undefined}
          >
            {color && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />}
            {sel && <Check className="w-3 h-3 flex-shrink-0" strokeWidth={3} />}
            {label}
            {sub && <span className="opacity-60 ml-0.5">{sub}</span>}
          </button>
        )
      })}

      {adding ? (
        <div className="flex items-center gap-1">
          <input
            autoFocus
            value={inputVal}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); handleAdd() }
              if (e.key === 'Escape') { setAdding(false); setInput('') }
            }}
            placeholder={placeholder}
            className="h-8 px-3 text-xs rounded-full border-2 border-indigo-300 focus:border-indigo-500 outline-none w-40 transition-colors"
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={saving || !inputVal.trim()}
            className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-700 transition-colors disabled:opacity-40"
          >
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
          </button>
          <button
            type="button"
            onClick={() => { setAdding(false); setInput('') }}
            className="w-8 h-8 rounded-full border-2 border-gray-200 text-gray-400 flex items-center justify-center hover:border-gray-300 transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ) : (
        onAdd && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="px-3 py-1.5 rounded-full border-2 border-dashed border-gray-300 text-gray-400 text-xs font-medium hover:border-indigo-300 hover:text-indigo-500 transition-all flex items-center gap-1"
          >
            <Plus className="w-3 h-3" /> Nueva
          </button>
        )
      )}
    </div>
  )
}
