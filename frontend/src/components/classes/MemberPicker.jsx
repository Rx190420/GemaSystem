import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, X, Loader2 } from 'lucide-react'
import api from '../../api/axios'

export default function MemberPicker({ value, onChange, placeholder = 'Buscar por nombre o DYM-XXXX...' }) {
  const [q, setQ] = useState('')

  const { data: members = [], isFetching } = useQuery({
    queryKey: ['member-picker-search', q],
    queryFn: () => api.get('/members/search', { params: { q } }).then(r => r.data),
    enabled: q.length >= 2,
  })

  if (value) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-xl bg-violet-50 border border-violet-100">
        <div className="w-9 h-9 rounded-full bg-violet-200 flex items-center justify-center text-violet-800 font-bold text-sm flex-shrink-0">
          {value.first_name?.[0]}{value.last_name?.[0]}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 text-sm truncate">{value.first_name} {value.last_name}</p>
          {value.member_code && <p className="text-xs font-mono text-violet-500">{value.member_code}</p>}
        </div>
        <button type="button" onClick={() => onChange(null)} className="text-gray-400 hover:text-gray-600">
          <X className="w-4 h-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
      <input
        value={q}
        onChange={e => setQ(e.target.value)}
        placeholder={placeholder}
        className="input pl-9"
      />
      {isFetching && (
        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300 animate-spin" />
      )}
      {members.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10 max-h-44 overflow-y-auto">
          {members.map(m => (
            <button
              key={m.id}
              type="button"
              onClick={() => { onChange(m); setQ('') }}
              className="w-full text-left px-3 py-2.5 hover:bg-gray-50 flex items-center gap-3"
            >
              <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 text-xs font-bold flex-shrink-0">
                {m.first_name[0]}{m.last_name[0]}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">{m.first_name} {m.last_name}</p>
                <p className="text-xs text-gray-400">{m.member_code ?? m.email ?? '—'}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
