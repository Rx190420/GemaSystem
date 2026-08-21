import { useState, useCallback, useEffect } from 'react'
import { Skeleton } from 'boneyard-js/react'
import { LoadingLogoOverlay } from '../components/SkeletonLogoMark'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import * as yup from 'yup'
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  Plus, Search, X, Edit2, Trash2, QrCode, Check,
  User, Phone, Mail, Calendar, Loader2, ChevronDown,
  ExternalLink, Users, UserCheck, UserX, Shield,
  BarChart2, TrendingUp, Activity, Clock, Footprints, MessageCircle, Percent,
} from 'lucide-react'
import ChipSelect from '../components/ChipSelect'
import { FixedPanel, PanelHeader, EmptyState } from '../components/Panel'
import MembershipTypeBadge from '../components/MembershipTypeBadge'
import useMembershipTypeColors from '../hooks/useMembershipTypeColors'
import useSort from '../hooks/useSort'
import SortableTh from '../components/SortableTh'
import Pagination from '../components/Pagination'
import { QRCodeCanvas } from 'qrcode.react'
import toast from 'react-hot-toast'
import api from '../api/axios'
import useLockBodyScroll from '../hooks/useLockBodyScroll'
import { useSettingsStore } from '../store/settingsStore'
import ConfirmModal from '../components/ConfirmModal'
import ExportMenu from '../components/ExportMenu'
import { exportToExcel, exportToPDF } from '../utils/exportUtils'

const MONTH_NAMES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

const STATUS_BADGE = { active: 'badge-green', inactive: 'badge-gray', suspended: 'badge-red' }
const STATUS_LABEL = { active: 'Activo', inactive: 'Inactivo', suspended: 'Suspendido' }
const TYPE_LABEL   = { basic: 'Básica', premium: 'Premium', vip: 'VIP' }

// Plan duration labels and badges (active_plan_type from memberships table)
const PLAN_BADGE = {
  weekly:    'badge-teal',
  biweekly:  'badge-cyan',
  monthly:   'badge-blue',
  quarterly: 'badge-purple',
  biannual:  'badge-indigo',
  annual:    'badge-yellow',
}
const PLAN_LABEL = {
  weekly:    'Semanal',
  biweekly:  'Quincenal',
  monthly:   'Mensual',
  quarterly: 'Trimestral',
  biannual:  'Semestral',
  annual:    'Anual',
}

const TYPE_CHART_COLORS   = { basic: '#3B82F6', premium: '#8B5CF6', vip: '#F59E0B' }

const CHART_TYPES = [
  { id: 'bar',  label: 'Barras', icon: BarChart2 },
  { id: 'line', label: 'Línea',  icon: TrendingUp },
  { id: 'area', label: 'Área',   icon: Activity },
]

const EXPORT_COLS = [
  { header: 'Nombre',        value: r => `${r.first_name} ${r.last_name}` },
  { header: 'Código',        value: r => r.member_code ?? '—' },
  { header: 'Correo',        value: r => r.email ?? '—' },
  { header: 'Teléfono',      value: r => r.phone ?? '—' },
  { header: 'Membresía',     value: r => r.active_plan_type ? (PLAN_LABEL[r.active_plan_type] ?? r.active_plan_type) : (TYPE_LABEL[r.membership_type] ?? r.membership_type) },
  { header: 'Vencimiento',   value: r => r.membership_end ? new Date(r.membership_end).toLocaleDateString('es-MX') : '—' },
  { header: 'Días restantes', value: r => { const d = daysUntil(r.membership_end); return d === null ? '—' : d < 0 ? 'Vencido' : `${d}` } },
  { header: 'Visitas',       value: r => r.visits_count ?? 0 },
  { header: 'Última visita', value: r => r.last_visit_date ? new Date(r.last_visit_date).toLocaleDateString('es-MX') : '—' },
  { header: 'Estado',        value: r => STATUS_LABEL[r.status] ?? r.status },
]

function buildMonthly(byMonth) {
  const now = new Date()
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1)
    const y = d.getFullYear(), m = d.getMonth() + 1
    const found = byMonth?.find(r => r.year === y && r.month === m)
    return { name: `${MONTH_NAMES[m - 1]} ${String(y).slice(2)}`, count: found?.count ?? 0 }
  })
}

const memberSchema = yup.object({
  first_name:               yup.string().required('Nombre obligatorio'),
  last_name:                yup.string().required('Apellido obligatorio'),
  email:                    yup.string().email('Correo inválido').nullable(),
  phone:                    yup.string().nullable(),
  membership_type:          yup.string().required('Tipo de membresía obligatorio'),
  discount_category:        yup.string().nullable(),
  membership_start:         yup.string().nullable(),
  membership_end:           yup.string().nullable(),
  gender:                   yup.string().oneOf(['male', 'female', 'other', '']).nullable(),
  address:                  yup.string().nullable(),
  birth_date:               yup.string().nullable(),
  emergency_contact_name:   yup.string().nullable(),
  emergency_contact_phone:  yup.string().nullable(),
  status:                   yup.string().oneOf(['active', 'inactive', 'suspended']).nullable(),
})

