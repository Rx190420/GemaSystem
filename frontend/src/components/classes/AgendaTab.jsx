import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, CalendarDays, Sparkles } from 'lucide-react'
import { FixedPanel, PanelHeader, EmptyState } from '../Panel'
import api from '../../api/axios'
import {
  toYMD, startOfDay, startOfMonth, endOfMonth, startOfWeek, endOfWeek, getOccurrencesInRange,
} from '../../utils/classOccurrences'

const DAYS_ES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

function capitalize(s) {
  return s ? s[0].toUpperCase() + s.slice(1) : s
}

function OccurrenceRow({ occ, onOpenProgress, onOpenAttendance }) {
  const { gymClass: c, kind, schedule, session } = occ
  const isPrivate = kind === 'session'

  return (
    <button
      type="button"
      onClick={() => (isPrivate ? onOpenProgress(c) : onOpenAttendance(c))}
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
      {isPrivate && (
        <span className={`badge flex-shrink-0 ${
          session.status === 'completed' ? 'badge-green' : session.status === 'missed' ? 'badge-red' : 'badge-gray'
        }`}>
          {session.status === 'completed' ? 'Completada' : session.status === 'missed' ? 'Faltó' : 'Pendiente'}
        </span>
      )}
    </button>
  )
}

export default function AgendaTab({ onOpenProgress, onOpenAttendance }) {
  const today = startOfDay(new Date())
  const [cursorMonth, setCursorMonth] = useState(startOfMonth(today))
  const [selectedDay, setSelectedDay] = useState(today)

  const { data: classes = [], isLoading } = useQuery({
    queryKey: ['classes'],
    queryFn: () => api.get('/classes').then(r => r.data),
  })

  // Reminders: today + rest of this week, independent of whatever month is on screen.
  const weekOccurrences   = getOccurrencesInRange(classes, today, endOfWeek(today))
  const todayYMD          = toYMD(today)
  const todayOccurrences  = weekOccurrences.filter(o => o.date === todayYMD)
  const restOfWeek        = weekOccurrences.filter(o => o.date !== todayYMD)

  // Calendar grid for the visible month.
  const monthStart = startOfMonth(cursorMonth)
  const monthEnd   = endOfMonth(cursorMonth)
  const gridStart  = startOfWeek(monthStart)
  const gridEnd    = endOfWeek(monthEnd)

  const gridOccurrences = getOccurrencesInRange(classes, gridStart, gridEnd)
  const occByDate = new Map()
  gridOccurrences.forEach(o => {
    if (!occByDate.has(o.date)) occByDate.set(o.date, [])
    occByDate.get(o.date).push(o)
  })

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
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Agenda</h2>
        <p className="text-sm text-gray-500 mt-0.5">Todo lo que viene, en orden.</p>
      </div>

      {isLoading ? null : (
        <>
          {/* Reminders — altura fija: ambas tarjetas miden lo mismo tenga o no
              clases, y la lista larga hace scroll interno en vez de crecer. */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <FixedPanel height={320} className="p-4">
              <PanelHeader
                title={<span className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-indigo-500" />Hoy</span>}
                badge={<span className="badge badge-indigo">{todayOccurrences.length}</span>}
              />
              {todayOccurrences.length === 0 ? (
                <EmptyState icon={Sparkles} text="No tienes clases hoy." />
              ) : (
                <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-2">
                  {todayOccurrences.map((o, i) => (
                    <OccurrenceRow key={i} occ={o} onOpenProgress={onOpenProgress} onOpenAttendance={onOpenAttendance} />
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
                    <OccurrenceRow key={i} occ={o} onOpenProgress={onOpenProgress} onOpenAttendance={onOpenAttendance} />
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
                const inMonth = day.getMonth() === cursorMonth.getMonth()
                const isToday = ymd === todayYMD
                const isSelected = ymd === toYMD(selectedDay)

                return (
                  <button
                    key={ymd}
                    type="button"
                    onClick={() => setSelectedDay(day)}
                    className={`aspect-square rounded-lg p-1 flex flex-col items-center justify-start gap-0.5 border transition-colors
                      ${inMonth ? '' : 'opacity-30'}
                      ${isSelected ? 'border-indigo-500 bg-indigo-50' : 'border-transparent hover:bg-gray-50'}
                      ${isToday && !isSelected ? 'ring-1 ring-inset ring-indigo-300' : ''}`}
                  >
                    <span className={`text-xs ${isToday ? 'font-bold text-indigo-600' : 'font-medium text-gray-700'}`}>
                      {day.getDate()}
                    </span>
                    <div className="flex items-center gap-0.5 flex-wrap justify-center">
                      {dayOccs.slice(0, 3).map((o, i) => (
                        <span
                          key={i}
                          className={`w-1.5 h-1.5 rounded-full ${o.kind === 'session' ? 'bg-violet-500' : 'bg-indigo-500'}`}
                        />
                      ))}
                      {dayOccs.length > 3 && (
                        <span className="text-[8px] text-gray-400 leading-none">+{dayOccs.length - 3}</span>
                      )}
                    </div>
                  </button>
                )
              })}
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
                  <OccurrenceRow key={i} occ={o} onOpenProgress={onOpenProgress} onOpenAttendance={onOpenAttendance} />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
