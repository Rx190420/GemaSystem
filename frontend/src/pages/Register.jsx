import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import * as yup from 'yup'
import ReCAPTCHA from 'react-google-recaptcha'
import {
  Check, Eye, EyeOff, Loader2, Shield,
  CreditCard, ArrowRight, X, Lock, BadgeCheck, Zap,
  Building2, User, Mail, KeyRound, RefreshCcw, IdCard,
} from 'lucide-react'
import api from '../api/axios'
import GemaSystemLogo from '../components/GemaSystemLogo'
import useLockBodyScroll from '../hooks/useLockBodyScroll'
import usePlans, { customTotal, BASIC_INCLUDES, fullIncludes } from '../hooks/usePlans'

const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY

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

function PlanTabs({ plans, current, onChange, customFeatures }) {
  const tabs = [
    { id: 'basic', name: plans.basic.label, price: plans.basic.price, badge: null },
    { id: 'full',  name: plans.full.label,  price: plans.full.price,  badge: 'Más popular' },
    { id: 'custom', name: 'Custom', price: customTotal(plans, customFeatures), badge: null },
  ]
  return (
    <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-gray-100">
      {tabs.map(p => {
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
              ${p.price.toLocaleString('es-MX')}
            </p>
            <p className={`text-[9px] mt-0.5 transition-colors ${active ? 'text-gray-400' : 'text-gray-300'}`}>/mes</p>
          </button>
        )
      })}
    </div>
  )
}

