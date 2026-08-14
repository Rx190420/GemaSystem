import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { X, Search, Loader2, CreditCard, CheckCircle2, UserPlus, Users, ChevronDown, Check, Mail, MessageCircle } from 'lucide-react'
import ChipSelect from './ChipSelect'
import PaymentPanel from './PaymentPanel'
import toast from 'react-hot-toast'
import api from '../api/axios'
import { useSettingsStore } from '../store/settingsStore'
import useLockBodyScroll from '../hooks/useLockBodyScroll'

const PLANS = [
  { id: 'weekly',    label: 'Semana',     days: 7,    color: 'border-teal-400 bg-teal-50 text-teal-700' },
  { id: 'biweekly',  label: 'Quincena',   days: 15,   color: 'border-cyan-400 bg-cyan-50 text-cyan-700' },
  { id: 'monthly',   label: 'Mensual',    months: 1,  color: 'border-blue-400 bg-blue-50 text-blue-700' },
  { id: 'quarterly', label: 'Trimestral', months: 3,  color: 'border-indigo-400 bg-indigo-50 text-indigo-700' },
  { id: 'biannual',  label: 'Semestral',  months: 6,  color: 'border-violet-400 bg-violet-50 text-violet-700' },
  { id: 'annual',    label: 'Anual',      months: 12, color: 'border-purple-400 bg-purple-50 text-purple-700' },
]

