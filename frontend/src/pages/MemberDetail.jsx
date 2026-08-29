import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { QRCodeCanvas } from 'qrcode.react'
import SkeletonLogoMark from '../components/SkeletonLogoMark'
import {
  ArrowLeft, Mail, Phone, Calendar, MapPin, User, Hash,
  Shield, Tag, Plus, X, Check, Loader2, BadgeCheck, Zap, Percent,
  Clock, TrendingUp, Activity, CreditCard, CalendarCheck2,
  CalendarDays, History, MessageCircle, Send,
  QrCode, AlarmClock, Gift, RefreshCw,
} from 'lucide-react'
import toast from 'react-hot-toast'
import useLockBodyScroll from '../hooks/useLockBodyScroll'
import api from '../api/axios'
import ActivityGraph from '../components/ActivityGraph'
import MembershipTypeBadge from '../components/MembershipTypeBadge'

// ── constants ─────────────────────────────────────────────────
const STATUS_BADGE = { active: 'badge-green', inactive: 'badge-gray', suspended: 'badge-red' }
const STATUS_LABEL = { active: 'Activo', inactive: 'Inactivo', suspended: 'Suspendido' }
const VISIT_LABEL  = { training: 'Visita', class: 'Clase', consultation: 'Consulta', other: 'Otro' }
const VISIT_COLOR  = { training: 'badge-indigo', class: 'badge-purple', consultation: 'badge-blue', other: 'badge-gray' }
const PAY_LABEL    = { cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia' }

const PLAN_BADGE = {
  weekly: 'badge-teal', biweekly: 'badge-cyan', monthly: 'badge-blue',
  quarterly: 'badge-purple', biannual: 'badge-indigo', annual: 'badge-yellow',
}
const PLAN_LABEL = {
  weekly: 'Semanal', biweekly: 'Quincenal', monthly: 'Mensual',
  quarterly: 'Trimestral', biannual: 'Semestral', annual: 'Anual',
}

const PRESET_COLORS = [
  '#ef4444','#f97316','#eab308','#22c55e',
  '#06b6d4','#6366f1','#a855f7','#ec4899',
  '#78716c','#64748b',
]

// ── helpers ───────────────────────────────────────────────────
function fmtDate(dateStr, opts = { day: '2-digit', month: 'short', year: 'numeric' }) {
  if (!dateStr) return '—'
  const [y, m, d] = String(dateStr).split('T')[0].split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-MX', opts)
}

function daysUntil(dateStr) {
  if (!dateStr) return null
  const [y, m, d] = String(dateStr).split('T')[0].split('-').map(Number)
  return Math.ceil((new Date(y, m - 1, d, 23, 59, 59) - new Date()) / 86400000)
}

function membershipProgress(startStr, endStr) {
  if (!startStr || !endStr) return 0
  const parseLocal = s => { const [y,m,d] = s.split('T')[0].split('-').map(Number); return new Date(y, m-1, d) }
  const start = parseLocal(startStr), end = parseLocal(endStr), now = new Date()
  const total = end - start
  if (total <= 0) return 100
  return Math.min(100, Math.max(0, ((now - start) / total) * 100))
}

// ── LabelManager ──────────────────────────────────────────────
function LabelManager({ member, allLabels, onUpdate }) {
  const [adding, setAdding]     = useState(false)
  const [newName, setNewName]   = useState('')
  const [newColor, setNewColor] = useState('#6366f1')
  const [loading, setLoading]   = useState(false)
  const memberLabelIds = member.labels?.map(l => l.id) ?? []

  async function attach(labelId) {
    try { await api.post(`/members/${member.id}/labels`, { label_id: labelId }); toast.success('Etiqueta asignada'); onUpdate() }
    catch { toast.error('Error al asignar etiqueta') }
  }
  async function detach(labelId) {
    try { await api.delete(`/members/${member.id}/labels/${labelId}`); toast.success('Etiqueta removida'); onUpdate() }
    catch { toast.error('Error al remover etiqueta') }
  }
  async function createAndAttach() {
    if (!newName.trim()) return
    setLoading(true)
    try {
      const { data: label } = await api.post('/labels', { name: newName.trim(), color: newColor })
      await api.post(`/members/${member.id}/labels`, { label_id: label.id })
      toast.success('Etiqueta creada y asignada'); setNewName(''); setAdding(false); onUpdate()
    } catch (err) {
      toast.error(Object.values(err.response?.data?.errors ?? {}).flat()[0] ?? 'Error al crear etiqueta')
    } finally { setLoading(false) }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {member.labels?.map(l => (
          <span key={l.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold text-white" style={{ backgroundColor: l.color }}>
            {l.name}
            <button onClick={() => detach(l.id)} className="hover:opacity-70"><X className="w-3 h-3" /></button>
          </span>
        ))}
        {(!member.labels || member.labels.length === 0) && <p className="text-xs text-gray-400">Sin etiquetas asignadas</p>}
      </div>
      {allLabels.filter(l => !memberLabelIds.includes(l.id)).length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {allLabels.filter(l => !memberLabelIds.includes(l.id)).map(l => (
            <button key={l.id} onClick={() => attach(l.id)}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border-2 hover:opacity-80"
              style={{ borderColor: l.color, color: l.color }}>
              <Plus className="w-3 h-3" />{l.name}
            </button>
          ))}
        </div>
      )}
      {adding ? (
        <div className="flex items-center gap-2 flex-wrap">
          <input value={newName} onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && createAndAttach()}
            placeholder="Nombre de etiqueta" className="input flex-1 min-w-0 h-8 text-xs" autoFocus />
          <div className="flex gap-1">
            {PRESET_COLORS.map(c => (
              <button key={c} onClick={() => setNewColor(c)} style={{ backgroundColor: c }}
                className={`w-5 h-5 rounded-full transition-transform ${newColor === c ? 'ring-2 ring-offset-1 ring-gray-400 scale-110' : 'hover:scale-110'}`} />
            ))}
          </div>
          <button onClick={createAndAttach} disabled={loading} className="btn-primary h-8 px-3 text-xs">
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
          </button>
          <button onClick={() => setAdding(false)} className="btn-secondary h-8 px-2 text-xs"><X className="w-3 h-3" /></button>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="btn-ghost text-xs h-7 px-2">
          <Plus className="w-3 h-3" /> Nueva etiqueta
        </button>
      )}
    </div>
  )
}