// The plan-tabs + price/features block shown for "Nueva cuenta", extracted
// so "Reactivar gym" can render the exact same thing for an account whose
// existing plan is Basic/Full/Custom — that account never had a weekly/
// monthly plan, so it has no business being offered one just because it's
// reactivating (see LEGACY_PLANS below for the plan it's actually offered
// instead when the account turns out to be on one of THOSE).
function NewPlanDetail({ plans, planId, customFeatures, onSelectPlan, onToggleFeature, label }) {
  return (
    <>
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Selecciona tu plan</p>
      <PlanTabs plans={plans} current={planId} onChange={onSelectPlan} customFeatures={customFeatures} />

      <div className="mt-4 mb-4">
        {planId === 'full' && (
          <span className="inline-flex items-center gap-1.5 mb-2.5 px-2.5 py-1 rounded-full text-[10px] font-bold"
            style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', color: '#6366F1' }}>
            <Zap className="w-2.5 h-2.5" /> Más popular
          </span>
        )}
        <p className="text-gray-400 text-[11px] mb-0.5">{label}</p>
        <h2 className="text-lg font-extrabold text-gray-900 mb-2 tracking-tight">
          Plan {planId === 'basic' ? plans.basic.label : planId === 'full' ? plans.full.label : 'Custom'}
        </h2>
        <div className="flex items-baseline gap-1 mb-3">
          <span className="text-2xl font-black text-indigo-600 tracking-tight">
            ${(planId === 'basic' ? plans.basic.price : planId === 'full' ? plans.full.price : customTotal(plans, customFeatures)).toLocaleString('es-MX')}
          </span>
          <span className="text-gray-400 text-xs">/mes MXN</span>
        </div>

        {planId === 'custom' ? (
          <div className="space-y-1.5">
            {Object.entries(plans.addons).map(([key, addon]) => {
              const checked = customFeatures.includes(key)
              return (
                <label key={key}
                  className={`flex flex-col gap-1 px-2.5 py-2 rounded-lg border cursor-pointer transition-colors ${checked ? 'border-indigo-300 bg-indigo-50/60' : 'border-gray-100 hover:border-gray-200'}`}>
                  <span className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-[11px] text-gray-700">
                      <input type="checkbox" checked={checked} onChange={() => onToggleFeature(key)}
                        className="w-3.5 h-3.5 rounded accent-indigo-500 flex-shrink-0" />
                      {addon.label}
                    </span>
                    <span className="text-[10px] text-gray-400 flex-shrink-0">+${addon.price}</span>
                  </span>
                  {addon.description && (
                    <span className="text-[10px] text-gray-400 leading-snug pl-5 pt-1 border-t border-gray-100">
                      {addon.description}
                    </span>
                  )}
                </label>
              )
            })}
          </div>
        ) : (
          <div className="space-y-1.5">
            {(planId === 'basic' ? BASIC_INCLUDES : fullIncludes(plans)).map((f, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 bg-indigo-50">
                  <Check className="w-2.5 h-2.5 text-indigo-500" />
                </div>
                <span className="text-gray-600 text-[11px]">{f}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

// Legacy weekly/monthly — only offered when "Verificar gym" confirms the
// account is ACTUALLY on one of these (see isLegacyReactivation below). Not
// part of usePlans()/config/plans.php on purpose: that file only carries the
// new Basic/Full/Custom tiers, legacy plans keep their own fixed Stripe
// prices exactly as before. Single source for both ReactivatePlanTabs below
// and the price line next to it, instead of the number showing up twice.
const LEGACY_PLANS = [
  { id: 'weekly',  label: 'Semanal', price: 399,  period: '/sem' },
  { id: 'monthly', label: 'Mensual', price: 1560, period: '/mes' },
]

// Same visual language as PlanTabs above, sized for 2 columns instead of 3 —
// used on the "Reactivar gym" side of the left panel.
function ReactivatePlanTabs({ current, onChange }) {
  return (
    <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-gray-100">
      {LEGACY_PLANS.map(p => {
        const active = current === p.id
        return (
          <button key={p.id} type="button" onClick={() => onChange(p.id)}
            className="relative flex flex-col items-center pt-3.5 pb-2.5 px-2 rounded-lg transition-all duration-200 hover:bg-white/70"
            style={active ? { background: '#fff', boxShadow: '0 2px 12px rgba(217,119,6,0.12)' } : {}}>
            {active && <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[3px] rounded-full bg-amber-500" />}
            <p className={`text-[9px] font-bold uppercase tracking-widest mb-1 transition-colors ${active ? 'text-amber-600' : 'text-gray-400'}`}>
              {p.label}
            </p>
            <p className={`text-lg font-black leading-none transition-colors ${active ? 'text-amber-600' : 'text-gray-300'}`}>
              ${p.price.toLocaleString('es-MX')}
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
  const [planId, setPlanId] = useState(() => {
    const p = searchParams.get('plan')
    return ['basic', 'full', 'custom'].includes(p) ? p : 'full'
  })
  const [customFeatures, setCustomFeatures] = useState(() =>
    (searchParams.get('features') || '').split(',').filter(Boolean)
  )
  const { plans, isLoading: plansLoading } = usePlans()

  const [mode, setMode] = useState(searchParams.get('reactivate') === '1' ? 'reactivate' : 'new')

  const [showPassN, setShowPassN] = useState(false)
  const [showConfN, setShowConfN] = useState(false)
  const [showPassR, setShowPassR] = useState(false)
  const [loadingN, setLoadingN]   = useState(false)
  const [loadingR, setLoadingR]   = useState(false)
  const [apiErrorN, setApiErrorN] = useState(null)
  const [apiErrorR, setApiErrorR] = useState(null)

  // "Verificar gym" gate on the reactivation form — checks the credentials
  // and shows which account/plan they belong to BEFORE the terms checkbox,
  // reCAPTCHA and "Reactivar con Stripe" button even appear. verifiedGym
  // holds the account it found; verifiedFor remembers exactly which
  // email+password combo that verification was for, so editing either
  // field afterward invalidates it instead of leaving a stale "verified"
  // state pointing at credentials that no longer match what's in the form.
  const [verifiedGym, setVerifiedGym] = useState(null)
  const [verifiedFor, setVerifiedFor] = useState(null)
  const [verifying, setVerifying]     = useState(false)
  const [verifyError, setVerifyError] = useState(null)

  // Which legacy plan (weekly/monthly) this reactivation buys — selected via
  // ReactivatePlanTabs in the left panel, defaulted to whatever "Verificar
  // gym" found the account already on (inside verifyGym() below).
  const [reactivatePlan, setReactivatePlan] = useState('monthly')

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

  // True only while the currently-typed email+password still match what
  // "Verificar gym" last confirmed — editing either field after verifying
  // drops back to false instead of leaving a stale result on screen for
  // credentials that no longer match it.
  const gymIsVerified = !!(verifiedGym && verifiedFor?.email === reactEmail && verifiedFor?.password === reactPassword)

  // Which plan picker to show: an account only ever had weekly/monthly OR
  // Basic/Full/Custom, never both, so this is only "true" once verification
  // confirms it's the legacy kind — before that (or for a confirmed
  // Basic/Full/Custom account) it shares the exact same PlanTabs/
  // NewPlanDetail "Nueva cuenta" already uses, driven by planId/customFeatures.
  const isLegacyReactivation = !!(verifiedGym && ['weekly', 'monthly'].includes(verifiedGym.plan))

  // Did the verified account already have at least one extra? (Whether it
  // was 'custom' outright, or 'basic' + extras — verifyGym() reclassifies
  // that second case to 'custom' too, so by the time this reads, "has
  // extras" and "planId === 'custom'" line up.) Extras have no expiration of
  // their own in the schema — they're just gyms.plan_features, riding on the
  // same subscription_ends_at as everything else — so this only gates a
  // clarifying note, never a separate date to track or get out of sync.
  const hadExtrasBefore = !!(verifiedGym?.plan_features && Object.values(verifiedGym.plan_features).some(Boolean))

  const close = onClose

  const selectPlan = (id) => {
    setSearchParams({
      plan: id,
      ...(id === 'custom' && customFeatures.length ? { features: customFeatures.join(',') } : {}),
      ...(mode === 'reactivate' ? { reactivate: '1' } : {}),
    }, { replace: true })
    setPlanId(id)
  }

  const toggleCustomFeature = (key) => {
    setCustomFeatures(prev => {
      const next = prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
      setSearchParams({
        plan: planId,
        ...(next.length ? { features: next.join(',') } : {}),
        ...(mode === 'reactivate' ? { reactivate: '1' } : {}),
      }, { replace: true })
      return next
    })
  }

  const switchMode = (m) => {
    setMode(m)
    setApiErrorN(null)
    setApiErrorR(null)
    setVerifiedGym(null)
    setVerifiedFor(null)
    setVerifyError(null)
    setSearchParams({
      plan: planId,
      ...(planId === 'custom' && customFeatures.length ? { features: customFeatures.join(',') } : {}),
      ...(m === 'reactivate' ? { reactivate: '1' } : {}),
    }, { replace: true })
  }

  // "Verificar gym" — checks the credentials and shows which account/plan
  // was found, WITHOUT creating a Stripe session (see StripeController::
  // verifyReactivation). Only once this succeeds do the terms checkbox,
  // reCAPTCHA and "Reactivar con Stripe" button even appear. Always succeeds
  // for valid credentials, even if the gym already has a live subscription —
  // verifiedGym.is_active just switches the copy/button to "esto se sumará
  // a tu suscripción actual" instead of blocking the purchase (see fulfill()'s
  // resubscription branch on the backend for the actual stacking).
  const verifyGym = async () => {
    const email    = reactForm.getValues('email')
    const password = reactForm.getValues('password')
    if (!email?.trim() || !password?.trim()) return
    setVerifying(true)
    setVerifyError(null)
    try {
      const res = await api.post('/stripe/verify-reactivation', { email, password })
      setVerifiedGym(res.data)
      setVerifiedFor({ email, password })

      const foundExtras = res.data.plan_features
        ? Object.keys(res.data.plan_features).filter(k => res.data.plan_features[k])
        : []

      // Default the picker to whatever this gym is actually on — "seguir con
      // mi plan" should mean the plan it found, not a guess. A 'basic' gym
      // that already has extras on top IS a Custom plan by definition
      // (Custom is just Basic + chosen extras) — treat it as one here rather
      // than a separate "Basic with bonus extras" concept, so it reuses the
      // exact same Custom addon picker as everything else. Only one of the
      // two branches below ever applies to a given account (see isLegacyReactivation).
      if (['weekly', 'monthly'].includes(res.data.plan)) {
        setReactivatePlan(res.data.plan)
      } else if (res.data.plan === 'basic' && foundExtras.length > 0) {
        setPlanId('custom')
        setCustomFeatures(foundExtras)
      } else if (['basic', 'full', 'custom'].includes(res.data.plan)) {
        setPlanId(res.data.plan)
        setCustomFeatures(foundExtras)
      }
    } catch (err) {
      setVerifiedGym(null)
      setVerifiedFor(null)
      setVerifyError(err.response?.data?.message ?? 'No se pudo verificar. Intenta de nuevo.')
    }
    setVerifying(false)
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
      const res = await api.post('/stripe/create-session', {
        ...data,
        plan_id: planId,
        ...(planId === 'custom' ? { features: customFeatures } : {}),
      })
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
        // Whichever picker applied to this account — see isLegacyReactivation.
        // Never 'basic' with features: a Basic account that already has
        // extras gets reclassified to 'custom' in verifyGym() instead, since
        // that's what Basic + extras actually is.
        plan_id: isLegacyReactivation ? reactivatePlan : planId,
        ...(!isLegacyReactivation && planId === 'custom' ? { features: customFeatures } : {}),
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
                    <GemaSystemLogo className="w-4 h-4" />
                  </div>
                  <span className="font-extrabold text-gray-900 text-base tracking-tight">GemaSystem</span>
                </div>

                {mode === 'new' ? (
                  plansLoading || !plans ? (
                    <div className="h-64 rounded-xl bg-gray-100 animate-pulse mb-4" />
                  ) : (
                    <NewPlanDetail plans={plans} planId={planId} customFeatures={customFeatures}
                      onSelectPlan={selectPlan} onToggleFeature={toggleCustomFeature} label="Suscripción al" />
                  )
                ) : (
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200">
                      <RefreshCcw className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                      <p className="text-[10px] text-amber-700 font-medium leading-snug">
                        {verifiedGym?.is_active
                          ? 'Tu suscripción sigue vigente — lo que compres se suma a tu periodo actual.'
                          : 'Reactivamos tu cuenta con el plan que elijas.'}
                      </p>
                    </div>
                    <p className="text-gray-400 text-[11px] mb-0.5">Reactivación de</p>
                    <h2 className="text-lg font-extrabold text-gray-900 mb-4 tracking-tight">
                      {verifiedGym?.gym_name || 'Suscripción existente'}
                    </h2>

                    {isLegacyReactivation ? (
                      // Este gym específico sí venía de un plan legacy — se le
                      // ofrecen esos, no los de arriba (ver LEGACY_PLANS).
                      <>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Elige tu plan</p>
                        <ReactivatePlanTabs current={reactivatePlan} onChange={setReactivatePlan} />

                        <div className="mt-4">
                          <p className="text-gray-400 text-[11px] mb-0.5">
                            {verifiedGym?.is_active ? 'Se suma a tu suscripción actual' : 'Suscripción al'}
                          </p>
                          <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-black text-amber-600 tracking-tight">
                              ${LEGACY_PLANS.find(p => p.id === reactivatePlan)?.price.toLocaleString('es-MX')}
                            </span>
                            <span className="text-gray-400 text-xs">{LEGACY_PLANS.find(p => p.id === reactivatePlan)?.period} MXN</span>
                          </div>
                        </div>
                      </>
                    ) : (
                      // Default (before verifying, or once verified as Basic/
                      // Full/Custom) — the plans this gym actually has.
                      plansLoading || !plans ? (
                        <div className="h-56 rounded-xl bg-gray-100 animate-pulse" />
                      ) : (
                        <NewPlanDetail plans={plans} planId={planId} customFeatures={customFeatures}
                          onSelectPlan={selectPlan} onToggleFeature={toggleCustomFeature}
                          label={verifiedGym?.is_active ? 'Se suma a tu suscripción actual' : 'Reactivando el'} />
                      )
                    )}

                    {verifiedGym?.is_active && verifiedGym?.subscription_ends_at && (
                      <p className="text-[10px] text-indigo-500 leading-snug -mt-2 mb-1">
                        Más los días que te quedan hasta el {verifiedGym.subscription_ends_at}.
                      </p>
                    )}

                    {/* Los extras (marcados arriba) no tienen su propia fecha
                        de vencimiento — duran lo mismo que el plan. Aclara
                        eso explícitamente en vez de dejarlo implícito, y que
                        "volver a comprar" (reactivar) extiende esa fecha en
                        vez de reiniciarla — mismo mecanismo que ya extiende
                        subscription_ends_at arriba, no algo aparte a romper. */}
                    {!isLegacyReactivation && planId === 'custom' && hadExtrasBefore && (
                      <p className="text-[10px] text-gray-400 leading-snug -mt-1 mb-1">
                        Los extras que ya tenías no vencen por separado — duran lo mismo que tu plan
                        {verifiedGym?.subscription_ends_at && <>, hasta el <strong className="text-gray-500">{verifiedGym.subscription_ends_at}</strong></>}.
                        {' '}Al reactivar, esa fecha se extiende y los extras siguen con ella.
                      </p>
                    )}
                  </div>
                )}

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

                      {/* Confirms which account was found and gates
                          everything below (terms, reCAPTCHA, "Reactivar con
                          Stripe") behind an explicit click — instead of only
                          finding out the credentials were wrong after
                          already being sent to Stripe. */}
                      {!gymIsVerified ? (
                        <div className="space-y-2">
                          <button type="button" disabled={verifying || !reactEmail?.trim() || !reactPassword?.trim()}
                            onClick={verifyGym}
                            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-xs border-2
                              border-amber-200 text-amber-700 hover:bg-amber-50 hover:border-amber-300 transition-all disabled:opacity-50">
                            {verifying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BadgeCheck className="w-3.5 h-3.5" />}
                            {verifying ? 'Verificando...' : 'Verificar gym'}
                          </button>

                          {verifyError && (
                            <div className="flex items-start gap-2 px-3.5 py-2.5 rounded-xl text-xs text-red-600 bg-red-50 border border-red-200">
                              <X className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /><span>{verifyError}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="reg-fade-up space-y-2.5">
                          <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl border border-emerald-200 bg-emerald-50">
                            <div className="w-8 h-8 rounded-lg bg-white border border-emerald-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <Building2 className="w-4 h-4 text-emerald-600" />
                            </div>
                            <div className="min-w-0 flex-1 space-y-1">
                              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wide flex items-center gap-1">
                                <Check className="w-3 h-3" /> Gym verificado
                              </p>
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-bold text-gray-800 truncate">{verifiedGym?.gym_name}</p>
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold text-emerald-700 bg-white border border-emerald-200 flex-shrink-0">
                                  Plan {verifiedGym?.plan === 'weekly' ? 'Semanal'
                                    : verifiedGym?.plan === 'monthly' ? 'Mensual'
                                    : verifiedGym?.plan === 'basic' ? (plans?.basic.label ?? 'Basic')
                                    : verifiedGym?.plan === 'full' ? (plans?.full.label ?? 'Full')
                                    : verifiedGym?.plan === 'custom' ? 'Custom'
                                    : verifiedGym?.plan}
                                </span>
                              </div>
                              {verifiedGym?.subscription_ends_at && (
                                <p className="text-[11px] text-gray-500">
                                  {verifiedGym.is_active ? 'Vigente hasta' : 'Venció'} el {verifiedGym.subscription_ends_at}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Ya tiene una suscripción activa — no bloquea la
                              compra, solo aclara qué pasa con el tiempo que
                              todavía le queda: se suma, no se pierde. El plan
                              a comprar se elige en el panel izquierdo. */}
                          {verifiedGym?.is_active && (
                            <div className="flex items-start gap-2 px-3.5 py-2.5 rounded-xl text-xs bg-indigo-50 border border-indigo-200 text-indigo-700 leading-relaxed">
                              <BadgeCheck className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-indigo-500" />
                              <span>Esta cuenta ya tiene una suscripción vigente{verifiedGym.subscription_ends_at && <> hasta el <strong>{verifiedGym.subscription_ends_at}</strong></>}. Si compras ahora, esos días se suman al nuevo periodo — no se pierden.</span>
                            </div>
                          )}
                        </div>
                      )}

                      {gymIsVerified && (
                      <TermsCheckbox register={r.register('acceptTerms')} error={r.formState.errors.acceptTerms?.message} accentColor="#D97706" />
                      )}

                      {gymIsVerified && reactFormReady && (
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

                      {gymIsVerified && (
                        <div className="pt-1 space-y-2.5">
                          <button type="submit" disabled={loadingR}
                            className="w-full py-3 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2.5
                              transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-amber-500/30
                              active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none"
                            style={{ background: 'linear-gradient(135deg,#D97706,#F59E0B)', boxShadow: '0 6px 20px rgba(217,119,6,0.25)' }}>
                            {loadingR
                              ? <><Loader2 className="w-4 h-4 animate-spin" /> Verificando...</>
                              : <><CreditCard className="w-4 h-4" /> {verifiedGym?.is_active ? 'Comprar' : 'Reactivar'} con Stripe <ArrowRight className="w-4 h-4" /></>}
                          </button>
                          <p className="text-center text-[10px] text-gray-400 flex items-center justify-center gap-1.5">
                            <Shield className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                            Pago cifrado · Tus datos se conservan · Cancela cuando quieras
                          </p>
                        </div>
                      )}
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

