import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Skeleton } from 'boneyard-js/react'
import {
  Plus, Edit2, Trash2, Calendar, Users, Clock,
  Filter, Search, AlertTriangle, UserCheck, Target, CalendarClock,
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../api/axios'
import ConfirmModal from '../ConfirmModal'
import ClassModal from './ClassModal'
import { LoadingLogoOverlay } from '../SkeletonLogoMark'
import { avatarColor } from '../../utils/avatarColor'

const DIFFICULTY   = { beginner: 'Principiante', intermediate: 'Intermedio', advanced: 'Avanzado' }
const DIFF_COLORS  = { beginner: 'badge-green', intermediate: 'badge-yellow', advanced: 'badge-red' }
const DIFF_BG      = { beginner: '#10B981',      intermediate: '#F59E0B',     advanced: '#EF4444' }
const DAYS    = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
const DAYS_ES = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo']

function fmtStartDate(raw) {
  const d = new Date(`${raw.slice(0, 10)}T12:00`)
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
}

export default function ClassesTab({ onOpenProgress, onOpenAttendance }) {
  const qc = useQueryClient()
  const [modal,        setModal]        = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [diffFilter,   setDiffFilter]   = useState('')
  const [typeFilter,   setTypeFilter]   = useState('')
  const [search,       setSearch]       = useState('')

  const { data: classes = [], isLoading } = useQuery({
    queryKey: ['classes'],
    queryFn: () => api.get('/classes').then(r => r.data),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/classes/${id}`),
    onSuccess: () => { qc.invalidateQueries(['classes']); toast.success('Clase eliminada') },
  })

  const total          = classes.length
  const byDiff          = { beginner: 0, intermediate: 0, advanced: 0 }
  const totalSched      = classes.reduce((n, c) => n + (c.schedules?.length ?? 0), 0)
  const withoutTrainer  = classes.filter(c => !c.trainer)
  const groupCount      = classes.filter(c => (c.type ?? 'group') === 'group').length
  const privateCount    = classes.filter(c => c.type === 'private').length
  classes.forEach(c => { if (byDiff[c.difficulty] !== undefined) byDiff[c.difficulty]++ })

  const filtered = classes
    .filter(c => {
      const matchDiff = !diffFilter || c.difficulty === diffFilter
      const matchType = !typeFilter || (c.type ?? 'group') === typeFilter
      const haystack = `${c.name} ${c.description ?? ''} ${c.trainer ? `${c.trainer.first_name} ${c.trainer.last_name}` : ''} ${c.member ? `${c.member.first_name} ${c.member.last_name}` : ''}`.toLowerCase()
      const matchSearch = !search || haystack.includes(search.toLowerCase())
      return matchDiff && matchType && matchSearch
    })
    .sort((a, b) => {
      if (!a.start_date && !b.start_date) return 0
      if (!a.start_date) return 1
      if (!b.start_date) return -1
      return a.start_date.localeCompare(b.start_date)
    })

  return (
    <>
    <LoadingLogoOverlay show={isLoading} />
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Clases</h2>
          <p className="text-sm text-gray-500 mt-0.5">{total} clases · {groupCount} conjuntas · {privateCount} privadas · {totalSched} horarios</p>
        </div>
        <button onClick={() => setModal('create')} className="btn-primary">
          <Plus className="w-4 h-4" /> Nueva clase
        </button>
      </div>

      <Skeleton name="classes-list" loading={isLoading}>
      <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total',        value: total,                color: '#6366F1' },
          { label: 'Principiante', value: byDiff.beginner,      color: DIFF_BG.beginner },
          { label: 'Intermedio',   value: byDiff.intermediate,  color: DIFF_BG.intermediate },
          { label: 'Avanzado',     value: byDiff.advanced,      color: DIFF_BG.advanced },
        ].map(s => (
          <div key={s.label} className="card p-4 flex items-center gap-3">
            <div className="w-2 h-10 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
            <div>
              <p className="text-xs text-gray-500">{s.label}</p>
              <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Aviso de clases sin entrenador */}
      {withoutTrainer.length > 0 && (
        <div className="card p-4 flex items-center gap-3" style={{ background: '#FFFBEB', borderColor: '#FDE68A' }}>
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
          <p className="text-sm text-amber-700">
            {withoutTrainer.length} {withoutTrainer.length === 1 ? 'clase no tiene' : 'clases no tienen'} entrenador asignado. Edítala{withoutTrainer.length === 1 ? '' : 's'} para asignar uno.
          </p>
        </div>
      )}

      {/* Búsqueda + filtros */}
      <div className="card p-4 flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre, descripción, entrenador o socio…"
            className="input pl-9"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-gray-400 flex-shrink-0" />
          {[
            { id: '', label: 'Todos' },
            { id: 'beginner',     label: 'Principiante' },
            { id: 'intermediate', label: 'Intermedio' },
            { id: 'advanced',     label: 'Avanzado' },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setDiffFilter(f.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border
                ${diffFilter === f.id
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-400 flex-shrink-0 pl-6">Tipo:</span>
          {[
            { id: '',        label: 'Todas' },
            { id: 'group',   label: 'Conjuntas' },
            { id: 'private', label: 'Privadas' },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setTypeFilter(f.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border
                ${typeFilter === f.id
                  ? 'bg-violet-600 text-white border-violet-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-violet-300'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-gray-400">
          <Calendar className="w-10 h-10 mb-2 opacity-30" />
          <p className="text-sm">{diffFilter || typeFilter || search ? 'No hay clases que coincidan' : 'No hay clases registradas'}</p>
          {!diffFilter && !typeFilter && !search && (
            <button onClick={() => setModal('create')} className="btn-primary mt-4 text-xs">Crear primera clase</button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(c => {
            const isPrivate = c.type === 'private'
            const completedCount = (c.sessions ?? []).filter(s => s.status === 'completed').length
            const pct = isPrivate && c.total_sessions
              ? Math.round((completedCount / c.total_sessions) * 100)
              : 0
            const startsInFuture = c.start_date && new Date(`${c.start_date.slice(0, 10)}T00:00`) > new Date()

            return (
              <div
                key={c.id}
                className={`card p-5 flex flex-col gap-3 hover:shadow-md transition-shadow border-l-4 ${isPrivate ? 'border-l-violet-400' : 'border-l-indigo-400'}`}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900 truncate">{c.name}</h3>
                      {isPrivate && <span className="badge badge-purple flex-shrink-0">Privada</span>}
                    </div>
                    {c.trainer ? (
                      <div className="flex items-center gap-1.5 mt-1">
                        <div className={`w-5 h-5 rounded-full bg-gradient-to-br ${avatarColor(c.trainer.id)} flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0`}>
                          {c.trainer.first_name?.[0]}{c.trainer.last_name?.[0]}
                        </div>
                        <p className="text-xs text-gray-600 truncate">{c.trainer.first_name} {c.trainer.last_name}</p>
                      </div>
                    ) : (
                      <p className="text-xs text-amber-600 mt-1 flex items-center gap-1 font-medium">
                        <AlertTriangle className="w-3 h-3" /> Falta asignar entrenador
                      </p>
                    )}
                  </div>
                  <span className={`badge ${DIFF_COLORS[c.difficulty] ?? 'badge-gray'} flex-shrink-0`}>
                    {DIFFICULTY[c.difficulty]}
                  </span>
                </div>

                {/* Fecha de inicio */}
                {c.start_date && (
                  <span className={`inline-flex items-center gap-1 text-xs w-fit px-2 py-0.5 rounded-full font-medium
                    ${startsInFuture ? 'bg-indigo-50 text-indigo-600' : 'bg-gray-100 text-gray-500'}`}>
                    <CalendarClock className="w-3 h-3" />
                    {startsInFuture ? 'Inicia' : 'Inició'} {fmtStartDate(c.start_date)}
                  </span>
                )}

                {/* Description */}
                {c.description && (
                  <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{c.description}</p>
                )}

                {isPrivate ? (
                  <div className="rounded-xl bg-violet-50 border border-violet-100 p-3 space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <UserCheck className="w-4 h-4 text-violet-500 flex-shrink-0" />
                      {c.member ? (
                        <span className="font-medium text-gray-800 truncate">{c.member.first_name} {c.member.last_name}</span>
                      ) : (
                        <span className="text-gray-400">Sin socio asignado</span>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                        <span>{completedCount} de {c.total_sessions ?? 0} sesiones</span>
                        <span>{pct}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-violet-100 overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #a78bfa, #7c3aed)' }}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Meta chips */}
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{c.capacity} pers.</span>
                      <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{c.duration} min</span>
                      {c.schedules?.length > 0 && (
                        <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{c.schedules.length} horario{c.schedules.length !== 1 ? 's' : ''}</span>
                      )}
                    </div>

                    {/* Schedules */}
                    {c.schedules?.length > 0 && (
                      <div className="rounded-xl bg-gray-50 border border-gray-100 divide-y divide-gray-100">
                        {c.schedules.map((s, i) => (
                          <div key={i} className="flex items-center justify-between px-3 py-2 text-xs text-gray-700">
                            <span className="font-semibold text-gray-800 w-20 flex-shrink-0">
                              {DAYS_ES[DAYS.indexOf(s.day_of_week)] ?? s.day_of_week}
                            </span>
                            <span className="flex-1 text-center text-gray-500 font-mono">
                              {s.start_time?.slice(0, 5)} – {s.end_time?.slice(0, 5)}
                            </span>
                            {s.room ? (
                              <span className="text-gray-400 text-right w-20 truncate">{s.room}</span>
                            ) : (
                              <span className="w-20" />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {/* Actions */}
                <div className="flex flex-col gap-2 mt-auto pt-1 border-t border-gray-50">
                  {isPrivate ? (
                    <button onClick={() => onOpenProgress(c)} className="btn-secondary text-xs py-1.5 w-full">
                      <Target className="w-3 h-3" /> Ver progreso
                    </button>
                  ) : (
                    <button onClick={() => onOpenAttendance(c)} className="btn-secondary text-xs py-1.5 w-full">
                      <Users className="w-3 h-3" /> Ver asistencia
                    </button>
                  )}
                  <div className="flex gap-2">
                    <button onClick={() => setModal(c)} className="btn-secondary text-xs flex-1 py-1.5">
                      <Edit2 className="w-3 h-3" /> Editar
                    </button>
                    <button onClick={() => setDeleteTarget(c)} className="btn-danger text-xs flex-1 py-1.5">
                      <Trash2 className="w-3 h-3" /> Eliminar
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
      </div>
      </Skeleton>

      {modal && (
        <ClassModal gymClass={modal === 'create' ? null : modal} onClose={() => setModal(null)} />
      )}
      {deleteTarget && (
        <ConfirmModal
          title={`¿Eliminar clase "${deleteTarget.name}"?`}
          message="Se eliminarán también todos sus horarios y su historial de progreso."
          onConfirm={() => { deleteMutation.mutate(deleteTarget.id); setDeleteTarget(null) }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
    </>
  )
}
