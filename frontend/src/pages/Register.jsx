import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import * as yup from 'yup'
import ReCAPTCHA from 'react-google-recaptcha'
import {
  Dumbbell, Check, Eye, EyeOff, Loader2, Shield,
  CreditCard, ArrowRight, X, Lock, BadgeCheck, Zap,
  Building2, User, Mail, KeyRound, RefreshCcw, IdCard,
} from 'lucide-react'
import api from '../api/axios'
import useLockBodyScroll from '../hooks/useLockBodyScroll'

const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY

// ─── Plans ────────────────────────────────────────────────────────────────────

const PLANS = {
  weekly: {
    id: 'weekly', name: 'Semanal', price: '$417', originalPrice: '$699', period: '/semana',
    subtext: 'MXN · sin contrato', badge: null, saving: 'Ahorras $282',
    features: ['Miembros ilimitados', 'Control de visitas QR', 'Membresías flexibles', 'Exportar básico', 'Soporte estándar'],
  },
  monthly: {
    id: 'monthly', name: 'Mensual', price: '$1,622', originalPrice: '$2,499', period: '/mes',
    subtext: 'MXN · cancela cuando quieras', badge: 'Más popular', saving: 'Ahorras $877/mes',
    features: ['Todo lo de Semanal', 'Análisis financiero completo', 'Mapa de actividad', 'Exportar PDF y Excel', 'Clases y entrenadores', 'Modo privacidad', 'Soporte prioritario'],
  },
}

// ─── Password rules ───────────────────────────────────────────────────────────

const PASSWORD_RULES = [
  { re: /.{8,}/,         label: 'Mínimo 8 caracteres' },
  { re: /[A-Z]/,         label: 'Una mayúscula' },
  { re: /[a-z]/,         label: 'Una minúscula' },
  { re: /[0-9]/,         label: 'Un número' },
  { re: /[^A-Za-z0-9]/, label: 'Un símbolo' },
]

const strongPassword = yup.string()
  .required('Obligatorio')
  .test('strong', 'La contraseña no cumple los requisitos de seguridad', v =>
    !!v && PASSWORD_RULES.every(r => r.re.test(v))
  )

// ─── Schemas ──────────────────────────────────────────────────────────────────

const acceptTerms = yup.boolean()
  .oneOf([true], 'Debes aceptar los Términos y Condiciones para continuar')
  .required('Debes aceptar los Términos y Condiciones para continuar')

const recaptchaToken = yup.string().required('Verifica que no eres un robot')

const schemaNew = yup.object({
  gym_name:              yup.string().required('Nombre del gimnasio requerido').max(100),
  first_name:            yup.string().required('Requerido').max(100),
  paternal_surname:      yup.string().required('Requerido').max(100),
  maternal_surname:      yup.string().max(100),
  username:              yup.string().min(3, 'Mínimo 3 caracteres').max(50).required('Obligatorio'),
  email:                 yup.string().email('Correo inválido').required('Obligatorio'),
  password:              strongPassword,
  password_confirmation: yup.string()
    .oneOf([yup.ref('password')], 'Las contraseñas no coinciden').required('Obligatorio'),
  acceptTerms,
  recaptcha_token: recaptchaToken,
})

// Reactivation only needs the account's *existing* password to verify identity —
// it isn't creating a new one, so it must not enforce the new-password character rules.
const schemaReactivate = yup.object({
  email:    yup.string().email('Correo inválido').required('Obligatorio'),
  password: yup.string().required('Ingresa tu contraseña'),
  acceptTerms,
  recaptcha_token: recaptchaToken,
})

// ─── Password strength indicator ──────────────────────────────────────────────