function localToday() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function calcEndDate(dateStr, plan) {
  if (!dateStr || !plan) return ''
  const [y, m, day] = dateStr.split('-').map(Number)
  const d = new Date(y, m - 1, day)
  if (plan.days) d.setDate(d.getDate() + plan.days)
  else d.setMonth(d.getMonth() + (plan.months ?? 1))
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * The membership form + its checkout step, with no modal chrome of its own —
 * embeddable inline wherever a membership needs to be sold (the standalone
 * `QuickMembershipModal` below, and the QR-scan renewal flow in Visits.jsx),
 * so a checkout step never has to open as a second overlay on top of another
 * modal. Two internal steps: 'form' (who/what plan) → 'payment' (cobro).
 */
export function QuickMembershipBody({ initialMember = null, onDone, onCancel }) {
  const qc = useQueryClient()
  const { systemSettings } = useSettingsStore()

  const [step, setStep]           = useState('form') // 'form' | 'payment'
  const [mode, setMode]           = useState('existing') // 'existing' | 'new'
  const [q, setQ]                 = useState('')
  const [member, setMember]       = useState(initialMember)
  const [firstName, setFirst]     = useState('')
  const [lastName, setLast]       = useState('')
  const [email, setEmail]         = useState('')
  const [phone, setPhone]         = useState('')
  const [gender, setGender]       = useState('')
  const [birthDate, setBirth]     = useState('')
  const [address, setAddress]     = useState('')
  const [ecName, setEcName]       = useState('')
  const [ecPhone, setEcPhone]     = useState('')
  const [plan, setPlan]           = useState('monthly')
  const [membershipType, setType] = useState('Básica')
  const [startDate, setStart]   = useState(localToday())
  const [amount, setAmount]     = useState('')
  const [submitting, setSub]    = useState(false)
  const [discountCat, setDiscountCat]     = useState('')
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
    const val = systemSettings?.[`price_membership_${plan}`]
    if (val && val !== '0') setAmount(String(val))
    setType(t => {
      if (t !== 'VIP') return ['annual', 'biannual'].includes(plan) ? 'Premium' : 'Básica'
      return t
    })
  }, [plan, systemSettings])

  const { data: members = [], isFetching } = useQuery({
    queryKey: ['quick-search', q],
    queryFn: () => q.length >= 2
      ? api.get('/members/search', { params: { q } }).then(r => r.data)
      : [],
    enabled: q.length >= 2,
  })

  const selectedPlan = PLANS.find(p => p.id === plan) ?? PLANS[0]
  const endDate = calcEndDate(startDate, selectedPlan)

  function switchMode(m) {
    setMode(m)
    setMember(null)
    setQ('')
    setFirst(''); setLast(''); setEmail(''); setPhone('')
    setGender(''); setBirth(''); setAddress(''); setEcName(''); setEcPhone('')
  }

  function goToPayment() {
    if (!amount || isNaN(amount) || Number(amount) <= 0) return toast.error('Ingresa un monto válido')
    if (mode === 'existing' && !member) return toast.error('Selecciona un miembro')
    if (mode === 'new' && (!firstName.trim() || !lastName.trim())) return toast.error('Nombre y apellido son obligatorios')
    setStep('payment')
  }

  async function handleConfirm({ payment_method, amount_paid }) {
    setSub(true)
    try {
      let memberId, displayName, createdMember = null
      if (mode === 'existing') {
        memberId    = member.id
        displayName = member.first_name
      } else {
        const { data: newMember } = await api.post('/members', {
          first_name:               firstName.trim(),
          last_name:                lastName.trim(),
          email:                    email.trim()   || null,
          phone:                    phone.trim()   || null,
          gender:                   gender         || null,
          birth_date:               birthDate      || null,
          address:                  address.trim() || null,
          emergency_contact_name:   ecName.trim()  || null,
          emergency_contact_phone:  ecPhone.trim() || null,
          membership_type:          membershipType,
          discount_category:        discountCat.trim() || null,
        })
        memberId    = newMember.id
        displayName = newMember.first_name
        createdMember = newMember
      }
      await api.post('/memberships', {
        member_id:       memberId,
        type:            plan,
        start_date:      startDate,
        end_date:        endDate,
        amount:          Number(amount),
        amount_paid,
        payment_method,
        membership_type: membershipType,
      })
      try { await api.post('/visits', { member_id: memberId, visit_type: 'training' }) } catch { /* best-effort visit log, membership already saved */ }
      toast.success(`Membresía ${selectedPlan.label} registrada`)
      qc.invalidateQueries(['memberships'])
      qc.invalidateQueries(['membership-summary'])
      qc.invalidateQueries(['members'])
      qc.invalidateQueries(['visits'])
      qc.invalidateQueries(['visit-summary'])
      if (createdMember) {
        if (notifyEmail && createdMember.email)
          api.post(`/members/${createdMember.id}/notify`, { type: 'qr', channel: 'email' }).catch(() => {})
        if (notifyWa && createdMember.phone)
          api.post(`/members/${createdMember.id}/notify`, { type: 'qr', channel: 'whatsapp' }).catch(() => {})
      }
      onDone(displayName, selectedPlan.label)
    } catch (err) {
      const msg = Object.values(err.response?.data?.errors ?? {}).flat()[0]
      toast.error(msg ?? 'Error al registrar membresía')
      setStep('form')
    } finally {
      setSub(false)
    }
  }

  if (step === 'payment') {
    const displayName = mode === 'existing' ? `${member.first_name} ${member.last_name}` : `${firstName} ${lastName}`
    return (
      <PaymentPanel
        amount={Number(amount) || 0}
        title={initialMember ? 'Renovar membresía' : 'Cobrar membresía'}
        subtitle={`${displayName} · ${selectedPlan.label}`}
        onConfirm={handleConfirm}
        onBack={() => setStep('form')}
        onCancel={onCancel}
        loading={submitting}
        confirmLabel="Confirmar cobro y registrar"
      />
    )
  }

  return (
    <div className="space-y-5">

      {/* Toggle nuevo / existente — oculto cuando ya viene un socio fijo (ej. renovación desde QR) */}
      {!initialMember && (
        <div className="flex rounded-xl border border-gray-200 bg-gray-50 p-1 gap-1">
          <button
            type="button"
            onClick={() => switchMode('existing')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all
              ${mode === 'existing' ? 'bg-white shadow text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <Users className="w-4 h-4" /> Ya es miembro
          </button>
          <button
            type="button"
            onClick={() => switchMode('new')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all
              ${mode === 'new' ? 'bg-white shadow text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <UserPlus className="w-4 h-4" /> Nuevo miembro
          </button>
        </div>
      )}

      {/* Miembro existente: buscador */}
      {mode === 'existing' && (
        <div>
          <label className="label">Miembro</label>
          {member ? (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-indigo-50 border border-indigo-100">
              <div className="w-9 h-9 rounded-full bg-indigo-200 flex items-center justify-center text-indigo-800 font-bold text-sm flex-shrink-0">
                {member.first_name[0]}{member.last_name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 text-sm">{member.first_name} {member.last_name}</p>
                {member.member_code && <p className="text-xs font-mono text-indigo-500">{member.member_code}</p>}
              </div>
              {!initialMember && (
                <button onClick={() => setMember(null)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ) : (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="Buscar por nombre o DYM-XXXX..."
                className="input pl-9"
                autoFocus
              />
              {isFetching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300 animate-spin" />
              )}
              {members.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10 max-h-44 overflow-y-auto">
                  {members.map(m => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => { setMember(m); setQ('') }}
                      className="w-full text-left px-3 py-2.5 hover:bg-gray-50 flex items-center gap-3"
                    >
                      <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-bold flex-shrink-0">
                        {m.first_name[0]}{m.last_name[0]}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{m.first_name} {m.last_name}</p>
                        <p className="text-xs text-gray-400">{m.member_code ?? m.email ?? '—'}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Nuevo miembro: campos */}
      {mode === 'new' && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Nombre *</label>
              <input value={firstName} onChange={e => setFirst(e.target.value)} placeholder="Nombre" className="input" />
            </div>
            <div>
              <label className="label">Apellido *</label>
              <input value={lastName} onChange={e => setLast(e.target.value)} placeholder="Apellido" className="input" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Correo</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="correo@ejemplo.com" className="input" />
            </div>
            <div>
              <label className="label">Teléfono</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+52 55..." className="input" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Género</label>
              <select value={gender} onChange={e => setGender(e.target.value)} className="input">
                <option value="">Sin especificar</option>
                <option value="male">Masculino</option>
                <option value="female">Femenino</option>
                <option value="other">Otro</option>
              </select>
            </div>
            <div>
              <label className="label">Fecha de nacimiento</label>
              <input type="date" value={birthDate} onChange={e => setBirth(e.target.value)} className="input" />
            </div>
          </div>
          <div>
            <label className="label">Dirección</label>
            <input value={address} onChange={e => setAddress(e.target.value)} placeholder="Calle, ciudad, estado" className="input" />
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
                  <input value={ecName} onChange={e => setEcName(e.target.value)} placeholder="Nombre completo" className="input" />
                </div>
                <div>
                  <label className="label">Tel. emergencia</label>
                  <input value={ecPhone} onChange={e => setEcPhone(e.target.value)} placeholder="+52 55..." className="input" />
                </div>
              </div>
            )}
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
        </div>
      )}

      {/* Tipo de membresía */}
      <div>
        <label className="label">Tipo de membresía</label>
        <ChipSelect
          options={membershipTypes}
          value={membershipType}
          onChange={setType}
          onAdd={async name => {
            await api.post('/membership-types', { name })
            qc.invalidateQueries(['membership-types'])
            setType(name)
          }}
          placeholder="Nuevo tipo..."
        />
      </div>

      {/* Categoría de descuento */}
      <div>
        <label className="label">Categoría de descuento <span className="text-gray-400 font-normal">(opcional)</span></label>
        <ChipSelect
          options={discountCategories}
          value={discountCat}
          onChange={v => setDiscountCat(v)}
          onAdd={async name => {
            await api.post('/discount-categories', { name, discount_percent: 0 })
            qc.invalidateQueries(['discount-categories'])
            setDiscountCat(name)
          }}
          allowNone
          subLabel={opt => opt.discount_percent > 0 ? `-${parseFloat(opt.discount_percent).toFixed(0)}%` : null}
          placeholder="Nueva categoría..."
        />
      </div>

      {/* Plan selector */}
      <div>
        <label className="label">Plan</label>
        <div className="grid grid-cols-2 gap-2">
          {PLANS.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPlan(p.id)}
              className={`px-3 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all text-center
                ${plan === p.id ? p.color + ' border-current' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
            >
              {p.label}
              <span className="block text-xs font-normal mt-0.5 opacity-70">
                {p.days ? `${p.days} días` : `${p.months} ${p.months === 1 ? 'mes' : 'meses'}`}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="label">Fecha inicio</label>
          <input
            type="date"
            value={startDate}
            onChange={e => setStart(e.target.value)}
            className="input"
          />
        </div>
        <div>
          <label className="label">Fecha fin</label>
          <input
            type="date"
            value={endDate}
            readOnly
            className="input bg-gray-50 text-gray-500 cursor-default"
          />
        </div>
      </div>

      {/* Amount */}
      <div>
        <label className="label">Monto ($)</label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          placeholder="0.00"
          className="input"
        />
      </div>

      {/* Footer */}
      <div className="flex gap-3 pt-1">
        {onCancel && <button onClick={onCancel} className="btn-secondary flex-1">Cancelar</button>}
        <button
          onClick={goToPayment}
          disabled={!amount || (mode === 'existing' ? !member : !firstName.trim() || !lastName.trim())}
          className="btn-primary flex-1"
        >
          Continuar al cobro
        </button>
      </div>
    </div>
  )
}

// ── Standalone modal wrapper (FAB quick actions) ─────────────────────────────
export default function QuickMembershipModal({ onClose, initialMember = null }) {
  useLockBodyScroll()
  const [done, setDone]         = useState(false)
  const [doneText, setDoneText] = useState('')

  function handleDone(displayName, planLabel) {
    setDoneText(`${displayName} · ${planLabel}`)
    setDone(true)
    setTimeout(onClose, 1600)
  }

  if (done) {
    return (
      <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 flex flex-col items-center gap-3" onClick={e => e.stopPropagation()}>
          <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center">
            <CheckCircle2 className="w-9 h-9 text-indigo-600" />
          </div>
          <p className="text-lg font-semibold text-gray-900">¡Membresía registrada!</p>
          <p className="text-sm text-gray-500">{doneText}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
              <CreditCard className="w-4 h-4 text-indigo-600" />
            </div>
            <h2 className="text-base font-semibold text-gray-900">{initialMember ? 'Renovar membresía' : 'Nueva membresía'}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <QuickMembershipBody initialMember={initialMember} onDone={handleDone} onCancel={onClose} />
        </div>
      </div>
    </div>
  )
}