// ── StatCard ──────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color = 'text-indigo-600', bg = 'bg-indigo-50' }) {
  return (
    <div className="card p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${bg}`}>
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-xl font-bold text-gray-900 leading-tight">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ── MembershipStatusCard ──────────────────────────────────────
function MembershipStatusCard({ member }) {
  const active = member.activeMembership
  const endStr   = active?.end_date   ?? member.membership_end
  const startStr = active?.start_date ?? member.membership_start
  const planType = active?.type
  const days = daysUntil(endStr)
  const pct  = membershipProgress(startStr, endStr)

  // no membership at all
  if (!endStr && !startStr) {
    return (
      <div className="card p-5 flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
          <CreditCard className="w-6 h-6 text-gray-400" />
        </div>
        <div>
          <p className="font-semibold text-gray-700">Sin membresía activa</p>
          <p className="text-xs text-gray-400 mt-0.5">Este miembro no tiene membresía registrada</p>
        </div>
      </div>
    )
  }

  const isExpired = days !== null && days < 0
  const barColor  = isExpired ? 'bg-red-500'
    : days !== null && days <= 7  ? 'bg-red-400'
    : days !== null && days <= 30 ? 'bg-amber-400'
    : 'bg-emerald-400'

  const daysLabel = days === null     ? '—'
    : days < 0                        ? `Vencida hace ${Math.abs(days)} días`
    : days === 0                      ? 'Vence hoy'
    : `${days} días restantes`

  const daysColor = isExpired ? 'text-red-600'
    : days !== null && days <= 7  ? 'text-red-500'
    : days !== null && days <= 30 ? 'text-amber-600'
    : 'text-emerald-600'

  return (
    <div className={`card overflow-hidden border-l-4 ${isExpired ? 'border-l-red-400' : days !== null && days <= 7 ? 'border-l-amber-400' : 'border-l-emerald-400'}`}>
      <div className="p-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          {/* Left: plan + dates */}
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <CreditCard className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-semibold text-gray-800">Membresía activa</span>
              {planType && (
                <span className={`${PLAN_BADGE[planType] ?? 'badge-blue'}`}>
                  {PLAN_LABEL[planType] ?? planType}
                </span>
              )}
              {active?.status && (
                <span className={active.status === 'active' ? 'badge-green' : 'badge-gray'}>
                  {active.status === 'active' ? 'Activa' : active.status}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <p className="text-gray-400">Inicio</p>
                <p className="font-semibold text-gray-700">{fmtDate(startStr)}</p>
              </div>
              <div>
                <p className="text-gray-400">Vencimiento</p>
                <p className="font-semibold text-gray-700">{fmtDate(endStr)}</p>
              </div>
              {active?.amount && (
                <div>
                  <p className="text-gray-400">Monto pagado</p>
                  <p className="font-semibold text-gray-700">
                    ${parseFloat(active.amount).toLocaleString('es-MX')}
                    {active.payment_method && <span className="text-gray-400 font-normal"> · {PAY_LABEL[active.payment_method] ?? active.payment_method}</span>}
                  </p>
                </div>
              )}
            </div>

            {/* Progress bar */}
            <div>
              <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                <span>{Math.round(pct)}% consumido</span>
                <span className={`font-semibold ${daysColor}`}>{daysLabel}</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          </div>

          {/* Right: big days counter */}
          <div className={`flex-shrink-0 flex flex-col items-center justify-center w-24 h-24 rounded-2xl ${isExpired ? 'bg-red-50' : days !== null && days <= 7 ? 'bg-amber-50' : 'bg-emerald-50'}`}>
            {isExpired ? (
              <>
                <span className="text-2xl font-black text-red-500">{Math.abs(days)}</span>
                <span className="text-[10px] text-red-400 font-medium text-center leading-tight">días<br/>vencida</span>
              </>
            ) : days === 0 ? (
              <span className="text-xs font-bold text-red-500 text-center">Vence<br/>hoy</span>
            ) : days !== null ? (
              <>
                <span className={`text-3xl font-black ${daysColor}`}>{days}</span>
                <span className={`text-[10px] font-medium text-center leading-tight ${daysColor}`}>días<br/>restantes</span>
              </>
            ) : (
              <span className="text-xs text-gray-400">Sin fecha</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── MembershipHistory ─────────────────────────────────────────
function MembershipHistory({ memberships }) {
  if (!memberships || memberships.length === 0) return null

  const STATUS_CL = { active: 'badge-green', expired: 'badge-red', cancelled: 'badge-gray' }
  const STATUS_LB = { active: 'Activa', expired: 'Vencida', cancelled: 'Cancelada' }

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
        <History className="w-4 h-4 text-gray-400" />
        <h3 className="text-sm font-semibold text-gray-800">Historial de membresías</h3>
        <span className="ml-auto text-xs text-gray-400">{memberships.length} registro{memberships.length !== 1 ? 's' : ''}</span>
      </div>
      <ul className="divide-y divide-gray-50">
        {memberships.map(m => {
          const d = daysUntil(m.end_date)
          return (
            <li key={m.id} className="flex items-center gap-4 px-5 py-3.5">
              <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center flex-shrink-0">
                <CreditCard className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`${PLAN_BADGE[m.type] ?? 'badge-blue'} text-xs`}>
                    {PLAN_LABEL[m.type] ?? m.type}
                  </span>
                  <span className={STATUS_CL[m.status] ?? 'badge-gray'}>{STATUS_LB[m.status] ?? m.status}</span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {fmtDate(m.start_date, { day: '2-digit', month: 'short' })}
                  {' → '}
                  {fmtDate(m.end_date, { day: '2-digit', month: 'short', year: 'numeric' })}
                  {m.amount && <span className="ml-2 font-medium text-gray-700">${parseFloat(m.amount).toLocaleString('es-MX')}</span>}
                </p>
              </div>
              {m.status === 'active' && d !== null && d >= 0 && (
                <span className={`text-xs font-semibold flex-shrink-0 ${d <= 7 ? 'text-red-500' : d <= 30 ? 'text-amber-500' : 'text-emerald-600'}`}>
                  {d === 0 ? 'Hoy' : `${d}d`}
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ── Channel picker modal ──────────────────────────────────────
const NOTIFY_TYPES = [
  {
    key: 'qr',
    icon: QrCode,
    label: 'QR de membresía',
    desc: 'Código QR de acceso + datos de membresía',
    color: '#6366f1',
    bg: '#f5f3ff',
  },
  {
    key: 'reminder',
    icon: AlarmClock,
    label: 'Recordatorio de membresía',
    desc: 'Días restantes y fecha de vencimiento',
    color: '#d97706',
    bg: '#fffbeb',
  },
  {
    key: 'birthday',
    icon: Gift,
    label: 'Felicitación de cumpleaños',
    desc: 'Mensaje especial de cumpleaños',
    color: '#9333ea',
    bg: '#fdf4ff',
  },
  {
    key: 'renewal',
    icon: RefreshCw,
    label: 'Invitación a renovar',
    desc: 'Invitación para renovar antes de que venza',
    color: '#16a34a',
    bg: '#f0fdf4',
  },
]

const CHANNELS = [
  { key: 'email',    icon: Mail,          label: 'Correo',   color: '#6366f1', bg: '#f5f3ff' },
  { key: 'whatsapp', icon: MessageCircle, label: 'WhatsApp', color: '#16a34a', bg: '#f0fdf4' },
]

function NotifyModal({ member, onConfirm, onClose, loading }) {
  useLockBodyScroll()
  const [type,    setType]    = useState(null)
  const [channel, setChannel] = useState(null)

  const canEmail = !!member.email
  const canWa    = !!member.phone

  const selType = NOTIFY_TYPES.find(t => t.key === type)
  const selCh   = CHANNELS.find(c => c.key === channel)

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={!loading ? onClose : undefined} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 flex flex-col gap-4">
        {!loading && (
          <button onClick={onClose} className="absolute top-3 right-3 text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        )}

        <div>
          <h3 className="text-base font-bold text-gray-900">Enviar notificación</h3>
          <p className="text-xs text-gray-400 mt-0.5">a {member.first_name} {member.last_name}</p>
        </div>

        {/* Step 1 — type */}
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">¿Qué notificación?</p>
          <div className="grid grid-cols-2 gap-2">
            {NOTIFY_TYPES.map(t => {
              const Icon   = t.icon
              const active = type === t.key
              return (
                <button
                  key={t.key}
                  onClick={() => setType(t.key)}
                  className="flex items-start gap-2 p-2.5 rounded-xl border-2 text-left transition-all"
                  style={active
                    ? { borderColor: t.color, background: t.bg }
                    : { borderColor: '#f3f4f6', background: '#fff' }}
                >
                  <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5"
                       style={{ background: active ? t.color : '#f3f4f6' }}>
                    <Icon style={{ width: 12, height: 12, color: active ? '#fff' : '#9ca3af' }} />
                  </div>
                  <span className="text-xs font-semibold leading-tight" style={{ color: active ? t.color : '#374151' }}>
                    {t.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Step 2 — channel */}
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">¿Por qué canal?</p>
          <div className="flex gap-2">
            {CHANNELS.map(ch => {
              const available = ch.key === 'email' ? canEmail : canWa
              const value     = ch.key === 'email' ? member.email : member.phone
              const active    = channel === ch.key
              const ChIcon    = ch.icon
              return (
                <button
                  key={ch.key}
                  onClick={() => available && setChannel(ch.key)}
                  disabled={!available}
                  className="flex-1 flex items-center gap-2 p-2.5 rounded-xl border-2 text-left transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  style={active
                    ? { borderColor: ch.color, background: ch.bg }
                    : { borderColor: '#f3f4f6', background: '#fff' }}
                >
                  <ChIcon style={{ width: 14, height: 14, color: active ? ch.color : '#9ca3af', flexShrink: 0 }} />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold" style={{ color: active ? ch.color : '#374151' }}>{ch.label}</p>
                    <p className="text-[10px] text-gray-400 truncate">{available ? value : 'No registrado'}</p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} disabled={loading} className="btn-secondary flex-1 text-sm">
            Cancelar
          </button>
          <button
            onClick={() => type && channel && onConfirm(type, channel)}
            disabled={!type || !channel || loading}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: selCh ? selCh.color : '#d1d5db' }}
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            {loading ? 'Enviando...' : 'Enviar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── NoMembershipModal ─────────────────────────────────────────
function NoMembershipModal({ member, onClose }) {
  useLockBodyScroll()

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 flex flex-col items-center gap-4">
        <button onClick={onClose} className="absolute top-3 right-3 text-gray-400 hover:text-gray-600">
          <X className="w-5 h-5" />
        </button>
        <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center">
          <CreditCard className="w-8 h-8 text-amber-400" />
        </div>
        <div className="text-center">
          <h3 className="text-lg font-bold text-gray-900">Sin membresía activa</h3>
          <p className="text-sm text-gray-500 mt-1">
            <span className="font-semibold text-gray-700">{member.full_name}</span> no cuenta con una
            membresía activa en este momento. No se puede enviar la notificación de días restantes.
          </p>
        </div>
        <div className="w-full bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800">
          Para poder notificar al miembro, primero registra una membresía desde el panel de membresías.
        </div>
        <button onClick={onClose} className="btn-primary w-full">Entendido</button>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────
export default function MemberDetail() {
  const { id, hash } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [showNotifyModal, setShowNotifyModal] = useState(false)
  const [notifyLoading, setNotifyLoading]     = useState(false)
  const [showNoMemModal, setShowNoMemModal]   = useState(false)

  const TOAST_LABELS = {
    qr:       { email: 'QR enviado al correo', whatsapp: 'QR enviado por WhatsApp' },
    reminder: { email: 'Recordatorio enviado al correo', whatsapp: 'Recordatorio enviado por WhatsApp' },
    birthday: { email: 'Felicitación enviada al correo', whatsapp: 'Felicitación enviada por WhatsApp' },
    renewal:  { email: 'Invitación enviada al correo',   whatsapp: 'Invitación enviada por WhatsApp'   },
  }

  async function handleNotify(type, channel) {
    setNotifyLoading(true)
    try {
      await api.post(`/members/${member?.id}/notify`, { type, channel })
      setShowNotifyModal(false)
      toast.success(TOAST_LABELS[type]?.[channel] ?? 'Notificación enviada')
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'No se pudo enviar la notificación')
    } finally {
      setNotifyLoading(false)
    }
  }

  const { data, isLoading, isError } = useQuery({
    queryKey: ['member', id],
    queryFn: () => api.get(`/members/${id}`).then(r => r.data),
  })

  const { data: allLabels = [] } = useQuery({
    queryKey: ['labels'],
    queryFn: () => api.get('/labels').then(r => r.data),
  })

  const invalidate = () => qc.invalidateQueries(['member', id])

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <SkeletonLogoMark size={56} />
    </div>
  )

  if (isError) return (
    <div className="text-center py-20 text-gray-400">
      <p className="text-lg">Miembro no encontrado</p>
      <button onClick={() => navigate(`/g/${hash}/socios`)} className="btn-secondary mt-4">
        <ArrowLeft className="w-4 h-4" /> Volver
      </button>
    </div>
  )

  const { member, stats, recent_visits } = data
  const daysLeft = daysUntil(member.activeMembership?.end_date ?? member.membership_end)

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Notify modal */}
      {showNotifyModal && (
        <NotifyModal
          member={member}
          loading={notifyLoading}
          onClose={() => { if (!notifyLoading) setShowNotifyModal(false) }}
          onConfirm={handleNotify}
        />
      )}

      {/* No-membership modal */}
      {showNoMemModal && (
        <NoMembershipModal member={member} onClose={() => setShowNoMemModal(false)} />
      )}

      {/* Back */}
      <button onClick={() => navigate(`/g/${hash}/socios`)} className="btn-ghost text-sm -ml-2">
        <ArrowLeft className="w-4 h-4" /> Volver a miembros
      </button>

      {/* ── Profile header ── */}
      <div className="card p-6">
        <div className="flex flex-col sm:flex-row items-start gap-5">
          {/* Avatar */}
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-white text-2xl font-bold flex-shrink-0">
            {member.first_name[0]}{member.last_name[0]}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-xl font-bold text-gray-900">{member.full_name}</h1>
              <span className={STATUS_BADGE[member.status] ?? 'badge-gray'}>{STATUS_LABEL[member.status]}</span>
              {member.activeMembership?.type ? (
                <span className={PLAN_BADGE[member.activeMembership.type] ?? 'badge-blue'}>
                  {PLAN_LABEL[member.activeMembership.type]}
                </span>
              ) : (
                <MembershipTypeBadge type={member.membership_type} />
              )}
            </div>

            {member.member_code && (
              <div className="flex items-center gap-1.5 mb-2">
                <Hash className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-sm font-mono text-indigo-600 font-semibold">{member.member_code}</span>
              </div>
            )}

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
              {member.email && (
                <span className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-gray-400" />{member.email}
                </span>
              )}
              {member.phone && (
                <span className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-gray-400" />{member.phone}
                </span>
              )}
              {member.created_at && (
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="w-3.5 h-3.5 text-gray-400" />
                  Miembro desde {fmtDate(member.created_at)}
                </span>
              )}
              {(member.activeMembership?.end_date ?? member.membership_end) && (
                <span className={`flex items-center gap-1.5 font-medium ${daysLeft !== null && daysLeft <= 7 ? 'text-red-500' : daysLeft !== null && daysLeft <= 30 ? 'text-amber-500' : 'text-gray-500'}`}>
                  <CalendarCheck2 className="w-3.5 h-3.5" />
                  Vence {fmtDate(member.activeMembership?.end_date ?? member.membership_end, { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
              )}
              {member.gender && (
                <span className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-gray-400" />
                  {{ male: 'Masculino', female: 'Femenino', other: 'Otro' }[member.gender]}
                </span>
              )}
              {member.birth_date && (
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-gray-400" />
                  {fmtDate(member.birth_date)}
                </span>
              )}
              {member.address && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-gray-400" />
                  {member.address}
                </span>
              )}
              {member.emergency_contact_name && (
                <span className="flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-gray-400" />
                  {member.emergency_contact_name}
                  {member.emergency_contact_phone && <span className="text-gray-400"> · {member.emergency_contact_phone}</span>}
                </span>
              )}
              {member.discount_category && (
                <span className="flex items-center gap-1.5 text-indigo-600 font-medium">
                  <Percent className="w-3.5 h-3.5 text-indigo-400" />
                  {member.discount_category}
                </span>
              )}
            </div>

            {/* Action buttons */}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => setShowNotifyModal(true)}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors"
              >
                <Send className="w-3.5 h-3.5" /> Notificar
              </button>
            </div>
          </div>

          {/* QR */}
          {member.qr_token && (
            <div className="flex-shrink-0 flex flex-col items-center gap-1.5">
              <div className="p-3 bg-white border-2 border-gray-100 rounded-xl shadow-sm">
                <QRCodeCanvas value={member.qr_token} size={130} level="H" id={`qr-${member.id}`} />
              </div>
              <p className="text-center text-[10px] text-gray-400">Escanear para registrar visita</p>
              <p className="font-mono text-[9px] text-gray-300 tracking-widest select-all">{member.member_code}</p>
            </div>
          )}
        </div>

        {/* Quick stats strip */}
        <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Total visitas */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
              <Activity className="w-4 h-4 text-indigo-500" />
            </div>
            <div>
              <p className="text-[10px] text-gray-400 leading-none">Total visitas</p>
              <p className="text-lg font-bold text-gray-900 leading-tight">{stats.totalVisits}</p>
            </div>
          </div>

          {/* Este mes */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
            </div>
            <div>
              <p className="text-[10px] text-gray-400 leading-none">Este mes</p>
              <p className="text-lg font-bold text-gray-900 leading-tight">{stats.monthVisits}</p>
            </div>
          </div>

          {/* Días como miembro */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center flex-shrink-0">
              <BadgeCheck className="w-4 h-4 text-violet-500" />
            </div>
            <div>
              <p className="text-[10px] text-gray-400 leading-none">Días registrado</p>
              <p className="text-lg font-bold text-gray-900 leading-tight">{stats.daysActive}</p>
            </div>
          </div>

          {/* Días restantes */}
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
              daysLeft === null ? 'bg-gray-100'
              : daysLeft < 0   ? 'bg-red-50'
              : daysLeft <= 7  ? 'bg-red-50'
              : daysLeft <= 30 ? 'bg-amber-50'
              : 'bg-green-50'
            }`}>
              <Clock className={`w-4 h-4 ${
                daysLeft === null ? 'text-gray-400'
                : daysLeft < 0   ? 'text-red-500'
                : daysLeft <= 7  ? 'text-red-500'
                : daysLeft <= 30 ? 'text-amber-500'
                : 'text-green-500'
              }`} />
            </div>
            <div>
              <p className="text-[10px] text-gray-400 leading-none">Días restantes</p>
              <p className={`text-lg font-bold leading-tight ${
                daysLeft === null ? 'text-gray-400'
                : daysLeft < 0   ? 'text-red-500'
                : daysLeft <= 7  ? 'text-red-500'
                : daysLeft <= 30 ? 'text-amber-500'
                : 'text-green-600'
              }`}>
                {daysLeft === null ? '—' : daysLeft < 0 ? 'Vencida' : daysLeft === 0 ? 'Hoy' : daysLeft}
              </p>
            </div>
          </div>
        </div>

        {/* Labels */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <Tag className="w-4 h-4 text-gray-400" />
            <p className="text-sm font-medium text-gray-700">Etiquetas</p>
          </div>
          <LabelManager member={member} allLabels={allLabels} onUpdate={invalidate} />
        </div>
      </div>

      {/* ── Membership status card ── */}
      <MembershipStatusCard member={member} />

      {/* ── Stats extra ── */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={Clock}
          label="Visitas esta semana"
          value={stats.weekVisits}
          color="text-blue-600" bg="bg-blue-50"
        />
        <StatCard
          icon={CalendarDays}
          label="Miembro desde"
          value={fmtDate(member.created_at, { day: '2-digit', month: 'short', year: 'numeric' })}
          color="text-violet-600" bg="bg-violet-50"
        />
      </div>

      {/* ── Activity graph ── */}
      <div className="card p-5">
        <ActivityGraph memberId={id} />
      </div>

      {/* ── Membership history ── */}
      <MembershipHistory memberships={member.memberships} />

      {/* ── Recent visits ── */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <Zap className="w-4 h-4 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-800">Visitas recientes</h3>
        </div>
        {recent_visits.length === 0 ? (
          <div className="flex items-center justify-center h-24 text-gray-400 text-sm">
            Sin visitas registradas
          </div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {recent_visits.map(v => (
              <li key={v.id} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center">
                    <Clock className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      {new Date(v.visit_date).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                    {v.notes && <p className="text-xs text-gray-400">{v.notes}</p>}
                  </div>
                </div>
                <span className={`badge ${VISIT_COLOR[v.visit_type] ?? 'badge-gray'}`}>
                  {VISIT_LABEL[v.visit_type] ?? v.visit_type}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Additional info ── */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-gray-800 mb-4">Información adicional</h3>
        <div className="grid sm:grid-cols-2 gap-3 text-sm">
          {member.created_at && (
            <div className="flex items-center gap-2.5 text-gray-600">
              <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                <CalendarDays className="w-3.5 h-3.5 text-indigo-500" />
              </div>
              <div>
                <p className="text-[10px] text-gray-400 leading-none mb-0.5">Miembro desde</p>
                <p className="font-medium">{fmtDate(member.created_at)}</p>
              </div>
            </div>
          )}
          {member.gender && (
            <div className="flex items-center gap-2.5 text-gray-600">
              <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                <User className="w-3.5 h-3.5 text-blue-500" />
              </div>
              <div>
                <p className="text-[10px] text-gray-400 leading-none mb-0.5">Género</p>
                <p className="font-medium">{{ male: 'Masculino', female: 'Femenino', other: 'Otro' }[member.gender]}</p>
              </div>
            </div>
          )}
          {member.birth_date && (
            <div className="flex items-center gap-2.5 text-gray-600">
              <div className="w-7 h-7 rounded-lg bg-pink-50 flex items-center justify-center flex-shrink-0">
                <Calendar className="w-3.5 h-3.5 text-pink-500" />
              </div>
              <div>
                <p className="text-[10px] text-gray-400 leading-none mb-0.5">Fecha de nacimiento</p>
                <p className="font-medium">{fmtDate(member.birth_date)}</p>
              </div>
            </div>
          )}
          {member.address && (
            <div className="flex items-center gap-2.5 text-gray-600 sm:col-span-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                <MapPin className="w-3.5 h-3.5 text-emerald-500" />
              </div>
              <div>
                <p className="text-[10px] text-gray-400 leading-none mb-0.5">Dirección</p>
                <p className="font-medium">{member.address}</p>
              </div>
            </div>
          )}
          {member.emergency_contact_name && (
            <div className="flex items-center gap-2.5 text-gray-600 sm:col-span-2">
              <div className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
                <Shield className="w-3.5 h-3.5 text-red-500" />
              </div>
              <div>
                <p className="text-[10px] text-gray-400 leading-none mb-0.5">Contacto de emergencia</p>
                <p className="font-medium">
                  {member.emergency_contact_name}
                  {member.emergency_contact_phone && <span className="text-gray-400 font-normal"> · {member.emergency_contact_phone}</span>}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