function PasswordStrength({ password }) {
  if (!password) return null
  return (
    <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5">
      {PASSWORD_RULES.map(rule => {
        const ok = rule.re.test(password)
        return (
          <span key={rule.label} className={`flex items-center gap-1.5 text-[10px] transition-colors ${ok ? 'text-emerald-600' : 'text-gray-400'}`}>
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${ok ? 'bg-emerald-500' : 'bg-gray-300'}`} />
            {rule.label}
          </span>
        )
      })}
    </div>
  )
}

// ─── Live "already registered?" check ─────────────────────────────────────────
// Debounced so it doesn't fire on every keystroke — waits half a second of
// silence, then asks the backend. Purely advisory: the real, authoritative
// check still happens server-side on submit either way.
//
// Status is derived at render time from (eligible, checkedValue, result) rather
// than reset synchronously inside the effect — the effect only ever calls
// setState from inside the debounce timeout's async callback.
function useAvailability(field, value) {
  const [checkedValue, setCheckedValue] = useState('')
  const [result, setResult]             = useState(null) // null | true | false — for `checkedValue`

  const v        = (value ?? '').trim()
  const minLen    = field === 'email' ? 5 : 3
  const eligible  = v.length >= minLen && (field !== 'email' || v.includes('@'))

  useEffect(() => {
    if (!eligible) return
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.post('/auth/check-availability', { field, value: v })
        setResult(data.available)
        setCheckedValue(v)
      } catch {
        // network hiccup — leave the previous result, it's advisory only
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [field, v, eligible])

  if (!eligible) return 'idle'
  if (checkedValue !== v) return 'checking'
  if (result === null) return 'idle' // backend declined to judge (edge-case value) — no info, not stuck
  return result ? 'available' : 'taken'
}

function AvailabilityIcon({ status }) {
  if (status === 'checking')  return <Loader2 className="w-3.5 h-3.5 text-gray-400 animate-spin" />
  if (status === 'available') return <Check className="w-3.5 h-3.5 text-emerald-500" />
  if (status === 'taken')     return <X className="w-3.5 h-3.5 text-red-500" />
  return null
}

// ─── Field component ──────────────────────────────────────────────────────────

function Field({ label, error, icon: Icon, status, hint, children }) {
  return (
    <div className="group">
      <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</label>
      <div className="relative">
        {Icon && (
          <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 group-focus-within:text-indigo-400 pointer-events-none z-10 transition-colors" />
        )}
        {children}
        {status && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 z-10 flex items-center">
            <AvailabilityIcon status={status} />
          </span>
        )}
      </div>
      {error && (
        <p className="mt-1 text-[10px] text-red-500 flex items-center gap-1">
          <X className="w-2.5 h-2.5 flex-shrink-0" />{error}
        </p>
      )}
      {!error && hint}
    </div>
  )
}

// ─── Terms checkbox ───────────────────────────────────────────────────────────

function TermsCheckbox({ register, error, accentColor = '#4F46E5' }) {
  return (
    <div>
      <label className="flex items-start gap-2.5 cursor-pointer group">
        <input type="checkbox" {...register}
          style={{ accentColor }}
          className="mt-0.5 w-4 h-4 rounded border-gray-300 cursor-pointer flex-shrink-0" />
        <span className="text-xs text-gray-500 leading-relaxed">
          Acepto los{' '}
          <a href="/terminos" target="_blank" rel="noopener noreferrer"
            className="text-indigo-600 hover:text-indigo-700 font-semibold underline-offset-2 hover:underline">
            Términos y Condiciones
          </a>
          {' '}y el{' '}
          <a href="/privacidad" target="_blank" rel="noopener noreferrer"
            className="text-indigo-600 hover:text-indigo-700 font-semibold underline-offset-2 hover:underline">
            Aviso de Privacidad
          </a>
          {' '}de GemaSystem.
        </span>
      </label>
      {error && (
        <p className="mt-1 text-[10px] text-red-500 flex items-center gap-1 pl-6">
          <X className="w-2.5 h-2.5 flex-shrink-0" />{error}
        </p>
      )}
    </div>
  )
}

// ─── Plan Tabs ────────────────────────────────────────────────────────────────

function PlanTabs({ current, onChange }) {
  return (
    <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-gray-100">
      {Object.values(PLANS).map(p => {
        const active = current === p.id
        return (
          <button key={p.id} type="button" onClick={() => onChange(p.id)}
            className="relative flex flex-col items-center pt-3.5 pb-2.5 px-2 rounded-lg transition-all duration-200 hover:bg-white/70"
            style={active ? { background: '#fff', boxShadow: '0 2px 12px rgba(99,102,241,0.12)' } : {}}>
            {active && <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[3px] rounded-full bg-indigo-500" />}
            {p.badge && (
              <span className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[7px] font-extrabold text-white whitespace-nowrap"
                style={{ background: '#6366F1' }}>
                {p.badge}
              </span>
            )}
            <p className={`text-[9px] font-bold uppercase tracking-widest mb-1 transition-colors ${active ? 'text-indigo-500' : 'text-gray-400'}`}>
              {p.name}
            </p>
            <p className={`text-lg font-black leading-none transition-colors ${active ? 'text-indigo-600' : 'text-gray-300'}`}>
              {p.price}
            </p>
            <p className={`text-[9px] mt-0.5 transition-colors ${active ? 'text-gray-400' : 'text-gray-300'}`}>{p.period}</p>
          </button>
        )
      })}
    </div>
  )
}

// ─── Register modal ────────────────────────────────────────────────────────────

export default function RegisterModal({ onClose }) {
  useLockBodyScroll()
  const [searchParams, setSearchParams] = useSearchParams()
  const [planId, setPlanId] = useState(searchParams.get('plan') || 'monthly')
  const plan = PLANS[planId] || PLANS.monthly

  const [mode, setMode] = useState(searchParams.get('reactivate') === '1' ? 'reactivate' : 'new')

  const [showPassN, setShowPassN] = useState(false)
  const [showConfN, setShowConfN] = useState(false)
  const [showPassR, setShowPassR] = useState(false)
  const [loadingN, setLoadingN]   = useState(false)
  const [loadingR, setLoadingR]   = useState(false)
  const [apiErrorN, setApiErrorN] = useState(null)
  const [apiErrorR, setApiErrorR] = useState(null)

  const newForm   = useForm({ resolver: yupResolver(schemaNew) })
  const reactForm = useForm({ resolver: yupResolver(schemaReactivate) })

  const recaptchaRefN = useRef(null)
  const recaptchaRefR = useRef(null)

  const newPassword   = newForm.watch('password')

  // Only reveal each form's reCAPTCHA once its required fields are filled in and
  // terms are accepted — same progressive-disclosure pattern as the free-trial form,
  // so the security check reads as the natural last step instead of clutter up front.
  const [newGymName, newFirstName, newPaternalSurname, newUsername, newEmail, newPasswordConfirmation, newAcceptTerms] =
    newForm.watch(['gym_name', 'first_name', 'paternal_surname', 'username', 'email', 'password_confirmation', 'acceptTerms'])
  const newFormReady = !!(
    newGymName?.trim() && newFirstName?.trim() && newPaternalSurname?.trim() &&
    newUsername?.trim() && newEmail?.trim() &&
    newPassword?.trim() && newPasswordConfirmation?.trim() && newAcceptTerms
  )

  // Live "already registered?" hints — advisory only, server still validates on submit.
  const usernameStatus = useAvailability('username', newUsername)
  const emailStatus    = useAvailability('email', newEmail)

  const [reactEmail, reactPassword, reactAcceptTerms] =
    reactForm.watch(['email', 'password', 'acceptTerms'])
  const reactFormReady = !!(reactEmail?.trim() && reactPassword?.trim() && reactAcceptTerms)

  const close = onClose

  const selectPlan = (id) => {
    setSearchParams({ plan: id, ...(mode === 'reactivate' ? { reactivate: '1' } : {}) }, { replace: true })
    setPlanId(id)
  }

  const switchMode = (m) => {
    setMode(m)
    setApiErrorN(null)
    setApiErrorR(null)
    setSearchParams({ plan: planId, ...(m === 'reactivate' ? { reactivate: '1' } : {}) }, { replace: true })
  }

  // "This email already has an account" nudge under the email field links here —
  // jumps to the reactivation form with the email carried over instead of making
  // the user retype it.
  const suggestReactivate = () => {
    switchMode('reactivate')
    reactForm.setValue('email', newEmail)
  }

  const onSubmitNew = async ({ acceptTerms, ...data }) => {
    setLoadingN(true)
    setApiErrorN(null)
    try {
      const res = await api.post('/stripe/create-session', { ...data, plan_id: plan.id })
      window.location.href = res.data.url
    } catch (err) {
      const errs = err.response?.data?.errors
      setApiErrorN(errs ? Object.values(errs).flat()[0] : (err.response?.data?.message ?? 'Error al procesar. Intenta de nuevo.'))
      // reCAPTCHA tokens are single-use — force a fresh check before retrying.
      recaptchaRefN.current?.reset()
      newForm.setValue('recaptcha_token', '')
      setLoadingN(false)
    }
  }

  const onSubmitReactivate = async (data) => {
    setLoadingR(true)
    setApiErrorR(null)
    try {
      const res = await api.post('/stripe/create-session', {
        email: data.email,
        password: data.password,
        password_confirmation: data.password,
        recaptcha_token: data.recaptcha_token,
        plan_id: plan.id,
      })
      window.location.href = res.data.url
    } catch (err) {
      const errs = err.response?.data?.errors
      setApiErrorR(errs ? Object.values(errs).flat()[0] : (err.response?.data?.message ?? 'Error al procesar. Intenta de nuevo.'))
      recaptchaRefR.current?.reset()
      reactForm.setValue('recaptcha_token', '')
      setLoadingR(false)
    }
  }

  const inp    = 'w-full pl-9 pr-3.5 py-2.5 rounded-xl border text-[13px] text-gray-900 placeholder-gray-400 bg-gray-50 border-gray-200 hover:border-indigo-300 focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/15 outline-none transition-all duration-200'
  const inpErr = 'w-full pl-9 pr-3.5 py-2.5 rounded-xl border text-[13px] text-gray-900 placeholder-gray-400 bg-red-50 border-red-300 focus:border-red-400 focus:ring-2 focus:ring-red-500/15 outline-none transition-all duration-200'

  const n = newForm
  const r = reactForm

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-3 sm:p-4">
      <style>{`
        @keyframes modalIn { from { opacity:0; transform:scale(0.96) translateY(10px); } to { opacity:1; transform:scale(1) translateY(0); } }
        @keyframes regFadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        .reg-scroll::-webkit-scrollbar { width:0; height:0; }
        .reg-scroll { scrollbar-width:none; -ms-overflow-style:none; }
        .reg-fade-up { animation: regFadeUp 0.35s ease both; }
      `}</style>

      {/* ── Dim / blur overlay ── */}
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-lg" onClick={close} />

      {/* ── Modal ── */}
      <div className="relative w-full max-w-[900px] max-h-[calc(100vh-1.5rem)] sm:max-h-[calc(100vh-2rem)] z-10"
        style={{ animation: 'modalIn 0.3s cubic-bezier(0.34,1.56,0.64,1) both' }}>

        {/* Close button */}
        <button onClick={close}
          className="absolute -top-3 -right-3 z-20 w-8 h-8 rounded-full bg-white hover:bg-gray-50 shadow-lg border border-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-all">
          <X className="w-4 h-4" />
        </button>

        <div className="reg-scroll bg-white rounded-3xl shadow-2xl shadow-black/40 border border-gray-100 overflow-y-auto max-h-[calc(100vh-1.5rem)] sm:max-h-[calc(100vh-2rem)] flex flex-col lg:flex-row">

            {/* ══ Left panel — plan detail ══ */}
            <div className="lg:w-[340px] flex-shrink-0 relative overflow-hidden bg-white border-b lg:border-b-0 lg:border-r border-gray-100 px-6 py-6">
              <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full pointer-events-none"
                style={{ background: 'radial-gradient(circle,rgba(99,102,241,0.08) 0%,transparent 65%)' }} />
              <div className="absolute bottom-0 left-0 w-56 h-56 rounded-full pointer-events-none"
                style={{ background: 'radial-gradient(circle,rgba(139,92,246,0.05) 0%,transparent 70%)' }} />

              <div className="relative z-10">
                {/* Logo */}
                <div className="flex items-center gap-2.5 mb-5">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-md shadow-indigo-500/25">
                    <Dumbbell className="w-4 h-4 text-white" />
                  </div>
                  <span className="font-extrabold text-gray-900 text-base tracking-tight">GemaSystem</span>
                </div>

                {/* Plan tabs */}
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Selecciona tu plan</p>
                <PlanTabs current={planId} onChange={selectPlan} />

                {/* Beta banner */}
                <div className="flex items-center gap-2 mt-3.5 mb-4 px-3 py-2 rounded-xl border border-amber-200/80 bg-gradient-to-r from-amber-50 to-yellow-50">
                  <Zap className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                  <p className="text-[10px] text-amber-700 font-semibold leading-snug">Precio especial beta, garantizado.</p>
                </div>

                {/* Plan detail */}
                <div className="mb-4">
                  {plan.badge && (
                    <span className="inline-flex items-center gap-1.5 mb-2.5 px-2.5 py-1 rounded-full text-[10px] font-bold"
                      style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', color: '#6366F1' }}>
                      <Zap className="w-2.5 h-2.5" /> {plan.badge}
                    </span>
                  )}
                  <p className="text-gray-400 text-[11px] mb-0.5">Suscripción al</p>
                  <h2 className="text-lg font-extrabold text-gray-900 mb-2 tracking-tight">Plan {plan.name}</h2>
                  <div className="flex items-end gap-2 mb-3">
                    <div>
                      <p className="text-[10px] text-gray-400 line-through mb-0.5">{plan.originalPrice}<span className="text-gray-300">{plan.period}</span></p>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-black text-indigo-600 tracking-tight">{plan.price}</span>
                        <span className="text-gray-400 text-xs">{plan.period}</span>
                      </div>
                    </div>
                    <span className="mb-0.5 text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 flex-shrink-0">
                      {plan.saving}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {plan.features.map((f, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 bg-indigo-50">
                          <Check className="w-2.5 h-2.5 text-indigo-500" />
                        </div>
                        <span className="text-gray-600 text-[11px]">{f}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Trust badges */}
                <div className="border-t border-gray-100 pt-3 space-y-1.5">
                  {[
                    { Icon: Lock,       text: 'Pago cifrado SSL 256 bits' },
                    { Icon: CreditCard, text: 'Procesado por Stripe' },
                    { Icon: BadgeCheck, text: 'Sin permanencia' },
                  ].map(({ Icon, text }) => (
                    <div key={text} className="flex items-center gap-2">
                      <Icon className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                      <span className="text-[10px] text-gray-400">{text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ══ Right panel — form ══ */}
            <div className="flex-1 px-6 sm:px-8 py-6">
              <div className="max-w-md mx-auto lg:mx-0">

                {/* Mode toggle */}
                <div className="grid grid-cols-2 gap-1.5 p-1.5 rounded-2xl bg-gray-100 mb-5">
                  <button type="button" onClick={() => switchMode('new')}
                    className="flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all duration-200"
                    style={mode === 'new'
                      ? { background: '#fff', color: '#4F46E5', boxShadow: '0 2px 12px rgba(99,102,241,0.12)' }
                      : { background: 'transparent', color: '#9ca3af' }}>
                    <User className="w-3.5 h-3.5" />
                    Nueva cuenta
                  </button>
                  <button type="button" onClick={() => switchMode('reactivate')}
                    className="flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all duration-200"
                    style={mode === 'reactivate'
                      ? { background: '#fff', color: '#D97706', boxShadow: '0 2px 12px rgba(217,119,6,0.12)' }
                      : { background: 'transparent', color: '#9ca3af' }}>
                    <RefreshCcw className="w-3.5 h-3.5" />
                    Reactivar gym
                  </button>
                </div>

                {/* ── Nueva cuenta ── */}
                {mode === 'new' && (
                  <>
                    <div className="mb-4">
                      <h1 className="text-xl font-extrabold text-gray-900 mb-1 tracking-tight">Crea tu cuenta</h1>
                      <p className="text-xs text-gray-500">Completa tus datos para continuar al pago seguro con Stripe.</p>
                    </div>

                    <form onSubmit={n.handleSubmit(onSubmitNew)} className="space-y-3.5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Field label="Gimnasio" error={n.formState.errors.gym_name?.message} icon={Building2}>
                          <input {...n.register('gym_name')} type="text" placeholder="FitZone Premium"
                            className={n.formState.errors.gym_name ? inpErr : inp} autoFocus />
                        </Field>
                        <Field label="Usuario" error={n.formState.errors.username?.message} icon={User}
                          status={usernameStatus}
                          hint={usernameStatus === 'taken' && (
                            <p className="mt-1 text-[10px] text-red-500 flex items-center gap-1">
                              <X className="w-2.5 h-2.5 flex-shrink-0" />Ese usuario ya está en uso.
                            </p>
                          )}>
                          <input {...n.register('username')} type="text" placeholder="tu_usuario"
                            className={`${n.formState.errors.username ? inpErr : inp} pr-9`} autoComplete="username" />
                        </Field>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <Field label="Nombres" error={n.formState.errors.first_name?.message} icon={IdCard}>
                          <input {...n.register('first_name')} type="text" placeholder="Juan"
                            className={n.formState.errors.first_name ? inpErr : inp} autoComplete="given-name" />
                        </Field>
                        <Field label="Apellido paterno" error={n.formState.errors.paternal_surname?.message}>
                          <input {...n.register('paternal_surname')} type="text" placeholder="Pérez"
                            className={`${n.formState.errors.paternal_surname ? inpErr : inp} !pl-3`} autoComplete="family-name" />
                        </Field>
                        <Field label="Apellido materno" error={n.formState.errors.maternal_surname?.message}>
                          <input {...n.register('maternal_surname')} type="text" placeholder="López"
                            className={`${n.formState.errors.maternal_surname ? inpErr : inp} !pl-3`} autoComplete="additional-name" />
                        </Field>
                      </div>

                      <Field label="Correo electrónico" error={n.formState.errors.email?.message} icon={Mail}
                        status={emailStatus}
                        hint={emailStatus === 'taken' && (
                          <p className="mt-1 text-[10px] text-amber-600 flex items-center gap-1">
                            <Zap className="w-2.5 h-2.5 flex-shrink-0" />
                            Ese correo ya tiene una cuenta —{' '}
                            <button type="button" onClick={suggestReactivate} className="underline font-semibold hover:text-amber-700">
                              reactívala
                            </button> en vez de crear una nueva.
                          </p>
                        )}>
                        <input {...n.register('email')} type="email" placeholder="correo@ejemplo.com"
                          className={`${n.formState.errors.email ? inpErr : inp} pr-9`} autoComplete="email" />
                      </Field>

                      <div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <Field label="Contraseña" error={n.formState.errors.password?.message} icon={Lock}>
                            <input {...n.register('password')} type={showPassN ? 'text' : 'password'}
                              placeholder="••••••••" className={`${n.formState.errors.password ? inpErr : inp} pr-9`}
                              autoComplete="new-password" />
                            <button type="button" onClick={() => setShowPassN(s => !s)}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-indigo-500 transition-colors z-10 p-0.5">
                              {showPassN ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </Field>

                          <Field label="Confirmar" error={n.formState.errors.password_confirmation?.message} icon={KeyRound}>
                            <input {...n.register('password_confirmation')} type={showConfN ? 'text' : 'password'}
                              placeholder="••••••••" className={`${n.formState.errors.password_confirmation ? inpErr : inp} pr-9`}
                              autoComplete="new-password" />
                            <button type="button" onClick={() => setShowConfN(s => !s)}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-indigo-500 transition-colors z-10 p-0.5">
                              {showConfN ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </Field>
                        </div>
                        <PasswordStrength password={newPassword} />
                      </div>

                      <TermsCheckbox register={n.register('acceptTerms')} error={n.formState.errors.acceptTerms?.message} accentColor="#4F46E5" />

                      {newFormReady && (
                        <div className="reg-fade-up">
                          <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Verificación de seguridad</label>
                          <div className="flex justify-center rounded-xl border border-gray-200 bg-gray-50/70 p-2.5">
                            <div className="scale-[0.85] origin-center sm:scale-100">
                              <ReCAPTCHA
                                ref={recaptchaRefN}
                                sitekey={RECAPTCHA_SITE_KEY}
                                onChange={(token) => n.setValue('recaptcha_token', token || '', { shouldValidate: true })}
                                onExpired={() => n.setValue('recaptcha_token', '', { shouldValidate: true })}
                                onErrored={() => n.setValue('recaptcha_token', '', { shouldValidate: true })}
                              />
                            </div>
                          </div>
                          {n.formState.errors.recaptcha_token && (
                            <p className="mt-1.5 text-[10px] text-red-500 flex items-center justify-center gap-1">
                              <X className="w-2.5 h-2.5 flex-shrink-0" />{n.formState.errors.recaptcha_token.message}
                            </p>
                          )}
                        </div>
                      )}

                      {apiErrorN && (
                        <div className="flex items-start gap-2 px-3.5 py-2.5 rounded-xl text-xs text-red-600 bg-red-50 border border-red-200">
                          <X className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /><span>{apiErrorN}</span>
                        </div>
                      )}

                      <div className="pt-1 space-y-2.5">
                        <button type="submit"
                          disabled={loadingN || usernameStatus === 'taken' || emailStatus === 'taken'}
                          className="w-full py-3 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2.5
                            transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-indigo-500/30
                            active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none"
                          style={{ background: 'linear-gradient(135deg,#4F46E5,#7C3AED)', boxShadow: '0 6px 20px rgba(99,102,241,0.3)' }}>
                          {loadingN
                            ? <><Loader2 className="w-4 h-4 animate-spin" /> Procesando...</>
                            : <><CreditCard className="w-4 h-4" /> Continuar al pago con Stripe <ArrowRight className="w-4 h-4" /></>}
                        </button>
                        <p className="text-center text-[10px] text-gray-400 flex items-center justify-center gap-1.5">
                          <Shield className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                          Pago cifrado · Sin permanencia · Cancela cuando quieras
                        </p>
                      </div>
                    </form>
                  </>
                )}

                {/* ── Reactivar gym ── */}
                {mode === 'reactivate' && (
                  <>
                    <div className="mb-4">
                      <div className="flex items-center gap-2 mb-2.5 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200">
                        <RefreshCcw className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                        <p className="text-[10px] text-amber-700 font-medium leading-snug">
                          Ingresa las credenciales de tu cuenta existente para reactivarla.
                        </p>
                      </div>
                      <h1 className="text-xl font-extrabold text-gray-900 mb-1 tracking-tight">Reactivar suscripción</h1>
                      <p className="text-xs text-gray-500">Tus datos se conservan intactos. Solo se renueva el pago.</p>
                    </div>

                    <form onSubmit={r.handleSubmit(onSubmitReactivate)} className="space-y-3.5">
                      <Field label="Correo electrónico de tu cuenta" error={r.formState.errors.email?.message} icon={Mail}>
                        <input {...r.register('email')} type="email" placeholder="correo@ejemplo.com"
                          className={r.formState.errors.email ? inpErr : inp} autoComplete="email" autoFocus />
                      </Field>

                      <Field label="Tu contraseña actual" error={r.formState.errors.password?.message} icon={Lock}>
                        <input {...r.register('password')} type={showPassR ? 'text' : 'password'}
                          placeholder="••••••••" className={`${r.formState.errors.password ? inpErr : inp} pr-9`}
                          autoComplete="current-password" />
                        <button type="button" onClick={() => setShowPassR(s => !s)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-amber-500 transition-colors z-10 p-0.5">
                          {showPassR ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </Field>

                      <TermsCheckbox register={r.register('acceptTerms')} error={r.formState.errors.acceptTerms?.message} accentColor="#D97706" />

                      {reactFormReady && (
                        <div className="reg-fade-up">
                          <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Verificación de seguridad</label>
                          <div className="flex justify-center rounded-xl border border-gray-200 bg-gray-50/70 p-2.5">
                            <div className="scale-[0.85] origin-center sm:scale-100">
                              <ReCAPTCHA
                                ref={recaptchaRefR}
                                sitekey={RECAPTCHA_SITE_KEY}
                                onChange={(token) => reactForm.setValue('recaptcha_token', token || '', { shouldValidate: true })}
                                onExpired={() => reactForm.setValue('recaptcha_token', '', { shouldValidate: true })}
                                onErrored={() => reactForm.setValue('recaptcha_token', '', { shouldValidate: true })}
                              />
                            </div>
                          </div>
                          {r.formState.errors.recaptcha_token && (
                            <p className="mt-1.5 text-[10px] text-red-500 flex items-center justify-center gap-1">
                              <X className="w-2.5 h-2.5 flex-shrink-0" />{r.formState.errors.recaptcha_token.message}
                            </p>
                          )}
                        </div>
                      )}

                      {apiErrorR && (
                        <div className="flex items-start gap-2 px-3.5 py-2.5 rounded-xl text-xs text-red-600 bg-red-50 border border-red-200">
                          <X className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /><span>{apiErrorR}</span>
                        </div>
                      )}

                      <div className="pt-1 space-y-2.5">
                        <button type="submit" disabled={loadingR}
                          className="w-full py-3 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2.5
                            transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-amber-500/30
                            active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none"
                          style={{ background: 'linear-gradient(135deg,#D97706,#F59E0B)', boxShadow: '0 6px 20px rgba(217,119,6,0.25)' }}>
                          {loadingR
                            ? <><Loader2 className="w-4 h-4 animate-spin" /> Verificando...</>
                            : <><CreditCard className="w-4 h-4" /> Reactivar con Stripe <ArrowRight className="w-4 h-4" /></>}
                        </button>
                        <p className="text-center text-[10px] text-gray-400 flex items-center justify-center gap-1.5">
                          <Shield className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                          Pago cifrado · Tus datos se conservan · Cancela cuando quieras
                        </p>
                      </div>
                    </form>
                  </>
                )}

                <div className="mt-4 pt-3.5 border-t border-gray-100 text-center">
                  <p className="text-xs text-gray-500">
                    ¿Ya tienes cuenta activa?{' '}
                    <Link to="/?login=1" className="text-indigo-600 hover:text-indigo-700 font-semibold transition-colors">
                      Iniciar sesión
                    </Link>
                  </p>
                </div>

              </div>
            </div>

          </div>
        </div>
      </div>
  )
}

