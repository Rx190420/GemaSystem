import { useState, useEffect } from 'react'
import { Skeleton } from 'boneyard-js/react'
import { LoadingLogoOverlay } from '../components/SkeletonLogoMark'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  Plus, Search, X, CreditCard, Loader2,
  CheckCircle, XCircle, Clock, BarChart2, TrendingUp, Activity, Users,
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../api/axios'
import ConfirmModal from '../components/ConfirmModal'
import MemberQuickViewModal from '../components/members/MemberQuickViewModal'
import { FixedPanel, PanelHeader, EmptyState } from '../components/Panel'
import { isSparseTrend, trimLeadingEmpty } from '../utils/charts'
import ExportMenu from '../components/ExportMenu'
import { exportToExcel, exportToPDF } from '../utils/exportUtils'
import { runExport } from '../utils/runExport'
import { useSettingsStore } from '../store/settingsStore'
import { useAuthStore } from '../store/authStore'
import useLockBodyScroll from '../hooks/useLockBodyScroll'
import useSort from '../hooks/useSort'
import SortableTh from '../components/SortableTh'
import Pagination from '../components/Pagination'

const MONTH_NAMES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

const PLANS = [
  { id: 'weekly',    label: 'Semana',     days: 7,    color: 'border-teal-400 bg-teal-50 text-teal-700' },
  { id: 'biweekly',  label: 'Quincena',   days: 15,   color: 'border-cyan-400 bg-cyan-50 text-cyan-700' },
  { id: 'monthly',   label: 'Mensual',    months: 1,  color: 'border-blue-400 bg-blue-50 text-blue-700' },
  { id: 'quarterly', label: 'Trimestral', months: 3,  color: 'border-indigo-400 bg-indigo-50 text-indigo-700' },
  { id: 'biannual',  label: 'Semestral',  months: 6,  color: 'border-violet-400 bg-violet-50 text-violet-700' },
  { id: 'annual',    label: 'Anual',      months: 12, color: 'border-purple-400 bg-purple-50 text-purple-700' },
]

const TYPE_LABELS  = { weekly: 'Semana', biweekly: 'Quincena', monthly: 'Mensual', quarterly: 'Trimestral', biannual: 'Semestral', annual: 'Anual' }
const TYPE_COLORS  = { weekly: 'badge-teal', biweekly: 'badge-cyan', monthly: 'badge-blue', quarterly: 'badge-purple', biannual: 'badge-indigo', annual: 'badge-yellow' }
const TYPE_CHART_COLORS = { weekly: '#14B8A6', biweekly: '#06B6D4', monthly: '#3B82F6', quarterly: '#6366F1', biannual: '#8B5CF6', annual: '#A855F7' }

const STATUS_CLASS = { active: 'badge-green', expired: 'badge-red', cancelled: 'badge-gray' }
const STATUS_LABEL = { active: 'Activa', expired: 'Vencida', cancelled: 'Cancelada' }

const PAY_LABELS = { cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia' }

const CHART_TYPES = [
  { id: 'bar',  label: 'Barras', icon: BarChart2 },
  { id: 'line', label: 'Línea',  icon: TrendingUp },
  { id: 'area', label: 'Área',   icon: Activity },
]

const EXPORT_COLS = [
  { header: 'Miembro',        value: r => r.member ? `${r.member.first_name} ${r.member.last_name}` : '—' },
  { header: 'Tipo',           value: r => TYPE_LABELS[r.type] ?? r.type },
  { header: 'Inicio',         value: r => new Date(r.start_date).toLocaleDateString('es-MX') },
  { header: 'Vencimiento',    value: r => new Date(r.end_date).toLocaleDateString('es-MX') },
  { header: 'Monto (MXN)',    value: r => parseFloat(r.amount ?? 0).toFixed(2) },
  { header: 'Método de pago', value: r => PAY_LABELS[r.payment_method] ?? r.payment_method },
  { header: 'Estado',         value: r => STATUS_LABEL[r.status] ?? r.status },
]

function localToday() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function calcEndDate(dateStr, plan) {
  if (!dateStr || !plan) return ''
  const [y, m, day] = dateStr.split('-').map(Number)
  const d = new Date(y, m - 1, day) // parse as local midnight, not UTC
  if (plan.days) d.setDate(d.getDate() + plan.days)
  else d.setMonth(d.getMonth() + (plan.months ?? 1))
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function buildMonthly(byMonth) {
  const now = new Date()
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1)
    const y = d.getFullYear(), m = d.getMonth() + 1
    const found = byMonth?.find(r => r.year === y && r.month === m)
    return { name: `${MONTH_NAMES[m - 1]} ${String(y).slice(2)}`, count: found?.count ?? 0 }
  })
}

