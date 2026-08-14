import { useState, useRef, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import * as yup from 'yup'
import jsQR from 'jsqr'
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  Plus, Search, X, Trash2, Clock, Loader2, ChevronLeft, ChevronRight, ChevronDown, Check,
  QrCode, UserPlus, Camera, CheckCircle2, AlertCircle, User, DollarSign, Pencil,
  BarChart2, TrendingUp, Activity, Calendar, ShieldCheck, CreditCard,
  Mail, MessageCircle, RefreshCw,
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../api/axios'
import ChipSelect from '../components/ChipSelect'
import ConfirmModal from '../components/ConfirmModal'
import ExportMenu from '../components/ExportMenu'
import { QuickMembershipBody } from '../components/QuickMembershipModal'
import PaymentPanel from '../components/PaymentPanel'
import MembershipDecisionPanel, { MembershipStatusBanner } from '../components/MembershipDecisionPanel'
import { exportToExcel, exportToPDF } from '../utils/exportUtils'
import { useSettingsStore } from '../store/settingsStore'
import useLockBodyScroll from '../hooks/useLockBodyScroll'

const MONTH_NAMES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

const VISIT_LABELS  = { training: 'Entrenamiento', class: 'Clase', consultation: 'Consulta', other: 'Otro' }
const VISIT_COLORS  = { training: 'badge-indigo', class: 'badge-purple', consultation: 'badge-blue', other: 'badge-gray' }
const TYPE_CHART_COLORS = { training: '#6366F1', class: '#8B5CF6', consultation: '#3B82F6', other: '#94A3B8' }
const METHOD_LABELS = { cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia' }

const CHART_TYPES = [
  { id: 'bar',  label: 'Barras', icon: BarChart2 },
  { id: 'line', label: 'Línea',  icon: TrendingUp },
  { id: 'area', label: 'Área',   icon: Activity },
]

const EXPORT_COLS = [
  { header: 'Miembro',     value: r => r.member ? `${r.member.first_name} ${r.member.last_name}` : '—' },
  { header: 'Membresía',   value: r => r.has_active_membership ? 'Activa' : 'Sin membresía' },
  { header: 'Fecha',       value: r => new Date(r.visit_date).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' }) },
  { header: 'Tipo',        value: r => VISIT_LABELS[r.visit_type] ?? r.visit_type },
  { header: 'Entrenador',  value: r => r.trainer ? `${r.trainer.first_name} ${r.trainer.last_name}` : '—' },
  { header: 'Precio (MXN)',value: r => r.price != null ? parseFloat(r.price).toFixed(2) : '—' },
  { header: 'Método',      value: r => METHOD_LABELS[r.payment_method] ?? r.payment_method ?? '—' },
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

function StatCard({ icon: Icon, title, value, color }) {
  const palette = {
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', icon: 'text-emerald-600' },
    indigo:  { bg: 'bg-indigo-50',  text: 'text-indigo-700',  icon: 'text-indigo-600' },
    blue:    { bg: 'bg-blue-50',    text: 'text-blue-700',    icon: 'text-blue-600' },
    violet:  { bg: 'bg-violet-50',  text: 'text-violet-700',  icon: 'text-violet-600' },
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
            ${value === ct.id ? 'bg-emerald-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
        >
          <ct.icon className="w-3 h-3" />
          {ct.label}
        </button>
      ))}
    </div>
  )
}

const MODAL_TABS = [
  { id: 'qr',     label: 'Escanear QR',   icon: QrCode },
  { id: 'search', label: 'Buscar miembro', icon: Search },
  { id: 'new',    label: 'Nuevo miembro',  icon: UserPlus },
]

// ── QR Camera Tab ───────────────────────────────────────────────
function QRTab({ onSuccess }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const rafRef = useRef(null)
  const [status, setStatus]           = useState('starting')
  const [result, setResult]           = useState(null)
  const [camError, setCamError]       = useState('')
  const [pendingQR, setPendingQR]     = useState(null)   // { member, token, lastMembership } awaiting a decision
  const [confirmingQR, setConfirmQR]  = useState(false)
  // What's showing below the camera once a scan needs a decision — never a
  // separate overlay, always swapped in place so nothing stacks on the modal.
  const [flowStep, setFlowStep]       = useState(null)   // null | 'decision' | 'payment' | 'renew'
  const qc = useQueryClient()
  const { systemSettings } = useSettingsStore()

  const startScan = useCallback((video, canvas) => {
    function tick() {
      if (video.readyState !== video.HAVE_ENOUGH_DATA) {
        rafRef.current = requestAnimationFrame(tick)
        return
      }
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const code = jsQR(img.data, canvas.width, canvas.height)
      if (code?.data) {
        setStatus('processing')
        api.post('/members/scan-qr', { token: code.data })
          .then(r => {
            if (r.data.requires_payment) {
              // Member has no active membership — pause and let the front desk
              // decide: renew/register a membership, or just charge a walk-in visit.
              setPendingQR({ member: r.data.member, token: code.data, lastMembership: r.data.last_membership ?? null })
              setFlowStep('decision')
              return
            }
            // Has membership — visit already registered
            setResult(r.data)
            setStatus('found')
            qc.invalidateQueries(['visits'])
            qc.invalidateQueries(['visit-summary'])
            onSuccess()
          })
          .catch(err => {
            toast.error(err.response?.data?.message ?? 'QR no válido')
            setStatus('scanning')
            rafRef.current = requestAnimationFrame(tick)
          })
      } else {
        rafRef.current = requestAnimationFrame(tick)
      }
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [qc, onSuccess])

  useEffect(() => {
    let stream
    async function init() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCamError('Tu navegador no soporta cámara. Usa Chrome o Edge actualizados, y asegúrate de estar en localhost o HTTPS.')
        setStatus('error')
        return
      }
      // Try back camera first, fall back to any camera
      const constraints = [
        { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } } },
        { video: true },
      ]
      let lastErr = null
      for (const c of constraints) {
        try { stream = await navigator.mediaDevices.getUserMedia(c); break }
        catch (e) { lastErr = e }
      }
      if (!stream) {
        const name = lastErr?.name ?? ''
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
          setCamError('Permiso de cámara bloqueado. Haz clic en el ícono de cámara en la barra de direcciones y permite el acceso.')
        } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
          setCamError('No se encontró cámara en este dispositivo. Usa la búsqueda manual.')
        } else {
          setCamError('No se pudo iniciar la cámara. Verifica que no esté en uso por otra aplicación.')
        }
        setStatus('error')
        return
      }
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        setStatus('scanning')
        startScan(videoRef.current, canvasRef.current)
      }
    }
    init()
    return () => {
      stream?.getTracks().forEach(t => t.stop())
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [startScan])

  async function confirmQRPayment({ payment_method, amount_paid }) {
    if (!pendingQR) return
    setConfirmQR(true)
    const defaultPrice = parseFloat(systemSettings?.price_visit_training || '0') || 0
    try {
      const r = await api.post('/members/scan-qr', {
        token:          pendingQR.token,
        confirmed:      true,
        payment_method,
        amount_paid,
        price: defaultPrice,
      })
      setResult(r.data)
      setStatus('found')
      setPendingQR(null)
      setFlowStep(null)
      qc.invalidateQueries(['visits'])
      qc.invalidateQueries(['visit-summary'])
      onSuccess()
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Error al registrar visita')
    } finally {
      setConfirmQR(false)
    }
  }

  function handleRenewalDone(displayName, planLabel) {
    setResult({ member: pendingQR.member, has_active_membership: true, renewed: `${displayName} · ${planLabel}` })
    setStatus('found')
    setPendingQR(null)
    setFlowStep(null)
    onSuccess()
  }

  if (status === 'error') return (
    <div className="flex flex-col items-center gap-3 py-10 text-center px-4">
      <AlertCircle className="w-10 h-10 text-red-400" />
      <p className="text-sm text-gray-600">{camError}</p>
    </div>
  )

  if (status === 'found' && result) {
    const m = result.member
    return (
      <div className="flex flex-col items-center gap-4 py-10 px-4 text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
          <CheckCircle2 className="w-9 h-9 text-emerald-600" />
        </div>
        <div>
          <p className="text-lg font-semibold text-gray-900">{result.renewed ? '¡Membresía renovada!' : '¡Visita registrada!'}</p>
          <p className="text-sm text-gray-500 mt-1">{m.first_name} {m.last_name}</p>
          {m.member_code && (
            <span className="inline-block mt-2 text-xs font-mono bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">
              {m.member_code}
            </span>
          )}
          {result.renewed ? (
            <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-indigo-600">
              <RefreshCw className="w-3.5 h-3.5" />
              {result.renewed} · visita anotada
            </div>
          ) : result.has_active_membership && (
            <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-emerald-600">
              <ShieldCheck className="w-3.5 h-3.5" />
              Cubierto por membresía activa
            </div>
          )}
        </div>
      </div>
    )
  }

  if (flowStep && pendingQR) {
    if (flowStep === 'decision') {
      return (
        <MembershipDecisionPanel
          member={pendingQR.member}
          lastMembership={pendingQR.lastMembership}
          price={parseFloat(systemSettings?.price_visit_training || '0') || 0}
          onRenew={() => setFlowStep('renew')}
          onPayVisit={() => setFlowStep('payment')}
          onCancel={() => { setPendingQR(null); setFlowStep(null); setStatus('scanning') }}
        />
      )
    }
    if (flowStep === 'payment') {
      return (
        <PaymentPanel
          amount={parseFloat(systemSettings?.price_visit_training || '0') || 0}
          title="Cobrar visita"
          subtitle={`${pendingQR.member.first_name} ${pendingQR.member.last_name}`}
          onConfirm={confirmQRPayment}
          onBack={() => setFlowStep('decision')}
          loading={confirmingQR}
          confirmLabel="Confirmar y registrar visita"
        />
      )
    }
    if (flowStep === 'renew') {
      return (
        <QuickMembershipBody
          initialMember={pendingQR.member}
          onDone={handleRenewalDone}
          onCancel={() => setFlowStep('decision')}
        />
      )
    }
  }

  return (
    <div className="space-y-4">
      <div className="relative bg-black rounded-xl overflow-hidden aspect-video">
        <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-52 h-52 border-2 border-white/60 rounded-2xl relative">
            <span className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-indigo-400 rounded-tl-lg" />
            <span className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-indigo-400 rounded-tr-lg" />
            <span className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-indigo-400 rounded-bl-lg" />
            <span className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-indigo-400 rounded-br-lg" />
          </div>
        </div>
        {(status === 'starting' || status === 'processing') && (
          <div className="absolute inset-0 bg-black/70 flex items-center justify-center gap-2">
            <Loader2 className="w-7 h-7 text-white animate-spin" />
            {status === 'processing' && <span className="text-white text-sm">Verificando...</span>}
          </div>
        )}
      </div>
      <canvas ref={canvasRef} className="hidden" />
      <p className="text-xs text-center text-gray-400">Coloca el QR del miembro dentro del marco</p>
    </div>
  )
}

