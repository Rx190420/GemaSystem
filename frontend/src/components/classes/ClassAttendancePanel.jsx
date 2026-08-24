import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  X, Loader2, Users, Search, Calendar, Clock, MapPin, AlertTriangle,
  TrendingUp, Gauge, ChevronDown, CalendarClock, ArrowUpDown,
} from 'lucide-react'
import api from '../../api/axios'
import useLockBodyScroll from '../../hooks/useLockBodyScroll'
import { avatarColor } from '../../utils/avatarColor'
import { classColor } from '../../utils/classColors'

const DIFFICULTY  = { beginner: 'Principiante', intermediate: 'Intermedio', advanced: 'Avanzado' }
const DIFF_BADGE  = { beginner: 'badge-green', intermediate: 'badge-yellow', advanced: 'badge-red' }
const STATUS_BADGE = { active: 'badge-green', inactive: 'badge-gray', suspended: 'badge-red' }
const STATUS_LABEL = { active: 'Activo', inactive: 'Inactivo', suspended: 'Suspendido' }
const DAYS    = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
const DAYS_ES = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo']

const SORTS = [
  { id: 'visits', label: 'Más visitas' },
  { id: 'recent', label: 'Última visita' },
  { id: 'name',   label: 'Nombre A-Z' },
]

function fmtDateTime(raw) {
  return new Date(raw).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtRelative(raw) {
  const days = Math.floor((Date.now() - new Date(raw).getTime()) / 86400000)
  if (days <= 0) return 'Hoy'
  if (days === 1) return 'Ayer'
  if (days < 7) return `Hace ${days} días`
  if (days < 30) return `Hace ${Math.floor(days / 7)} sem.`
  return `Hace ${Math.floor(days / 30)} mes${Math.floor(days / 30) !== 1 ? 'es' : ''}`
}

export default function ClassAttendancePanel({ gymClass, onClose }) {
  useLockBodyScroll()
  const [search, setSearch]         = useState('')
  const [sort, setSort]             = useState('visits')
  const [expandedId, setExpandedId] = useState(null)

  const { data: visits = [], isLoading } = useQuery({
    queryKey: ['class-visits', gymClass.id],
    queryFn: () => api.get('/visits', { params: { class_id: gymClass.id, per_page: 500 } }).then(r => r.data.data ?? []),
  })

  const attendance = useMemo(() => {
    const map = new Map()
    visits.forEach(v => {
      if (!v.member) return
      const entry = map.get(v.member.id) ?? { member: v.member, count: 0, dates: [] }
      entry.count += 1
      entry.dates.push(v.visit_date)
      map.set(v.member.id, entry)
    })
    const list = [...map.values()].map(e => ({
      ...e,
      dates: e.dates.sort((a, b) => new Date(b) - new Date(a)),
      lastVisit: e.dates.reduce((max, d) => (!max || new Date(d) > new Date(max) ? d : max), null),
    }))
    return list
  }, [visits])

  const filtered = useMemo(() => {
    let list = attendance
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(({ member }) => `${member.first_name} ${member.last_name}`.toLowerCase().includes(q))
    }
    return [...list].sort((a, b) => {
      if (sort === 'name')   return `${a.member.first_name} ${a.member.last_name}`.localeCompare(`${b.member.first_name} ${b.member.last_name}`)
      if (sort === 'recent') return new Date(b.lastVisit) - new Date(a.lastVisit)
      return b.count - a.count
    })
  }, [attendance, search, sort])

  const color        = classColor(gymClass)
  const isPrivate     = gymClass.type === 'private'
  const totalVisits   = visits.length
  const distinctCount = attendance.length
  const capacity      = gymClass.capacity ?? 0
  const fillRate       = capacity > 0 ? Math.min(100, Math.round((distinctCount / capacity) * 100)) : null
  const mostFrequent   = attendance.length ? attendance.reduce((a, b) => (b.count > a.count ? b : a)) : null
  const avgVisits      = distinctCount > 0 ? (totalVisits / distinctCount).toFixed(1) : '0'

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-5 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `color-mix(in srgb, ${color} 14%, transparent)` }}>
                <Users className="w-5 h-5" style={{ color }} />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-gray-900 leading-snug">{gymClass.name}</h2>
                <div className="flex items-center flex-wrap gap-1.5 mt-1.5">
                  <span className={`badge ${isPrivate ? 'badge-purple' : 'badge-indigo'}`}>{isPrivate ? 'Privada' : 'Conjunta'}</span>
                  {gymClass.difficulty && (
                    <span className={`badge ${DIFF_BADGE[gymClass.difficulty] ?? 'badge-gray'}`}>{DIFFICULTY[gymClass.difficulty]}</span>
                  )}
                </div>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 flex-shrink-0"><X className="w-5 h-5" /></button>
          </div>

          {gymClass.description && (
            <p className="text-sm text-gray-500 leading-relaxed mt-3">{gymClass.description}</p>
          )}

          {/* Trainer + meta */}
          <div className="flex items-center flex-wrap gap-x-4 gap-y-1.5 mt-3 text-sm text-gray-600">
            {gymClass.trainer ? (
              <div className="flex items-center gap-1.5">
                <div className={`w-5 h-5 rounded-full bg-gradient-to-br ${avatarColor(gymClass.trainer.id)} flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0`}>
                  {gymClass.trainer.first_name?.[0]}{gymClass.trainer.last_name?.[0]}
                </div>
                <span>{gymClass.trainer.first_name} {gymClass.trainer.last_name}</span>
              </div>
            ) : (
              <span className="text-amber-600 flex items-center gap-1.5 font-medium text-xs">
                <AlertTriangle className="w-3.5 h-3.5" /> Sin entrenador asignado
              </span>
            )}
            {gymClass.duration && (
              <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-gray-400" />{gymClass.duration} min</span>
            )}
            {gymClass.start_date && (
              <span className="flex items-center gap-1.5"><CalendarClock className="w-3.5 h-3.5 text-gray-400" />Inició {fmtDateTime(gymClass.start_date)}</span>
            )}
          </div>

          {/* Schedules */}
          {gymClass.schedules?.length > 0 && (
            <div className="mt-3 rounded-xl bg-gray-50 border border-gray-100 divide-y divide-gray-100">
              {gymClass.schedules.map((s, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-2 text-xs text-gray-700">
                  <Calendar className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                  <span className="font-semibold text-gray-800 w-16 flex-shrink-0">{DAYS_ES[DAYS.indexOf(s.day_of_week)] ?? s.day_of_week}</span>
                  <span className="font-mono text-gray-500">{s.start_time?.slice(0, 5)} – {s.end_time?.slice(0, 5)}</span>
                  {s.room && (
                    <span className="flex items-center gap-1 text-gray-400 ml-auto"><MapPin className="w-3 h-3" />{s.room}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Miembros',   value: distinctCount, icon: Users },
              { label: 'Asistencias', value: totalVisits,   icon: TrendingUp },
              { label: 'Capacidad',   value: capacity || '—', icon: Gauge },
              { label: 'Prom./socio', value: avgVisits,     icon: ArrowUpDown },
            ].map(s => (
              <div key={s.label} className="rounded-xl bg-gray-50 border border-gray-100 p-2.5">
                <s.icon className="w-3.5 h-3.5 text-gray-400 mb-1" />
                <p className="text-base font-bold text-gray-900 leading-none">{s.value}</p>
                <p className="text-[11px] text-gray-500 mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          {fillRate !== null && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                <span>Ocupación (miembros distintos / capacidad)</span>
                <span className="font-semibold text-gray-700">{fillRate}%</span>
              </div>
              <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${fillRate}%`, background: `linear-gradient(90deg, ${color}99, ${color})` }}
                />
              </div>
            </div>
          )}

          {mostFrequent && (
            <p className="text-xs text-gray-400 mt-2.5">
              Socio más asiduo: <span className="font-medium text-gray-600">{mostFrequent.member.first_name} {mostFrequent.member.last_name}</span> ({mostFrequent.count} visita{mostFrequent.count !== 1 ? 's' : ''})
            </p>
          )}
        </div>

        {/* Attendee list */}
        <div className="p-4 flex-1 min-h-0">
          {isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-indigo-600" /></div>
          ) : attendance.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <Users className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-sm">Aún no hay asistencias registradas</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-3">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar socio…"
                    className="input pl-8 py-1.5 text-sm"
                  />
                </div>
                <select
                  value={sort}
                  onChange={e => setSort(e.target.value)}
                  className="input py-1.5 text-xs w-auto flex-shrink-0"
                >
                  {SORTS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>

              {filtered.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">Ningún socio coincide con "{search}"</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {filtered.map(({ member, count, dates, lastVisit }) => {
                    const isOpen = expandedId === member.id
                    return (
                      <div key={member.id}>
                        <button
                          type="button"
                          onClick={() => setExpandedId(isOpen ? null : member.id)}
                          className="w-full flex items-center gap-3 px-2 py-2.5 hover:bg-gray-50 rounded-lg transition-colors text-left"
                        >
                          <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${avatarColor(member.id)} flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0`}>
                            {member.first_name?.[0]}{member.last_name?.[0]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm text-gray-800 font-medium truncate">{member.first_name} {member.last_name}</span>
                              {member.status && (
                                <span className={`${STATUS_BADGE[member.status] ?? 'badge-gray'} text-[10px] flex-shrink-0`}>{STATUS_LABEL[member.status] ?? member.status}</span>
                              )}
                            </div>
                            {lastVisit && (
                              <p className="text-[11px] text-gray-400 mt-0.5">Última visita: {fmtRelative(lastVisit)} · {fmtDateTime(lastVisit)}</p>
                            )}
                          </div>
                          <span className="badge badge-indigo flex-shrink-0">{count} visita{count !== 1 ? 's' : ''}</span>
                          <ChevronDown className={`w-4 h-4 text-gray-300 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {isOpen && (
                          <div className="pl-11 pr-2 pb-3 -mt-1">
                            <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-1.5">Historial de visitas</p>
                            <div className="flex flex-wrap gap-1.5">
                              {dates.map((d, i) => (
                                <span key={i} className="text-[11px] px-2 py-1 rounded-lg bg-gray-50 border border-gray-100 text-gray-600">
                                  {fmtDateTime(d)}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
