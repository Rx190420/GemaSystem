import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, FileText, Building2, Users, LogOut,
  Check, X, RefreshCw, ChevronDown, ChevronUp,
  Shield, ShieldOff, ShieldAlert, KeyRound, Lock,
  Eye, EyeOff, Loader2, AlertTriangle, Database,
  Clock, CheckCircle2, Zap, MessageSquare, Star,
  Archive, MailOpen, Tag, Inbox, Send, ArrowLeft,
  CreditCard, TrendingUp, Activity, UserCheck, Calendar,
  BadgeCheck, Ban, RotateCcw, Info,
  Globe, Code2, Sparkles, Phone, Wallet, Mail, User,
} from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import axiosInstance from '../api/axios'
import toast from 'react-hot-toast'
import useLockBodyScroll from '../hooks/useLockBodyScroll'

// Operator API wrapper — uses the same authenticated axios instance
async function api(method, path, body) {
  try {
    const m = method.toLowerCase()
    const res = m === 'delete'
      ? await axiosInstance.delete(`/operator${path}`, body ? { data: body } : undefined)
      : await axiosInstance[m](`/operator${path}`, body)
    return res.data
  } catch (err) {
    const msg = err.response?.data?.message || err.message || 'Error del servidor'
    throw new Error(msg)
  }
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const card   = 'bg-white rounded-2xl border border-gray-200 shadow-sm'
const badge  = (color) => `text-[11px] font-bold px-2 py-0.5 rounded-full border ${color}`

const statusBadge = (s) => {
  if (s === 'active'     || s === 'approved') return badge('bg-emerald-50 border-emerald-200 text-emerald-700')
  if (s === 'pending')                        return badge('bg-amber-50 border-amber-200 text-amber-700')
  if (s === 'suspended'  || s === 'rejected') return badge('bg-red-50 border-red-200 text-red-700')
  if (s === 'restricted' || s === 'cancelled')return badge('bg-orange-50 border-orange-200 text-orange-700')
  if (s === 'trialing')                       return badge('bg-blue-50 border-blue-200 text-blue-700')
  return badge('bg-gray-100 border-gray-200 text-gray-600')
}
const statusLabel = (s) => ({ active:'Activo', suspended:'Suspendido', restricted:'Restringido', pending:'Pendiente', approved:'Aprobado', rejected:'Rechazado', cancelled:'Cancelado', trialing:'Trial' }[s] ?? s)

// ─── TrialTab ─────────────────────────────────────────────────────────────────

function TrialTab() {
  const [filter, setFilter]       = useState('pending')
  const [items, setItems]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [expanded, setExpanded]   = useState(null)
  const [approveData, setApprove] = useState({})
  const [resendData, setResend]   = useState({})
  const [showPwd, setShowPwd]     = useState({})
  const [busy, setBusy]           = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try { setItems(await api('GET', `/trial-requests?status=${filter}`)) }
    catch { toast.error('Error cargando solicitudes') }
    setLoading(false)
  }, [filter])

  useEffect(() => { load() }, [load])

  const approve = async (id) => {
    const d = approveData[id] || {}
    if (!d.username || !d.password) { toast.error('Completa usuario y contraseña'); return }
    if (d.password.length < 8) { toast.error('La contraseña debe tener al menos 8 caracteres'); return }
    setBusy(`approve-${id}`)
    try {
      const res = await api('POST', `/trial-requests/${id}/approve`, {
        username:   d.username,
        password:   d.password,
        notes:      d.notes,
        send_email: true,
      })
      toast.success(res.message)
      load()
    } catch (e) { toast.error(e.message) }
    setBusy(null)
  }

  const reject = async (id) => {
    const d = approveData[id] || {}
    setBusy(`reject-${id}`)
    try {
      const res = await api('POST', `/trial-requests/${id}/reject`, {
        notes:      d.rejectNotes,
        send_email: true,
      })
      toast.success(res.message)
      load()
    } catch (e) { toast.error(e.message) }
    setBusy(null)
  }

  const resendApproval = async (id) => {
    const d = resendData[id] || {}
    if (!d.username || !d.password) { toast.error('Completa usuario y contraseña para reenviar'); return }
    setBusy(`resend-${id}`)
    try {
      const res = await api('POST', `/trial-requests/${id}/resend-approval`, { username: d.username, password: d.password })
      toast.success(res.message)
    } catch (e) { toast.error(e.message) }
    setBusy(null)
  }

  const resendRejection = async (id) => {
    setBusy(`resend-rej-${id}`)
    try {
      const res = await api('POST', `/trial-requests/${id}/resend-rejection`)
      toast.success(res.message)
    } catch (e) { toast.error(e.message) }
    setBusy(null)
  }

  const setField     = (id, k, v) => setApprove(p => ({ ...p, [id]: { ...(p[id] || {}), [k]: v } }))
  const setResendFld = (id, k, v) => setResend(p  => ({ ...p, [id]: { ...(p[id] || {}), [k]: v } }))
  const togglePwd    = (key)       => setShowPwd(p => ({ ...p, [key]: !p[key] }))

  const dtFull = (iso) => iso
    ? new Date(iso).toLocaleString('es-MX', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })
    : '—'

  const filterLabels = { pending:'Pendientes', approved:'Aprobadas', rejected:'Rechazadas', all:'Todas' }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        {['pending','approved','rejected','all'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-all ${
              filter === s ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
            }`}>
            {filterLabels[s]}
          </button>
        ))}
        <button onClick={load} className="ml-auto p-2 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 text-gray-300 animate-spin" /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">Sin solicitudes</div>
      ) : items.map(item => (
        <div key={item.id} className={`${card} overflow-hidden`}>

          {/* ── Header row ── */}
          <div className="flex items-center gap-4 px-5 py-4 cursor-pointer" onClick={() => setExpanded(expanded === item.id ? null : item.id)}>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center flex-shrink-0">
              <Building2 className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                <p className="font-bold text-gray-900 text-sm">{item.gym_name}</p>
                <span className={statusBadge(item.status)}>{statusLabel(item.status)}</span>
              </div>
              <p className="text-xs text-gray-500 truncate">
                {item.contact_name}
                {' · '}<span className="text-indigo-600">{item.email}</span>
                {item.phone ? ` · ${item.phone}` : ''}
              </p>
            </div>
            <p className="text-xs text-gray-400 flex-shrink-0">{new Date(item.created_at).toLocaleDateString('es-MX')}</p>
            {expanded === item.id ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
          </div>

          {expanded === item.id && (
            <div className="border-t border-gray-100 bg-gray-50">

              {/* ── Form info ── */}
              <div className="px-5 pt-4 pb-3">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <FileText className="w-3 h-3" /> Información de la solicitud
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
                  {[
                    { label: 'Nombre del gym',   value: item.gym_name },
                    { label: 'Contacto',          value: item.contact_name },
                    { label: 'Correo',            value: item.email },
                    { label: 'Teléfono',          value: item.phone || '—' },
                    { label: 'Solicitud enviada', value: dtFull(item.created_at) },
                    { label: 'Revisada el',       value: item.reviewed_at ? dtFull(item.reviewed_at) : '—' },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
                      <p className="text-xs font-semibold text-gray-800 break-all">{value}</p>
                    </div>
                  ))}
                </div>
                {item.operator_notes && (
                  <div className="mt-3 flex items-start gap-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-100">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-800"><strong>Notas del operador:</strong> {item.operator_notes}</p>
                  </div>
                )}
              </div>

              {/* ── Pending: approve / reject form ── */}
              {item.status === 'pending' && (
                <div className="px-5 pb-4 space-y-3 border-t border-gray-100 pt-3">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                    <KeyRound className="w-3 h-3" /> Crear cuenta de acceso
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Usuario <span className="text-red-400">*</span></label>
                      <input
                        value={approveData[item.id]?.username || ''}
                        onChange={e => setField(item.id, 'username', e.target.value)}
                        placeholder="solo letras, números y _"
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Contraseña inicial <span className="text-red-400">*</span></label>
                      <div className="relative">
                        <input
                          type={showPwd[`new-${item.id}`] ? 'text' : 'password'}
                          value={approveData[item.id]?.password || ''}
                          onChange={e => setField(item.id, 'password', e.target.value)}
                          placeholder="mínimo 8 caracteres"
                          className="w-full pl-3 pr-9 py-2 text-sm border border-gray-200 rounded-xl bg-white outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                        />
                        <button type="button" onClick={() => togglePwd(`new-${item.id}`)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                          {showPwd[`new-${item.id}`] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Notas internas (no se envían al cliente)</label>
                    <input
                      value={approveData[item.id]?.notes || ''}
                      onChange={e => setField(item.id, 'notes', e.target.value)}
                      placeholder="Observaciones internas..."
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white outline-none focus:border-gray-300"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Motivo de rechazo (si aplica)</label>
                    <input
                      value={approveData[item.id]?.rejectNotes || ''}
                      onChange={e => setField(item.id, 'rejectNotes', e.target.value)}
                      placeholder="Se enviará al solicitante por correo..."
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white outline-none focus:border-red-300"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      onClick={() => approve(item.id)}
                      disabled={!!busy}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 transition-colors">
                      {busy === `approve-${item.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      Aprobar y enviar credenciales
                    </button>
                    <button
                      onClick={() => reject(item.id)}
                      disabled={!!busy}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-red-600 border border-red-200 hover:bg-red-50 disabled:opacity-60 transition-colors bg-white">
                      {busy === `reject-${item.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                      Rechazar y notificar
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-400 flex items-center gap-1">
                    <Mail className="w-3 h-3" /> Se enviará correo automáticamente a <strong>{item.email}</strong>
                  </p>
                </div>
              )}

              {/* ── Approved: resend credentials ── */}
              {item.status === 'approved' && (
                <div className="px-5 pb-4 border-t border-gray-100 pt-3 space-y-3">
                  <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-1.5">
                    <Mail className="w-3 h-3" /> Reenviar credenciales al correo
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Usuario</label>
                      <input
                        value={resendData[item.id]?.username || ''}
                        onChange={e => setResendFld(item.id, 'username', e.target.value)}
                        placeholder="nombre_gym"
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Nueva contraseña a enviar</label>
                      <div className="relative">
                        <input
                          type={showPwd[`resend-${item.id}`] ? 'text' : 'password'}
                          value={resendData[item.id]?.password || ''}
                          onChange={e => setResendFld(item.id, 'password', e.target.value)}
                          placeholder="mínimo 8 caracteres"
                          className="w-full pl-3 pr-9 py-2 text-sm border border-gray-200 rounded-xl bg-white outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                        />
                        <button type="button" onClick={() => togglePwd(`resend-${item.id}`)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                          {showPwd[`resend-${item.id}`] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => resendApproval(item.id)}
                    disabled={!!busy}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-emerald-700 border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-60 transition-colors">
                    {busy === `resend-${item.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    Reenviar correo de credenciales
                  </button>
                </div>
              )}

              {/* ── Rejected: resend rejection ── */}
              {item.status === 'rejected' && (
                <div className="px-5 pb-4 border-t border-gray-100 pt-3">
                  <button
                    onClick={() => resendRejection(item.id)}
                    disabled={!!busy}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-red-600 border border-red-200 bg-red-50 hover:bg-red-100 disabled:opacity-60 transition-colors">
                    {busy === `resend-rej-${item.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    Reenviar notificación de rechazo
                  </button>
                  <p className="text-[10px] text-gray-400 mt-2">Se enviará a <strong>{item.email}</strong> con el motivo registrado.</p>
                </div>
              )}

            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Subscription badge ───────────────────────────────────────────────────────

function SubBadge({ sub }) {
  if (!sub || sub.billing_status === 'none') return null
  const s = sub.sub_status
  if (s === 'expired' || s === 'cancelled')
    return <span className={badge('bg-red-50 border-red-200 text-red-700')}>
      {s === 'cancelled' ? 'Cancelado' : 'Expirado'}
    </span>
  if (s === 'payment_failed')
    return <span className={badge('bg-red-50 border-red-200 text-red-700')}>Pago fallido</span>
  if (s === 'expiring_soon')
    return <span className={badge('bg-orange-50 border-orange-200 text-orange-700')}>Expira en {sub.days_remaining}d</span>
  if (s === 'expiring')
    return <span className={badge('bg-amber-50 border-amber-200 text-amber-700')}>Expira en {sub.days_remaining}d</span>
  if (sub.days_remaining !== null)
    return <span className={badge('bg-emerald-50 border-emerald-200 text-emerald-700')}>{sub.days_remaining}d restantes</span>
  return null
}

function fmt(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  // Guard against epoch (1969/1970) timestamps stored as 0
  if (d.getFullYear() < 2000) return '—'
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function BillingCard({ sub }) {
  if (!sub) return null
  if (sub.plan === 'free' && !sub.ends_at) return null

  const isFree    = sub.plan === 'free'
  const isExpired = sub.sub_status === 'expired' || sub.sub_status === 'cancelled'

  const statusColor = {
    active:        'text-emerald-700 bg-emerald-50 border-emerald-200',
    payment_failed:'text-red-700 bg-red-50 border-red-200',
    cancelled:     'text-gray-600 bg-gray-100 border-gray-200',
    trial_expired: 'text-red-700 bg-red-50 border-red-200',
    payment_due:   'text-red-700 bg-red-50 border-red-200',
    none:          'text-gray-400 bg-gray-50 border-gray-100',
  }[sub.billing_status] ?? 'text-gray-500 bg-gray-50 border-gray-200'

  const billingChip = {
    active:        <span className="inline-flex items-center gap-1"><Check className="w-2.5 h-2.5" />{isFree ? 'Trial activo' : 'Al corriente'}</span>,
    payment_failed:<span className="inline-flex items-center gap-1"><X className="w-2.5 h-2.5" /> Pago fallido</span>,
    payment_due:   <span className="inline-flex items-center gap-1"><X className="w-2.5 h-2.5" /> Pago vencido</span>,
    cancelled:     '— Cancelado',
    trial_expired: <span className="inline-flex items-center gap-1"><X className="w-2.5 h-2.5" /> Trial vencido</span>,
    none:          '— Sin datos',
  }[sub.billing_status] ?? sub.billing_status

  const planLabel = isFree
    ? 'Gratuito (trial)'
    : (sub.plan === 'weekly' ? 'Semanal' : sub.plan === 'monthly' ? 'Mensual' : sub.plan ?? '—')

  return (
    <div className={`${card} p-5`}>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
          <CreditCard className="w-3.5 h-3.5" />
          {isFree ? 'Período de prueba' : 'Facturación'}
        </p>
        <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full border ${statusColor}`}>{billingChip}</span>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">Plan</p>
          <p className="font-semibold text-gray-800">{planLabel}</p>
        </div>
        <div>
          <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">Último pago</p>
          <p className="font-semibold text-gray-800">{isFree ? '—' : fmt(sub.last_payment)}</p>
        </div>
        <div>
          <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">Período inició</p>
          <p className="font-semibold text-gray-800">{fmt(sub.starts_at)}</p>
        </div>
        <div>
          <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">
            {isExpired ? 'Venció el' : 'Vence el'}
          </p>
          <p className={`font-semibold ${isExpired ? 'text-red-600' : 'text-gray-800'}`}>
            {fmt(sub.ends_at)}
          </p>
        </div>

        {sub.days_remaining !== null && (
          <div className="col-span-2">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">Días restantes</p>
            <p className={`font-bold text-lg ${sub.days_remaining < 0 ? 'text-red-600' : sub.days_remaining <= 3 ? 'text-orange-600' : 'text-emerald-600'}`}>
              {sub.days_remaining < 0
                ? `Vencido hace ${Math.abs(sub.days_remaining)} día${Math.abs(sub.days_remaining) !== 1 ? 's' : ''}`
                : `${sub.days_remaining} día${sub.days_remaining !== 1 ? 's' : ''}`}
            </p>
          </div>
        )}

        {sub.is_blocked && (
          <div className="col-span-2 flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 border border-red-200">
            <ShieldOff className="w-4 h-4 text-red-500 flex-shrink-0" />
            <p className="text-xs font-semibold text-red-700">
              {isFree ? 'Acceso bloqueado — trial vencido' : 'Acceso bloqueado por falta de pago'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── GymCard (shared) ─────────────────────────────────────────────────────────

function GymCard({ gym, onManage }) {
  const planColor = gym.plan_type === 'paid'
    ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
    : 'bg-gray-100 border-gray-200 text-gray-600'

  const sub = gym.subscription

  return (
    <div className={`${card} p-4 ${sub?.sub_status === 'expired' ? 'ring-2 ring-red-200' : sub?.sub_status === 'expiring' ? 'ring-2 ring-amber-200' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <p className="font-bold text-gray-900 text-sm truncate">{gym.name}</p>
            <span className={badge(planColor)}>{gym.plan_type === 'paid' ? 'Pago' : 'Free'}</span>
            <span className={statusBadge(gym.status)}>{statusLabel(gym.status)}</span>
            <SubBadge sub={sub} />
          </div>
          {gym.admin && (
            <p className="text-xs text-gray-500">
              Admin: <span className="font-medium text-gray-700">{gym.admin.username}</span>
              {' · '}{gym.admin.email}
              {' · '}
              <span className={statusBadge(gym.admin.account_status)}>{statusLabel(gym.admin.account_status)}</span>
            </p>
          )}
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {sub?.ends_at && new Date(sub.ends_at).getFullYear() >= 2000 && (
              <p className="text-xs text-gray-400 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {sub.sub_status === 'expired' ? 'Venció' : 'Vence'} el {new Date(sub.ends_at).toLocaleDateString('es-MX', { day:'2-digit', month:'short', year:'numeric' })}
              </p>
            )}
            {gym.plan && (
              <p className="text-xs text-gray-400">Plan: {gym.plan === 'weekly' ? 'Semanal' : gym.plan === 'monthly' ? 'Mensual' : 'Anual'}</p>
            )}
            {gym.db_name && (
              <p className="text-xs text-gray-400 flex items-center gap-1">
                <Database className="w-3 h-3" />{gym.db_name}
              </p>
            )}
          </div>
        </div>
        <button onClick={() => onManage(gym)}
          className="flex-shrink-0 px-3 py-1.5 text-xs font-bold text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors">
          Gestionar
        </button>
      </div>
    </div>
  )
}

// ─── GymsTab ──────────────────────────────────────────────────────────────────

function GymsTab({ onManage }) {
  const [type, setType]         = useState('all')
  const [gyms, setGyms]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [checking, setChecking] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try { setGyms(await api('GET', `/gyms?type=${type}`)) }
    catch { toast.error('Error cargando gyms') }
    setLoading(false)
  }, [type])

  useEffect(() => { load() }, [load])

  const runSuspensionCheck = async () => {
    setChecking(true)
    try {
      const res = await api('POST', '/gyms/run-suspension-check')
      if (res.suspended > 0) {
        toast.success(res.message)
        load()
      } else {
        toast(res.message, { icon: '✓' })
      }
    } catch (e) {
      toast.error(e.message)
    }
    setChecking(false)
  }

  const expiredCount = gyms.filter(g =>
    g.subscription?.sub_status === 'expired' && g.status !== 'suspended'
  ).length

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        {['all','free','paid'].map(t => (
          <button key={t} onClick={() => setType(t)}
            className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-all ${
              type === t ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
            }`}>
            {t === 'all' ? 'Todos' : t === 'free' ? 'Gratuitos' : 'De pago'}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          {expiredCount > 0 && (
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-red-50 border border-red-200 text-red-700">
              {expiredCount} vencido{expiredCount > 1 ? 's' : ''}
            </span>
          )}
          <button onClick={runSuspensionCheck} disabled={checking}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-red-700 border border-red-200 bg-red-50 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-60">
            {checking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
            Verificar vencidos
          </button>
          <button onClick={load} className="p-2 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 text-gray-300 animate-spin" /></div>
      ) : gyms.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">Sin gyms registrados</div>
      ) : gyms.map(gym => (
        <GymCard key={gym.id} gym={gym} onManage={onManage} />
      ))}
    </div>
  )
}

// ─── ManageTab ────────────────────────────────────────────────────────────────

function ManageTab({ selectedGym, onBack }) {
  const [detail, setDetail]       = useState(null)
  const [loading, setLoading]     = useState(true)
  const [busy, setBusy]           = useState(null)
  const [showPwd, setShowPwd]     = useState({})
  const [forms, setForms]         = useState({})
  const [pendingAction, setPending] = useState(null) // { key, label, fn, needsReason }
  const [reason, setReason]       = useState('')

  // Danger zone — delete gym
  const [deleteOpen, setDeleteOpen]     = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleteSecret, setDeleteSecret]   = useState('')
  const [deleteBusy, setDeleteBusy]       = useState(false)

  useLockBodyScroll(!!pendingAction || deleteOpen)

  const load = useCallback(async () => {
    if (!selectedGym) return
    setLoading(true)
    try { setDetail(await api('GET', `/gyms/${selectedGym.id}`)) }
    catch { toast.error('Error cargando detalle') }
    setLoading(false)
  }, [selectedGym])

  useEffect(() => { load() }, [load])

  const setForm = (userId, k, v) => setForms(p => ({ ...p, [userId]: { ...(p[userId] || {}), [k]: v } }))

  const action = async (label, fn) => {
    setBusy(label)
    try { const r = await fn(); toast.success(r.message); load() }
    catch (e) { toast.error(e.message) }
    setBusy(null)
  }

  const requestAction = (key, label, fn, needsReason = false) => {
    if (needsReason) {
      setPending({ key, label, fn })
      setReason('')
    } else {
      action(key, fn)
    }
  }

  const confirmAction = async () => {
    if (!pendingAction) return
    const { key, fn } = pendingAction
    setBusy(key)
    try { const r = await fn(reason); toast.success(r.message); load() }
    catch (e) { toast.error(e.message) }
    setBusy(null)
    setPending(null)
    setReason('')
  }

  const doDeleteGym = async () => {
    if (!detail) return
    setDeleteBusy(true)
    try {
      const r = await api('DELETE', `/gyms/${detail.gym.id}`, { secret: deleteSecret })
      toast.success(r.message)
      setDeleteOpen(false)
      onBack()
    } catch (e) {
      toast.error(e.message)
    }
    setDeleteBusy(false)
  }

  if (!selectedGym) return (
    <div className="text-center py-16 text-gray-400 text-sm">Selecciona un gym desde la pestaña Gyms.</div>
  )

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 text-gray-300 animate-spin" /></div>
  if (!detail) return null

  const { gym, users, stats, subscription: sub } = detail

  const dt  = (iso) => iso ? new Date(iso).toLocaleString('es-MX', { day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit' }) : '—'
  const num = (n)   => n?.toLocaleString('es-MX') ?? '—'

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-start gap-3">
        <button onClick={onBack} className="mt-0.5 p-2 rounded-xl hover:bg-gray-100 text-gray-500 transition-colors flex-shrink-0">
          <ChevronDown className="w-4 h-4 rotate-90" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-extrabold text-gray-900 text-lg truncate">{gym.name}</h2>
            <span className={statusBadge(gym.status)}>{statusLabel(gym.status)}</span>
            <span className={badge(gym.plan_type === 'paid' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-gray-100 border-gray-200 text-gray-600')}>
              {gym.plan_type === 'paid' ? 'Pago' : 'Free'}
            </span>
            {sub?.billing_status && sub.billing_status !== 'none' && (() => {
              const isFree = gym.plan_type === 'free'
              const colorMap = {
                active:        'bg-emerald-50 border-emerald-200 text-emerald-700',
                payment_failed:'bg-red-50 border-red-200 text-red-700',
                payment_due:   'bg-red-50 border-red-200 text-red-700',
                trial_expired: 'bg-red-50 border-red-200 text-red-700',
                cancelled:     'bg-orange-50 border-orange-200 text-orange-700',
              }
              const labelMap = {
                active:        isFree ? 'Trial activo' : 'Pago activo',
                payment_failed:'Pago fallido',
                payment_due:   'Pago vencido',
                trial_expired: 'Trial vencido',
                cancelled:     'Cancelado',
              }
              const color = colorMap[sub.billing_status] ?? 'bg-gray-100 border-gray-200 text-gray-600'
              const label = labelMap[sub.billing_status] ?? sub.billing_status
              return <span className={badge(color)}>{label}</span>
            })()}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            ID #{gym.id} · Creado {dt(gym.created_at)} ·
            {gym.plan_type === 'paid' ? ` DB: ${gym.db_name}` : ' Base compartida (free)'}
          </p>
        </div>
        <button onClick={load} className="p-2 text-gray-400 hover:text-gray-700 rounded-xl hover:bg-gray-100 transition-colors flex-shrink-0">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* ── Stats grid ── */}
      {stats && Object.keys(stats).length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Socios totales',    value: num(stats.members),          sub: `${num(stats.activeMembers)} activos`,    Icon: Users,       color: 'text-indigo-600 bg-indigo-50' },
            { label: 'Visitas totales',   value: num(stats.visits),            sub: `${num(stats.visitsThisMonth)} este mes`, Icon: Activity,    color: 'text-violet-600 bg-violet-50' },
            { label: 'Membresías',        value: num(stats.memberships),       sub: `${num(stats.activeMemberships)} activas`,Icon: BadgeCheck,  color: 'text-emerald-600 bg-emerald-50' },
            { label: 'Ingresos totales',  value: `$${num(stats.revenue)}`,     sub: `${num(stats.payments)} pagos`,           Icon: TrendingUp,  color: 'text-amber-600 bg-amber-50' },
          ].map(({ label, value, sub: s, Icon, color }) => (
            <div key={label} className={`${card} p-4`}>
              <div className="flex items-start justify-between mb-2">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide leading-tight">{label}</p>
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
              </div>
              <p className="text-xl font-extrabold text-gray-900 leading-none">{value}</p>
              <p className="text-[10px] text-gray-400 mt-1">{s}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Gym info detallada ── */}
      <div className={`${card} p-5`}>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5" /> Información del gym
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
          {[
            { label: 'Nombre',           value: gym.name },
            { label: 'ID del gym',       value: `#${gym.id}` },
            { label: 'Tipo de plan',     value: gym.plan_type === 'paid' ? 'De pago (DB dedicada)' : 'Gratuito (DB compartida)' },
            { label: 'Plan de cobro',    value: gym.plan_type === 'free' ? 'Trial gratuito (10 días)' : gym.plan === 'weekly' ? 'Semanal ($417/sem)' : gym.plan === 'monthly' ? 'Mensual ($1,622/mes)' : gym.plan ?? '—' },
            { label: 'Estado del gym',   value: statusLabel(gym.status) },
            { label: 'Base de datos',    value: gym.db_name ?? 'Compartida (gemasystem)' },
            { label: 'Stripe Customer',  value: gym.stripe_customer_id ?? '—' },
            { label: 'Stripe Sub. ID',   value: gym.stripe_subscription_id ?? '—' },
            { label: 'Fecha de alta',    value: dt(gym.created_at) },
            { label: 'Última actualiz.', value: dt(gym.updated_at) },
          ].map(({ label, value }) => (
            <div key={label} className="flex flex-col">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{label}</span>
              <span className="text-gray-800 font-medium text-xs mt-0.5 break-all">{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Facturación Stripe ── */}
      <BillingCard sub={sub} />

      {/* ── Control de suspensión de pago ── */}
      {gym.plan_type === 'paid' && (
        <div className={`${card} p-5`}>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <CreditCard className="w-3.5 h-3.5" /> Control de facturación manual
          </p>
          <p className="text-xs text-gray-400 mb-4">
            Activa la pantalla de "pago requerido" en el login del gym sin tocar Stripe.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button disabled={!!busy} onClick={() => action('bill-suspend-now', () =>
                api('PUT', `/gyms/${gym.id}/billing-status`, { action: 'suspend_now' }))}
              className="flex flex-col items-start gap-1 px-4 py-3 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 disabled:opacity-60 transition-all text-left group">
              <div className="flex items-center gap-1.5">
                {busy === 'bill-suspend-now' ? <Loader2 className="w-3.5 h-3.5 animate-spin text-red-500" /> : <Ban className="w-3.5 h-3.5 text-red-600" />}
                <span className="text-xs font-extrabold text-red-700">Bloquear ahora</span>
              </div>
              <span className="text-[10px] text-red-500 leading-snug">Marca como impago y expira la suscripción. Bloquea el acceso de inmediato y revoca sesiones.</span>
            </button>

            <button disabled={!!busy} onClick={() => action('bill-suspend-later', () =>
                api('PUT', `/gyms/${gym.id}/billing-status`, { action: 'suspend_on_expire' }))}
              className="flex flex-col items-start gap-1 px-4 py-3 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 disabled:opacity-60 transition-all text-left group">
              <div className="flex items-center gap-1.5">
                {busy === 'bill-suspend-later' ? <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" /> : <Clock className="w-3.5 h-3.5 text-amber-600" />}
                <span className="text-xs font-extrabold text-amber-700">Bloquear al vencer</span>
              </div>
              <span className="text-[10px] text-amber-600 leading-snug">Marca como pago fallido. El acceso continúa hasta que venza el período actual.</span>
            </button>

            <button disabled={!!busy} onClick={() => action('bill-restore', () =>
                api('PUT', `/gyms/${gym.id}/billing-status`, { action: 'restore' }))}
              className="flex flex-col items-start gap-1 px-4 py-3 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-60 transition-all text-left group">
              <div className="flex items-center gap-1.5">
                {busy === 'bill-restore' ? <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-500" /> : <RotateCcw className="w-3.5 h-3.5 text-emerald-600" />}
                <span className="text-xs font-extrabold text-emerald-700">Restaurar acceso</span>
              </div>
              <span className="text-[10px] text-emerald-600 leading-snug">Reactiva la facturación manualmente. El gym puede volver a iniciar sesión.</span>
            </button>
          </div>
        </div>
      )}

      {/* ── Acciones de sesión del gym ── */}
      <div className={`${card} p-5`}>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5" /> Control de acceso al gym completo
        </p>
        <div className="flex flex-wrap gap-2">
          {[
            { label: 'Suspender todo',  Icon: ShieldOff,   color: 'text-red-600 border-red-200 hover:bg-red-50 bg-white',       needs: true,  fn: (r) => api('PUT', `/gyms/${gym.id}/suspend`,  { reason: r }) },
            { label: 'Restringir todo', Icon: ShieldAlert,  color: 'text-orange-600 border-orange-200 hover:bg-orange-50 bg-white', needs: true,  fn: (r) => api('PUT', `/gyms/${gym.id}/restrict`,  { reason: r }) },
            { label: 'Activar todo',    Icon: Shield,       color: 'text-emerald-600 border-emerald-200 hover:bg-emerald-50 bg-white', needs: false, fn: () => api('PUT', `/gyms/${gym.id}/activate`) },
          ].map(({ label, Icon, color, needs, fn }) => (
            <button key={label} disabled={busy === label} onClick={() => requestAction(label, label, fn, needs)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border transition-colors disabled:opacity-60 ${color}`}>
              {busy === label ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Icon className="w-3.5 h-3.5" />}
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Usuarios ── */}
      <div className="space-y-3">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5" /> Usuarios del gym
        </p>
        {users.map(user => (
          <div key={user.id} className={`${card} p-5 space-y-4`}>

            {/* User info */}
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-700 font-extrabold text-sm flex-shrink-0">
                {user.username[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <p className="font-bold text-gray-900 text-sm">{user.username}</p>
                  <span className={badge('bg-gray-100 border-gray-200 text-gray-500 capitalize')}>{user.role}</span>
                  <span className={statusBadge(user.account_status)}>{statusLabel(user.account_status)}</span>
                </div>
                <p className="text-xs text-gray-500">{user.email}</p>
                <div className="flex flex-wrap gap-3 mt-1">
                  <p className="text-[10px] text-gray-400">
                    <span className="font-semibold">Creado:</span> {dt(user.created_at)}
                  </p>
                  <p className="text-[10px] text-gray-400">
                    <span className="font-semibold">Último acceso:</span> {user.last_login ? dt(user.last_login) : 'Nunca'}
                  </p>
                  {user.access_code_plain && (
                    <p className="text-[10px] text-gray-400">
                      <span className="font-semibold">Código acceso:</span>{' '}
                      <span className="font-mono text-indigo-600">{user.access_code_plain}</span>
                    </p>
                  )}
                </div>
                {user.restriction_reason && (
                  <div className="mt-1.5 flex items-start gap-1 px-2 py-1 rounded-lg bg-orange-50 border border-orange-100">
                    <AlertTriangle className="w-3 h-3 text-orange-500 flex-shrink-0 mt-0.5" />
                    <p className="text-[10px] text-orange-700">{user.restriction_reason}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Session controls */}
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Control de sesión</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: `suspend-${user.id}`,  text: 'Suspender',  Icon: ShieldOff,   color: 'text-red-600 border-red-200 hover:bg-red-50',       needs: true,  fn: (r) => api('PUT', `/users/${user.id}/suspend`,  { reason: r }) },
                  { label: `restrict-${user.id}`, text: 'Restringir', Icon: ShieldAlert,  color: 'text-orange-600 border-orange-200 hover:bg-orange-50', needs: true,  fn: (r) => api('PUT', `/users/${user.id}/restrict`, { reason: r }) },
                  { label: `activate-${user.id}`, text: 'Activar',    Icon: UserCheck,    color: 'text-emerald-600 border-emerald-200 hover:bg-emerald-50', needs: false, fn: () => api('PUT', `/users/${user.id}/activate`) },
                ].map(({ label, text, Icon, color, needs, fn }) => (
                  <button key={label} disabled={busy === label} onClick={() => requestAction(label, text, fn, needs)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border bg-white transition-colors disabled:opacity-60 ${color}`}>
                    {busy === label ? <Loader2 className="w-3 h-3 animate-spin" /> : <Icon className="w-3 h-3" />}
                    {text}
                  </button>
                ))}
              </div>
            </div>

            {/* Password change */}
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Cambiar contraseña</p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input type={showPwd[`pwd-${user.id}`] ? 'text' : 'password'}
                    value={forms[user.id]?.password || ''}
                    onChange={e => setForm(user.id, 'password', e.target.value)}
                    placeholder="Nueva contraseña (mín. 8 caracteres)"
                    className="w-full pl-3 pr-9 py-2 text-sm border border-gray-200 rounded-xl bg-gray-50 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 focus:bg-white" />
                  <button type="button" onClick={() => setShowPwd(p => ({ ...p, [`pwd-${user.id}`]: !p[`pwd-${user.id}`] }))}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                    {showPwd[`pwd-${user.id}`] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <button disabled={busy === `pwd-${user.id}`}
                  onClick={() => action(`pwd-${user.id}`, () => api('PUT', `/users/${user.id}/password`, { password: forms[user.id]?.password }))}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 transition-colors">
                  {busy === `pwd-${user.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <KeyRound className="w-3 h-3" />}
                  Actualizar
                </button>
              </div>
            </div>

            {/* Security code */}
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Código de seguridad</p>
              <div className="flex gap-2">
                <input value={forms[user.id]?.code || ''}
                  onChange={e => setForm(user.id, 'code', e.target.value)}
                  placeholder="Nuevo código (4-20 caracteres)"
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl bg-gray-50 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 focus:bg-white" />
                <button disabled={busy === `code-${user.id}`}
                  onClick={() => action(`code-${user.id}`, () => api('PUT', `/users/${user.id}/security-code`, { code: forms[user.id]?.code }))}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-60 transition-colors">
                  {busy === `code-${user.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Lock className="w-3 h-3" />}
                  Guardar
                </button>
                <button disabled={busy === `rmcode-${user.id}`}
                  onClick={() => action(`rmcode-${user.id}`, () => api('DELETE', `/users/${user.id}/security-code`))}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-red-600 border border-red-200 hover:bg-red-50 disabled:opacity-60 transition-colors bg-white">
                  <X className="w-3 h-3" /> Quitar
                </button>
              </div>
            </div>

            {/* Emails — everything GemaSystem can actually send this user
                again from what's already on record (no fabricated data) */}
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Correos</p>
              <div className="flex flex-wrap gap-2">
                <button disabled={busy === `welcome-${user.id}`}
                  onClick={() => action(`welcome-${user.id}`, () => api('POST', `/users/${user.id}/resend-welcome`))}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border bg-white transition-colors disabled:opacity-60 text-indigo-600 border-indigo-200 hover:bg-indigo-50">
                  {busy === `welcome-${user.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3" />}
                  Reenviar bienvenida
                </button>
                {gym.stripe_subscription_id && (
                  <button disabled={busy === `invoice-${user.id}`}
                    onClick={() => action(`invoice-${user.id}`, () => api('POST', `/users/${user.id}/resend-invoice`))}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border bg-white transition-colors disabled:opacity-60 text-teal-600 border-teal-200 hover:bg-teal-50">
                    {busy === `invoice-${user.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                    Reenviar recibo de pago
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Danger zone: delete gym ── */}
      <div className="bg-red-50/60 rounded-2xl border-2 border-red-200 shadow-sm p-5">
        <p className="text-xs font-bold text-red-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5" /> Zona de peligro
        </p>
        <p className="text-xs text-red-400 mb-4">
          Borra permanentemente este gym: su base de datos/schema dedicado (o todos sus registros en la base compartida),
          sus usuarios, y cancela su suscripción de Stripe si tiene una activa. No se puede deshacer.
        </p>
        <button onClick={() => { setDeleteOpen(true); setDeleteConfirm(''); setDeleteSecret('') }}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 transition-colors">
          <Ban className="w-3.5 h-3.5" /> Borrar gym permanentemente
        </button>
      </div>

      {/* ── Delete gym confirmation dialog ── */}
      {deleteOpen && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center px-4"
          style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)' }}
          onClick={() => !deleteBusy && setDeleteOpen(false)}
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-red-200 w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center flex-shrink-0">
                <Ban className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="font-bold text-gray-900 text-sm">Borrar "{gym.name}" permanentemente</p>
                <p className="text-xs text-red-500">Esta acción no se puede deshacer.</p>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Escribe <span className="font-mono text-gray-700">{gym.name}</span> para confirmar
              </label>
              <input value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)}
                placeholder={gym.name}
                className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 focus:bg-white" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Clave secreta</label>
              <input type="password" value={deleteSecret} onChange={e => setDeleteSecret(e.target.value)}
                placeholder="SUPERADMIN_DELETE_SECRET"
                className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 focus:bg-white" />
            </div>
            <div className="flex gap-2">
              <button onClick={doDeleteGym} disabled={deleteBusy || deleteConfirm !== gym.name || !deleteSecret}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 transition-colors">
                {deleteBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
                Borrar permanentemente
              </button>
              <button onClick={() => setDeleteOpen(false)} disabled={deleteBusy}
                className="px-5 py-2.5 rounded-xl text-sm font-bold text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reason confirmation dialog ── */}
      {pendingAction && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center px-4"
          style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)' }}
          onClick={() => { setPending(null); setReason('') }}
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-orange-50 border border-orange-200 flex items-center justify-center flex-shrink-0">
                <ShieldAlert className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <p className="font-bold text-gray-900 text-sm">{pendingAction.label}</p>
                <p className="text-xs text-gray-400">El motivo se mostrará al usuario al intentar iniciar sesión</p>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Motivo <span className="normal-case font-normal text-gray-400">(visible para el usuario)</span>
              </label>
              <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3}
                placeholder="Ej: Pago vencido. Contacta a soporte para reactivar tu cuenta."
                className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 focus:bg-white resize-none" />
            </div>
            <div className="flex gap-2">
              <button onClick={confirmAction} disabled={!!busy}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-60 transition-colors">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Confirmar
              </button>
              <button onClick={() => { setPending(null); setReason('') }}
                className="px-5 py-2.5 rounded-xl text-sm font-bold text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── MessagesTab ─────────────────────────────────────────────────────────────

// ─── TicketsTab — operator ticket management with chat ────────────────────────

const TICKET_STATUS_COLORS = {
  open:     'bg-blue-50 border-blue-200 text-blue-700',
  accepted: 'bg-indigo-50 border-indigo-200 text-indigo-700',
  resolved: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  closed:   'bg-gray-100 border-gray-200 text-gray-500',
}
const TICKET_STATUS_LABELS = { open:'Abierto', accepted:'En atención', resolved:'Resuelto', closed:'Cerrado' }
const TICKET_CATS = { bug:'Error', feature:'Sugerencia', billing:'Facturación', account:'Mi cuenta', other:'Otro' }

function TicketThread({ ticketId, onBack }) {
  const [ticket, setTicket] = useState(null)
  const [loading, setLoading] = useState(true)
  const [reply, setReply]   = useState('')
  const [sending, setSending] = useState(false)
  const [busy, setBusy]     = useState(null)
  const bottomRef           = useRef(null)

  const load = useCallback(async () => {
    try {
      const data = await api('GET', `/tickets/${ticketId}`)
      setTicket(data)
    } catch { toast.error('Error cargando ticket') }
    setLoading(false)
  }, [ticketId])

  useEffect(() => { load() }, [load])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [ticket?.messages])

  const sendReply = async () => {
    if (!reply.trim()) return
    setSending(true)
    try {
      await api('POST', `/tickets/${ticketId}/messages`, { message: reply.trim() })
      setReply('')
      load()
    } catch { toast.error('Error al enviar') }
    setSending(false)
  }

  const doAction = async (action, label) => {
    setBusy(action)
    try {
      const r = await api('PUT', `/tickets/${ticketId}/${action}`)
      toast.success(r.message)
      load()
    } catch (e) { toast.error(e.message) }
    setBusy(null)
  }

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 text-gray-300 animate-spin" /></div>
  if (!ticket) return null

  const isOpen = !['resolved', 'closed'].includes(ticket.status)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-extrabold text-gray-900 text-base truncate">{ticket.subject}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-xs font-mono text-gray-400">{ticket.ticket_number}</span>
            <span className="text-gray-300">·</span>
            <span className="text-xs text-gray-400">{ticket.name} · {ticket.email}</span>
            {ticket.gym && <><span className="text-gray-300">·</span><span className="text-xs text-gray-400">{ticket.gym.name}</span></>}
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${TICKET_STATUS_COLORS[ticket.status] ?? ''}`}>
              {TICKET_STATUS_LABELS[ticket.status]}
            </span>
          </div>
        </div>
        <button onClick={load} className="p-2 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Actions */}
      {ticket.status === 'open' && (
        <div className={`${card} p-4 flex items-center gap-3`}>
          <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
          <p className="text-sm text-gray-600 flex-1">Este ticket está pendiente de aceptación.</p>
          <button disabled={!!busy} onClick={() => doAction('accept', 'accept')}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 transition-colors">
            {busy === 'accept' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            Aceptar y notificar
          </button>
        </div>
      )}

      {isOpen && ticket.status !== 'open' && (
        <div className="flex gap-2 justify-end">
          <button disabled={!!busy} onClick={() => doAction('resolve', 'resolve')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-600 border border-emerald-200 hover:bg-emerald-50 disabled:opacity-60 transition-colors">
            {busy === 'resolve' ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
            Marcar resuelto
          </button>
          <button disabled={!!busy} onClick={() => doAction('close', 'close')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-gray-500 border border-gray-200 hover:bg-gray-50 disabled:opacity-60 transition-colors">
            {busy === 'close' ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
            Cerrar
          </button>
        </div>
      )}

      {/* Messages */}
      <div className={`${card} overflow-hidden`}>
        <div className="divide-y divide-gray-50">
          {ticket.messages?.map(msg => {
            const isOp = msg.sender_type === 'operator'
            return (
              <div key={msg.id} className={`px-5 py-4 ${isOp ? 'bg-indigo-50/40' : ''}`}>
                <div className="flex items-center gap-2 mb-1.5">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-extrabold text-white flex-shrink-0 ${isOp ? 'bg-indigo-600' : 'bg-gray-400'}`}>
                    {isOp ? 'S' : msg.sender_name?.[0]?.toUpperCase()}
                  </div>
                  <span className="text-xs font-bold text-gray-700">{msg.sender_name}</span>
                  {isOp && <span className="text-[10px] font-bold text-indigo-500 bg-indigo-100 px-1.5 py-0.5 rounded-full">Operador</span>}
                  <span className="text-xs text-gray-400 ml-auto">
                    {new Date(msg.created_at).toLocaleString('es-MX', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}
                  </span>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap ml-8">{msg.message}</p>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>

        {isOpen && (
          <div className="px-5 py-4 bg-gray-50 border-t border-gray-100">
            <div className="flex gap-3">
              <textarea value={reply} onChange={e => setReply(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) sendReply() }}
                rows={3} placeholder="Responder al usuario… (Ctrl+Enter para enviar)"
                className="flex-1 px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl bg-white outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 resize-none" />
              <button onClick={sendReply} disabled={sending || !reply.trim()}
                className="self-end flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-40 transition-colors flex-shrink-0">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function TicketsTab() {
  const [statusFilter, setStatusFilter] = useState('open')
  const [tickets, setTickets]           = useState([])
  const [loading, setLoading]           = useState(true)
  const [selectedId, setSelectedId]     = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try { setTickets(await api('GET', `/tickets?status=${statusFilter}`)) }
    catch { toast.error('Error cargando tickets') }
    setLoading(false)
  }, [statusFilter])

  useEffect(() => { load() }, [load])

  const filterBtn = (active, onClick, label) => (
    <button onClick={onClick} className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-all ${active ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}>
      {label}
    </button>
  )

  if (selectedId) {
    return <TicketThread ticketId={selectedId} onBack={() => { setSelectedId(null); load() }} />
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {filterBtn(statusFilter === 'open',     () => setStatusFilter('open'),     'Abiertos')}
        {filterBtn(statusFilter === 'accepted', () => setStatusFilter('accepted'), 'En atención')}
        {filterBtn(statusFilter === 'resolved', () => setStatusFilter('resolved'), 'Resueltos')}
        {filterBtn(statusFilter === 'closed',   () => setStatusFilter('closed'),   'Cerrados')}
        {filterBtn(statusFilter === 'all',      () => setStatusFilter('all'),      'Todos')}
        <button onClick={load} className="ml-auto p-2 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 text-gray-300 animate-spin" /></div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">Sin tickets en este estado</div>
      ) : tickets.map(t => (
        <div key={t.id} className={`${card} px-5 py-4 cursor-pointer hover:shadow-md transition-shadow ${t.status === 'open' ? 'ring-2 ring-blue-200' : ''}`}
          onClick={() => setSelectedId(t.id)}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <p className="font-bold text-gray-900 text-sm truncate">{t.subject}</p>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${TICKET_STATUS_COLORS[t.status] ?? ''}`}>
                  {TICKET_STATUS_LABELS[t.status]}
                </span>
                {t.category && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">{TICKET_CATS[t.category] ?? t.category}</span>}
              </div>
              <p className="text-xs text-gray-500">{t.name} · {t.email}</p>
              <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-2">
                <span className="font-mono">{t.ticket_number}</span>
                <span>·</span>
                <span>{t.message_count} mensaje{t.message_count !== 1 ? 's' : ''}</span>
                <span>·</span>
                <span>{new Date(t.updated_at).toLocaleDateString('es-MX')}</span>
              </p>
            </div>
            <ChevronDown className="w-4 h-4 text-gray-300 rotate-[-90deg] flex-shrink-0 mt-1" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── MessagesTabSimple (reviews + contact from landing) ──────────────────────

// ─── Submission helpers ───────────────────────────────────────────────────────

const TYPE_META = {
  review:  { label: 'Reseña',   icon: Star,      pill: 'bg-amber-50 border-amber-200 text-amber-700',  header: 'bg-amber-50' },
  contact: { label: 'Proyecto', icon: Globe,      pill: 'bg-violet-50 border-violet-200 text-violet-700', header: 'bg-violet-50' },
  ticket:  { label: 'Ticket',   icon: MessageSquare, pill: 'bg-blue-50 border-blue-200 text-blue-700',   header: 'bg-blue-50' },
}

const STATUS_META = {
  new:      { label: 'Nuevo',    pill: 'bg-indigo-50 border-indigo-200 text-indigo-600' },
  read:     { label: 'Leído',    pill: 'bg-gray-100 border-gray-200 text-gray-500' },
  archived: { label: 'Archivado', pill: 'bg-gray-100 border-gray-200 text-gray-400' },
}

const PROJECT_LABELS = {
  whitelabel: { label: 'GemaSystem con dominio propio', icon: Globe,    color: '#4F46E5' },
  custom:     { label: 'Desarrollo a medida',       icon: Code2,    color: '#7C3AED' },
  other:      { label: 'Otro proyecto',             icon: Sparkles, color: '#059669' },
}

const CONTACT_LABELS = { email: 'Correo', whatsapp: 'WhatsApp', call: 'Llamada' }

const BUDGET_LABELS = {
  '<5k': '< $5,000 MXN', '5-15k': '$5,000–$15,000', '15-40k': '$15,000–$40,000',
  '40-100k': '$40,000–$100,000', '>100k': '> $100,000 MXN',
}

function fmtDate(iso) {
  return new Date(iso).toLocaleString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function StarRow({ rating }) {
  return (
    <div className="flex items-center gap-1">
      {[1,2,3,4,5].map(n => (
        <Star key={n} className={`w-3.5 h-3.5 ${n <= rating ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}`} />
      ))}
      <span className="text-xs font-bold text-amber-600 ml-1">{rating}/5</span>
    </div>
  )
}

function InfoRow({ icon: Icon, label, value, mono }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-2">
      <Icon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
      <div>
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mr-1.5">{label}</span>
        <span className={`text-sm text-gray-700 ${mono ? 'font-mono' : ''}`}>{value}</span>
      </div>
    </div>
  )
}

function SubmissionCard({ item, expanded, onToggle, onMarkRead, onArchive, busy }) {
  const tm  = TYPE_META[item.type]   ?? TYPE_META.contact
  const sm  = STATUS_META[item.status] ?? STATUS_META.new
  const TypeIcon = tm.icon
  const isNew = item.status === 'new'

  // Project type details
  const projMeta = item.category ? PROJECT_LABELS[item.category] : null
  const ProjIcon = projMeta?.icon

  // Reviewer type from role prefix
  const isOwnerReview  = item.role?.startsWith('Dueño/Admin')
  const isMemberReview = item.role?.startsWith('Socio')

  return (
    <div className={`${card} overflow-hidden ${isNew ? 'ring-1 ring-indigo-300' : ''}`}>

      {/* Header row */}
      <div className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-gray-50/60 transition-colors"
        onClick={onToggle}>

        {/* Type icon */}
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${tm.header}`}>
          <TypeIcon className="w-4 h-4" style={{ color: tm.pill.includes('amber') ? '#d97706' : tm.pill.includes('violet') ? '#7c3aed' : '#2563eb' }} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
            <span className={badge(tm.pill)}>{tm.label}</span>
            {isNew && <span className={badge(sm.pill)}>Nuevo</span>}
            {!isNew && <span className={badge(sm.pill)}>{sm.label}</span>}
            {projMeta && <span className={badge('bg-gray-50 border-gray-200 text-gray-600')}>{projMeta.label}</span>}
            {isOwnerReview  && <span className={badge('bg-violet-50 border-violet-200 text-violet-600')}>Dueño/Admin</span>}
            {isMemberReview && <span className={badge('bg-blue-50 border-blue-200 text-blue-600')}>Socio</span>}
          </div>
          <p className={`text-sm text-gray-900 truncate ${isNew ? 'font-bold' : 'font-medium'}`}>
            {item.subject || item.name}
          </p>
          <p className="text-xs text-gray-400 mt-0.5 truncate">
            {item.email ?? '—'}{item.company ? ` · ${item.company}` : ''}
          </p>
        </div>

        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          {item.rating && <StarRow rating={Number(item.rating)} />}
          <p className="text-[10px] text-gray-400">{fmtDate(item.created_at)}</p>
        </div>

        {expanded ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-gray-100 px-5 py-4 bg-gray-50/60 space-y-4">

          {/* Contact info grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <InfoRow icon={User}    label="Nombre"  value={item.name} />
            <InfoRow icon={Mail}    label="Correo"  value={item.email} />
            {item.company        && <InfoRow icon={Building2} label="Empresa"  value={item.company} />}
            {item.role           && <InfoRow icon={Tag}       label="Rol"      value={item.role} />}
            {item.budget         && <InfoRow icon={Wallet}    label="Presupuesto" value={BUDGET_LABELS[item.budget] ?? item.budget} />}
            {item.contact_method && <InfoRow icon={Phone}     label="Contactar por" value={CONTACT_LABELS[item.contact_method] ?? item.contact_method} />}
          </div>

          {/* Project type banner */}
          {projMeta && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl border bg-white border-gray-200">
              <ProjIcon className="w-4 h-4 flex-shrink-0" style={{ color: projMeta.color }} />
              <span className="text-sm font-semibold text-gray-700">{projMeta.label}</span>
            </div>
          )}

          {/* Rating */}
          {item.rating && (
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Calificación</p>
              <StarRow rating={Number(item.rating)} />
            </div>
          )}

          {/* Message */}
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Mensaje</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed bg-white border border-gray-200 rounded-xl px-4 py-3">
              {item.message}
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            {item.status !== 'read' && item.status !== 'archived' && (
              <button disabled={busy === item.id} onClick={onMarkRead}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-600 border border-emerald-200 hover:bg-emerald-50 disabled:opacity-60 transition-colors">
                {busy === item.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <MailOpen className="w-3 h-3" />} Marcar leído
              </button>
            )}
            {item.status !== 'archived' && (
              <button disabled={busy === `a${item.id}`} onClick={onArchive}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-gray-500 border border-gray-200 hover:bg-gray-100 disabled:opacity-60 transition-colors">
                {busy === `a${item.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Archive className="w-3 h-3" />} Archivar
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function MessagesTabSimple() {
  const [all, setAll]         = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)
  const [busy, setBusy]       = useState(null)
  const [filterType, setFilterType]     = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api('GET', '/submissions?type=all&status=all')
      setAll(res.data ?? res)
    } catch { toast.error('Error cargando mensajes') }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const markRead = async (id) => {
    setBusy(id)
    try { await api('PUT', `/submissions/${id}/read`); load() }
    catch { toast.error('Error') }
    setBusy(null)
  }

  const archive = async (id) => {
    setBusy(`a${id}`)
    try { await api('PUT', `/submissions/${id}/archive`); load() }
    catch { toast.error('Error') }
    setBusy(null)
  }

  const items = all.filter(i =>
    (filterType   === 'all' || i.type   === filterType) &&
    (filterStatus === 'all' || i.status === filterStatus)
  )

  const counts = {
    all:     all.length,
    review:  all.filter(i => i.type === 'review').length,
    contact: all.filter(i => i.type === 'contact').length,
    ticket:  all.filter(i => i.type === 'ticket').length,
    new:     all.filter(i => i.status === 'new').length,
    read:    all.filter(i => i.status === 'read').length,
    archived:all.filter(i => i.status === 'archived').length,
  }

  const FilterBtn = ({ id, label, count, active, onClick }) => (
    <button onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
        active
          ? 'bg-indigo-600 border-indigo-600 text-white'
          : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700'
      }`}>
      {label}
      {count > 0 && (
        <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold ${
          active ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
        }`}>{count}</span>
      )}
    </button>
  )

  return (
    <div className="space-y-4">

      {/* Filters + refresh */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-4">
          {/* Type filter */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mr-0.5">Tipo</span>
            {[
              { id: 'all',     label: 'Todos',    count: counts.all },
              { id: 'review',  label: 'Reseñas',  count: counts.review },
              { id: 'contact', label: 'Proyectos',count: counts.contact },
              { id: 'ticket',  label: 'Tickets',  count: counts.ticket },
            ].map(f => (
              <FilterBtn key={f.id} {...f} active={filterType === f.id} onClick={() => { setFilterType(f.id); setExpanded(null) }} />
            ))}
          </div>
          {/* Status filter */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mr-0.5">Estado</span>
            {[
              { id: 'all',      label: 'Todos',     count: counts.all },
              { id: 'new',      label: 'Nuevos',    count: counts.new },
              { id: 'read',     label: 'Leídos',    count: counts.read },
              { id: 'archived', label: 'Archivados',count: counts.archived },
            ].map(f => (
              <FilterBtn key={f.id} {...f} active={filterStatus === f.id} onClick={() => { setFilterStatus(f.id); setExpanded(null) }} />
            ))}
          </div>
        </div>
        <button onClick={load} title="Actualizar"
          className="p-2 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 text-gray-300 animate-spin" /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">
          No hay {filterType !== 'all' ? TYPE_META[filterType]?.label?.toLowerCase() + 's' : 'mensajes'} {filterStatus !== 'all' ? filterStatus === 'new' ? 'nuevos' : filterStatus === 'read' ? 'leídos' : 'archivados' : ''}
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(item => (
            <SubmissionCard
              key={item.id}
              item={item}
              expanded={expanded === item.id}
              onToggle={() => setExpanded(expanded === item.id ? null : item.id)}
              onMarkRead={() => markRead(item.id)}
              onArchive={() => archive(item.id)}
              busy={busy}
            />
          ))}
          <p className="text-[10px] text-gray-400 text-center pt-2">
            Mostrando {items.length} de {all.length} mensajes
          </p>
        </div>
      )}
    </div>
  )
}

// ─── SuperAdmin page ──────────────────────────────────────────────────────────

const TABS = [
  { id: 'dashboard', label: 'Dashboard',   icon: LayoutDashboard },
  { id: 'trials',    label: 'Solicitudes', icon: FileText },
  { id: 'gyms',      label: 'Gyms',        icon: Building2 },
  { id: 'manage',    label: 'Gestión',     icon: Users },
  { id: 'tickets',   label: 'Soporte',     icon: MessageSquare },
  { id: 'messages',  label: 'Mensajes',    icon: Inbox },
]

export default function SuperAdmin() {
  const navigate = useNavigate()
  const { logout } = useAuthStore()
  const [tab, setTab]               = useState('dashboard')
  const [stats, setStats]           = useState(null)
  const [selectedGym, setSelectedGym] = useState(null)

  useEffect(() => {
    api('GET', '/stats').then(setStats).catch(() => toast.error('Error cargando estadísticas'))
  }, [])

  const handleManage = (gym) => { setSelectedGym(gym); setTab('manage') }
  const handleBack   = () => { setSelectedGym(null); setTab('gyms') }

  const handleLogout = async () => {
    await logout()
    navigate('/', { replace: true })
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex">
      {/* ── Sidebar ── */}
      <aside className="w-56 flex-shrink-0 flex flex-col border-r border-white/8 bg-[#0d0d14]">
        <div className="px-5 py-5 border-b border-white/8">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-white" />
            </div>
            <div>
              <p className="text-white font-extrabold text-sm leading-none">GemaSystem</p>
              <p className="text-[10px] text-slate-500 mt-0.5">Console</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-2 py-4 space-y-0.5">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                tab === id ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
              }`}>
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
              {id === 'trials' && stats?.pending_trials > 0 && (
                <span className="ml-auto text-[10px] font-bold bg-red-500 text-white rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                  {stats.pending_trials}
                </span>
              )}
              {id === 'tickets' && stats?.open_tickets > 0 && (
                <span className="ml-auto text-[10px] font-bold bg-blue-500 text-white rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                  {stats.open_tickets}
                </span>
              )}
              {id === 'messages' && stats?.unread_messages > 0 && (
                <span className="ml-auto text-[10px] font-bold bg-indigo-500 text-white rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                  {stats.unread_messages}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="px-2 py-3 border-t border-white/8">
          <button onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all">
            <LogOut className="w-4 h-4" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* ── Content ── */}
      <main className="flex-1 min-h-screen overflow-y-auto bg-gray-50">
        <div className="max-w-4xl mx-auto px-6 py-8">
          {/* Dashboard */}
          {tab === 'dashboard' && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Dashboard</h1>
                <p className="text-gray-500 text-sm mt-0.5">Panel de control del sistema GemaSystem</p>
              </div>
              {stats ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {[
                    { label: 'Solicitudes pendientes', value: stats.pending_trials, color: 'text-amber-600', bg: 'bg-amber-50', icon: Clock },
                    { label: 'Gyms gratuitos',         value: stats.free_gyms,      color: 'text-gray-700',  bg: 'bg-gray-100',  icon: Building2 },
                    { label: 'Gyms de pago',           value: stats.paid_gyms,      color: 'text-indigo-600',bg: 'bg-indigo-50', icon: Database },
                    { label: 'Gyms activos',           value: stats.active_gyms,    color: 'text-emerald-600',bg:'bg-emerald-50',icon: CheckCircle2 },
                    { label: 'Total gyms',             value: stats.total_gyms,     color: 'text-gray-700',  bg: 'bg-gray-100',  icon: Building2 },
                    { label: 'Total usuarios',         value: stats.total_users,    color: 'text-violet-600',bg: 'bg-violet-50', icon: Users },
                  ].map(({ label, value, color, bg, icon: Icon }) => (
                    <div key={label} className={`${card} p-5`}>
                      <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center mb-3`}>
                        <Icon className={`w-4.5 h-4.5 ${color}`} />
                      </div>
                      <p className={`text-2xl font-extrabold ${color}`}>{value}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 text-gray-300 animate-spin" /></div>
              )}

              <div className={`${card} p-5`}>
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-gray-900 text-sm mb-1">Panel de operador — acceso restringido</p>
                    <p className="text-xs text-gray-500 leading-relaxed">
                      Este panel es exclusivo del operador del sistema. Cualquier acción aquí afecta directamente
                      las cuentas de los gyms. Opera con responsabilidad. La sesión de operador no es visible
                      para los usuarios normales del sistema.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === 'trials' && (
            <div className="space-y-5">
              <div>
                <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Solicitudes de prueba</h1>
                <p className="text-gray-500 text-sm mt-0.5">Formularios enviados desde la landing page</p>
              </div>
              <TrialTab />
            </div>
          )}

          {tab === 'gyms' && (
            <div className="space-y-5">
              <div>
                <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Gyms registrados</h1>
                <p className="text-gray-500 text-sm mt-0.5">Gestiona cuentas gratuitas y de pago</p>
              </div>
              <GymsTab onManage={handleManage} />
            </div>
          )}

          {tab === 'manage' && (
            <div className="space-y-5">
              <div>
                <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Gestión de gym</h1>
                <p className="text-gray-500 text-sm mt-0.5">Sesión, contraseñas y accesos</p>
              </div>
              <ManageTab selectedGym={selectedGym} onBack={handleBack} />
            </div>
          )}

          {tab === 'tickets' && (
            <div className="space-y-5">
              <div>
                <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Soporte</h1>
                <p className="text-gray-500 text-sm mt-0.5">Gestión de tickets y conversaciones con usuarios</p>
              </div>
              <TicketsTab />
            </div>
          )}

          {tab === 'messages' && (
            <div className="space-y-5">
              <div>
                <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Mensajes</h1>
                <p className="text-gray-500 text-sm mt-0.5">Reseñas y formularios de contacto desde la landing</p>
              </div>
              <MessagesTabSimple />
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
