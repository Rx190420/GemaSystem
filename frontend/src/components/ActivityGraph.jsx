import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2, ChevronLeft, ChevronRight, Calendar, CalendarRange, CalendarDays } from 'lucide-react'
import api from '../api/axios'

// ── constants ─────────────────────────────────────────────────
// Solid fills mixed from the app's own brand color (var(--color-primary-500))
// instead of a hardcoded green — the heatmap matches whatever theme the gym
// picked in Configuración → Apariencia instead of clashing with it.
const LEVEL_MIX = [0, 30, 55, 75, 100]
const MO_FULL   = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const MO_SHORT  = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const DOW       = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom']

// ── helpers ───────────────────────────────────────────────────
const pad2     = n  => String(n).padStart(2, '0')
const padDate  = (y, m, d) => `${y}-${pad2(m)}-${pad2(d)}`
const todayStr = () => { const n = new Date(); return padDate(n.getFullYear(), n.getMonth()+1, n.getDate()) }
const getLevel = n  => n===0?0:n===1?1:n<=3?2:n<=5?3:4
const levelStyle = level => level === 0
  ? { background: 'var(--surface-3, #EDEFF3)' }
  : { background: `color-mix(in srgb, var(--color-primary-500) ${LEVEL_MIX[level]}%, var(--surface-3, #EDEFF3))` }

// Consecutive days with at least one visit, counting back from the most
// recent day in the set — a quick, motivating "still going" indicator.
function currentStreak(days) {
  let streak = 0
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].count > 0) streak++
    else break
  }
  return streak
}

// Longest run of consecutive active days anywhere in the period — a
// high-water mark, distinct from currentStreak which only looks back from
// the end. Only worth surfacing over a long span like a year.
function longestStreak(days) {
  let longest = 0, run = 0
  for (const d of days) {
    if (d.count > 0) { run++; if (run > longest) longest = run }
    else run = 0
  }
  return longest
}

// Calendar month with the most total visits in the period.
function busiestMonth(days) {
  const totals = new Map()
  for (const d of days) {
    const key = d.date.slice(0, 7)                      // 'YYYY-MM'
    totals.set(key, (totals.get(key) || 0) + d.count)
  }
  let bestKey = null, bestTotal = 0
  for (const [key, total] of totals) {
    if (total > bestTotal) { bestKey = key; bestTotal = total }
  }
  if (!bestKey) return null
  const month = Number(bestKey.slice(5, 7))
  return { label: MO_FULL[month - 1], total: bestTotal }
}

// Single stat tile — label on top, value + muted suffix below.
function StatBlock({ label, value, suffix }) {
  return (
    <div className="rounded-xl bg-gray-50 px-3.5 py-2.5">
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-sm font-bold text-gray-800 mt-0.5">
        {value} <span className="text-gray-400 font-semibold">{suffix}</span>
      </p>
    </div>
  )
}

// Replaces the old color-scale legend with two numbers that are actually
// useful at a glance: the single busiest day in the period, and the daily
// average across it — solid stat blocks instead of a thin line of text.
// Used by Month/Week, where a month-level or streak-level rollup wouldn't
// mean much over such a short span.
function ActivityFooter({ days }) {
  const active = days.filter(d => d.count > 0)
  if (!active.length) return null
  const best = active.reduce((b, d) => d.count > b.count ? d : b, active[0])
  const avg  = (days.reduce((s, d) => s + d.count, 0) / days.length).toFixed(1)
  const bestLabel = localDate(best.date).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })

  return (
    <div className="grid grid-cols-2 gap-2.5 mt-3 pt-3 border-t border-gray-100">
      <StatBlock label="Mejor día" value={bestLabel} suffix={`· ${best.count}`} />
      <StatBlock label="Promedio"  value={avg}       suffix="/día" />
    </div>
  )
}

// Year view gets a fuller breakdown than Month/Week: six stats instead of
// two, since a full year of data supports rollups (busiest month, longest
// streak) that only make sense over a long span.
function YearFooter({ days }) {
  const active = days.filter(d => d.count > 0)
  if (!active.length) return null
  const best      = active.reduce((b, d) => d.count > b.count ? d : b, active[0])
  const avg       = (days.reduce((s, d) => s + d.count, 0) / days.length).toFixed(1)
  const bestLabel = localDate(best.date).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
  const streak    = currentStreak(days)
  const longest   = longestStreak(days)
  const month     = busiestMonth(days)

  return (
    <div className="grid grid-cols-2 gap-2.5 mt-3 pt-3 border-t border-gray-100">
      <StatBlock label="Mejor día"      value={bestLabel}     suffix={`· ${best.count}`} />
      <StatBlock label="Promedio"       value={avg}           suffix="/día" />
      <StatBlock label="Racha actual"   value={streak}        suffix={`día${streak !== 1 ? 's' : ''}`} />
      <StatBlock label="Mejor racha"    value={longest}       suffix={`día${longest !== 1 ? 's' : ''}`} />
      {month && (
        <StatBlock label="Mes más activo" value={month.label} suffix={`· ${month.total}`} />
      )}
      <StatBlock label="Días activos"   value={active.length} suffix={`/ ${days.length}`} />
    </div>
  )
}

