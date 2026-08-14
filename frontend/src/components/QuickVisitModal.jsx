import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import * as yup from 'yup'
import jsQR from 'jsqr'
import {
  X, Search, QrCode, Camera, CheckCircle2, Check,
  Loader2, DollarSign, UserPlus, ShieldCheck, AlertCircle, User, Lock,
  Mail, MessageCircle, ChevronDown, RefreshCw,
} from 'lucide-react'
import ChipSelect from './ChipSelect'
import PaymentPanel from './PaymentPanel'
import MembershipDecisionPanel, { MembershipStatusBanner } from './MembershipDecisionPanel'
import { QuickMembershipBody } from './QuickMembershipModal'
import toast from 'react-hot-toast'
import api from '../api/axios'
import { useSettingsStore } from '../store/settingsStore'
import useLockBodyScroll from '../hooks/useLockBodyScroll'

const TABS = [
  { id: 'qr',     label: 'Escanear QR',   icon: QrCode },
  { id: 'search', label: 'Buscar miembro', icon: Search },
  { id: 'new',    label: 'Nuevo miembro',  icon: UserPlus },
]

const VISIT_LABELS = { training: 'Entrenamiento', class: 'Clase', consultation: 'Consulta', other: 'Otro' }

// ── QR Camera Tab ────────────────────────────────────────────
function QRCameraTab({ onSuccess }) {
  const videoRef   = useRef(null)
  const canvasRef  = useRef(null)
  const rafRef     = useRef(null)
  const streamRef  = useRef(null)
  const [status, setStatus]         = useState('starting')
  const [result, setResult]         = useState(null)
  const [camError, setCamError]     = useState({ title: '', hint: '', blocked: false })
  const [pendingQR, setPendingQR]   = useState(null)   // { member, token, lastMembership } awaiting a decision
  const [confirmingQR, setConfirm]  = useState(false)
  // What's showing below the camera once a scan needs a decision — never a
  // separate overlay, always swapped in place so nothing stacks on the modal.
  const [flowStep, setFlowStep]     = useState(null)   // null | 'decision' | 'payment' | 'renew'
  const qc = useQueryClient()
  const { systemSettings } = useSettingsStore()

  const startScan = useCallback(() => {
    const video  = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    function tick() {
      if (video.readyState !== video.HAVE_ENOUGH_DATA) {
        rafRef.current = requestAnimationFrame(tick); return
      }
      canvas.width  = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const code = jsQR(imageData.data, canvas.width, canvas.height)
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

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
  }, [])

  const initCamera = useCallback(async () => {
    setStatus('starting')
    setCamError({ title: '', hint: '', blocked: false })
    stopStream()

    if (!navigator.mediaDevices?.getUserMedia) {
      setCamError({ title: 'Cámara no disponible', hint: 'Tu navegador no soporta acceso a cámara. Usa Chrome o Edge actualizados.', blocked: false })
      setStatus('error'); return
    }

    const constraints = [
      { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } } },
      { video: true },
    ]

    let stream = null, lastErr = null
    for (const c of constraints) {
      try { stream = await navigator.mediaDevices.getUserMedia(c); break }
      catch (e) { lastErr = e }
    }

    if (!stream) {
      const name = lastErr?.name ?? ''
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setCamError({ title: 'Permiso de cámara bloqueado', hint: 'Haz clic en el ícono de cámara bloqueada en la barra de direcciones, permite el acceso y recarga la página.', blocked: true })
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        setCamError({ title: 'No se encontró cámara', hint: 'Este dispositivo no tiene cámara o no está conectada. Usa la pestaña "Buscar miembro" en su lugar.', blocked: false })
      } else if (name === 'NotReadableError' || name === 'TrackStartError') {
        setCamError({ title: 'Cámara en uso', hint: 'Otra aplicación está usando la cámara. Ciérrala e intenta de nuevo.', blocked: false })
      } else {
        setCamError({ title: 'No se pudo iniciar la cámara', hint: 'Verifica que el navegador tenga permiso de cámara para este sitio.', blocked: false })
      }
      setStatus('error'); return
    }

    streamRef.current = stream
    if (videoRef.current) {
      videoRef.current.srcObject = stream
      await videoRef.current.play()
      setStatus('scanning')
      startScan()
    }
  }, [startScan, stopStream])

  useEffect(() => { initCamera(); return stopStream }, [initCamera, stopStream])

  async function confirmQRPayment({ payment_method, amount_paid }) {
    if (!pendingQR) return
    setConfirm(true)
    const defaultPrice = parseFloat(systemSettings?.price_visit_training || '0') || 0
    try {
      const r = await api.post('/members/scan-qr', {
        token: pendingQR.token,
        confirmed: true,
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
      setConfirm(false)
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
    <div className="flex flex-col items-center gap-4 py-8 px-4 text-center">
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${camError.blocked ? 'bg-amber-100' : 'bg-red-100'}`}>
        <Camera className={`w-7 h-7 ${camError.blocked ? 'text-amber-600' : 'text-red-500'}`} />
      </div>
      <div>
        <p className="text-sm font-semibold text-gray-800">{camError.title}</p>
        <p className="text-xs text-gray-500 mt-1.5 max-w-xs leading-relaxed">{camError.hint}</p>
      </div>
      {camError.blocked ? (
        <div className="w-full rounded-xl bg-amber-50 border border-amber-200 p-3 text-left space-y-1.5">
          <p className="text-xs font-semibold text-amber-800">Cómo desbloquear:</p>
          <ol className="text-xs text-amber-700 space-y-1 list-decimal list-inside leading-relaxed">
            <li>Haz clic en el ícono de candado <strong><Lock className="w-3 h-3 inline-block align-text-bottom" /></strong> en la barra de URL</li>
            <li>Busca <strong>"Cámara"</strong> y cámbialo a <strong>"Permitir"</strong></li>
            <li>Recarga la página y vuelve a intentarlo</li>
          </ol>
        </div>
      ) : (
        <button onClick={initCamera} className="btn-secondary text-sm">
          <Camera className="w-4 h-4" /> Reintentar
        </button>
      )}
    </div>
  )

  if (status === 'found' && result) {
    const m = result.member
    const v = result.visit
    return (
      <div className="flex flex-col items-center gap-4 py-8 px-4 text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
          <CheckCircle2 className="w-9 h-9 text-emerald-600" />
        </div>
        <div>
          <p className="text-lg font-semibold text-gray-900">{result.renewed ? '¡Membresía renovada!' : '¡Visita registrada!'}</p>
          <p className="text-sm text-gray-500 mt-1">{m.first_name} {m.last_name}</p>
          {m.member_code && (
            <span className="inline-block mt-1 text-xs font-mono bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">
              {m.member_code}
            </span>
          )}
          {result.renewed ? (
            <div className="mt-2 flex items-center justify-center gap-1.5 text-xs text-indigo-600">
              <RefreshCw className="w-3.5 h-3.5" />
              {result.renewed} · visita anotada
            </div>
          ) : result.has_active_membership ? (
            <div className="mt-2 flex items-center justify-center gap-1.5 text-xs text-emerald-600">
              <ShieldCheck className="w-3.5 h-3.5" /> Cubierto por membresía activa
            </div>
          ) : v?.price > 0 && (
            <p className="mt-2 text-sm font-semibold text-emerald-600">
              ${parseFloat(v.price).toLocaleString('es-MX', { minimumFractionDigits: 2 })} cobrado
            </p>
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
    <div className="space-y-3">
      <div className="relative bg-black rounded-xl overflow-hidden aspect-video">
        <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-52 h-52 border-2 border-white/40 rounded-2xl relative">
            <span className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-indigo-400 rounded-tl-lg" />
            <span className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-indigo-400 rounded-tr-lg" />
            <span className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-indigo-400 rounded-bl-lg" />
            <span className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-indigo-400 rounded-br-lg" />
            {status === 'scanning' && (
              <span className="absolute inset-x-0 top-0 h-0.5 bg-indigo-400/80"
                style={{ animation: 'scan 2s ease-in-out infinite' }} />
            )}
          </div>
        </div>
        {status === 'starting' && (
          <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
            <span className="text-white/70 text-xs">Iniciando cámara...</span>
          </div>
        )}
        {status === 'processing' && (
          <div className="absolute inset-0 bg-black/70 flex items-center justify-center gap-2">
            <Loader2 className="w-6 h-6 text-white animate-spin" />
            <span className="text-white text-sm">Verificando membresía...</span>
          </div>
        )}
      </div>
      <canvas ref={canvasRef} className="hidden" />
      <p className="text-xs text-center text-gray-400">
        Coloca el código QR del miembro dentro del marco
      </p>
    </div>
  )
}

// ── Search Tab ───────────────────────────────────────────────
function SearchTab({ onSuccess }) {
  const qc = useQueryClient()
  const { systemSettings } = useSettingsStore()
  const [q, setQ]                       = useState('')
  const [selected, setSelected]         = useState(null)
  const [visitType, setVisitType]       = useState('training')
  const [classId, setClassId]           = useState('')
  const [price, setPrice]               = useState('')
  const [submitting, setSubmitting]     = useState(false)
  const [membershipInfo, setMemInfo]    = useState(null)
  const [fetchingMem, setFetchingMem]   = useState(false)
  const [step, setStep]                 = useState('form') // 'form' | 'payment'

  useEffect(() => {
    if (membershipInfo?.has_active_membership) return
    const val = systemSettings?.[`price_visit_${visitType}`]
    setPrice(val && val !== '0' ? String(val) : '')
  }, [visitType, systemSettings, membershipInfo])

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
    queryKey: ['quick-search', q],
    queryFn: () => q.length >= 2
      ? api.get('/members/search', { params: { q } }).then(r => r.data)
      : [],
    enabled: q.length >= 2,
  })

  const { data: classes = [] } = useQuery({
    queryKey: ['classes-list'],
    queryFn: () => api.get('/classes').then(r => r.data),
  })

  const hasMembership = membershipInfo?.has_active_membership === true

  async function doRegister({ payment_method, amount_paid } = {}) {
    setSubmitting(true)
    try {
      const payload = { member_id: selected.id, visit_type: visitType }
      if (visitType === 'class' && classId) payload.class_id = parseInt(classId)
      if (!hasMembership) {
        payload.price = parseFloat(price || 0)
      }
      if (!hasMembership && payment_method) {
        payload.payment_method = payment_method
        payload.amount_paid = amount_paid
      }
      await api.post('/visits', payload)
      const priceStr = !hasMembership && price && parseFloat(price) > 0
        ? ` · $${parseFloat(price).toFixed(2)}`
        : hasMembership ? ' · membresía activa' : ''
      toast.success(`Visita de ${selected.first_name} registrada${priceStr}`)
      qc.invalidateQueries(['visits'])
      qc.invalidateQueries(['visit-summary'])
      onSuccess()
    } catch {
      toast.error('Error al registrar visita')
      setStep('form')
    } finally {
      setSubmitting(false)
    }
  }

  function handleRegister() {
    if (!selected) return
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
        <label className="label">Buscar por nombre o ID (DYM-XXXX)</label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={q}
            onChange={e => { setQ(e.target.value); setSelected(null) }}
            placeholder="Nombre, apellido o DYM-0001..."
            className="input pl-9"
            autoFocus
          />
          {isFetching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
          )}
        </div>

        {members.length > 0 && !selected && (
          <div className="mt-1 border border-gray-200 rounded-lg overflow-hidden shadow-sm max-h-44 overflow-y-auto">
            {members.map(m => (
              <button
                key={m.id} type="button"
                onClick={() => { setSelected(m); setQ('') }}
                className="w-full text-left px-3 py-2.5 hover:bg-gray-50 flex items-center gap-3 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-bold flex-shrink-0">
                  {m.first_name[0]}{m.last_name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{m.first_name} {m.last_name}</p>
                  <p className="text-xs text-gray-400">{m.member_code ?? m.email ?? m.phone}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  m.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
                }`}>{m.status === 'active' ? 'Activo' : 'Inactivo'}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <div className="bg-indigo-50 rounded-xl p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-indigo-200 flex items-center justify-center text-indigo-800 font-bold text-sm flex-shrink-0">
            {selected.first_name[0]}{selected.last_name[0]}
          </div>
          <div className="flex-1">
            <p className="font-semibold text-gray-900 text-sm">{selected.first_name} {selected.last_name}</p>
            {selected.member_code && (
              <p className="text-xs font-mono text-indigo-600">{selected.member_code}</p>
            )}
          </div>
          {fetchingMem && <Loader2 className="w-4 h-4 text-indigo-400 animate-spin flex-shrink-0" />}
          <button onClick={() => { setSelected(null); setMemInfo(null) }} className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {selected && !fetchingMem && membershipInfo && (
        <MembershipStatusBanner
          memberStatus={membershipInfo.member_status}
          hasMembership={hasMembership}
          lastMembership={membershipInfo.last_membership}
        />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="label">Tipo de visita</label>
          <select value={visitType} onChange={e => { setVisitType(e.target.value); setClassId('') }} className="input">
            <option value="training">Entrenamiento</option>
            <option value="class">Clase</option>
            <option value="consultation">Consulta</option>
            <option value="other">Otro</option>
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
            <input
              type="number" min="0" step="0.01"
              value={price} onChange={e => setPrice(e.target.value)}
              placeholder="0.00" className="input"
            />
          )}
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

      <button
        onClick={handleRegister}
        disabled={!selected || submitting || fetchingMem}
        className="btn-primary w-full"
      >
        {!hasMembership
          ? 'Continuar al cobro'
          : submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Registrando...</> : 'Registrar visita'}
      </button>
    </div>
  )
}

// ── New Member Tab ───────────────────────────────────────────
const newSchema = yup.object({
  first_name:               yup.string().required('Obligatorio'),
  last_name:                yup.string().required('Obligatorio'),
  email:                    yup.string().email('Correo inválido').nullable(),
  phone:                    yup.string().nullable(),
  membership_type:          yup.string().required('Tipo obligatorio'),
  discount_category:        yup.string().nullable(),
  gender:                   yup.string().oneOf(['male', 'female', 'other', '']).nullable(),
  birth_date:               yup.string().nullable(),
  address:                  yup.string().nullable(),
  emergency_contact_name:   yup.string().nullable(),
  emergency_contact_phone:  yup.string().nullable(),
})

function NewMemberTab({ onSuccess }) {
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
      discount_category: '', gender: '', birth_date: '', address: '',
      emergency_contact_name: '', emergency_contact_phone: '',
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
      const errors = err.response?.data?.errors
      const msg = errors
        ? Object.values(errors).flat()[0]
        : (err.response?.data?.message ?? 'Error al guardar')
      toast.error(msg)
      setStep('form')
    } finally {
      setSubmitting(false)
    }
  }

  function onSubmit(data) {
    if (parseFloat(price || 0) > 0) {
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Teléfono</label>
            <input {...register('phone')} className="input" placeholder="+52 55..." />
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

        <div>
          <label className="label">Fecha de nacimiento</label>
          <input {...register('birth_date')} type="date" className="input" />
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
          <label className="label">Dirección</label>
          <input {...register('address')} className="input" placeholder="Calle, ciudad, estado" />
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
          <input
            type="number" min="0" step="0.01"
            value={price} onChange={e => setPrice(e.target.value)}
            placeholder="0.00" className="input"
          />
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

// ── Main Modal ───────────────────────────────────────────────
export default function QuickVisitModal({ onClose }) {
  const [tab, setTab] = useState('search')
  useLockBodyScroll()

  function handleSuccess() {
    setTimeout(onClose, 1800)
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Acciones rápidas</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex border-b">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors border-b-2 -mb-px
                ${tab === t.id
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {tab === 'qr'     && <QRCameraTab   onSuccess={handleSuccess} />}
          {tab === 'search' && <SearchTab     onSuccess={handleSuccess} />}
          {tab === 'new'    && <NewMemberTab  onSuccess={handleSuccess} />}
        </div>
      </div>
    </div>
  )
}
