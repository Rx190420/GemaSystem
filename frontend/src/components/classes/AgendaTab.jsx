import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Skeleton } from 'boneyard-js/react'
import {
  ChevronLeft, ChevronRight, CalendarDays, Sparkles, MoreVertical,
  Eye, CheckCircle2, XCircle, Circle, Edit2, Clock, X, Users, UserCheck, AlertTriangle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { FixedPanel, PanelHeader, EmptyState } from '../Panel'
import api from '../../api/axios'
import { LoadingLogoOverlay } from '../SkeletonLogoMark'
import { avatarColor } from '../../utils/avatarColor'
import { classColor } from '../../utils/classColors'
import useLockBodyScroll from '../../hooks/useLockBodyScroll'
import {
  toYMD, parseYMD, startOfDay, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  getOccurrencesInRange, getOccurrenceStatus,
} from '../../utils/classOccurrences'

const DAYS_ES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

const STATUS_META = {
  pending:   { label: 'Pendiente',  badge: 'badge-gray',   icon: Circle      },
  ongoing:   { label: 'En curso',   badge: 'badge-yellow', icon: Clock       },
  completed: { label: 'Finalizada', badge: 'badge-green',  icon: CheckCircle2 },
  missed:    { label: 'Faltó',      badge: 'badge-red',    icon: XCircle     },
}

const DIFFICULTY_ES    = { beginner: 'Principiante', intermediate: 'Intermedio', advanced: 'Avanzado' }
const DIFFICULTY_BADGE = { beginner: 'badge-green',  intermediate: 'badge-yellow', advanced: 'badge-red' }

function capitalize(s) {
  return s ? s[0].toUpperCase() + s.slice(1) : s
}

// ── One occurrence row + its quick-actions menu ────────────────────────────
function OccurrenceRow({ occ, onOpenProgress, onOpenAttendance, onEditClass }) {
  const qc = useQueryClient()
  const [menuOpen, setMenuOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function close(e) {
      if (ref.current && !ref.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const { gymClass: c, kind, schedule, session } = occ
  const isPrivate = kind === 'session'
  const status = getOccurrenceStatus(occ)
  const meta = STATUS_META[status]

  const statusMutation = useMutation({
    mutationFn: (newStatus) => api.patch(`/classes/${c.id}/sessions/${session.id}`, { status: newStatus }),
    onSuccess: () => {
      qc.invalidateQueries(['classes'])
      toast.success('Sesión actualizada')
    },
    onError: () => toast.error('No se pudo actualizar la sesión'),
  })

  function setSessionStatus(newStatus) {
    setMenuOpen(false)
    statusMutation.mutate(newStatus)
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setMenuOpen(o => !o)}
        className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/30 transition-colors text-left"
      >
        <div className={`w-2 h-10 rounded-full flex-shrink-0 ${isPrivate ? 'bg-violet-500' : 'bg-indigo-500'}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800 truncate">{c.name}</p>
          <p className="text-xs text-gray-500 truncate">
            {isPrivate
              ? `Sesión ${session.session_number} · ${c.member ? `${c.member.first_name} ${c.member.last_name}` : 'Sin socio'}`
              : `${schedule.start_time?.slice(0, 5)} – ${schedule.end_time?.slice(0, 5)}${schedule.room ? ` · ${schedule.room}` : ''}${c.trainer ? ` · ${c.trainer.first_name} ${c.trainer.last_name}` : ''}`}
          </p>
        </div>
        <span className={`badge ${meta.badge} flex-shrink-0`}>{meta.label}</span>
        <MoreVertical className="w-4 h-4 text-gray-300 flex-shrink-0" />
      </button>

      {menuOpen && (
        <div className="absolute right-0 top-full mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xl z-30 overflow-hidden min-w-[220px]">
          <button
            type="button"
            onClick={() => { setMenuOpen(false); isPrivate ? onOpenProgress(c) : onOpenAttendance(c) }}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
          >
            <Eye className="w-4 h-4 text-indigo-500 flex-shrink-0" />
            {isPrivate ? 'Ver progreso y detalles' : 'Ver asistencia y detalles'}
          </button>

          {isPrivate ? (
            <>
              {session.status !== 'completed' && (
                <button
                  type="button"
                  disabled={statusMutation.isLoading}
                  onClick={() => setSessionStatus('completed')}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" /> Marcar como finalizada
                </button>
              )}
              {session.status !== 'missed' && (
                <button
                  type="button"
                  disabled={statusMutation.isLoading}
                  onClick={() => setSessionStatus('missed')}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-red-50 hover:text-red-700 transition-colors disabled:opacity-50"
                >
                  <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" /> Marcar que faltó
                </button>
              )}
              {session.status !== 'pending' && (
                <button
                  type="button"
                  disabled={statusMutation.isLoading}
                  onClick={() => setSessionStatus('pending')}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  <Circle className="w-4 h-4 text-gray-400 flex-shrink-0" /> Marcar como pendiente
                </button>
              )}
            </>
          ) : (
            <button
              type="button"
              onClick={() => { setMenuOpen(false); onEditClass(c) }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
            >
              <Edit2 className="w-4 h-4 text-indigo-500 flex-shrink-0" /> Editar clase
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Preview of one occurrence, shown inside a calendar day cell. Fills the
// cell with a compact version of what the "Clases" list rows show (time,
// room/trainer or session/socio, status) — background/text tinted with the
// class's own identifying color (set in the class form, or a deterministic
// fallback — see utils/classColors) so each class reads as its own color
// the same way everywhere else in the calendar.
function DayOccCard({ occ }) {
  const { gymClass: c, kind, schedule, session } = occ
  const status = getOccurrenceStatus(occ)
  const meta = STATUS_META[status]
  const StatusIcon = meta.icon
  const isPrivate = kind === 'session'
  const color = classColor(c)
  const fade  = status === 'completed' ? 'opacity-60' : ''
  const pulse = status === 'ongoing' ? 'animate-pulse' : ''

  const detail = isPrivate
    ? `Sesión ${session.session_number}${c.member ? ` · ${c.member.first_name} ${c.member.last_name}` : ''}`
    : [
        schedule.start_time && schedule.end_time ? `${schedule.start_time.slice(0, 5)}–${schedule.end_time.slice(0, 5)}` : null,
        schedule.room,
        c.trainer ? `${c.trainer.first_name} ${c.trainer.last_name}` : null,
      ].filter(Boolean).join(' · ')

  return (
    <div
      className={`flex-1 min-h-0 w-full flex flex-col text-left rounded-md px-1.5 py-1 ${fade}`}
      style={{ background: `color-mix(in srgb, ${color} 14%, transparent)` }}
    >
      <StatusIcon className={`w-3 h-3 flex-shrink-0 ${pulse}`} style={{ color }} />
      <div className="min-w-0 flex-1 flex flex-col justify-center mt-0.5">
        <p className="text-[10.5px] leading-snug font-semibold line-clamp-2" style={{ color }}>{c.name}</p>
        {detail && <p className="text-[9px] leading-tight truncate opacity-80" style={{ color }}>{detail}</p>}
        <p className="text-[9px] leading-tight truncate opacity-60" style={{ color }}>{meta.label}</p>
      </div>
    </div>
  )
}

// ── Read-only detail card for one occurrence, opened by double-clicking a
// calendar day cell. Deliberately not the same modal "Clases" opens (that
// one's for marking attendance/progress) — this is just everything about
// the activity at a glance: schedule/session info, trainer or socio,
// capacity, description and progress, mirroring what the "Clases" cards
// show.
function OccurrenceInfoCard({ occ, onClose }) {
  useLockBodyScroll()

  const { gymClass: c, kind, schedule, session } = occ
  const isPrivate = kind === 'session'
  const status = getOccurrenceStatus(occ)
  const meta = STATUS_META[status]
  const StatusIcon = meta.icon
  const color = classColor(c)

  const dateLabel = capitalize(parseYMD(occ.date).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' }))
  const completedCount = (c.sessions ?? []).filter(s => s.status === 'completed').length
  const pct = c.total_sessions ? Math.round((completedCount / c.total_sessions) * 100) : 0

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-start gap-3 p-5 border-b border-gray-100">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `color-mix(in srgb, ${color} 14%, transparent)` }}>
            <StatusIcon className="w-5 h-5" style={{ color }} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-gray-900 leading-snug">{c.name}</h3>
            <div className="flex items-center flex-wrap gap-1.5 mt-1.5">
              <span className={`badge ${isPrivate ? 'badge-purple' : 'badge-indigo'}`}>{isPrivate ? 'Sesión privada' : 'Clase conjunta'}</span>
              <span className={`badge ${meta.badge}`}>{meta.label}</span>
              {!isPrivate && c.difficulty && (
                <span className={`badge ${DIFFICULTY_BADGE[c.difficulty] ?? 'badge-gray'}`}>{DIFFICULTY_ES[c.difficulty]}</span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          {c.description && <p className="text-sm text-gray-500 leading-relaxed">{c.description}</p>}

          <div className="flex items-center gap-2 text-sm text-gray-700 capitalize">
            <CalendarDays className="w-4 h-4 text-gray-400 flex-shrink-0" />
            {dateLabel}
          </div>

          {isPrivate ? (
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
              Sesión {session.session_number} de {c.total_sessions ?? '—'}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
              {schedule.start_time?.slice(0, 5)} – {schedule.end_time?.slice(0, 5)}
              {schedule.room && <span className="text-gray-400">· {schedule.room}</span>}
            </div>
          )}

          {isPrivate ? (
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <UserCheck className="w-4 h-4 text-gray-400 flex-shrink-0" />
              {c.member
                ? <span>{c.member.first_name} {c.member.last_name}</span>
                : <span className="text-gray-400">Sin socio asignado</span>}
            </div>
          ) : (
            <div className="flex items-center gap-3 text-sm text-gray-500">
              <span className="flex items-center gap-1.5"><Users className="w-4 h-4 text-gray-400" />{c.capacity} pers.</span>
              <span className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-gray-400" />{c.duration} min</span>
            </div>
          )}

          <div className="flex items-center gap-2 text-sm text-gray-700">
            {c.trainer ? (
              <>
                <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${avatarColor(c.trainer.id)} flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0`}>
                  {c.trainer.first_name?.[0]}{c.trainer.last_name?.[0]}
                </div>
                <span>{c.trainer.first_name} {c.trainer.last_name}</span>
              </>
            ) : (
              <span className="text-amber-600 flex items-center gap-1.5 font-medium">
                <AlertTriangle className="w-4 h-4" /> Falta asignar entrenador
              </span>
            )}
          </div>

          {isPrivate && c.total_sessions ? (
            <div>
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                <span>{completedCount} de {c.total_sessions} sesiones</span>
                <span>{pct}%</span>
              </div>
              <div className="h-2 rounded-full bg-violet-100 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #a78bfa, #7c3aed)' }} />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

// Minimum horizontal drag (px) before a pointer gesture counts as a swipe
// rather than a tap/click.
const SWIPE_THRESHOLD = 24

// ── One cell in the month grid. Shows one activity at a time, filling the
// cell — swipe left/right (mouse drag or touch) to page through the rest
// when a day has several, or tap a dot to jump straight to one (the active
// dot matches that activity's color). Double-click/double-tap opens the
// full read-only info card for whichever activity is currently showing —
// a single press/tap that isn't a swipe just selects the day.
function DayCell({ day, dayOccs, inMonth, isToday, isSelected, onSelect, onShowInfo }) {
  const [previewIndex, setPreviewIndex] = useState(0)
  const clampedIndex = Math.min(previewIndex, Math.max(0, dayOccs.length - 1))
  const current = dayOccs[clampedIndex]
  const dragRef = useRef({ x: 0, y: 0, swiped: false })

  function stepPreview(dir) {
    if (dayOccs.length < 2) return
    setPreviewIndex(i => {
      const clamped = Math.min(i, dayOccs.length - 1)
      return (clamped + dir + dayOccs.length) % dayOccs.length
    })
  }

  function handlePointerDown(e) {
    dragRef.current = { x: e.clientX, y: e.clientY, swiped: false }
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }

  function handlePointerMove(e) {
    if (dayOccs.length < 2) return
    const dx = e.clientX - dragRef.current.x
    const dy = e.clientY - dragRef.current.y
    if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
      stepPreview(dx < 0 ? 1 : -1)
      dragRef.current.swiped = true
      dragRef.current.x = e.clientX // rebase so one long drag can page through several
      dragRef.current.y = e.clientY
    }
  }

  function handleClick() {
    if (dragRef.current.swiped) { dragRef.current.swiped = false; return }
    onSelect()
  }

  function handleDoubleClick() {
    if (dragRef.current.swiped) return
    if (current) onShowInfo(current)
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      style={{ touchAction: 'pan-y' }}
      title={current ? `${current.gymClass.name} — desliza para ver más, doble clic para detalles` : undefined}
      className={`aspect-square rounded-lg p-1 flex flex-col items-stretch gap-1 border transition-colors overflow-hidden select-none
        ${inMonth ? '' : 'opacity-30'}
        ${isSelected ? 'border-indigo-500 bg-indigo-50' : 'border-transparent hover:bg-gray-50'}
        ${isToday && !isSelected ? 'ring-1 ring-inset ring-indigo-300' : ''}`}
    >
      <span className={`text-xs text-center flex-shrink-0 ${isToday ? 'font-bold text-indigo-600' : 'font-medium text-gray-700'}`}>
        {day.getDate()}
      </span>

      {current && <DayOccCard occ={current} />}

      {dayOccs.length > 1 && (
        <div className="flex items-center justify-center gap-1 flex-shrink-0">
          {dayOccs.map((o, i) => (
            <button
              key={i}
              type="button"
              title={`Ver actividad ${i + 1} de ${dayOccs.length}`}
              onClick={e => { e.stopPropagation(); setPreviewIndex(i) }}
              onPointerDown={e => e.stopPropagation()}
              className="p-1 -m-1 flex items-center justify-center"
            >
              <span
                className={`block rounded-full transition-all ${i === clampedIndex ? 'w-2.5 h-1' : 'w-1 h-1 bg-gray-300 hover:bg-gray-400'}`}
                style={i === clampedIndex ? { background: classColor(o.gymClass) } : undefined}
              />
            </button>
          ))}
        </div>
      )}
    </button>
  )
}

export default function AgendaTab({ onOpenProgress, onOpenAttendance, onEditClass }) {
  const today = startOfDay(new Date())
  const [cursorMonth, setCursorMonth] = useState(startOfMonth(today))
  const [selectedDay, setSelectedDay] = useState(today)
  const [infoOcc, setInfoOcc] = useState(null)
  const [typeFilter, setTypeFilter] = useState('') // '' = todas, 'group' = conjuntas, 'private' = privadas

  const { data: classes = [], isLoading } = useQuery({
    queryKey: ['classes'],
    queryFn: () => api.get('/classes').then(r => r.data),
  })

  // Same filter ClassesTab uses ("Todas/Conjuntas/Privadas") — applied once
  // here so every downstream view (Hoy, Esta semana, calendario, detalle del
  // día) sees the same filtered set.
  const visibleClasses = typeFilter ? classes.filter(c => (c.type ?? 'group') === typeFilter) : classes

  // Reminders: today + rest of this week, independent of whatever month is on screen.
  const weekOccurrences   = getOccurrencesInRange(visibleClasses, today, endOfWeek(today))
  const todayYMD          = toYMD(today)
  const todayOccurrences  = weekOccurrences.filter(o => o.date === todayYMD)
  const restOfWeek        = weekOccurrences.filter(o => o.date !== todayYMD)
  const todayPending      = todayOccurrences.filter(o => ['pending', 'ongoing'].includes(getOccurrenceStatus(o))).length

  // Calendar grid for the visible month.
  const monthStart = startOfMonth(cursorMonth)
  const monthEnd   = endOfMonth(cursorMonth)
  const gridStart  = startOfWeek(monthStart)
  const gridEnd    = endOfWeek(monthEnd)

  const gridOccurrences = getOccurrencesInRange(visibleClasses, gridStart, gridEnd)
  const occByDate = new Map()
  gridOccurrences.forEach(o => {
    if (!occByDate.has(o.date)) occByDate.set(o.date, [])
    occByDate.get(o.date).push(o)
  })

  // Classes actually appearing this month, deduped — this is what the color
  // legend below the calendar lists, so it only shows colors relevant to
  // what's on screen instead of every class the gym has ever created.
  const classesInView = [...new Map(gridOccurrences.map(o => [o.gymClass.id, o.gymClass])).values()]
    .sort((a, b) => a.name.localeCompare(b.name))

  const days = []
  for (const d = new Date(gridStart); d <= gridEnd; d.setDate(d.getDate() + 1)) {
    days.push(new Date(d))
  }

  const selectedOccurrences = occByDate.get(toYMD(selectedDay)) ?? []

  function goPrevMonth() {
    setCursorMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))
  }
  function goNextMonth() {
    setCursorMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))
  }
  function goToday() {
    setCursorMonth(startOfMonth(today))
    setSelectedDay(today)
  }

  return (
    <>
    <LoadingLogoOverlay show={isLoading} />
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Agenda</h2>
          <p className="text-sm text-gray-500 mt-0.5">Todo lo que viene, en orden. Toca una clase para ver detalles o marcar su estado.</p>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
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

      <Skeleton name="agenda-view" loading={isLoading}>
        <>
          {/* Reminders — altura fija: ambas tarjetas miden lo mismo tenga o no
              clases, y la lista larga hace scroll interno en vez de crecer. */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <FixedPanel height={320} className="p-4">
              <PanelHeader
                title={<span className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-indigo-500" />Hoy</span>}
                badge={<span className="badge badge-indigo">{todayPending} pendiente{todayPending !== 1 ? 's' : ''} · {todayOccurrences.length} total</span>}
              />
              {todayOccurrences.length === 0 ? (
                <EmptyState icon={Sparkles} text="No tienes clases hoy." />
              ) : (
                <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-2">
                  {todayOccurrences.map((o, i) => (
                    <OccurrenceRow key={i} occ={o} onOpenProgress={onOpenProgress} onOpenAttendance={onOpenAttendance} onEditClass={onEditClass} />
                  ))}
                </div>
              )}
            </FixedPanel>

            <FixedPanel height={320} className="p-4">
              <PanelHeader
                title={<span className="flex items-center gap-2"><CalendarDays className="w-4 h-4 text-violet-500" />Esta semana</span>}
                badge={<span className="badge badge-purple">{restOfWeek.length}</span>}
              />
              {restOfWeek.length === 0 ? (
                <EmptyState icon={CalendarDays} text="No hay más clases el resto de la semana." />
              ) : (
                <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-2">
                  {restOfWeek.map((o, i) => (
                    <OccurrenceRow key={i} occ={o} onOpenProgress={onOpenProgress} onOpenAttendance={onOpenAttendance} onEditClass={onEditClass} />
                  ))}
                </div>
              )}
            </FixedPanel>
          </div>

          {/* Calendar */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-800 capitalize">
                {capitalize(cursorMonth.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' }))}
              </h3>
              <div className="flex items-center gap-1">
                <button onClick={goPrevMonth} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button onClick={goToday} className="px-2.5 py-1 rounded-lg text-xs font-medium text-indigo-600 hover:bg-indigo-50">
                  Hoy
                </button>
                <button onClick={goNextMonth} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1 mb-1">
              {DAYS_ES.map(d => (
                <div key={d} className="text-center text-[10px] font-semibold text-gray-400 uppercase py-1">
                  {d.slice(0, 3)}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {days.map(day => {
                const ymd = toYMD(day)
                const dayOccs = occByDate.get(ymd) ?? []

                return (
                  <DayCell
                    key={ymd}
                    day={day}
                    dayOccs={dayOccs}
                    inMonth={day.getMonth() === cursorMonth.getMonth()}
                    isToday={ymd === todayYMD}
                    isSelected={ymd === toYMD(selectedDay)}
                    onSelect={() => setSelectedDay(day)}
                    onShowInfo={setInfoOcc}
                  />
                )
              })}
            </div>

            {/* Legend — real color per class (set in the class form) instead of
                just "group vs. private", so it doubles as a color key. */}
            <div className="flex items-center flex-wrap gap-x-4 gap-y-1.5 mt-3 pt-3 border-t border-gray-100 text-[11px] text-gray-500">
              {classesInView.map(c => (
                <span key={c.id} className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: classColor(c) }} />
                  {c.name}
                </span>
              ))}
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-gray-400 opacity-40" /> Ya pasó</span>
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-pulse" /> En curso ahora</span>
            </div>
          </div>

          {/* Day detail */}
          <div className="card p-4">
            <h4 className="text-sm font-semibold text-gray-800 mb-3 capitalize">
              {selectedDay.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
            </h4>
            {selectedOccurrences.length === 0 ? (
              <p className="text-sm text-gray-400">No hay clases este día.</p>
            ) : (
              <div className="space-y-2">
                {selectedOccurrences.map((o, i) => (
                  <OccurrenceRow key={i} occ={o} onOpenProgress={onOpenProgress} onOpenAttendance={onOpenAttendance} onEditClass={onEditClass} />
                ))}
              </div>
            )}
          </div>
        </>
      </Skeleton>

      {infoOcc && <OccurrenceInfoCard occ={infoOcc} onClose={() => setInfoOcc(null)} />}
    </div>
    </>
  )
}