function localDate(dateStr) {
  const [y,m,d] = dateStr.split('-').map(Number)
  return new Date(y, m-1, d)
}

// Monday of the week that contains today + weekOffset weeks
function getMonday(weekOffset = 0) {
  const now = new Date()
  const dow = now.getDay() || 7                      // 1=Mon…7=Sun
  const mon = new Date(now)
  mon.setDate(now.getDate() - (dow - 1) + weekOffset * 7)
  mon.setHours(0, 0, 0, 0)
  return mon
}

// Build week-columns grid (Mon-first). days = [{date,count}]
function buildGrid(days) {
  if (!days.length) return []
  const first  = localDate(days[0].date)
  const rawDow = first.getDay()                      // 0=Sun…6=Sat
  const pad    = rawDow === 0 ? 6 : rawDow - 1      // cells to prepend
  const cells  = [...Array(pad).fill(null), ...days]
  const weeks  = []
  for (let i = 0; i < cells.length; i += 7) {
    const week = cells.slice(i, i + 7)
    while (week.length < 7) week.push(null)
    weeks.push(week)
  }
  return weeks
}

// ── Shared heatmap grid ───────────────────────────────────────
function HeatmapGrid({ weeks, tickLabels = [], allDayLabels = false, cell = 16, gap = 3 }) {
  const today = todayStr()
  const lblW  = 30

  return (
    <div className="flex justify-center">
      <div>
        {/* top tick labels */}
        {tickLabels.length > 0 && (
          <div className="flex mb-1" style={{ marginLeft: lblW + 4 }}>
            {weeks.map((_, wi) => {
              const tick = tickLabels.find(t => t.col === wi)
              return (
                <div key={wi} style={{ width: cell + gap }}
                  className="text-[10px] text-gray-400 overflow-visible whitespace-nowrap leading-none">
                  {tick?.label ?? ''}
                </div>
              )
            })}
          </div>
        )}

        <div className="flex">
          {/* day-of-week labels */}
          <div className="flex flex-col mr-1" style={{ width: lblW }}>
            {DOW.map((lbl, i) => (
              <div key={i} style={{ height: cell + gap }}
                className="text-[10px] text-gray-400 flex items-center justify-end pr-1 leading-none">
                {(allDayLabels || [0, 2, 4].includes(i)) ? lbl : ''}
              </div>
            ))}
          </div>

          {/* week columns */}
          <div className="flex" style={{ gap }}>
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col" style={{ gap }}>
                {week.map((day, di) => {
                  if (!day) return <div key={di} style={{ width: cell, height: cell }} className="rounded-sm" />
                  const level   = getLevel(day.count)
                  const isToday = day.date === today
                  const d       = localDate(day.date)
                  const label   = d.toLocaleDateString('es-MX', { weekday:'short', day:'numeric', month:'short' })
                  return (
                    <div key={di}
                      title={`${label}: ${day.count} visita${day.count!==1?'s':''}`}
                      style={{ width: cell, height: cell, ...levelStyle(level), '--tw-ring-color': 'var(--color-primary-600)' }}
                      className={`rounded-md cursor-default transition-transform hover:scale-125
                        ${isToday ? 'ring-2 ring-offset-1' : ''}`}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Year view ─────────────────────────────────────────────────
function YearView({ days }) {
  if (!days.length) return <p className="text-xs text-gray-400 text-center py-6">Sin visitas registradas</p>
  const total  = days.reduce((s,d)=>s+d.count, 0)
  const streak = currentStreak(days)
  const weeks  = buildGrid(days)

  const ticks = []; let lastM = -1
  weeks.forEach((week, wi) => {
    const first = week.find(Boolean)
    if (!first) return
    const m = localDate(first.date).getMonth()
    if (m !== lastM) { ticks.push({ col: wi, label: MO_SHORT[m] }); lastM = m }
  })

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        {streak > 0 ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-orange-50 text-orange-600 border border-orange-100">
            🔥 {streak} día{streak !== 1 ? 's' : ''} seguidos
          </span>
        ) : <span />}
        <span className="text-xs text-gray-400">{total} visita{total!==1?'s':''} en el último año</span>
      </div>
      <div className="overflow-x-auto pb-1">
        <HeatmapGrid weeks={weeks} tickLabels={ticks} allDayLabels={false} cell={14} gap={3} />
      </div>
      <YearFooter days={days} />
    </div>
  )
}

// ── Month view ────────────────────────────────────────────────
function MonthView({ days }) {
  const total = days.reduce((s,d)=>s+d.count, 0)
  const weeks = buildGrid(days)

  const ticks = weeks.map((week, wi) => {
    const first = week.find(Boolean)
    if (!first) return null
    return { col: wi, label: String(localDate(first.date).getDate()) }
  }).filter(Boolean)

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-400 text-right">{total} visita{total!==1?'s':''} en el mes</p>
      <HeatmapGrid weeks={weeks} tickLabels={ticks} allDayLabels={true} cell={28} gap={5} />
      <ActivityFooter days={days} />
    </div>
  )
}

// ── Week view ─────────────────────────────────────────────────
function WeekView({ days }) {
  const total = days.reduce((s,d)=>s+d.count, 0)
  const weeks = [days.length === 7 ? days : Array.from({ length:7 }, (_,i) => days[i] ?? null)]

  const first = days[0]?.date, last = days[days.length-1]?.date
  const ticks = first ? [{ col:0, label: `${localDate(first).getDate()}–${localDate(last).getDate()}` }] : []

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-400 text-right">{total} visita{total!==1?'s':''} en la semana</p>
      <HeatmapGrid weeks={weeks} tickLabels={ticks} allDayLabels={true} cell={44} gap={6} />
      <ActivityFooter days={days} />
    </div>
  )
}

const VIEW_LABELS = { year: 'Año', month: 'Mes', week: 'Semana' }
// Icon-only toggle — one glyph per granularity, no text, so the switcher
// reads as a single compact control tucked in the card's top-right corner.
const VIEW_ICONS  = { year: CalendarRange, month: Calendar, week: CalendarDays }

// ── Main export ───────────────────────────────────────────────
// Pass either `memberId` (per-member activity, the original use case) or
// `endpoint` (any gym-wide activity feed, e.g. the Dashboard's) — same grid,
// same views, just a different data source and title. `views` controls which
// of the three tabs are offered (e.g. the Dashboard drops "Semana"), and its
// first entry is what loads initially — "month" leads so the widget opens on
// the most immediately useful, glanceable period.
export default function ActivityGraph({ memberId, endpoint, title = 'Actividad de visitas', icon: Icon, views = ['month', 'year', 'week'] }) {
  const url = memberId ? `/members/${memberId}/activity` : endpoint
  const [view,   setView]   = useState(views[0])
  const [offset, setOffset] = useState(0)        // 0 = current period

  const range = useMemo(() => {
    if (view === 'year') return null

    if (view === 'month') {
      const now    = new Date()
      const target = new Date(now.getFullYear(), now.getMonth() + offset, 1)
      const y = target.getFullYear(), m = target.getMonth()
      const from = padDate(y, m+1, 1)
      const to   = padDate(y, m+1, new Date(y, m+1, 0).getDate())
      return { from, to, label: `${MO_FULL[m]} ${y}` }
    }

    if (view === 'week') {
      const mon = getMonday(offset)
      const sun = new Date(mon); sun.setDate(mon.getDate()+6)
      const from = padDate(mon.getFullYear(), mon.getMonth()+1, mon.getDate())
      const to   = padDate(sun.getFullYear(), sun.getMonth()+1, sun.getDate())
      const fmtD = d => d.toLocaleDateString('es-MX', { day:'numeric', month:'short' })
      return { from, to, label: `${fmtD(mon)} – ${fmtD(sun)}` }
    }
  }, [view, offset])

  const { data: days = [], isLoading } = useQuery({
    queryKey: ['activity-graph', memberId ?? endpoint, view, offset],
    queryFn:  () => {
      const params = range ? { from: range.from, to: range.to } : {}
      return api.get(url, { params }).then(r => r.data)
    },
    staleTime: 30_000,
  })

  function switchView(v) { setView(v); setOffset(0) }

  return (
    <div className="space-y-4">

      {/* header + icon-only period toggle, pinned top-right */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          {Icon && (
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{
                background: 'color-mix(in srgb, var(--color-primary-500) 12%, transparent)',
                border: '1px solid color-mix(in srgb, var(--color-primary-500) 20%, transparent)',
              }}
            >
              <Icon className="w-4 h-4" style={{ color: 'var(--color-primary-600)' }} />
            </div>
          )}
          <p className="text-sm font-semibold text-gray-800 truncate">{title}</p>
        </div>
        <div className="flex gap-0.5 bg-gray-100 rounded-lg p-0.5 flex-shrink-0">
          {views.map(key => {
            const ViewIcon = VIEW_ICONS[key]
            return (
              <button key={key} onClick={() => switchView(key)}
                title={VIEW_LABELS[key]} aria-label={VIEW_LABELS[key]} aria-pressed={view === key}
                className={`w-7 h-7 flex items-center justify-center rounded-md transition-all
                  ${view===key ? 'bg-white shadow text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}>
                <ViewIcon className="w-3.5 h-3.5" />
              </button>
            )
          })}
        </div>
      </div>

      {/* prev / next navigation */}
      {view !== 'year' && range && (
        <div className="flex items-center justify-between">
          <button onClick={() => setOffset(o=>o-1)}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold text-gray-700 capitalize">{range.label}</span>
          <button onClick={() => setOffset(o=>o+1)} disabled={offset >= 0}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* content */}
      {isLoading ? (
        <div className="flex items-center justify-center h-24">
          <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
        </div>
      ) : view === 'year'  ? <YearView  days={days} />
        : view === 'month' ? <MonthView days={days} />
        :                    <WeekView  days={days} />
      }

    </div>
  )
}