// ── Search Tab ──────────────────────────────────────────────────
function SearchTab({ onSuccess }) {
  const qc = useQueryClient()
  const { systemSettings } = useSettingsStore()
  const [q, setQ]                       = useState('')
  const [selected, setSelected]         = useState(null)
  const [visitDate, setDate]            = useState(new Date().toISOString().slice(0, 16))
  const [visitType, setType]            = useState('training')
  const [trainerId, setTrainer]         = useState('')
  const [classId, setClassId]           = useState('')
  const [price, setPrice]               = useState('')
  const [notes, setNotes]               = useState('')
  const [submitting, setSub]            = useState(false)
  const [membershipInfo, setMemInfo]    = useState(null)   // { has_active_membership, membership }
  const [fetchingMem, setFetchingMem]   = useState(false)
  const [step, setStep]                 = useState('form') // 'form' | 'payment'

  // Auto-fill price from settings when visit type changes
  useEffect(() => {
    if (membershipInfo?.has_active_membership) return
    const val = systemSettings?.[`price_visit_${visitType}`]
    if (val && val !== '0') setPrice(String(val))
  }, [visitType, systemSettings, membershipInfo])

  // Check membership whenever a member is selected
  useEffect(() => {
    if (!selected) { setMemInfo(null); return }
    setFetchingMem(true)
    api.get(`/members/${selected.id}/membership-status`)
      .then(r => {
        setMemInfo(r.data)
        if (r.data.has_active_membership) setPrice('')
      })
      .catch(() => setMemInfo(null))
      .finally(() => setFetchingMem(false))
  }, [selected])

  const { data: members = [], isFetching } = useQuery({
    queryKey: ['visit-search', q],
    queryFn: () => q.length >= 2 ? api.get('/members/search', { params: { q } }).then(r => r.data) : [],
    enabled: q.length >= 2,
  })

  const { data: trainers = [] } = useQuery({
    queryKey: ['trainers-active'],
    queryFn: () => api.get('/trainers', { params: { active_only: 1 } }).then(r => r.data),
  })

  const { data: classes = [] } = useQuery({
    queryKey: ['classes-list'],
    queryFn: () => api.get('/classes').then(r => r.data),
  })

  const hasMembership = membershipInfo?.has_active_membership === true

  async function doRegister({ payment_method, amount_paid } = {}) {
    setSub(true)
    try {
      await api.post('/visits', {
        member_id:      selected.id,
        visit_date:     visitDate,
        visit_type:     visitType,
        ...(trainerId ? { trainer_id: parseInt(trainerId) } : {}),
        ...(visitType === 'class' && classId ? { class_id: parseInt(classId) } : {}),
        ...(!hasMembership ? { price: parseFloat(price || 0) } : {}),
        ...(!hasMembership && payment_method ? { payment_method, amount_paid } : {}),
        ...(notes ? { notes } : {}),
      })
      toast.success('Visita registrada')
      qc.invalidateQueries(['visits'])
      qc.invalidateQueries(['visit-summary'])
      onSuccess()
    } catch {
      toast.error('Error al registrar visita')
      setStep('form')
    } finally {
      setSub(false)
    }
  }

  function handleSubmit() {
    if (!selected) return toast.error('Selecciona un miembro')
    // No active membership → always go through the checkout step so cash
    // payments get the "efectivo recibido" + cambio calculator, even if the
    // price field was left at 0 (e.g. no default configured in Ajustes).
    if (!hasMembership) {
      setStep('payment')
      return
    }
    doRegister()
  }

  if (step === 'payment' && selected) {
    return (
      <PaymentPanel
        amount={parseFloat(price || 0) || 0}
        title="Cobrar visita"
        subtitle={`${selected.first_name} ${selected.last_name} · ${VISIT_LABELS[visitType] ?? visitType}`}
        onConfirm={doRegister}
        onBack={() => setStep('form')}
        loading={submitting}
        confirmLabel="Confirmar y registrar visita"
      />
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="label">Miembro *</label>
        {selected ? (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-indigo-50 border border-indigo-100">
            <div className="w-9 h-9 rounded-full bg-indigo-200 flex items-center justify-center text-indigo-800 font-bold text-sm flex-shrink-0">
              {selected.first_name[0]}{selected.last_name[0]}
            </div>
            <div className="flex-1">
              <p className="font-semibold text-gray-900 text-sm">{selected.first_name} {selected.last_name}</p>
              {selected.member_code && <p className="text-xs font-mono text-indigo-500">{selected.member_code}</p>}
            </div>
            {fetchingMem && <Loader2 className="w-4 h-4 text-indigo-400 animate-spin flex-shrink-0" />}
            <button onClick={() => { setSelected(null); setMemInfo(null) }} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : null}
        {selected && !fetchingMem && membershipInfo && (
          <div className="mt-2.5">
            <MembershipStatusBanner
              memberStatus={membershipInfo.member_status}
              hasMembership={hasMembership}
              lastMembership={membershipInfo.last_membership}
            />
          </div>
        )}
        {!selected && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={q} onChange={e => { setQ(e.target.value); setSelected(null) }}
              placeholder="Nombre, apellido o DYM-XXXX..." className="input pl-9" autoFocus
            />
            {isFetching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300 animate-spin" />}
            {members.length > 0 && !selected && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10 max-h-44 overflow-y-auto">
                {members.map(m => (
                  <button key={m.id} type="button" onClick={() => { setSelected(m); setQ('') }}
                    className="w-full text-left px-3 py-2.5 hover:bg-gray-50 flex items-center gap-3 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-bold flex-shrink-0">
                      {m.first_name[0]}{m.last_name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{m.first_name} {m.last_name}</p>
                      <p className="text-xs text-gray-400">{m.member_code ?? m.email ?? m.phone}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${m.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                      {m.status === 'active' ? 'Activo' : 'Inactivo'}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="label">Fecha y hora</label>
          <input type="datetime-local" value={visitDate} onChange={e => setDate(e.target.value)} className="input" />
        </div>
        <div>
          <label className="label">Tipo de visita</label>
          <select value={visitType} onChange={e => setType(e.target.value)} className="input">
            <option value="training">Entrenamiento</option>
            <option value="class">Clase</option>
            <option value="consultation">Consulta</option>
            <option value="other">Otro</option>
          </select>
        </div>
      </div>

      {visitType === 'class' && (
        <div>
          <label className="label">Clase</label>
          <select value={classId} onChange={e => setClassId(e.target.value)} className="input">
            <option value="">Sin especificar</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="label">Entrenador</label>
          <select value={trainerId} onChange={e => setTrainer(e.target.value)} className="input">
            <option value="">Sin entrenador</option>
            {trainers.map(t => <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>)}
          </select>
        </div>
        <div>
          <label className="label flex items-center gap-1">
            <DollarSign className="w-3.5 h-3.5 text-gray-400" /> Precio
          </label>
          {fetchingMem ? (
            <div className="input flex items-center gap-2 text-gray-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
              <span className="text-xs">Verificando...</span>
            </div>
          ) : hasMembership ? (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-emerald-50 border border-emerald-200 min-h-[38px]">
              <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span className="text-xs font-semibold text-emerald-700">Con membresía activa</span>
            </div>
          ) : (
            <input type="number" min="0" step="0.01" value={price} onChange={e => setPrice(e.target.value)} placeholder="0.00" className="input" />
          )}
        </div>
      </div>

      <div>
        <label className="label">Notas</label>
        <input value={notes} onChange={e => setNotes(e.target.value)} className="input" placeholder="Observaciones..." />
      </div>

      <button onClick={handleSubmit} disabled={!selected || submitting || fetchingMem} className="btn-primary w-full">
        {!hasMembership
          ? 'Continuar al cobro'
          : submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Registrando...</> : 'Registrar visita'}
      </button>
    </div>
  )
}

// ── New Member Tab ──────────────────────────────────────────────
const newSchema = yup.object({
  first_name:               yup.string().required('Obligatorio'),
  last_name:                yup.string().required('Obligatorio'),
  email:                    yup.string().email('Correo inválido').nullable(),
  phone:                    yup.string().nullable(),
  membership_type:          yup.string().required('Tipo obligatorio'),
  discount_category:        yup.string().nullable(),
  emergency_contact_name:   yup.string().nullable(),
  emergency_contact_phone:  yup.string().nullable(),
})

function NewTab({ onSuccess }) {
  const qc = useQueryClient()
  const { systemSettings } = useSettingsStore()
  const [price, setPrice]               = useState('')
  const [step, setStep]                 = useState('form') // 'form' | 'payment'
  const [pendingData, setPendingData]   = useState(null)
  const [submitting, setSubmitting]     = useState(false)
  const [showEmergency, setShowEmergency] = useState(false)
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

  useEffect(() => {
    const val = systemSettings?.price_visit_training
    if (val && val !== '0') setPrice(String(val))
  }, [systemSettings])

  const { register, handleSubmit, formState: { errors }, watch, setValue } = useForm({
    resolver: yupResolver(newSchema),
    defaultValues: {
      first_name: '', last_name: '', email: '', phone: '', membership_type: 'Básica',
      discount_category: '', emergency_contact_name: '', emergency_contact_phone: '',
    },
  })

  async function doCreate(data, paymentInfo) {
    setSubmitting(true)
    const payload = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v === '' ? null : v]))
    try {
      const { data: member } = await api.post('/members', payload)
      const visitPayload = { member_id: member.id, visit_type: 'training' }
      if (paymentInfo) {
        visitPayload.price          = parseFloat(price)
        visitPayload.payment_method = paymentInfo.payment_method
        visitPayload.amount_paid    = paymentInfo.amount_paid
      }
      await api.post('/visits', visitPayload)
      const priceStr = paymentInfo ? ` · $${parseFloat(price).toFixed(2)}` : ''
      toast.success(`${member.first_name} registrado y visita anotada${priceStr}`)
      qc.invalidateQueries(['members'])
      qc.invalidateQueries(['visits'])
      qc.invalidateQueries(['visit-summary'])
      if (notifyEmail && member.email)
        api.post(`/members/${member.id}/notify`, { type: 'qr', channel: 'email' }).catch(() => {})
      if (notifyWa && member.phone)
        api.post(`/members/${member.id}/notify`, { type: 'qr', channel: 'whatsapp' }).catch(() => {})
      onSuccess()
    } catch (err) {
      const msg = Object.values(err.response?.data?.errors ?? {}).flat()[0]
      toast.error(msg ?? 'Error al guardar')
      setStep('form')
    } finally {
      setSubmitting(false)
    }
  }

  function onSubmit(data) {
    if (price && parseFloat(price) > 0) {
      setPendingData(data)
      setStep('payment')
      return
    }
    doCreate(data, null)
  }

  if (step === 'payment' && pendingData) {
    return (
      <PaymentPanel
        amount={parseFloat(price) || 0}
        title="Cobrar visita"
        subtitle={`${pendingData.first_name} ${pendingData.last_name}`}
        onConfirm={info => doCreate(pendingData, info)}
        onBack={() => setStep('form')}
        loading={submitting}
        confirmLabel="Confirmar y crear miembro"
      />
    )
  }

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
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
        <div>
          <label className="label">Teléfono</label>
          <input {...register('phone')} className="input" placeholder="+52 55..." />
        </div>

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
                <label className="label">Tel. emergencia</label>
                <input {...register('emergency_contact_phone')} className="input" placeholder="+52 55..." />
              </div>
            </div>
          )}
        </div>
        <div>
          <label className="label flex items-center gap-1">
            <DollarSign className="w-3.5 h-3.5 text-gray-400" /> Precio de visita
          </label>
          <input type="number" min="0" step="0.01" value={price} onChange={e => setPrice(e.target.value)} placeholder="0.00" className="input" />
        </div>
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
        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {price && parseFloat(price) > 0
            ? 'Continuar al cobro'
            : submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</> : 'Crear miembro y registrar visita'}
        </button>
      </form>
    </>
  )
}

// ── Inline price cell ───────────────────────────────────────────
function PriceCell({ visit }) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(visit.price != null ? String(visit.price) : '')

  async function save() {
    setEditing(false)
    const newPrice = val === '' ? null : parseFloat(val)
    const oldPrice = visit.price == null ? null : parseFloat(visit.price)
    if (newPrice === oldPrice) return
    try {
      await api.patch(`/visits/${visit.id}`, { price: newPrice })
      qc.invalidateQueries(['visits'])
      toast.success('Precio actualizado')
    } catch {
      toast.error('Error al actualizar precio')
    }
  }

  if (editing) return (
    <input
      type="number" min="0" step="0.01" value={val} onChange={e => setVal(e.target.value)}
      onBlur={save}
      onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
      className="w-24 px-2 py-1 text-xs border border-indigo-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-400"
      autoFocus
    />
  )

  return (
    <button onClick={() => setEditing(true)} className="group/p flex items-center gap-1 hover:text-emerald-600 transition-colors" title="Clic para editar precio">
      {visit.price > 0
        ? <span className="text-emerald-700 font-semibold text-xs">${parseFloat(visit.price).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
        : <span className="text-gray-300 text-xs">—</span>
      }
      <Pencil className="w-3 h-3 text-gray-300 group-hover/p:text-emerald-500 transition-colors" />
    </button>
  )
}

// ── Register Visit Modal ────────────────────────────────────────
function RegisterVisitModal({ onClose, initialTab = 'search' }) {
  const [tab, setTab] = useState(initialTab)
  useLockBodyScroll()
  function handleSuccess() { setTimeout(onClose, 1600) }

  return (
    <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Registrar visita</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex border-b">
          {MODAL_TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors border-b-2 -mb-px
                ${tab === t.id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {tab === 'qr'     && <QRTab     onSuccess={handleSuccess} />}
          {tab === 'search' && <SearchTab onSuccess={handleSuccess} />}
          {tab === 'new'    && <NewTab    onSuccess={handleSuccess} />}
        </div>
      </div>
    </div>
  )
}

// ── Main Page ───────────────────────────────────────────────────
export default function Visits() {
  const qc = useQueryClient()
  const { systemSettings } = useSettingsStore()
  const [showModal, setShowModal]       = useState(false)
  const [modalTab, setModalTab]         = useState('search')
  const [page, setPage]                 = useState(1)
  const [dateFilter, setDateFilter]     = useState('')
  const [search, setSearch]             = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [trendType, setTrendType]       = useState('bar')
  const [exporting, setExporting]       = useState(false)

  function openModal(tab = 'search') { setModalTab(tab); setShowModal(true) }

  const params = {
    page, per_page: 20,
    ...(dateFilter        && { date:   dateFilter }),
    ...(search.trim()     && { search: search.trim() }),
  }

  const { data, isLoading } = useQuery({
    queryKey: ['visits', params],
    queryFn: () => api.get('/visits', { params }).then(r => r.data),
    keepPreviousData: true,
  })

  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ['visit-summary'],
    queryFn: () => api.get('/visits/summary').then(r => r.data),
  })

  const deleteMutation = useMutation({
    mutationFn: id => api.delete(`/visits/${id}`),
    onSuccess: () => {
      qc.invalidateQueries(['visits'])
      qc.invalidateQueries(['visit-summary'])
      toast.success('Visita eliminada')
    },
  })

  const visits    = data?.data ?? []
  const pagination = data ? { current: data.current_page, last: data.last_page, total: data.total } : null
  const s = summary?.summary

  const monthlyData = buildMonthly(summary?.by_month)
  const typeData = (summary?.by_type ?? []).map(r => ({
    name:  VISIT_LABELS[r.type] ?? r.type,
    count: r.count,
    fill:  TYPE_CHART_COLORS[r.type] ?? '#94A3B8',
  }))

  async function fetchAll() {
    const res = await api.get('/visits', { params: { page: 1, per_page: 9999, ...(dateFilter && { date: dateFilter }), ...(search.trim() && { search: search.trim() }) } })
    return res.data.data ?? []
  }

  async function handleExportExcel() {
    setExporting(true)
    const gymName = systemSettings?.gym_name || 'GemaSystem'
    try { exportToExcel(await fetchAll(), EXPORT_COLS, 'visitas', { title: 'Reporte de Visitas', gymName }) }
    finally { setExporting(false) }
  }

  async function handleExportPDF() {
    setExporting(true)
    const gymName = systemSettings?.gym_name || 'GemaSystem'
    try { exportToPDF(await fetchAll(), EXPORT_COLS, 'visitas', { title: 'Reporte de Visitas', gymName }) }
    finally { setExporting(false) }
  }

  const axisProps = { tick: { fontSize: 11, fill: '#94A3B8' }, tickLine: false, axisLine: false }
  const tipStyle  = { contentStyle: { borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '12px' } }
  const trendColor = '#10B981'

  function TrendChart() {
    const common = { data: monthlyData, margin: { top: 5, right: 5, bottom: 5, left: 0 } }
    if (trendType === 'line') return (
      <ResponsiveContainer width="100%" height={180}>
        <LineChart {...common}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
          <XAxis dataKey="name" {...axisProps} />
          <YAxis {...axisProps} allowDecimals={false} />
          <Tooltip {...tipStyle} formatter={v => [v, 'Visitas']} />
          <Line type="monotone" dataKey="count" stroke={trendColor} strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    )
    if (trendType === 'area') return (
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart {...common}>
          <defs>
            <linearGradient id="visitGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={trendColor} stopOpacity={0.18} />
              <stop offset="95%" stopColor={trendColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
          <XAxis dataKey="name" {...axisProps} />
          <YAxis {...axisProps} allowDecimals={false} />
          <Tooltip {...tipStyle} formatter={v => [v, 'Visitas']} />
          <Area type="monotone" dataKey="count" stroke={trendColor} strokeWidth={2.5} fill="url(#visitGrad)" dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    )
    return (
      <ResponsiveContainer width="100%" height={180}>
        <BarChart {...common}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
          <XAxis dataKey="name" {...axisProps} />
          <YAxis {...axisProps} allowDecimals={false} />
          <Tooltip {...tipStyle} formatter={v => [v, 'Visitas']} />
          <Bar dataKey="count" fill={trendColor} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    )
  }

  const totalTypeCount = typeData.reduce((s, d) => s + d.count, 0)

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Control de visitas</h2>
          <p className="text-sm text-gray-500 mt-0.5">{pagination?.total ?? 0} visitas registradas</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ExportMenu onExportExcel={handleExportExcel} onExportPDF={handleExportPDF} loading={exporting} />
          <button onClick={() => openModal('search')} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Registrar visita
          </button>
        </div>
      </div>

      {/* ── Stat cards ── */}
      {!loadingSummary && s && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Clock}      title="Total visitas" value={s.total}     color="emerald" />
          <StatCard icon={Calendar}   title="Hoy"           value={s.today}     color="indigo"  />
          <StatCard icon={TrendingUp} title="Esta semana"   value={s.thisWeek}  color="blue"    />
          <StatCard icon={Activity}   title="Este mes"      value={s.thisMonth} color="violet"  />
        </div>
      )}

      {/* ── Main 2-column layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">

        {/* ── Left panel ── */}
        <div className="space-y-4">

          {/* QR Scanner card */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <QrCode className="w-4 h-4 text-indigo-500" />
              Registrar entrada
            </h3>

            {/* QR visual + CTA */}
            <button
              onClick={() => openModal('qr')}
              className="w-full group relative overflow-hidden rounded-2xl border-2 border-dashed border-indigo-200 bg-indigo-50/50 hover:bg-indigo-50 hover:border-indigo-400 transition-all p-6 flex flex-col items-center gap-3 mb-4"
            >
              {/* decorative QR grid */}
              <div className="grid grid-cols-7 gap-0.5 opacity-30 group-hover:opacity-60 transition-opacity">
                {Array.from({ length: 49 }).map((_, i) => (
                  <div key={i} className="w-3.5 h-3.5 rounded-sm"
                    style={{ background: [0,1,2,3,4,5,6,7,13,14,20,21,27,28,34,35,41,42,43,44,45,46,47,48,10,11,12,36,37,38].includes(i) ? '#6366F1' : '#c7d2fe' }}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2 text-sm font-semibold text-indigo-600">
                <Camera className="w-4 h-4" />
                Abrir escáner QR
              </div>
              <p className="text-xs text-indigo-400">Apunta la cámara al código del socio</p>

              {/* Scanning indicator */}
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-semibold text-emerald-700">Listo para escanear</span>
              </div>
            </button>

            {/* Secondary actions */}
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => openModal('search')}
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-medium text-gray-700 transition-colors">
                <Search className="w-3.5 h-3.5 text-gray-400" />
                Buscar socio
              </button>
              <button onClick={() => openModal('new')}
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-medium text-gray-700 transition-colors">
                <UserPlus className="w-3.5 h-3.5 text-gray-400" />
                Nuevo socio
              </button>
            </div>
          </div>

          {/* Visit type breakdown */}
          {!loadingSummary && typeData.length > 0 && (
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Tipos de visita</h3>
              <div className="space-y-3">
                {typeData.map((d, i) => {
                  const pct = totalTypeCount > 0 ? Math.round((d.count / totalTypeCount) * 100) : 0
                  return (
                    <div key={i}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.fill }} />
                          <span className="text-xs text-gray-600">{d.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-gray-800">{d.count}</span>
                          <span className="text-xs text-gray-400 w-8 text-right">{pct}%</span>
                        </div>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div className="h-1.5 rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, background: d.fill }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Monthly trend */}
          {!loadingSummary && summary && (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <h3 className="text-sm font-semibold text-gray-700">Tendencia — 12 meses</h3>
                <ChartTypePicker value={trendType} onChange={setTrendType} />
              </div>
              <TrendChart />
            </div>
          )}
        </div>

        {/* ── Right panel: visits table ── */}
        <div className="lg:col-span-2 space-y-3">

          {/* Filters */}
          <div className="card p-4 flex items-center gap-3 flex-wrap">
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
            <input
              type="date" value={dateFilter}
              onChange={e => { setDateFilter(e.target.value); setPage(1) }}
              className="input sm:w-44"
            />
            {(dateFilter || search) && (
              <button onClick={() => { setDateFilter(''); setSearch(''); setPage(1) }} className="btn-ghost text-xs flex items-center gap-1">
                <X className="w-3 h-3" /> Limpiar
              </button>
            )}
            {(dateFilter || search) && (
              <span className="ml-auto text-xs text-gray-500">{visits.length} resultado{visits.length !== 1 ? 's' : ''}</span>
            )}
          </div>

          {/* Table */}
          <div className="card overflow-hidden">
            {isLoading ? (
              <div className="flex justify-center items-center h-40">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
              </div>
            ) : visits.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                <Clock className="w-8 h-8 mb-2 opacity-30" />
                <p className="text-sm">Sin visitas registradas</p>
                <button onClick={() => openModal('search')} className="mt-3 btn-primary text-xs py-1.5 px-3">
                  Registrar primera visita
                </button>
              </div>
            ) : (
              <>
                {/* Desktop/tablet — full table */}
                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b-2 border-gray-100">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Miembro</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Fecha y hora</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Tipo</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Membresía</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Entrenador</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Precio</th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {visits.map((v, idx) => (
                        <tr key={v.id} className={`border-b border-gray-50 hover:bg-emerald-50/30 transition-colors group ${idx % 2 === 1 ? 'bg-gray-50/40' : ''}`}>
                          <td className="px-4 py-3.5 align-top w-full max-w-0">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 text-xs font-bold flex-shrink-0">
                                {v.member?.first_name?.[0]}{v.member?.last_name?.[0]}
                              </div>
                              <span className="font-medium text-gray-800 truncate">
                                {v.member ? `${v.member.first_name} ${v.member.last_name}` : '—'}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 align-top text-gray-600 tabular-nums text-xs">
                            {new Date(v.visit_date).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
                          </td>
                          <td className="px-4 py-3.5 align-top">
                            <span className={`badge ${VISIT_COLORS[v.visit_type] ?? 'badge-gray'}`}>
                              {VISIT_LABELS[v.visit_type] ?? v.visit_type}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 align-top">
                            {v.has_active_membership ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                                <ShieldCheck className="w-3 h-3" /> Activa
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-400">
                                Sin membresía
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 align-top text-gray-500 text-xs hidden lg:table-cell">
                            {v.trainer ? `${v.trainer.first_name} ${v.trainer.last_name}` : '—'}
                          </td>
                          <td className="px-4 py-3.5 align-top hidden lg:table-cell">
                            <PriceCell visit={v} />
                          </td>
                          <td className="px-4 py-3.5 align-top text-right">
                            <button onClick={() => setDeleteTarget(v)}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile — stacked cards, no horizontal scroll */}
                <div className="lg:hidden divide-y divide-gray-100">
                  {visits.map(v => (
                    <div key={v.id} className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 text-xs font-bold flex-shrink-0">
                            {v.member?.first_name?.[0]}{v.member?.last_name?.[0]}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-gray-800 truncate">
                              {v.member ? `${v.member.first_name} ${v.member.last_name}` : '—'}
                            </p>
                            <p className="text-xs text-gray-500 tabular-nums">
                              {new Date(v.visit_date).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
                            </p>
                          </div>
                        </div>
                        <button onClick={() => setDeleteTarget(v)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 flex-shrink-0">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                        <span className={`badge ${VISIT_COLORS[v.visit_type] ?? 'badge-gray'}`}>
                          {VISIT_LABELS[v.visit_type] ?? v.visit_type}
                        </span>
                        {v.has_active_membership ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                            <ShieldCheck className="w-3 h-3" /> Activa
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-400">
                            Sin membresía
                          </span>
                        )}
                        {v.trainer && (
                          <span className="text-xs text-gray-500">
                            · {v.trainer.first_name} {v.trainer.last_name}
                          </span>
                        )}
                      </div>

                      <div className="mt-2.5">
                        <PriceCell visit={v} />
                      </div>
                    </div>
                  ))}
                </div>

                {pagination && pagination.last > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/50">
                    <p className="text-xs text-gray-500">Página {pagination.current} de {pagination.last} · {pagination.total} registros</p>
                    <div className="flex gap-2">
                      <button onClick={() => setPage(p => p - 1)} disabled={page <= 1} className="btn-secondary py-1.5 px-3 disabled:opacity-40">
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button onClick={() => setPage(p => p + 1)} disabled={page >= pagination.last} className="btn-secondary py-1.5 px-3 disabled:opacity-40">
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {showModal && <RegisterVisitModal onClose={() => setShowModal(false)} initialTab={modalTab} />}
      {deleteTarget && (
        <ConfirmModal
          title="¿Eliminar visita?"
          message="Esta acción eliminará el registro de visita permanentemente."
          onConfirm={() => { deleteMutation.mutate(deleteTarget.id); setDeleteTarget(null) }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
