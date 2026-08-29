 import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Skeleton } from 'boneyard-js/react'
import { LoadingLogoOverlay } from '../components/SkeletonLogoMark'
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  TrendingUp, TrendingDown, Eye, EyeOff, Loader2, CreditCard,
  X, BarChart2, Activity, Award,
  DollarSign, CalendarDays, Zap, CalendarCheck, Plus, Pencil, Trash2, Search, User,
} from 'lucide-react'
import api from '../api/axios'
import toast from 'react-hot-toast'
import { isSparseTrend, trimLeadingEmpty } from '../utils/charts'
import { useSettingsStore } from '../store/settingsStore'
import { useAuthStore } from '../store/authStore'
import useLockBodyScroll from '../hooks/useLockBodyScroll'
import ExportMenu from '../components/ExportMenu'
import { exportFinancesExcel, exportFinancesPDF } from '../utils/financeExportUtils'
import { runExport } from '../utils/runExport'
import useSort from '../hooks/useSort'
import SortableTh from '../components/SortableTh'
import Pagination from '../components/Pagination'

const MONTH_NAMES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const METHOD_LABELS  = { cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia' }
const METHOD_COLORS  = { cash: '#10B981',  card: '#818CF8', transfer: '#F59E0B' }
const SOURCE_COLORS  = ['#818CF8', '#34D399']
const SOURCE_COLORS2 = ['#6366F1', '#10B981']

const CHART_TYPES = [
  { id: 'area', label: 'Área',   icon: Activity },
  { id: 'line', label: 'Línea',  icon: TrendingUp },
  { id: 'bar',  label: 'Barras', icon: BarChart2 },
]

const ORIGIN_LABEL  = { membership: 'Membresía', visit: 'Visita', product: 'Producto', manual: 'Manual' }
const ORIGIN_STYLE  = {
  membership: 'bg-indigo-50 text-indigo-700',
  visit:      'bg-emerald-50 text-emerald-700',
  product:    'bg-orange-50 text-orange-700',
  manual:     'bg-amber-50 text-amber-700',
}

const EXPORT_COLS = [
  { header: 'Miembro',     value: r => r.member ?? '—' },
  { header: 'Código',      value: r => r.member_code ?? '—' },
  { header: 'Concepto',    value: r => r.concept ?? '—' },
  { header: 'Fecha',       value: r => r.date ? new Date(r.date + 'T12:00').toLocaleDateString('es-MX') : '—' },
  { header: 'Origen',      value: r => ORIGIN_LABEL[r.origin] ?? r.origin ?? '—' },
  { header: 'Método',      value: r => METHOD_LABELS[r.payment_method] ?? r.payment_method ?? '—' },
  { header: 'Monto (MXN)', value: r => parseFloat(r.amount ?? 0).toFixed(2) },
  { header: 'Notas',       value: r => r.notes ?? '' },
]

// ── IngresoModal (create / edit) ─────────────────────────────────────────────

function IngresoModal({ ingreso, onClose, onSaved }) {
  useLockBodyScroll()
  const isEdit = !!ingreso?.id
  const [form, setForm] = useState({
    concept:        ingreso?.concept        ?? '',
    amount:         ingreso?.amount         ?? '',
    payment_method: ingreso?.payment_method ?? 'cash',
    origin:         ingreso?.origin         ?? 'manual',
    date:           ingreso?.date           ?? new Date().toISOString().split('T')[0],
    notes:          ingreso?.notes          ?? '',
    member_id:      ingreso?.member_id      ?? null,
  })
  const [saving, setSaving] = useState(false)
  const [memberQ, setMemberQ]         = useState(ingreso?.member ? `${ingreso.member}` : '')
  const [selectedMember, setSelected] = useState(ingreso?.member_id ? { id: ingreso.member_id, display: ingreso.member ?? '' } : null)

  const { data: memberResults = [], isFetching: searchingMembers } = useQuery({
    queryKey: ['ingreso-member-search', memberQ],
    queryFn: () => memberQ.length >= 2
      ? api.get('/members/search', { params: { q: memberQ } }).then(r => r.data)
      : [],
    enabled: memberQ.length >= 2 && !selectedMember,
  })

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  useEffect(() => {
    set('member_id', selectedMember?.id ?? null)
  }, [selectedMember])

  const save = async () => {
    if (!form.concept.trim()) return toast.error('El concepto es requerido')
    if (!form.amount || isNaN(form.amount) || Number(form.amount) <= 0) return toast.error('Monto inválido')
    if (!form.date) return toast.error('La fecha es requerida')
    setSaving(true)
    try {
      if (isEdit) {
        await api.put(`/ingresos/${ingreso.id}`, form)
        toast.success('Ingreso actualizado')
      } else {
        await api.post('/ingresos', form)
        toast.success('Ingreso registrado')
      }
      onSaved()
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Error al guardar')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">{isEdit ? 'Editar ingreso' : 'Nuevo ingreso'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3">
          {/* Socio asociado */}
          <div>
            <label className="label">Socio (opcional)</label>
            {selectedMember ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-50 border border-indigo-100">
                <User className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                <span className="flex-1 text-sm font-medium text-gray-800">{selectedMember.display}</span>
                <button type="button" onClick={() => { setSelected(null); setMemberQ('') }} className="text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  value={memberQ}
                  onChange={e => setMemberQ(e.target.value)}
                  placeholder="Buscar por nombre o código…"
                  className="input pl-9"
                />
                {searchingMembers && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300 animate-spin" />}
                {memberResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10 max-h-40 overflow-y-auto">
                    {memberResults.map(m => (
                      <button key={m.id} type="button"
                        onClick={() => { setSelected({ id: m.id, display: `${m.first_name} ${m.last_name}` }); setMemberQ('') }}
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2 text-sm transition-colors"
                      >
                        <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-bold flex-shrink-0">
                          {m.first_name[0]}{m.last_name[0]}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{m.first_name} {m.last_name}</p>
                          <p className="text-xs text-gray-400">{m.member_code ?? m.email ?? ''}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Concepto */}
          <div>
            <label className="label">Concepto *</label>
            <input value={form.concept} onChange={e => set('concept', e.target.value)}
              placeholder="Ej. Membresía mensual, Clase especial…" className="input" />
          </div>

          {/* Amount + Method */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Monto *</label>
              <input type="number" min="0.01" step="0.01" value={form.amount}
                onChange={e => set('amount', e.target.value)}
                placeholder="0.00" className="input" />
            </div>
            <div>
              <label className="label">Método de pago</label>
              <select value={form.payment_method} onChange={e => set('payment_method', e.target.value)} className="input">
                <option value="cash">Efectivo</option>
                <option value="card">Tarjeta</option>
                <option value="transfer">Transferencia</option>
              </select>
            </div>
          </div>

          {/* Date + Origin */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Fecha *</label>
              <input type="date" value={form.date} onChange={e => set('date', e.target.value)} className="input" />
            </div>
            <div>
              <label className="label">Origen</label>
              <select value={form.origin} onChange={e => set('origin', e.target.value)} className="input">
                <option value="manual">Manual</option>
                <option value="membership">Membresía</option>
                <option value="visit">Visita</option>
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="label">Notas (opcional)</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
              rows={2} placeholder="Información adicional…" className="input resize-none" />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button onClick={save} disabled={saving} className="btn-primary flex-1">
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando…</> : isEdit ? 'Guardar cambios' : 'Registrar ingreso'}
          </button>
        </div>
      </div>
    </div>
  )
}

function fmt(val) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(val ?? 0)
}

function buildMonthly(byMonth) {
  const now = new Date()
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1)
    const y = d.getFullYear(), m = d.getMonth() + 1
    // Use loose equality to handle string/number differences from API
    const found = byMonth?.find(r => Number(r.year) === y && Number(r.month) === m)
    return { name: `${MONTH_NAMES[m - 1]} ${String(y).slice(2)}`, total: Number(found?.total ?? 0) }
  })
}

function fmtDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function pct(a, b) {
  if (!b || b === 0) return null
  return ((a - b) / b) * 100
}

function ChartTypePicker({ value, onChange, dark = false }) {
  return (
    <div className={`flex rounded-lg overflow-hidden border ${dark ? 'border-white/20' : 'border-gray-200 bg-white'}`}>
      {CHART_TYPES.map(ct => (
        <button key={ct.id} onClick={() => onChange(ct.id)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium transition-colors
            ${dark
              ? value === ct.id ? 'bg-white/20 text-white' : 'text-white/50 hover:bg-white/10 hover:text-white'
              : value === ct.id ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-50'
            }`}
        >
          <ct.icon className="w-3 h-3" />
          {ct.label}
        </button>
      ))}
    </div>
  )
}

const AXIS  = { tick: { fontSize: 11, fill: '#94A3B8' }, tickLine: false, axisLine: false }
const GRID  = <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
const TIPST = { contentStyle: { borderRadius: '10px', border: '1px solid #E2E8F0', fontSize: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' } }

function TrendChart({ data, chartType, color = '#6366F1', privacyMode }) {
  if (privacyMode) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-300 text-sm gap-2">
        <EyeOff className="w-5 h-5" /> Números ocultos
      </div>
    )
  }
  // Always render the chart — even with zero data so axes are visible
  const props = { data, margin: { top: 8, right: 8, bottom: 8, left: 0 } }
  const yFmt  = v => `$${(v / 1000).toFixed(0)}k`
  const tip   = { ...TIPST, formatter: v => [fmt(v), 'Ingresos'] }

  if (chartType === 'line') return (
    <ResponsiveContainer width="100%" height={256}>
      <LineChart {...props}>
        {GRID}
        <XAxis dataKey="name" {...AXIS} />
        <YAxis {...AXIS} tickFormatter={yFmt} width={45} />
        <Tooltip {...tip} />
        <Line type="monotone" dataKey="total" stroke={color} strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: color }} />
      </LineChart>
    </ResponsiveContainer>
  )

  if (chartType === 'bar') return (
    <ResponsiveContainer width="100%" height={256}>
      <BarChart {...props}>
        {GRID}
        <XAxis dataKey="name" {...AXIS} />
        <YAxis {...AXIS} tickFormatter={yFmt} width={45} />
        <Tooltip {...tip} />
        <Bar dataKey="total" fill={color} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )

  return (
    <ResponsiveContainer width="100%" height={256}>
      <AreaChart {...props}>
        <defs>
          <linearGradient id="finGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={color} stopOpacity={0.2} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        {GRID}
        <XAxis dataKey="name" {...AXIS} />
        <YAxis {...AXIS} tickFormatter={yFmt} width={45} />
        <Tooltip {...tip} />
        <Area type="monotone" dataKey="total" stroke={color} strokeWidth={2.5} fill="url(#finGrad)" dot={false} activeDot={{ r: 4, fill: color }} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ── Activity heatmap ─────────────────────────────────────────────
// Solid fills mixed from the app's own brand color (var(--color-primary-500))
// over the current theme's surface tone, instead of hardcoded hex — so the
// scale stays legible in dark mode (var(--surface-3) flips with the theme)
// rather than showing pale indigo-50 squares on a dark background.
const HEAT_LEVEL_MIX = [0, 30, 55, 78, 100]
const heatColor = level => level === 0
  ? 'var(--surface-3, #EEF2FF)'
  : `color-mix(in srgb, var(--color-primary-500) ${HEAT_LEVEL_MIX[level]}%, var(--surface-3, #EEF2FF))`
const CELL_SIZE   = 15   // px — bumped from 13 so the grid reads as a real calendar, not a smudge
const CELL_GAP    = 4    // px
const CELL_STEP   = CELL_SIZE + CELL_GAP   // 19 px
const MONTH_ROW_H = CELL_SIZE + 5          // 20 px

function ActivityHeatmap({ data }) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const dataMap = {}
  ;(data ?? []).forEach(d => { dataMap[d.date] = d.count })

  // Align start to nearest Sunday ≤ (today − 364 days)
  const rawStart = new Date(today)
  rawStart.setDate(today.getDate() - 364)
  const start = new Date(rawStart)
  start.setDate(rawStart.getDate() - rawStart.getDay())

  // Build week columns
  const weeks = []
  const cur   = new Date(start)
  while (cur <= today) {
    const week = []
    for (let dow = 0; dow < 7; dow++) {
      const dateStr = fmtDate(cur)
      week.push({
        date:    dateStr,
        count:   dataMap[dateStr] ?? 0,
        active:  cur >= rawStart && cur <= today,
        isToday: cur.getTime() === today.getTime(),
      })
      cur.setDate(cur.getDate() + 1)
    }
    weeks.push(week)
  }

  // ── Derived metrics ──────────────────────────────────────────────
  const allEntries  = data ?? []
  const counts      = allEntries.map(d => d.count)
  const maxCount    = Math.max(...counts, 1)
  const total       = counts.reduce((a, b) => a + b, 0)
  const activeDays  = counts.filter(c => c > 0).length

  // Best single day
  const bestDay = allEntries.reduce((b, d) => (!b || d.count > b.count) ? d : b, null)

  // Visits this calendar month
  const thisMonthPfx   = fmtDate(today).slice(0, 7)
  const thisMonthTotal = allEntries
    .filter(d => d.date.startsWith(thisMonthPfx))
    .reduce((s, d) => s + d.count, 0)

  // Current streak
  let streak = 0
  const sc = new Date(today)
  if (!dataMap[fmtDate(sc)]) sc.setDate(sc.getDate() - 1)
  while (dataMap[fmtDate(sc)] > 0) { streak++; sc.setDate(sc.getDate() - 1) }

  // Longest streak anywhere in the period — walks the full day-by-day grid
  // (not just the sparse `data` entries) so gaps between recorded dates
  // actually break the run.
  let longestStreak = 0, run = 0
  weeks.flat().forEach(d => {
    if (!d.active) return
    if (d.count > 0) { run++; if (run > longestStreak) longestStreak = run }
    else run = 0
  })

  // Calendar month with the most total visits in the period
  const monthTotals = {}
  allEntries.forEach(d => {
    const key = d.date.slice(0, 7)
    monthTotals[key] = (monthTotals[key] || 0) + d.count
  })
  const busiestKey = Object.keys(monthTotals).reduce(
    (best, key) => (!best || monthTotals[key] > monthTotals[best]) ? key : best, null
  )
  const busiestMonth = busiestKey
    ? { label: MONTH_NAMES[Number(busiestKey.slice(5, 7)) - 1], total: monthTotals[busiestKey] }
    : null

  // Color level (0–4)
  const getLevel = (count, active) => {
    if (!active || !count) return 0
    const r = count / maxCount
    if (r <= 0.20) return 1
    if (r <= 0.45) return 2
    if (r <= 0.75) return 3
    return 4
  }

  // Month label appears when a new month starts within a week column
  const monthLabels = weeks.map((week, wi) => {
    const d = new Date(week[0].date)
    if (wi === 0) return MONTH_NAMES[new Date(week.find(x => x.active)?.date ?? week[0].date).getMonth()]
    const prev = new Date(weeks[wi - 1][0].date).getMonth()
    return d.getMonth() !== prev ? MONTH_NAMES[d.getMonth()] : null
  })

  const DAY_LABELS = ['Dom', '', 'Mar', '', 'Jue', '', 'Sáb']

  return (
    <div>
      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {/* Total */}
        <div className="rounded-xl p-3.5 bg-gray-50 border border-gray-100">
          <p className="text-xl font-bold text-gray-900 tabular-nums leading-none">{total}</p>
          <p className="text-xs text-gray-500 mt-1.5">Visitas · último año</p>
        </div>

        {/* Active days */}
        <div className="rounded-xl p-3.5 bg-gray-50 border border-gray-100">
          <p className="text-xl font-bold text-gray-900 tabular-nums leading-none">{activeDays}</p>
          <p className="text-xs text-gray-500 mt-1.5">Días con actividad</p>
        </div>

        {/* Streak */}
        <div className={`rounded-xl p-3.5 border transition-colors ${
          streak > 0 ? 'bg-orange-50 border-orange-100' : 'bg-gray-50 border-gray-100'
        }`}>
          <div className="flex items-center gap-1.5">
            <p className={`text-xl font-bold tabular-nums leading-none ${streak > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
              {streak}
            </p>
            {streak > 0 && <Zap className="w-4 h-4 text-orange-400 flex-shrink-0" />}
          </div>
          <p className={`text-xs mt-1.5 ${streak > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
            {streak > 0 ? 'Días seguidos' : 'Sin racha activa'}
          </p>
        </div>

        {/* Longest streak — the high-water mark, distinct from the current run above */}
        <div className="rounded-xl p-3.5 bg-gray-50 border border-gray-100">
          <p className="text-xl font-bold text-gray-900 tabular-nums leading-none">{longestStreak}</p>
          <p className="text-xs text-gray-500 mt-1.5">Mejor racha</p>
        </div>

        {/* Busiest calendar month */}
        <div className="rounded-xl p-3.5 bg-gray-50 border border-gray-100">
          <p className="text-xl font-bold text-gray-900 leading-none truncate">{busiestMonth?.label ?? '—'}</p>
          <p className="text-xs text-gray-500 mt-1.5">
            Mes más activo{busiestMonth ? ` · ${busiestMonth.total}` : ''}
          </p>
        </div>

        {/* This month */}
        <div className="rounded-xl p-3.5 bg-indigo-50 border border-indigo-100">
          <p className="text-xl font-bold text-indigo-700 tabular-nums leading-none">{thisMonthTotal}</p>
          <p className="text-xs text-indigo-500 mt-1.5">Visitas este mes</p>
        </div>
      </div>

      {/* ── Heatmap grid — framed in its own panel so it reads as the card's
          focal element instead of floating loose against the page ── */}
      <div className="overflow-x-auto pb-2 -mx-1 px-1">
        <div className="flex min-w-max rounded-2xl p-4"
          style={{ background: 'var(--surface-base)', border: '1px solid var(--surface-border2)' }}>

          {/* Day-of-week labels — offset by month-label row height */}
          <div className="flex flex-col pr-2.5" style={{ paddingTop: `${MONTH_ROW_H + 4}px` }}>
            {DAY_LABELS.map((label, i) => (
              <div key={i} style={{ height: `${CELL_STEP}px` }} className="flex items-center">
                <span className="text-[10px] font-semibold w-6 text-right leading-none select-none"
                  style={{ color: 'var(--text-secondary)' }}>{label}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-col">
            {/* Month labels */}
            <div className="flex mb-1" style={{ height: `${MONTH_ROW_H}px` }}>
              {weeks.map((_, wi) => (
                <div key={wi} style={{ width: `${CELL_STEP}px`, flexShrink: 0 }}>
                  {monthLabels[wi] && (
                    <span className="text-[10px] font-bold leading-none whitespace-nowrap tracking-wide"
                      style={{ color: 'var(--text-secondary)' }}>
                      {monthLabels[wi]}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Cells */}
            <div className="flex" style={{ gap: `${CELL_GAP}px` }}>
              {weeks.map((week, wi) => (
                <div key={wi} className="flex flex-col" style={{ gap: `${CELL_GAP}px` }}>
                  {week.map((day, di) => {
                    const level = getLevel(day.count, day.active)
                    const bg    = day.active ? heatColor(level) : 'transparent'
                    const tip   = day.active
                      ? `${new Date(day.date + 'T12:00').toLocaleDateString('es-MX', {
                          weekday: 'long', day: 'numeric', month: 'long',
                        })}: ${day.count} visita${day.count !== 1 ? 's' : ''}`
                      : undefined

                    return (
                      <div
                        key={di}
                        title={tip}
                        style={{
                          width:        `${CELL_SIZE}px`,
                          height:       `${CELL_SIZE}px`,
                          borderRadius: '4px',
                          background:   bg,
                          flexShrink:   0,
                          // Every real day gets a hairline border so the grid reads as a
                          // calendar even when a cell has zero visits — without it, empty
                          // cells (whose fill matches the panel behind them) disappear.
                          boxShadow:    day.active ? 'inset 0 0 0 1px var(--surface-border2)' : 'none',
                          // Today: brighter ring in the theme's accent color
                          outline:      day.isToday ? '2px solid var(--color-primary-500)' : 'none',
                          outlineOffset:'1px',
                        }}
                        className={day.active && day.count > 0 ? 'cursor-help' : ''}
                      />
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Footer: best day + legend ── */}
      <div className="flex items-center justify-between mt-4 flex-wrap gap-3">
        {bestDay && bestDay.count > 0 ? (
          <p className="text-xs flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
            <span className="inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0"
              style={{ background: heatColor(4) }} />
            Pico:{' '}
            <span className="font-semibold text-gray-700">{bestDay.count} visita{bestDay.count !== 1 ? 's' : ''}</span>
            {' '}el {new Date(bestDay.date + 'T12:00').toLocaleDateString('es-MX', {
              day: 'numeric', month: 'short', year: 'numeric',
            })}
          </p>
        ) : <span />}

        <div className="flex items-center gap-1.5 ml-auto">
          <span className="text-[10px] font-semibold mr-0.5" style={{ color: 'var(--text-secondary)' }}>Menos</span>
          {HEAT_LEVEL_MIX.map((_, i) => (
            <div key={i} style={{ width: '11px', height: '11px', borderRadius: '2px', background: heatColor(i),
              boxShadow: 'inset 0 0 0 1px var(--surface-border2)' }} />
          ))}
          <span className="text-[10px] font-semibold ml-0.5" style={{ color: 'var(--text-secondary)' }}>Más</span>
        </div>
      </div>
    </div>
  )
}

function CustomPieTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const { name, value } = payload[0].payload
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-4 py-2.5 text-xs">
      <p className="font-semibold text-gray-800">{name}</p>
      <p className="text-indigo-600 font-bold">{fmt(value)}</p>
    </div>
  )
}

export default function Finances() {
  const { privacyMode, togglePrivacy, systemSettings } = useSettingsStore()
  const { user }                        = useAuthStore()
  const canExport                       = user?.plan_features?.export !== false
  const qc                              = useQueryClient()
  const [page, setPage]                 = useState(1)
  const [pageSize, setPageSize]         = useState(12)
  const [monthFilter, setMonthFilter]   = useState('')
  const [originFilter, setOriginFilter] = useState('')
  const [chartType, setChartType]       = useState('area')
  const [exporting, setExporting]       = useState(false)
  const [modal, setModal]               = useState(null)   // null | 'new' | {ingreso object}
  const [sort, onSort]                  = useSort('date', 'desc')
  const handleSort = key => { onSort(key); setPage(1) }
  const handlePageSize = n => { setPageSize(n); setPage(1) }

  const mask = val => privacyMode ? '••••' : val

  const { data: summary, isLoading } = useQuery({
    queryKey: ['finance-summary'],
    queryFn: () => api.get('/finances/summary').then(r => r.data),
  })

  const txParams = {
    page, per_page: pageSize,
    ...(monthFilter  && { month: monthFilter }),
    ...(originFilter && { origin: originFilter }),
    sort_by: sort.by, sort_dir: sort.dir,
  }

  const { data: txData, isLoading: loadingTx } = useQuery({
    queryKey: ['ingresos', txParams],
    queryFn: () => api.get('/ingresos', { params: txParams }).then(r => r.data),
    keepPreviousData: true,
  })

  const s           = summary?.summary
  const monthChange = s ? pct(s.this_month, s.last_month) : null
  const monthlyData = trimLeadingEmpty(buildMonthly(summary?.by_month), 'total')
  const pieData     = (summary?.by_source ?? []).filter(d => d.value > 0)
  const transactions = txData?.data ?? []
  const pagination   = txData
    ? { current: txData.current_page, last: txData.last_page, total: txData.total }
    : null

  const dailyData    = (summary?.by_day_month ?? []).map(d => ({ day: `${d.day}`, total: Number(d.total) }))
  const topMembers   = summary?.top_members ?? []
  const methods      = summary?.by_method ?? []
  const heatmapData  = summary?.activity_heatmap ?? []

  const invalidate = () => {
    qc.invalidateQueries(['ingresos'])
    qc.invalidateQueries(['finance-summary'])
  }

  async function handleDelete(id) {
    if (!window.confirm('¿Eliminar este ingreso? Esta acción no se puede deshacer.')) return
    try {
      await api.delete(`/ingresos/${id}`)
      toast.success('Ingreso eliminado')
      invalidate()
    } catch { toast.error('No se pudo eliminar') }
  }

  async function fetchAllTx(signal) {
    const res = await api.get('/ingresos', { params: { ...txParams, page: 1, per_page: 9999 }, signal })
    return res.data.data ?? []
  }
  function txFilterLabel() {
    const parts = []
    if (monthFilter) parts.push(`Detalle filtrado a ${new Date(monthFilter + '-02').toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}`)
    if (originFilter) parts.push(`origen: ${ORIGIN_LABEL[originFilter] ?? originFilter}`)
    return parts.join(' · ')
  }
  async function handleExportExcel() {
    setExporting(true)
    const gymName = systemSettings?.gym_name || 'GemaSystem'
    try {
      await runExport({
        label: 'Reporte Financiero', fileLabel: 'finanzas_desglose.xlsx', kind: 'excel',
        task: async (signal, setPhase) => {
          const transactions = await fetchAllTx(signal)
          setPhase('generating')
          return exportFinancesExcel({ summary, transactions, txColumns: EXPORT_COLS, gymName, subtitle: txFilterLabel() })
        },
      })
    } finally { setExporting(false) }
  }
  async function handleExportPDF() {
    setExporting(true)
    const gymName = systemSettings?.gym_name || 'GemaSystem'
    try {
      await runExport({
        label: 'Reporte Financiero', fileLabel: 'finanzas_desglose.pdf', kind: 'pdf',
        task: async (signal, setPhase) => {
          const transactions = await fetchAllTx(signal)
          setPhase('generating')
          return exportFinancesPDF({ summary, transactions, txColumns: EXPORT_COLS, gymName, subtitle: txFilterLabel() })
        },
      })
    } finally { setExporting(false) }
  }

  const maxMethod = methods.reduce((acc, m) => Math.max(acc, m.total), 0)
  const maxMember = topMembers[0]?.total ?? 1

  return (
    <>
    <LoadingLogoOverlay show={isLoading || loadingTx} />
    <div className="space-y-8">

      {/* Modal */}
      {modal && (
        <IngresoModal
          ingreso={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); invalidate() }}
        />
      )}

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Finanzas</h2>
          <p className="text-sm text-gray-500 mt-0.5">Panel financiero del gimnasio</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setModal('new')}
            className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Nuevo ingreso
          </button>
          <button onClick={togglePrivacy} className="btn-secondary flex items-center gap-2">
            {privacyMode ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            {privacyMode ? 'Mostrar' : 'Ocultar'}
          </button>
          {canExport && <ExportMenu onExportExcel={handleExportExcel} onExportPDF={handleExportPDF} loading={exporting} />}
        </div>
      </div>

      <Skeleton name="finances-page" loading={isLoading}>
        <div className="space-y-6">
          {/* ── KPI cards ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

            <div className="card p-5 flex items-start gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 shadow-lg flex-shrink-0">
                <DollarSign className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total histórico</p>
                <p className="text-2xl font-bold text-gray-900 mt-0.5 tabular-nums truncate">{mask(fmt(s?.total))}</p>
                <p className="text-xs text-gray-400 mt-0.5">Membresías + visitas</p>
                {!privacyMode && s?.total_tx != null && (
                  <p className="text-xs text-gray-400">{s.total_tx} transacciones</p>
                )}
              </div>
            </div>

            <div className="card p-5 flex items-start gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg flex-shrink-0">
                <CalendarDays className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Este mes</p>
                <p className="text-2xl font-bold text-gray-900 mt-0.5 tabular-nums truncate">{mask(fmt(s?.this_month))}</p>
                {monthChange !== null && !privacyMode ? (
                  <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${monthChange >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {monthChange >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {monthChange >= 0 ? '+' : ''}{monthChange.toFixed(1)}% vs anterior
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 mt-0.5">mes actual</p>
                )}
                {!privacyMode && s?.mem_tx_month != null && (
                  <p className="text-xs text-gray-400">{s.mem_tx_month} mem · {s.visit_tx_month} vis</p>
                )}
              </div>
            </div>

            <div className="card p-5 flex items-start gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg flex-shrink-0">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Esta semana</p>
                <p className="text-2xl font-bold text-gray-900 mt-0.5 tabular-nums truncate">{mask(fmt(s?.this_week))}</p>
                <p className="text-xs text-gray-400 mt-0.5">ingresos recientes</p>
                {!privacyMode && s?.avg_amount != null && (
                  <p className="text-xs text-gray-400">Prom. {fmt(s.avg_amount)} / tx</p>
                )}
              </div>
            </div>

            <div className="card p-5 flex items-start gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 shadow-lg flex-shrink-0">
                <CalendarCheck className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Este año</p>
                <p className="text-2xl font-bold text-gray-900 mt-0.5 tabular-nums truncate">{mask(fmt(s?.this_year))}</p>
                <p className="text-xs text-gray-400 mt-0.5">{new Date().getFullYear()}</p>
                {!privacyMode && s?.last_month != null && (
                  <p className="text-xs text-gray-400">Anterior: {fmt(s.last_month)}</p>
                )}
              </div>
            </div>

          </div>

          {/* ── Main trend chart ── */}
          <div className="card p-6">
            <div className="flex items-start justify-between mb-5 gap-3 flex-wrap">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Ingresos mensuales</h3>
                <p className="text-xs text-gray-400 mt-0.5">Últimos 12 meses — membresías + visitas</p>
              </div>
              <ChartTypePicker value={chartType} onChange={setChartType} />
            </div>
            {isSparseTrend(monthlyData, 'total') && !privacyMode ? (
              <div className="flex flex-col items-center justify-center gap-2 h-64 text-gray-300">
                <TrendingUp className="w-8 h-8 opacity-30" />
                <p className="text-xs">Aún no hay suficiente historial para ver una tendencia</p>
              </div>
            ) : (
              <TrendChart data={monthlyData} chartType={chartType} color="#6366F1" privacyMode={privacyMode} />
            )}
          </div>

          {/* ── Row: Daily + Source ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Daily revenue this month */}
            <div className="card p-6 lg:col-span-2">
              <div className="flex items-start justify-between mb-5">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Ingresos diarios — mes actual</h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date().toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}
                    {!privacyMode && s?.this_month > 0 && (
                      <span className="ml-2 font-semibold text-indigo-600">{fmt(s.this_month)} total</span>
                    )}
                  </p>
                </div>
              </div>
              {privacyMode ? (
                <div className="flex items-center justify-center h-52 text-gray-300 text-sm gap-2">
                  <EyeOff className="w-5 h-5" /> Oculto
                </div>
              ) : dailyData.length === 0 ? (
                <div className="flex items-center justify-center h-52 text-gray-300 text-sm">Sin datos este mes</div>
              ) : (
                <ResponsiveContainer width="100%" height={208}>
                  <BarChart data={dailyData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                    {GRID}
                    <XAxis dataKey="day" {...AXIS} tickFormatter={v => (parseInt(v) % 5 === 0 || v === '1') ? v : ''} />
                    <YAxis {...AXIS} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} width={40} />
                    <Tooltip {...TIPST}
                      formatter={v => [fmt(v), 'Ingresos']}
                      labelFormatter={l => `Día ${l}`}
                    />
                    <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                      {dailyData.map((entry, i) => (
                        <Cell key={i} fill={entry.total > 0 ? '#6366F1' : '#E2E8F0'} fillOpacity={entry.total > 0 ? 1 : 0.5} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* By source donut */}
            <div className="card p-6 flex flex-col justify-between">
              <h3 className="text-sm font-semibold text-gray-900 mb-1">Por origen</h3>
              <p className="text-xs text-gray-400 mb-4">Distribución de ingresos</p>
              {pieData.length > 0 && !privacyMode ? (
                <div className="flex-1 flex flex-col">
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie
                        data={pieData} dataKey="value" nameKey="label"
                        cx="50%" cy="50%" innerRadius={46} outerRadius={72}
                        paddingAngle={4} strokeWidth={0}
                      >
                        {pieData.map((_, i) => <Cell key={i} fill={SOURCE_COLORS2[i % SOURCE_COLORS2.length]} />)}
                      </Pie>
                      <Tooltip content={<CustomPieTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>

                  <div className="space-y-3 mt-4">
                    {pieData.map((item, i) => {
                      const color = SOURCE_COLORS2[i % SOURCE_COLORS2.length]
                      const share = s?.total > 0 ? (item.value / s.total) * 100 : 0
                      return (
                        <div key={i}>
                          <div className="flex items-center justify-between text-xs mb-1.5">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: color }} />
                              <span className="text-gray-600 font-medium">{item.label}</span>
                            </div>
                            <div className="text-right">
                              <span className="font-bold text-gray-900">{fmt(item.value)}</span>
                              <span className="text-gray-400 ml-1.5">{share.toFixed(1)}%</span>
                            </div>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-2">
                            <div className="h-2 rounded-full transition-all duration-500"
                              style={{ width: `${share}%`, background: color }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-gray-300 text-xs gap-1.5">
                  {privacyMode ? <><EyeOff className="w-4 h-4" />Oculto</> : 'Sin datos'}
                </div>
              )}
            </div>

          </div>

          {/* ── Row: Methods + Top members ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Payment methods */}
            <div className="card p-6 flex flex-col">
              <h3 className="text-sm font-semibold text-gray-900 mb-1">Método de pago</h3>
              <p className="text-xs text-gray-400 mb-5">Ingresos por forma de pago</p>
              {methods.length === 0 ? (
                <div className="flex items-center justify-center h-40 text-gray-300 text-sm">Sin datos</div>
              ) : (
                <div className="space-y-5">
                  {methods.map(m => {
                    const color = METHOD_COLORS[m.method] ?? '#94A3B8'
                    const share = maxMethod > 0 ? (m.total / maxMethod) * 100 : 0
                    return (
                      <div key={m.method}>
                        <div className="flex items-center justify-between text-xs mb-2">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                              style={{ background: color + '20' }}>
                              <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                            </div>
                            <div>
                              <p className="font-semibold text-gray-800">{METHOD_LABELS[m.method] ?? m.method}</p>
                              <p className="text-gray-400">{m.count} transacciones</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-gray-900 tabular-nums">{mask(fmt(m.total))}</p>
                            {!privacyMode && maxMethod > 0 && (
                              <p className="text-gray-400">{((m.total / (s?.total || 1)) * 100).toFixed(1)}%</p>
                            )}
                          </div>
                        </div>
                        {!privacyMode && (
                          <div className="w-full bg-gray-100 rounded-full h-2.5">
                            <div className="h-2.5 rounded-full transition-all duration-700"
                              style={{ width: `${share}%`, background: `linear-gradient(90deg, ${color}bb, ${color})` }} />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Top paying members */}
            <div className="card p-6 flex flex-col">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-semibold text-gray-900">Top miembros</h3>
                <Award className="w-4 h-4 text-amber-400" />
              </div>
              <p className="text-xs text-gray-400 mb-5">Mayor gasto acumulado en membresías</p>
              {topMembers.length === 0 ? (
                <div className="flex items-center justify-center h-40 text-gray-300 text-sm">Sin datos</div>
              ) : (
                <div className="space-y-4">
                  {topMembers.map((m, i) => {
                    const rankColors = ['#F59E0B', '#94A3B8', '#CD7C2F']
                    const barColors = ['#F59E0B', '#94A3B8', '#CD7C2F', '#6366F1', '#10B981']
                    const color = barColors[i] ?? '#6366F1'
                    return (
                      <div key={i}>
                        <div className="flex items-center gap-3 mb-2">
                          <span className="flex-shrink-0 w-6 flex items-center justify-center">
                            {i < 3
                              ? <Award className="w-4 h-4" style={{ color: rankColors[i] }} />
                              : <span className="text-xs font-bold text-gray-400">{i + 1}</span>}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-800 truncate">{m.member}</p>
                            {m.member_code && (
                              <p className="text-xs font-mono text-indigo-400">{m.member_code}</p>
                            )}
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-xs font-bold text-gray-900 tabular-nums">{mask(fmt(m.total))}</p>
                            <p className="text-xs text-gray-400">{m.count} pago{m.count !== 1 ? 's' : ''}</p>
                          </div>
                        </div>
                        {!privacyMode && (
                          <div className="w-full bg-gray-100 rounded-full h-2">
                            <div className="h-2 rounded-full transition-all duration-700"
                              style={{ width: `${(m.total / maxMember) * 100}%`, background: color }} />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

          </div>

          {/* ── Activity heatmap ── */}
          <div className="card p-6">
            <div className="mb-5">
              <h3 className="text-sm font-semibold text-gray-900">Actividad del gimnasio</h3>
              <p className="text-xs text-gray-400 mt-0.5">Visitas registradas día a día — últimos 365 días</p>
            </div>
            <ActivityHeatmap data={heatmapData} />
          </div>

          {/* ── Ingresos table ── */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Registro de ingresos</h3>
                {pagination && (
                  <p className="text-xs text-gray-400 mt-0.5">{pagination.total} registros</p>
                )}
              </div>
              <div className="flex gap-2 ml-auto flex-wrap">
                <input type="month" value={monthFilter}
                  onChange={e => { setMonthFilter(e.target.value); setPage(1) }}
                  className="input sm:w-44"
                />
                <select value={originFilter}
                  onChange={e => { setOriginFilter(e.target.value); setPage(1) }}
                  className="input sm:w-44"
                >
                  <option value="">Todos los orígenes</option>
                  <option value="membership">Membresías</option>
                  <option value="visit">Visitas</option>
                  <option value="product">Productos</option>
                  <option value="manual">Manual</option>
                </select>
                {(monthFilter || originFilter) && (
                  <button onClick={() => { setMonthFilter(''); setOriginFilter(''); setPage(1) }}
                    className="btn-ghost text-xs flex items-center gap-1">
                    <X className="w-3 h-3" /> Limpiar
                  </button>
                )}
              </div>
            </div>

            <Skeleton name="finances-table" loading={loadingTx}>
            <div className="card overflow-hidden">
              {transactions.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                  <CreditCard className="w-8 h-8 mb-2 opacity-30" />
                  <p className="text-sm">Sin ingresos registrados</p>
                  <button onClick={() => setModal('new')} className="mt-3 btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5" /> Registrar primer ingreso
                  </button>
                </div>
              ) : (
                <>
                  {/* Desktop/tablet — full table */}
                  <div className="hidden lg:block overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b-2 border-gray-100">
                          <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Miembro / Concepto</th>
                          <SortableTh sortKey="date" sort={sort} onSort={handleSort} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Fecha</SortableTh>
                          <SortableTh sortKey="origin" sort={sort} onSort={handleSort} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Origen</SortableTh>
                          <SortableTh sortKey="payment_method" sort={sort} onSort={handleSort} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Método</SortableTh>
                          <SortableTh sortKey="amount" sort={sort} onSort={handleSort} align="right" className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Monto</SortableTh>
                          <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transactions.map((tx, idx) => (
                          <tr key={tx.id}
                            className={`border-b border-gray-50 hover:bg-indigo-50/30 transition-colors ${idx % 2 === 1 ? 'bg-gray-50/30' : ''}`}>
                            <td className="px-5 py-3.5 align-top">
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                  {(tx.member ?? '?').slice(0, 1).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-medium text-gray-800 text-xs truncate">{tx.member ?? 'Sin miembro'}</p>
                                  <p className="text-[11px] text-gray-400 truncate">{tx.concept}</p>
                                  {tx.member_code && <p className="text-[10px] font-mono text-indigo-400">{tx.member_code}</p>}
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-3.5 align-top text-gray-500 text-xs tabular-nums">
                              {tx.date ? new Date(tx.date + 'T12:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                            </td>
                            <td className="px-5 py-3.5 align-top">
                              <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium ${ORIGIN_STYLE[tx.origin] ?? 'bg-gray-50 text-gray-600'}`}>
                                {ORIGIN_LABEL[tx.origin] ?? tx.origin}
                              </span>
                              {tx.notes && (
                                <p className="text-[10px] text-gray-400 mt-0.5 max-w-[120px] truncate" title={tx.notes}>{tx.notes}</p>
                              )}
                            </td>
                            <td className="px-5 py-3.5 align-top text-gray-500 text-xs hidden lg:table-cell">
                              {METHOD_LABELS[tx.payment_method] ?? tx.payment_method ?? '—'}
                            </td>
                            <td className="px-5 py-3.5 align-top text-right">
                              <span className="font-semibold text-gray-900 tabular-nums">{mask(fmt(tx.amount))}</span>
                            </td>
                            <td className="px-4 py-3.5 align-top">
                              <div className="flex items-center justify-center gap-1">
                                <button onClick={() => setModal(tx)} title="Editar ingreso"
                                  className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => handleDelete(tx.id)} title="Eliminar ingreso"
                                  className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile — stacked cards, no horizontal scroll */}
                  <div className="lg:hidden divide-y divide-gray-100">
                    {transactions.map(tx => (
                      <div key={tx.id} className="p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                              {(tx.member ?? '?').slice(0, 1).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-gray-800 text-sm truncate">{tx.member ?? 'Sin miembro'}</p>
                              <p className="text-xs text-gray-400 truncate">{tx.concept}</p>
                            </div>
                          </div>
                          <span className="font-semibold text-gray-900 tabular-nums flex-shrink-0">{mask(fmt(tx.amount))}</span>
                        </div>

                        <div className="flex items-center flex-wrap gap-2 mt-2.5">
                          <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium ${ORIGIN_STYLE[tx.origin] ?? 'bg-gray-50 text-gray-600'}`}>
                            {ORIGIN_LABEL[tx.origin] ?? tx.origin}
                          </span>
                          <span className="text-xs text-gray-500 tabular-nums">
                            {tx.date ? new Date(tx.date + 'T12:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                          </span>
                          <span className="text-xs text-gray-500">
                            · {METHOD_LABELS[tx.payment_method] ?? tx.payment_method ?? '—'}
                          </span>
                        </div>

                        <div className="flex items-center justify-end gap-1 mt-2">
                          <button onClick={() => setModal(tx)}
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDelete(tx.id)}
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {pagination && (
                    <Pagination page={pagination.current} lastPage={pagination.last} total={pagination.total} onPageChange={setPage} itemLabel="registros" className="px-5" pageSize={pageSize} onPageSizeChange={handlePageSize} />
                  )}
                </>
              )}
            </div>
            </Skeleton>
          </div>
        </div>
      </Skeleton>
    </div>
    </>
  )
}