function ChartTypePicker({ value, onChange, color = 'violet' }) {
  const active = color === 'violet' ? 'bg-violet-600 text-white' : 'bg-indigo-600 text-white'
  return (
    <div className="flex rounded-lg border border-gray-200 overflow-hidden bg-white">
      {CHART_TYPES.map(ct => (
        <button
          key={ct.id}
          onClick={() => onChange(ct.id)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium transition-colors
            ${value === ct.id ? active : 'text-gray-500 hover:bg-gray-50'}`}
        >
          <ct.icon className="w-3 h-3" />
          {ct.label}
        </button>
      ))}
    </div>
  )
}

function StatCard({ icon: Icon, title, value, color }) {
  const palette = {
    indigo:  { bg: 'bg-indigo-50', text: 'text-indigo-700', icon: 'text-indigo-600' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', icon: 'text-emerald-600' },
    red:     { bg: 'bg-red-50', text: 'text-red-700', icon: 'text-red-600' },
    gray:    { bg: 'bg-gray-100', text: 'text-gray-700', icon: 'text-gray-500' },
  }
  const p = palette[color] ?? palette.indigo
  return (
    <div className="card p-4 flex items-center gap-3">
      <div className={`p-2.5 rounded-xl ${p.bg} flex-shrink-0`}>
        <Icon className={`w-5 h-5 ${p.icon}`} />
      </div>
      <div>
        <p className="text-xs text-gray-500">{title}</p>
        <p className={`text-xl font-bold ${p.text}`}>{value}</p>
      </div>
    </div>
  )
}

// ── New Membership Modal ────────────────────────────────────────
function NewMembershipModal({ onClose }) {
  const qc = useQueryClient()
  const { systemSettings } = useSettingsStore()
  useLockBodyScroll()
  const [mode, setMode] = useState('existing') // 'existing' | 'new'
  const [memberSearch, setMemberSearch] = useState('')
  const [selectedMember, setSelectedMember] = useState(null)
  const [plan, setPlan] = useState('monthly')
  const [membershipType, setMembershipType] = useState('basic')

  const { data: members = [] } = useQuery({
    queryKey: ['member-search', memberSearch],
    queryFn: () => memberSearch.length >= 2
      ? api.get('/members/search', { params: { q: memberSearch } }).then(r => r.data)
      : [],
    enabled: memberSearch.length >= 2,
  })

  const { register, handleSubmit, watch, setValue, reset, formState: { errors, isSubmitting } } = useForm({
    defaultValues: {
      first_name: '', last_name: '', email: '', phone: '',
      start_date:     localToday(),
      end_date:       calcEndDate(localToday(), { months: 1 }),
      amount:         '',
      payment_method: 'cash',
    },
  })

  const startDate = watch('start_date')

  useEffect(() => {
    if (!startDate) return
    const found = PLANS.find(p => p.id === plan)
    if (found) setValue('end_date', calcEndDate(startDate, found))
  }, [plan, startDate, setValue])

  useEffect(() => {
    const val = systemSettings?.[`price_membership_${plan}`]
    if (val && val !== '0') setValue('amount', val)
    setMembershipType(t => {
      if (t !== 'vip') return ['annual', 'biannual'].includes(plan) ? 'premium' : 'basic'
      return t
    })
  }, [plan, systemSettings, setValue])

  function switchMode(m) {
    setMode(m)
    setSelectedMember(null)
    setMemberSearch('')
    reset(v => ({ ...v, first_name: '', last_name: '', email: '', phone: '' }))
  }

  const onSubmit = async (data) => {
    try {
      let memberId
      if (mode === 'existing') {
        if (!selectedMember) return toast.error('Selecciona un miembro')
        memberId = selectedMember.id
      } else {
        if (!data.first_name || !data.last_name) return toast.error('Nombre y apellido son obligatorios')
        const { data: newMember } = await api.post('/members', {
          first_name:      data.first_name,
          last_name:       data.last_name,
          email:           data.email || null,
          phone:           data.phone || null,
          membership_type: membershipType,
        })
        memberId = newMember.id
      }
      await api.post('/memberships', {
        member_id:       memberId,
        type:            plan,
        start_date:      data.start_date,
        end_date:        data.end_date,
        amount:          parseFloat(data.amount),
        payment_method:  data.payment_method,
        membership_type: membershipType,
      })
      try { await api.post('/visits', { member_id: memberId, visit_type: 'training' }) } catch {}
      toast.success('Membresía registrada')
      qc.invalidateQueries(['memberships'])
      qc.invalidateQueries(['membership-summary'])
      qc.invalidateQueries(['members'])
      qc.invalidateQueries(['visits'])
      onClose()
    } catch (err) {
      const msg = Object.values(err.response?.data?.errors ?? {}).flat()[0] ?? 'Error al registrar'
      toast.error(msg)
    }
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Nueva membresía</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {/* Toggle existente / nuevo */}
          <div className="flex rounded-xl border border-gray-200 overflow-hidden bg-gray-50 p-1 gap-1">
            <button
              type="button"
              onClick={() => switchMode('existing')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all
                ${mode === 'existing' ? 'bg-white shadow text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
            >
              Miembro existente
            </button>
            <button
              type="button"
              onClick={() => switchMode('new')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all
                ${mode === 'new' ? 'bg-white shadow text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
            >
              Nuevo miembro
            </button>
          </div>

          {/* Miembro existente: buscador */}
          {mode === 'existing' && (
            <div>
              <label className="label">Miembro *</label>
              {selectedMember ? (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-indigo-50 border border-indigo-100">
                  <div className="w-8 h-8 rounded-full bg-indigo-200 flex items-center justify-center text-indigo-700 text-xs font-bold">
                    {selectedMember.first_name[0]}{selectedMember.last_name[0]}
                  </div>
                  <span className="flex-1 text-sm font-medium">{selectedMember.first_name} {selectedMember.last_name}</span>
                  <button type="button" onClick={() => setSelectedMember(null)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input value={memberSearch} onChange={e => setMemberSearch(e.target.value)} placeholder="Buscar miembro..." className="input pl-9" />
                  {members.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-40 overflow-y-auto">
                      {members.map(m => (
                        <button key={m.id} type="button"
                          onClick={() => { setSelectedMember(m); setMemberSearch('') }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
                        >
                          <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-bold">
                            {m.first_name[0]}{m.last_name[0]}
                          </div>
                          {m.first_name} {m.last_name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Nuevo miembro: campos de datos */}
          {mode === 'new' && (
            <div className="space-y-3">
              <div>
                <label className="label">Nombre *</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <input
                      {...register('first_name', { required: true })}
                      className={`input ${errors.first_name ? 'border-red-400' : ''}`}
                      placeholder="Nombre"
                    />
                  </div>
                  <div>
                    <input
                      {...register('last_name', { required: true })}
                      className={`input ${errors.last_name ? 'border-red-400' : ''}`}
                      placeholder="Apellido"
                    />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Correo</label>
                  <input {...register('email')} type="email" className="input" placeholder="correo@ejemplo.com" />
                </div>
                <div>
                  <label className="label">Teléfono</label>
                  <input {...register('phone')} className="input" placeholder="+52 55..." />
                </div>
              </div>
            </div>
          )}

          {/* Plan */}
          <div>
            <label className="label">Plan *</label>
            <div className="grid grid-cols-2 gap-2">
              {PLANS.map(p => (
                <button key={p.id} type="button" onClick={() => setPlan(p.id)}
                  className={`px-3 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all text-center
                    ${plan === p.id ? p.color + ' border-current' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
                >
                  {p.label}
                  <span className="block text-xs font-normal mt-0.5 opacity-70">
                    {p.days ? `${p.days} días` : `${p.months} ${p.months === 1 ? 'mes' : 'meses'}`}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Tipo de membresía */}
          <div>
            <label className="label">Tipo de membresía</label>
            <div className="flex rounded-xl border border-gray-200 bg-gray-50 p-1 gap-1">
              {[
                { id: 'basic',   label: 'Básica',   color: 'bg-blue-600'   },
                { id: 'premium', label: 'Premium',  color: 'bg-purple-600' },
                { id: 'vip',     label: 'VIP',      color: 'bg-amber-500'  },
              ].map(t => (
                <button key={t.id} type="button" onClick={() => setMembershipType(t.id)}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all
                    ${membershipType === t.id ? `${t.color} text-white shadow` : 'text-gray-400 hover:text-gray-600'}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Fecha inicio *</label>
              <input {...register('start_date')} type="date" className="input" />
            </div>
            <div>
              <label className="label">Fecha fin</label>
              <input {...register('end_date')} type="date" readOnly className="input bg-gray-50 text-gray-500 cursor-default" />
              <p className="text-xs text-indigo-500 mt-1">Calculada automáticamente</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Monto (MXN) *</label>
              <input {...register('amount')} type="number" step="0.01" min="0" className="input" placeholder="0.00" />
            </div>
            <div>
              <label className="label">Método de pago *</label>
              <select {...register('payment_method')} className="input">
                <option value="cash">Efectivo</option>
                <option value="card">Tarjeta</option>
                <option value="transfer">Transferencia</option>
              </select>
            </div>
          </div>

        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button type="submit" disabled={isSubmitting} className="btn-primary flex-1">
            {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</> : 'Registrar membresía'}
          </button>
        </div>
        </form>
      </div>
    </div>
  )
}

// ── Main page ───────────────────────────────────────────────────
export default function Memberships() {
  const qc = useQueryClient()
  const { systemSettings } = useSettingsStore()
  const { user } = useAuthStore()
  const canExport = user?.plan_features?.export !== false
  const [showModal, setShowModal]       = useState(false)
  const [page, setPage]                 = useState(1)
  const [pageSize, setPageSize]         = useState(12)
  const [statusFilter, setStatus]       = useState('')
  const [search, setSearch]             = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [detailMemberId, setDetailMemberId] = useState(null)
  const [trendType, setTrendType]       = useState('bar')
  const [typeView, setTypeView]         = useState('pie')
  const [exporting, setExporting]       = useState(false)
  const [sort, onSort]                  = useSort('created_at', 'desc')
  const handleSort = key => { onSort(key); setPage(1) }
  const handlePageSize = n => { setPageSize(n); setPage(1) }

  const params = {
    page, per_page: pageSize,
    ...(statusFilter && { status: statusFilter }),
    ...(search.trim() && { search: search.trim() }),
    sort_by: sort.by, sort_dir: sort.dir,
  }

  const { data, isLoading } = useQuery({
    queryKey: ['memberships', params],
    queryFn: () => api.get('/memberships', { params }).then(r => r.data),
    keepPreviousData: true,
  })

  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ['membership-summary'],
    queryFn: () => api.get('/memberships/summary').then(r => r.data),
  })

  const cancelMutation = useMutation({
    mutationFn: id => api.delete(`/memberships/${id}`),
    onSuccess: () => {
      qc.invalidateQueries(['memberships'])
      qc.invalidateQueries(['membership-summary'])
      toast.success('Membresía cancelada')
    },
  })

  const memberships = data?.data ?? []
  const pagination  = data ? { current: data.current_page, last: data.last_page, total: data.total } : null
  const s = summary?.summary

  const monthlyData = trimLeadingEmpty(buildMonthly(summary?.by_month))
  const typeData = (summary?.by_type ?? []).map(r => ({
    name:  TYPE_LABELS[r.type] ?? r.type,
    count: r.count,
    fill:  TYPE_CHART_COLORS[r.type] ?? '#94A3B8',
  }))

  async function fetchAll(signal) {
    const res = await api.get('/memberships', { params: { page: 1, per_page: 9999, ...(statusFilter && { status: statusFilter }) }, signal })
    return res.data.data ?? []
  }

  async function handleExportExcel() {
    setExporting(true)
    const gymName = systemSettings?.gym_name || 'GemaSystem'
    try {
      await runExport({
        label: 'Reporte de Membresías', fileLabel: 'membresias.xlsx', kind: 'excel',
        task: async (signal, setPhase) => {
          const rows = await fetchAll(signal)
          setPhase('generating')
          return exportToExcel(rows, EXPORT_COLS, 'membresias', { title: 'Reporte de Membresías', gymName })
        },
      })
    } finally { setExporting(false) }
  }

  async function handleExportPDF() {
    setExporting(true)
    const gymName = systemSettings?.gym_name || 'GemaSystem'
    try {
      await runExport({
        label: 'Reporte de Membresías', fileLabel: 'membresias.pdf', kind: 'pdf',
        task: async (signal, setPhase) => {
          const rows = await fetchAll(signal)
          setPhase('generating')
          return exportToPDF(rows, EXPORT_COLS, 'membresias', { title: 'Reporte de Membresías', gymName })
        },
      })
    } finally { setExporting(false) }
  }

  const axisProps = { tick: { fontSize: 11, fill: '#94A3B8' }, tickLine: false, axisLine: false }
  const tipStyle  = { contentStyle: { borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '12px' } }
  const trendColor = '#8B5CF6'

  function TrendChart() {
    const common = { data: monthlyData, margin: { top: 5, right: 5, bottom: 5, left: 0 } }
    if (trendType === 'line') return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart {...common}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
          <XAxis dataKey="name" {...axisProps} />
          <YAxis {...axisProps} allowDecimals={false} />
          <Tooltip {...tipStyle} formatter={v => [v, 'Membresías']} />
          <Line type="monotone" dataKey="count" stroke={trendColor} strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    )
    if (trendType === 'area') return (
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart {...common}>
          <defs>
            <linearGradient id="memGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={trendColor} stopOpacity={0.18} />
              <stop offset="95%" stopColor={trendColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
          <XAxis dataKey="name" {...axisProps} />
          <YAxis {...axisProps} allowDecimals={false} />
          <Tooltip {...tipStyle} formatter={v => [v, 'Membresías']} />
          <Area type="monotone" dataKey="count" stroke={trendColor} strokeWidth={2.5} fill="url(#memGrad)" dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    )
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart {...common}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
          <XAxis dataKey="name" {...axisProps} />
          <YAxis {...axisProps} allowDecimals={false} />
          <Tooltip {...tipStyle} formatter={v => [v, 'Membresías']} />
          <Bar dataKey="count" fill={trendColor} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    )
  }

  return (
    <>
    <LoadingLogoOverlay show={isLoading || loadingSummary} />
    <div className="space-y-8">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Membresías</h2>
          <p className="text-sm text-gray-500 mt-0.5">{pagination?.total ?? 0} registradas</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {canExport && <ExportMenu onExportExcel={handleExportExcel} onExportPDF={handleExportPDF} loading={exporting} />}
          <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Nueva membresía
          </button>
        </div>
      </div>

      <Skeleton name="memberships-summary" loading={loadingSummary}>
      <div className="space-y-6">
      {/* ── Stat cards ── */}
      {s && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Users}       title="Total"      value={s.total}     color="indigo" />
          <StatCard icon={CheckCircle} title="Activas"    value={s.active}    color="emerald" />
          <StatCard icon={Clock}       title="Vencidas"   value={s.expired}   color="red" />
          <StatCard icon={XCircle}     title="Canceladas" value={s.cancelled} color="gray" />
        </div>
      )}

      {/* ── Charts ── */}
      {summary && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* By type */}
          <FixedPanel height={340}>
            <PanelHeader
              title="Por tipo de plan"
              action={
                <div className="flex rounded-lg border border-gray-200 overflow-hidden bg-white">
                  {[{ id: 'pie', label: 'Pastel' }, { id: 'bar', label: 'Barras' }].map(v => (
                    <button key={v.id} onClick={() => setTypeView(v.id)}
                      className={`px-2.5 py-1.5 text-xs font-medium transition-colors
                        ${typeView === v.id ? 'bg-violet-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
                    >{v.label}</button>
                  ))}
                </div>
              }
            />
            {typeData.length === 0 ? (
              <EmptyState icon={BarChart2} text="Sin datos" />
            ) : typeView === 'pie' ? (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={typeData} dataKey="count" nameKey="name" cx="50%" cy="50%" innerRadius={44} outerRadius={72} paddingAngle={3}>
                        {typeData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                      </Pie>
                      <Tooltip {...tipStyle} formatter={v => [v, 'Membresías']} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-2 flex-shrink-0">
                  {typeData.map((d, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.fill }} />
                      <span className="text-gray-600 truncate">{d.name}</span>
                      <span className="ml-auto font-semibold text-gray-800">{d.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={typeData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                    <XAxis dataKey="name" {...axisProps} />
                    <YAxis {...axisProps} allowDecimals={false} />
                    <Tooltip {...tipStyle} formatter={v => [v, 'Membresías']} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {typeData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </FixedPanel>

          {/* Monthly trend */}
          <FixedPanel height={340}>
            <PanelHeader
              title="Tendencia mensual — 12 meses"
              action={<ChartTypePicker value={trendType} onChange={setTrendType} color="violet" />}
            />
            <div className="flex-1 min-h-0">
              {isSparseTrend(monthlyData) ? (
                <EmptyState icon={TrendingUp} text="Aún no hay suficiente historial para ver una tendencia" />
              ) : (
                <TrendChart />
              )}
            </div>
          </FixedPanel>

        </div>
      )}
      </div>
      </Skeleton>

      {/* ── Filters ── */}
      <div className="card p-4 flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Buscar por nombre o código..."
            className="input pl-9"
          />
          {search && (
            <button onClick={() => { setSearch(''); setPage(1) }} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <select value={statusFilter} onChange={e => { setStatus(e.target.value); setPage(1) }} className="input sm:w-44">
          <option value="">Todos los estados</option>
          <option value="active">Activa</option>
          <option value="expired">Vencida</option>
          <option value="cancelled">Cancelada</option>
        </select>
        {(statusFilter || search) && (
          <button onClick={() => { setStatus(''); setSearch(''); setPage(1) }} className="btn-ghost text-xs flex items-center gap-1">
            <X className="w-3 h-3" /> Limpiar
          </button>
        )}
      </div>

      {/* ── Table ── */}
      <Skeleton name="memberships-table" loading={isLoading}>
      <div className="card overflow-hidden">
        {memberships.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400">
            <CreditCard className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-sm">Sin membresías registradas</p>
          </div>
        ) : (
          <>
            {/* Desktop/tablet — full table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b-2 border-gray-100">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Miembro</th>
                    <SortableTh sortKey="type" sort={sort} onSort={handleSort} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Tipo</SortableTh>
                    <SortableTh sortKey="end_date" sort={sort} onSort={handleSort} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Período</SortableTh>
                    <SortableTh sortKey="amount" sort={sort} onSort={handleSort} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Monto</SortableTh>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Pago</th>
                    <SortableTh sortKey="status" sort={sort} onSort={handleSort} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado</SortableTh>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {memberships.map((m, idx) => (
                    <tr
                      key={m.id}
                      className={`border-b border-gray-50 hover:bg-violet-50/30 transition-colors group ${idx % 2 === 1 ? 'bg-gray-50/40' : ''} ${m.member ? 'cursor-pointer' : ''}`}
                      onClick={m.member ? () => setDetailMemberId(m.member.id) : undefined}
                      title={m.member ? 'Ver información del miembro' : undefined}
                    >
                      <td className="px-4 py-3.5 align-top">
                        {m.member ? (
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 text-xs font-bold flex-shrink-0">
                              {m.member.first_name?.[0]}{m.member.last_name?.[0]}
                            </div>
                            <span className="font-medium text-gray-800 truncate max-w-[140px]">
                              {m.member.first_name} {m.member.last_name}
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 align-top">
                        <span className={`badge ${TYPE_COLORS[m.type] ?? 'badge-gray'}`}>{TYPE_LABELS[m.type]}</span>
                      </td>
                      <td className="px-4 py-3.5 align-top text-gray-500 text-xs tabular-nums">
                        {new Date(m.start_date).toLocaleDateString('es-MX')} → {new Date(m.end_date).toLocaleDateString('es-MX')}
                      </td>
                      <td className="px-4 py-3.5 align-top font-semibold text-gray-800 tabular-nums">
                        ${parseFloat(m.amount).toLocaleString('es-MX')}
                      </td>
                      <td className="px-4 py-3.5 align-top text-gray-500 text-xs capitalize hidden lg:table-cell">
                        {PAY_LABELS[m.payment_method] ?? m.payment_method}
                      </td>
                      <td className="px-4 py-3.5 align-top">
                        <span className={STATUS_CLASS[m.status] ?? 'badge-gray'}>{STATUS_LABEL[m.status]}</span>
                      </td>
                      <td className="px-4 py-3.5 align-top text-right">
                        {m.status === 'active' && (
                          <button
                            onClick={e => { e.stopPropagation(); setDeleteTarget(m) }}
                            className="text-xs text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            Cancelar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile — stacked cards, no horizontal scroll */}
            <div className="lg:hidden divide-y divide-gray-100">
              {memberships.map(m => (
                <div
                  key={m.id}
                  className={`p-4 ${m.member ? 'cursor-pointer hover:bg-violet-50/40 transition-colors' : ''}`}
                  onClick={m.member ? () => setDetailMemberId(m.member.id) : undefined}
                >
                  <div className="flex items-start justify-between gap-2">
                    {m.member ? (
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 text-xs font-bold flex-shrink-0">
                          {m.member.first_name?.[0]}{m.member.last_name?.[0]}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-gray-800 truncate">
                            {m.member.first_name} {m.member.last_name}
                          </p>
                          <p className="text-xs text-gray-500 tabular-nums">
                            {new Date(m.start_date).toLocaleDateString('es-MX')} → {new Date(m.end_date).toLocaleDateString('es-MX')}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="min-w-0">
                        <p className="font-medium text-gray-400 truncate">—</p>
                        <p className="text-xs text-gray-500 tabular-nums">
                          {new Date(m.start_date).toLocaleDateString('es-MX')} → {new Date(m.end_date).toLocaleDateString('es-MX')}
                        </p>
                      </div>
                    )}
                    <span className={`${STATUS_CLASS[m.status] ?? 'badge-gray'} flex-shrink-0`}>{STATUS_LABEL[m.status]}</span>
                  </div>

                  <div className="flex items-center flex-wrap gap-2 mt-2.5">
                    <span className={`badge ${TYPE_COLORS[m.type] ?? 'badge-gray'}`}>{TYPE_LABELS[m.type]}</span>
                    <span className="font-semibold text-gray-800 tabular-nums text-sm">
                      ${parseFloat(m.amount).toLocaleString('es-MX')}
                    </span>
                    <span className="text-xs text-gray-500 capitalize">
                      · {PAY_LABELS[m.payment_method] ?? m.payment_method}
                    </span>
                  </div>

                  {m.status === 'active' && (
                    <button
                      onClick={e => { e.stopPropagation(); setDeleteTarget(m) }}
                      className="mt-2.5 text-xs text-red-500 hover:text-red-700"
                    >
                      Cancelar membresía
                    </button>
                  )}
                </div>
              ))}
            </div>

            {pagination && (
              <Pagination page={pagination.current} lastPage={pagination.last} total={pagination.total} onPageChange={setPage} itemLabel="registros" pageSize={pageSize} onPageSizeChange={handlePageSize} />
            )}
          </>
        )}
      </div>
      </Skeleton>

      {showModal && <NewMembershipModal onClose={() => setShowModal(false)} />}
      {detailMemberId && (
        <MemberQuickViewModal memberId={detailMemberId} focus="memberships" onClose={() => setDetailMemberId(null)} />
      )}
      {deleteTarget && (
        <ConfirmModal
          title="¿Cancelar membresía?"
          message="La membresía será marcada como cancelada. Esta acción no se puede deshacer."
          confirmLabel="Cancelar membresía"
          onConfirm={() => { cancelMutation.mutate(deleteTarget.id); setDeleteTarget(null) }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
    </>
  )
}