const PLANS = [
  { id: 'weekly',    label: 'Semana',     days: 7,    color: 'border-teal-400 bg-teal-50 text-teal-700' },
  { id: 'biweekly',  label: 'Quincena',   days: 15,   color: 'border-cyan-400 bg-cyan-50 text-cyan-700' },
  { id: 'monthly',   label: 'Mensual',    months: 1,  color: 'border-blue-400 bg-blue-50 text-blue-700' },
  { id: 'quarterly', label: 'Trimestral', months: 3,  color: 'border-indigo-400 bg-indigo-50 text-indigo-700' },
  { id: 'biannual',  label: 'Semestral',  months: 6,  color: 'border-violet-400 bg-violet-50 text-violet-700' },
  { id: 'annual',    label: 'Anual',      months: 12, color: 'border-purple-400 bg-purple-50 text-purple-700' },
]

function calcEndDate(dateStr, plan) {
  if (!dateStr || !plan) return ''
  const [y, m, day] = dateStr.split('-').map(Number)
  const d = new Date(y, m - 1, day)
  if (plan.days) d.setDate(d.getDate() + plan.days)
  else d.setMonth(d.getMonth() + (plan.months ?? 1))
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function daysUntil(dateStr) {
  if (!dateStr) return null
  const end = new Date(dateStr)
  end.setHours(23, 59, 59, 999)
  return Math.ceil((end - new Date()) / 86400000)
}

function DaysRemaining({ dateStr }) {
  const days = daysUntil(dateStr)
  if (days === null) return null
  if (days < 0)
    return <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">Vencido</span>
  if (days === 0)
    return <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full"><Clock className="w-3 h-3" />Vence hoy</span>
  if (days <= 7)
    return <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full"><Clock className="w-3 h-3" />{days}d restantes</span>
  if (days <= 30)
    return <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full"><Clock className="w-3 h-3" />{days}d restantes</span>
  return <span className="inline-flex items-center gap-1 text-xs text-green-600"><Clock className="w-3 h-3" />{days}d restantes</span>
}

function addMonths(dateStr, months) {
  if (!dateStr) return ''
  const [y, m, day] = dateStr.split('-').map(Number)
  const d = new Date(y, m - 1, day)
  d.setMonth(d.getMonth() + months)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function StatCard({ icon: Icon, title, value, color }) {
  const palette = {
    indigo:  { bg: 'bg-indigo-50',  text: 'text-indigo-700',  icon: 'text-indigo-600' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', icon: 'text-emerald-600' },
    red:     { bg: 'bg-red-50',     text: 'text-red-700',     icon: 'text-red-600' },
    gray:    { bg: 'bg-gray-100',   text: 'text-gray-700',    icon: 'text-gray-500' },
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

function ChartTypePicker({ value, onChange }) {
  return (
    <div className="flex rounded-lg border border-gray-200 overflow-hidden bg-white">
      {CHART_TYPES.map(ct => (
        <button key={ct.id} onClick={() => onChange(ct.id)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium transition-colors
            ${value === ct.id ? 'text-white' : 'text-gray-500 hover:bg-gray-50'}`}
          style={value === ct.id ? { background: 'var(--color-primary-600)' } : {}}
        >
          <ct.icon className="w-3 h-3" />
          {ct.label}
        </button>
      ))}
    </div>
  )
}

// ── Form modal ────────────────────────────────────────────────
function MemberFormModal({ member, onClose }) {
  const qc = useQueryClient()
  const { systemSettings } = useSettingsStore()
  const isEdit = !!member
  useLockBodyScroll()
  const [plan, setPlan]               = useState(null)
  const [action, setAction]           = useState('client') // 'client' | 'visit' | 'membership'
  const [visitPrice, setVisitPrice]   = useState('')
  const [memberAmount, setMemberAmount]   = useState('')
  const [memberPayment, setMemberPayment] = useState('cash')
  const [showEmergency, setShowEmergency] = useState(!!(member?.emergency_contact_name))
  const [notifyEmail, setNotifyEmail]     = useState(true)
  const [notifyWa, setNotifyWa]           = useState(true)

  const { data: membershipTypes = [] } = useQuery({
    queryKey: ['membership-types'],
    queryFn: () => api.get('/membership-types').then(r => r.data),
  })
  const { data: discountCategories = [] } = useQuery({
    queryKey: ['discount-categories'],
    queryFn: () => api.get('/discount-categories').then(r => r.data),
  })

  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm({
    resolver: yupResolver(memberSchema),
    defaultValues: {
      first_name:               member?.first_name ?? '',
      last_name:                member?.last_name ?? '',
      email:                    member?.email ?? '',
      phone:                    member?.phone ?? '',
      membership_type:          member?.membership_type ?? 'Básica',
      discount_category:        member?.discount_category ?? '',
      membership_start:         member?.membership_start ?? '',
      membership_end:           member?.membership_end ?? '',
      gender:                   member?.gender ?? '',
      address:                  member?.address ?? '',
      birth_date:               member?.birth_date ?? '',
      emergency_contact_name:   member?.emergency_contact_name ?? '',
      emergency_contact_phone:  member?.emergency_contact_phone ?? '',
      status:                   member?.status ?? 'active',
    },
  })

  const startDate = watch('membership_start')

  useEffect(() => {
    if (!plan || !startDate) return
    const found = PLANS.find(p => p.id === plan)
    if (found) setValue('membership_end', calcEndDate(startDate, found))
  }, [plan, startDate, setValue])

  useEffect(() => {
    if (isEdit || action !== 'membership' || !plan) return
    const currentType = watch('membership_type')
    if (currentType !== 'vip') {
      setValue('membership_type', ['annual', 'biannual'].includes(plan) ? 'premium' : 'basic')
    }
    const val = systemSettings?.[`price_membership_${plan}`]
    if (val && val !== '0') setMemberAmount(String(val))
  }, [plan, action, isEdit, systemSettings, setValue])

  useEffect(() => {
    if (isEdit || action !== 'visit') return
    const val = systemSettings?.price_visit_training
    if (val && val !== '0') setVisitPrice(String(val))
  }, [action, isEdit, systemSettings])

  const onSubmit = async (data) => {
    const payload = Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, v === '' ? null : v])
    )
    if (!isEdit && action === 'membership') {
      if (!memberAmount || parseFloat(memberAmount) <= 0) return toast.error('Ingresa un monto válido')
      if (!plan) return toast.error('Selecciona un plan de duración')
    }
    try {
      let createdMember = null
      if (isEdit) {
        await api.put(`/members/${member.id}`, payload)
        toast.success('Miembro actualizado')
      } else {
        const { data: newMember } = await api.post('/members', { ...payload, send_qr_email: false })
        createdMember = newMember
        const memberId = newMember.id

        if (action === 'visit') {
          const visitPayload = { member_id: memberId, visit_type: 'training' }
          if (visitPrice && parseFloat(visitPrice) > 0) visitPayload.price = parseFloat(visitPrice)
          await api.post('/visits', visitPayload)
          const priceStr = visitPrice && parseFloat(visitPrice) > 0 ? ` · $${parseFloat(visitPrice).toFixed(2)}` : ''
          toast.success(`${newMember.first_name} registrado · visita anotada${priceStr}`)
          qc.invalidateQueries(['visits'])
        } else if (action === 'membership') {
          await api.post('/memberships', {
            member_id:       memberId,
            type:            plan,
            start_date:      data.membership_start,
            end_date:        data.membership_end,
            amount:          parseFloat(memberAmount),
            payment_method:  memberPayment,
            membership_type: data.membership_type,
          })
          try { await api.post('/visits', { member_id: memberId, visit_type: 'training' }) } catch {}
          const planLabel = PLANS.find(p => p.id === plan)?.label ?? plan
          toast.success(`${newMember.first_name} inscrito · membresía ${planLabel.toLowerCase()}`)
          qc.invalidateQueries(['memberships'])
          qc.invalidateQueries(['membership-summary'])
          qc.invalidateQueries(['visits'])
        } else {
          toast.success(`${newMember.first_name} registrado correctamente`)
        }
      }
      qc.invalidateQueries(['members'])
      qc.invalidateQueries(['member-summary'])
      if (createdMember) {
        if (notifyEmail && createdMember.email)
          api.post(`/members/${createdMember.id}/notify`, { type: 'qr', channel: 'email' }).catch(() => {})
        if (notifyWa && createdMember.phone)
          api.post(`/members/${createdMember.id}/notify`, { type: 'qr', channel: 'whatsapp' }).catch(() => {})
      }
      onClose()
    } catch (err) {
      const firstError = Object.values(err.response?.data?.errors ?? {}).flat()[0]
      toast.error(firstError ?? 'Error al guardar')
    }
  }

  const submitLabel = isEdit ? 'Actualizar'
    : action === 'visit'       ? 'Crear miembro y visita'
    : action === 'membership'  ? 'Crear miembro y membresía'
    : 'Crear miembro'

  return (
    <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">
            {isEdit ? 'Editar miembro' : 'Nuevo miembro'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {/* Action selector — only on create */}
          {!isEdit && (
            <div className="flex rounded-xl border border-gray-200 bg-gray-50 p-1 gap-1">
              {[
                { id: 'client',      label: 'Solo cliente' },
                { id: 'visit',       label: 'Con visita' },
                { id: 'membership',  label: 'Con membresía' },
              ].map(a => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setAction(a.id)}
                  className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all
                    ${action === a.id ? 'bg-white shadow text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  {a.label}
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Nombre *</label>
              <input {...register('first_name')} className="input" placeholder="Juan" />
              {errors.first_name && <p className="mt-1 text-xs text-red-500">{errors.first_name.message}</p>}
            </div>
            <div>
              <label className="label">Apellido *</label>
              <input {...register('last_name')} className="input" placeholder="García" />
              {errors.last_name && <p className="mt-1 text-xs text-red-500">{errors.last_name.message}</p>}
            </div>
          </div>
          <div>
            <label className="label">Correo electrónico</label>
            <input {...register('email')} type="email" className="input" placeholder="correo@ejemplo.com" />
            {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Teléfono</label>
              <input {...register('phone')} className="input" placeholder="+52 55 1234 5678" />
            </div>
            <div>
              <label className="label">Género</label>
              <select {...register('gender')} className="input">
                <option value="">Sin especificar</option>
                <option value="male">Masculino</option>
                <option value="female">Femenino</option>
                <option value="other">Otro</option>
              </select>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <label className="label">Tipo de membresía *</label>
              <ChipSelect
                options={membershipTypes}
                value={watch('membership_type')}
                onChange={v => setValue('membership_type', v, { shouldValidate: true })}
                onAdd={async name => {
                  await api.post('/membership-types', { name })
                  qc.invalidateQueries(['membership-types'])
                  setValue('membership_type', name, { shouldValidate: true })
                }}
                placeholder="Nuevo tipo..."
              />
              {errors.membership_type && <p className="mt-1 text-xs text-red-500">{errors.membership_type.message}</p>}
            </div>
            <div>
              <label className="label">Categoría de descuento <span className="text-gray-400 font-normal">(opcional)</span></label>
              <ChipSelect
                options={discountCategories}
                value={watch('discount_category') ?? ''}
                onChange={v => setValue('discount_category', v || null)}
                onAdd={async name => {
                  await api.post('/discount-categories', { name, discount_percent: 0 })
                  qc.invalidateQueries(['discount-categories'])
                  setValue('discount_category', name)
                }}
                allowNone
                subLabel={opt => opt.discount_percent > 0 ? `-${parseFloat(opt.discount_percent).toFixed(0)}%` : null}
                placeholder="Nueva categoría..."
              />
            </div>
          </div>
          {(isEdit || action === 'membership') && (
            <>
              <div>
                <label className="label">Plan de duración</label>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Inicio de membresía</label>
                  <input {...register('membership_start')} type="date" className="input" />
                </div>
                <div>
                  <label className="label">Vencimiento</label>
                  <input
                    {...register('membership_end')} type="date"
                    className={`input ${plan ? 'bg-gray-50 text-gray-500' : ''}`}
                    readOnly={!!plan}
                  />
                  {plan && <p className="text-xs text-indigo-500 mt-1">Calculado automáticamente</p>}
                </div>
              </div>
            </>
          )}
          <div>
            <label className="label">Dirección</label>
            <input {...register('address')} className="input" placeholder="Calle, ciudad, estado" />
          </div>
          <div>
            <label className="label">Fecha de nacimiento</label>
            <input {...register('birth_date')} type="date" className="input" />
          </div>
          <div>
            <button type="button" onClick={() => setShowEmergency(v => !v)}
              className="flex items-center gap-1.5 text-xs text-indigo-500 hover:text-indigo-700 font-medium transition-colors">
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showEmergency ? 'rotate-180' : ''}`} />
              {showEmergency ? 'Ocultar contacto de emergencia' : 'Añadir contacto de emergencia (opcional)'}
            </button>
            {showEmergency && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                <div>
                  <label className="label">Nombre del contacto</label>
                  <input {...register('emergency_contact_name')} className="input" placeholder="Nombre completo" />
                </div>
                <div>
                  <label className="label">Teléfono de emergencia</label>
                  <input {...register('emergency_contact_phone')} className="input" placeholder="+52 55 1234 5678" />
                </div>
              </div>
            )}
          </div>
          {isEdit && (
            <div>
              <label className="label">Estado del miembro</label>
              <select {...register('status')} className="input">
                <option value="active">Activo</option>
                <option value="inactive">Inactivo</option>
                <option value="suspended">Suspendido</option>
              </select>
            </div>
          )}

          {/* Extra fields: visit */}
          {!isEdit && action === 'visit' && (
            <div>
              <label className="label">Precio de visita</label>
              <input
                type="number" min="0" step="0.01"
                value={visitPrice}
                onChange={e => setVisitPrice(e.target.value)}
                placeholder="0.00"
                className="input"
              />
            </div>
          )}

          {/* Extra fields: membership */}
          {!isEdit && action === 'membership' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Monto ($) *</label>
                <input
                  type="number" min="0" step="0.01"
                  value={memberAmount}
                  onChange={e => setMemberAmount(e.target.value)}
                  placeholder="0.00"
                  className="input"
                />
              </div>
              <div>
                <label className="label">Método de pago</label>
                <select value={memberPayment} onChange={e => setMemberPayment(e.target.value)} className="input">
                  <option value="cash">Efectivo</option>
                  <option value="card">Tarjeta</option>
                  <option value="transfer">Transferencia</option>
                </select>
              </div>
            </div>
          )}

          {!isEdit && (
            <div className="bg-gray-50 rounded-xl border border-gray-100 px-4 py-3 space-y-2">
              <p className="text-xs font-semibold text-gray-500">Enviar bienvenida con QR al registrar</p>
              <div className="flex gap-6">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <div onClick={() => setNotifyEmail(v => !v)}
                    className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors
                      ${notifyEmail ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 bg-white'}`}>
                    {notifyEmail && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                  </div>
                  <Mail className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="text-sm text-gray-700">Correo</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <div onClick={() => setNotifyWa(v => !v)}
                    className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors
                      ${notifyWa ? 'bg-green-600 border-green-600' : 'border-gray-300 bg-white'}`}>
                    {notifyWa && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                  </div>
                  <MessageCircle className="w-3.5 h-3.5 text-green-500" />
                  <span className="text-sm text-gray-700">WhatsApp</span>
                </label>
              </div>
            </div>
          )}

        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button type="submit" disabled={isSubmitting} className="btn-primary flex-1">
            {isSubmitting
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</>
              : submitLabel
            }
          </button>
        </div>
        </form>
      </div>
    </div>
  )
}


// ── QR Modal ──────────────────────────────────────────────────
function QRModal({ member, onClose }) {
  useLockBodyScroll()

  return (
    <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Código QR</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold">
            {member.first_name[0]}{member.last_name[0]}
          </div>
          <div className="text-center">
            <p className="font-semibold text-gray-900">{member.first_name} {member.last_name}</p>
            {member.member_code && <p className="text-xs font-mono text-indigo-600 mt-0.5">{member.member_code}</p>}
            {member.active_plan_type ? (
              <span className={`${PLAN_BADGE[member.active_plan_type] ?? 'badge-blue'} mt-1`}>
                {PLAN_LABEL[member.active_plan_type] ?? member.active_plan_type}
              </span>
            ) : (
              <MembershipTypeBadge type={member.membership_type} className="mt-1" />
            )}
          </div>
          {member.qr_token ? (
            <div className="p-4 bg-white border-2 border-gray-100 rounded-xl">
              <QRCodeCanvas value={member.qr_token} size={180} level="H" />
            </div>
          ) : (
            <p className="text-sm text-gray-400">Este miembro no tiene token QR</p>
          )}
          <p className="text-xs text-gray-400 text-center">Escanea para registrar asistencia</p>
          <button onClick={() => window.print()} className="btn-secondary w-full">Imprimir QR</button>
        </div>
      </div>
    </div>
  )
}

// ── MembershipTypeFilter ──────────────────────────────────────
function MembershipTypeFilter({ value, onChange }) {
  const { data: types = [] } = useQuery({
    queryKey: ['membership-types'],
    queryFn: () => api.get('/membership-types').then(r => r.data),
  })
  return (
    <select value={value} onChange={e => onChange(e.target.value)} className="input sm:w-44">
      <option value="">Todas las membresías</option>
      {types.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
    </select>
  )
}

// ── Main page ─────────────────────────────────────────────────
export default function Members() {
  const navigate = useNavigate()
  const { hash } = useParams()
  const qc = useQueryClient()
  const { systemSettings } = useSettingsStore()
  const [search, setSearch]       = useState('')
  const [statusFilter, setStatus] = useState('')
  const [typeFilter, setType]     = useState('')
  const [page, setPage]           = useState(1)
  const [pageSize, setPageSize]   = useState(12)
  const [sort, onSort]            = useSort()
  const handleSort = key => { onSort(key); setPage(1) }
  const handlePageSize = n => { setPageSize(n); setPage(1) }
  const [formModal, setFormModal]         = useState(null)
  const [qrModal, setQrModal]             = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [trendType, setTrendType]       = useState('bar')
  const [exporting, setExporting]       = useState(false)

  const queryParams = { search, status: statusFilter, membership_type: typeFilter, page, per_page: pageSize, sort_by: sort.by, sort_dir: sort.dir }

  const { data, isLoading } = useQuery({
    queryKey: ['members', queryParams],
    queryFn: () => api.get('/members', { params: queryParams }).then(r => r.data),
    keepPreviousData: true,
  })

  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ['member-summary'],
    queryFn: () => api.get('/members/summary').then(r => r.data),
  })

  // Colors saved per membership type (Settings → Precios → Tipos de membresía) —
  // used to color the "Por tipo de membresía" pie and every type badge below by
  // each type's own color instead of a fixed 3-entry basic/premium/vip palette.
  const typeColorByName = useMembershipTypeColors()

  const deleteMutation = useMutation({
    mutationFn: id => api.delete(`/members/${id}`),
    onSuccess: () => {
      qc.invalidateQueries(['members'])
      qc.invalidateQueries(['member-summary'])
      toast.success('Miembro eliminado')
    },
    onError: () => toast.error('Error al eliminar'),
  })

  const members    = data?.data ?? []
  const pagination = data ? { current: data.current_page, last: data.last_page, total: data.total } : null
  const s = summary?.summary

  const monthlyData = buildMonthly(summary?.by_month)

  const typeData = (summary?.by_type ?? []).map(r => ({
    name:  TYPE_LABEL[r.type] ?? r.type,
    count: r.count,
    fill:  typeColorByName[r.type] || TYPE_CHART_COLORS[r.type] || '#94A3B8',
  }))
  const typeTotal = typeData.reduce((sum, d) => sum + d.count, 0)

  async function fetchAll() {
    const res = await api.get('/members', {
      params: { page: 1, per_page: 9999, search, status: statusFilter, membership_type: typeFilter },
    })
    return res.data.data ?? []
  }

  async function handleExportExcel() {
    setExporting(true)
    const gymName = systemSettings?.gym_name || 'GemaSystem'
    try { exportToExcel(await fetchAll(), EXPORT_COLS, 'miembros', { title: 'Reporte de Miembros', gymName }) }
    finally { setExporting(false) }
  }

  async function handleExportPDF() {
    setExporting(true)
    const gymName = systemSettings?.gym_name || 'GemaSystem'
    try { exportToPDF(await fetchAll(), EXPORT_COLS, 'miembros', { title: 'Reporte de Miembros', gymName }) }
    finally { setExporting(false) }
  }

  const axisProps = { tick: { fontSize: 11, fill: '#94A3B8' }, tickLine: false, axisLine: false }
  const tipStyle  = { contentStyle: { borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '12px' } }
  const trendColor = '#3B82F6'

  function TrendChart() {
    const common = { data: monthlyData, margin: { top: 5, right: 5, bottom: 5, left: 0 } }
    if (trendType === 'line') return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart {...common}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
          <XAxis dataKey="name" {...axisProps} />
          <YAxis {...axisProps} allowDecimals={false} />
          <Tooltip {...tipStyle} formatter={v => [v, 'Miembros']} />
          <Line type="monotone" dataKey="count" stroke={trendColor} strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    )
    if (trendType === 'area') return (
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart {...common}>
          <defs>
            <linearGradient id="memberGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={trendColor} stopOpacity={0.18} />
              <stop offset="95%" stopColor={trendColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
          <XAxis dataKey="name" {...axisProps} />
          <YAxis {...axisProps} allowDecimals={false} />
          <Tooltip {...tipStyle} formatter={v => [v, 'Miembros']} />
          <Area type="monotone" dataKey="count" stroke={trendColor} strokeWidth={2.5} fill="url(#memberGrad)" dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    )
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart {...common}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
          <XAxis dataKey="name" {...axisProps} />
          <YAxis {...axisProps} allowDecimals={false} />
          <Tooltip {...tipStyle} formatter={v => [v, 'Miembros']} />
          <Bar dataKey="count" fill={trendColor} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    )
  }

  return (
    <>
    <LoadingLogoOverlay show={isLoading || loadingSummary} />
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Miembros</h2>
          <p className="text-sm text-gray-500 mt-0.5">{pagination?.total ?? 0} miembros registrados</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ExportMenu onExportExcel={handleExportExcel} onExportPDF={handleExportPDF} loading={exporting} />
          <button onClick={() => setFormModal('create')} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Nuevo miembro
          </button>
        </div>
      </div>

      <Skeleton name="members-summary" loading={loadingSummary}>
      {/* ── Stat cards ── */}
      {s && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Users}     title="Total"       value={s.total}     color="indigo" />
          <StatCard icon={UserCheck} title="Activos"     value={s.active}    color="emerald" />
          <StatCard icon={UserX}     title="Inactivos"   value={s.inactive}  color="gray" />
          <StatCard icon={Shield}    title="Suspendidos" value={s.suspended} color="red" />
        </div>
      )}

      {/* ── Charts ── */}
      {summary && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* By membership type — pie */}
          <FixedPanel height={384}>
            <PanelHeader title="Por tipo de membresía" />
            {typeData.length === 0 ? (
              <EmptyState icon={Users} text="Sin datos" />
            ) : (
              <div className="flex-1 flex items-center gap-5 min-h-0">
                <div className="relative w-44 h-44 flex-shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={typeData} dataKey="count" nameKey="name" cx="50%" cy="50%" innerRadius={58} outerRadius={88} paddingAngle={3}>
                        {typeData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                      </Pie>
                      <Tooltip {...tipStyle} formatter={v => [v, 'Miembros']} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-2xl font-bold text-gray-800">{typeTotal}</span>
                    <span className="text-[11px] text-gray-400">miembros</span>
                  </div>
                </div>
                <div className="flex-1 space-y-3 overflow-y-auto max-h-full">
                  {typeData.map((d, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.fill }} />
                      <span className="text-gray-600 truncate">{d.name}</span>
                      <span className="ml-auto font-semibold text-gray-800">{d.count}</span>
                      <span className="text-xs text-gray-400 w-9 text-right flex-shrink-0">
                        {typeTotal ? Math.round((d.count / typeTotal) * 100) : 0}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </FixedPanel>

          {/* Monthly registrations */}
          <FixedPanel height={384}>
            <PanelHeader
              title="Registro mensual"
              action={<ChartTypePicker value={trendType} onChange={setTrendType} />}
            />
            <div className="flex-1 min-h-0">
              <TrendChart />
            </div>
          </FixedPanel>

        </div>
      )}
      </Skeleton>

      {/* ── Filters ── */}
      <div className="card p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Buscar por nombre, ID (DYM-XXXX), correo..."
            className="input pl-9"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <select value={statusFilter} onChange={e => { setStatus(e.target.value); setPage(1) }} className="input sm:w-40">
          <option value="">Todos los estados</option>
          <option value="active">Activo</option>
          <option value="inactive">Inactivo</option>
          <option value="suspended">Suspendido</option>
        </select>
        <MembershipTypeFilter value={typeFilter} onChange={v => { setType(v); setPage(1) }} />
      </div>

      {/* ── Table ── */}
      <Skeleton name="members-table" loading={isLoading}>
      <div className="card overflow-hidden">
        {members.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <User className="w-10 h-10 mb-2 opacity-30" />
            <p className="text-sm">No se encontraron miembros</p>
          </div>
        ) : (
          <>
            {/* Desktop — full table. Tablets (below lg) get the card list further
                down: at 768-1023px there isn't enough room for six columns
                without cramming/wrapping, so they get the roomier layout instead. */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b-2 border-gray-100">
                    <SortableTh sortKey="first_name" sort={sort} onSort={handleSort} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Miembro</SortableTh>
                    <th className="w-40 text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Contacto</th>
                    <SortableTh sortKey="membership_type" sort={sort} onSort={handleSort} className="w-40 text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Membresía</SortableTh>
                    <SortableTh sortKey="membership_end" sort={sort} onSort={handleSort} className="w-40 text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Vencimiento</SortableTh>
                    <th className="w-40 text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden xl:table-cell">Etiquetas</th>
                    <SortableTh sortKey="status" sort={sort} onSort={handleSort} className="w-40 text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado</SortableTh>
                    <th className="w-40 px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m, idx) => (
                    <tr
                      key={m.id}
                      className={`border-b border-gray-50 hover:bg-blue-50/30 transition-colors group cursor-pointer ${idx % 2 === 1 ? 'bg-gray-50/40' : ''}`}
                      onClick={() => navigate(`/g/${hash}/socio/${m.id}`)}
                    >
                      <td className="px-4 py-3.5 align-top w-full max-w-0">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-700 text-xs font-bold flex-shrink-0">
                            {m.first_name?.[0]}{m.last_name?.[0]}
                          </div>
                          <p className="font-medium text-gray-900 truncate" title={`${m.first_name} ${m.last_name}`}>
                            {m.first_name} {m.last_name}
                          </p>
                        </div>
                      </td>
                      <td className="w-40 px-4 py-3.5 align-top">
                        <div className="space-y-0.5 min-w-0">
                          {m.email && (
                            <div className="flex items-center gap-1.5 text-xs text-gray-600 min-w-0">
                              <Mail className="w-3 h-3 text-gray-400 flex-shrink-0" /><span className="truncate">{m.email}</span>
                            </div>
                          )}
                          {m.phone && (
                            <div className="flex items-center gap-1.5 text-xs text-gray-600 whitespace-nowrap">
                              <Phone className="w-3 h-3 text-gray-400 flex-shrink-0" />{m.phone}
                            </div>
                          )}
                          {!m.email && !m.phone && <span className="text-gray-300 text-xs">—</span>}
                        </div>
                      </td>
                      <td className="w-40 px-4 py-3.5 align-top">
                        <div className="flex flex-col items-start gap-1">
                          <MembershipTypeBadge type={m.membership_type} />
                          {m.active_plan_type && (
                            <span className={`${PLAN_BADGE[m.active_plan_type] ?? 'badge-blue'} text-xs`}>
                              {PLAN_LABEL[m.active_plan_type] ?? m.active_plan_type}
                            </span>
                          )}
                          {m.discount_category && (
                            <span className="inline-flex items-center gap-0.5 text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                              <Percent className="w-3 h-3" />{m.discount_category}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="w-40 px-4 py-3.5 align-top">
                        {m.membership_end ? (
                          <div className="space-y-1 whitespace-nowrap">
                            <div className="flex items-center gap-1.5 text-xs text-gray-600">
                              <Calendar className="w-3 h-3 text-gray-400 flex-shrink-0" />
                              {new Date(m.membership_end).toLocaleDateString('es-MX')}
                            </div>
                            <DaysRemaining dateStr={m.membership_end} />
                          </div>
                        ) : <span className="text-gray-300 text-xs">Sin fecha</span>}
                      </td>
                      <td className="w-40 px-4 py-3.5 align-top hidden xl:table-cell">
                        <div className="flex flex-wrap items-center gap-1 min-w-0">
                          {m.labels?.slice(0, 2).map(l => (
                            <span
                              key={l.id}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full truncate max-w-[7rem]"
                              style={{
                                background: `color-mix(in srgb, ${l.color} 15%, transparent)`,
                                color: l.color,
                                border: `1px solid color-mix(in srgb, ${l.color} 30%, transparent)`,
                              }}
                              title={l.name}
                            >
                              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: l.color }} />
                              <span className="truncate">{l.name}</span>
                            </span>
                          ))}
                          {(m.labels?.length ?? 0) > 2 && (
                            <span className="text-xs text-gray-400 flex-shrink-0">+{m.labels.length - 2}</span>
                          )}
                          {(m.labels?.length ?? 0) === 0 && <span className="text-gray-300 text-xs">—</span>}
                        </div>
                      </td>
                      <td className="w-40 px-4 py-3.5 align-top">
                        <span className={STATUS_BADGE[m.status] ?? 'badge-gray'}>{STATUS_LABEL[m.status]}</span>
                      </td>
                      <td className="w-40 px-4 py-3.5 align-top">
                        <div
                          className="flex items-center justify-end gap-1"
                          onClick={e => e.stopPropagation()}
                        >
                          <button onClick={() => navigate(`/g/${hash}/socio/${m.id}`)} className="p-1.5 rounded-lg hover:bg-indigo-50 text-indigo-400" title="Ver perfil">
                            <ExternalLink className="w-4 h-4" />
                          </button>
                          <button onClick={() => setQrModal(m)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500" title="Ver QR">
                            <QrCode className="w-4 h-4" />
                          </button>
                          <button onClick={() => setFormModal(m)} className="p-1.5 rounded-lg hover:bg-indigo-50 text-indigo-600" title="Editar">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => setDeleteTarget(m)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500" title="Eliminar">
                            <Trash2 className="w-4 h-4" />
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
              {members.map(m => (
                <div
                  key={m.id}
                  className="p-4 active:bg-gray-50 cursor-pointer"
                  onClick={() => navigate(`/g/${hash}/socio/${m.id}`)}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-700 text-sm font-bold flex-shrink-0">
                      {m.first_name?.[0]}{m.last_name?.[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate">{m.first_name} {m.last_name}</p>
                          {m.member_code && <p className="text-xs font-mono text-indigo-500">{m.member_code}</p>}
                        </div>
                        <span className={`${STATUS_BADGE[m.status] ?? 'badge-gray'} flex-shrink-0`}>{STATUS_LABEL[m.status]}</span>
                      </div>

                      {(m.email || m.phone) && (
                        <div className="mt-1.5 space-y-0.5">
                          {m.email && (
                            <div className="flex items-center gap-1.5 text-xs text-gray-600 min-w-0">
                              <Mail className="w-3 h-3 text-gray-400 flex-shrink-0" /><span className="truncate">{m.email}</span>
                            </div>
                          )}
                          {m.phone && (
                            <div className="flex items-center gap-1.5 text-xs text-gray-600">
                              <Phone className="w-3 h-3 text-gray-400 flex-shrink-0" />{m.phone}
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex flex-wrap gap-1 mt-2">
                        <MembershipTypeBadge type={m.membership_type} />
                        {m.active_plan_type && (
                          <span className={`${PLAN_BADGE[m.active_plan_type] ?? 'badge-blue'} text-xs`}>
                            {PLAN_LABEL[m.active_plan_type] ?? m.active_plan_type}
                          </span>
                        )}
                        {m.discount_category && (
                          <span className="inline-flex items-center gap-0.5 text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                            <Percent className="w-3 h-3" />{m.discount_category}
                          </span>
                        )}
                      </div>

                      {m.membership_end && (
                        <div className="flex items-center flex-wrap gap-x-2 gap-y-1 mt-2 text-xs text-gray-600">
                          <span className="flex items-center gap-1.5">
                            <Calendar className="w-3 h-3 text-gray-400" />
                            {new Date(m.membership_end).toLocaleDateString('es-MX')}
                          </span>
                          <DaysRemaining dateStr={m.membership_end} />
                        </div>
                      )}

                      {m.labels?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {m.labels.map(l => (
                            <span
                              key={l.id}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
                              style={{
                                background: `color-mix(in srgb, ${l.color} 15%, transparent)`,
                                color: l.color,
                                border: `1px solid color-mix(in srgb, ${l.color} 30%, transparent)`,
                              }}
                            >
                              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: l.color }} />
                              {l.name}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center gap-1 mt-3 pt-3 border-t border-gray-50" onClick={e => e.stopPropagation()}>
                        <button onClick={() => navigate(`/g/${hash}/socio/${m.id}`)} className="p-1.5 rounded-lg hover:bg-indigo-50 text-indigo-400" title="Ver perfil">
                          <ExternalLink className="w-4 h-4" />
                        </button>
                        <button onClick={() => setQrModal(m)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500" title="Ver QR">
                          <QrCode className="w-4 h-4" />
                        </button>
                        <button onClick={() => setFormModal(m)} className="p-1.5 rounded-lg hover:bg-indigo-50 text-indigo-600" title="Editar">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => setDeleteTarget(m)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500" title="Eliminar">
                          <Trash2 className="w-4 h-4" />
                        </button>
                        {m.visits_count > 0 && (
                          <span className="ml-auto flex items-center gap-1 text-xs text-gray-400">
                            <Footprints className="w-3 h-3" />{m.visits_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {pagination && (
              <Pagination page={pagination.current} lastPage={pagination.last} total={pagination.total} onPageChange={setPage} itemLabel="miembros" pageSize={pageSize} onPageSizeChange={handlePageSize} />
            )}
          </>
        )}
      </div>
      </Skeleton>

      {formModal && (
        <MemberFormModal
          member={formModal === 'create' ? null : formModal}
          onClose={() => setFormModal(null)}
        />
      )}
      {qrModal && <QRModal member={qrModal} onClose={() => setQrModal(null)} />}
      {deleteTarget && (
        <ConfirmModal
          title={`¿Eliminar a ${deleteTarget.first_name} ${deleteTarget.last_name}?`}
          message="Esta acción eliminará al miembro y todos sus registros permanentemente."
          onConfirm={() => { deleteMutation.mutate(deleteTarget.id); setDeleteTarget(null) }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
    </>
  )
}
