import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  User, Mail, Building2, Calendar, Clock, CreditCard,
  Lock, Eye, EyeOff, Loader2, CheckCircle2, ShieldCheck,
  AlertTriangle, BadgeCheck, ArrowLeft, Users, TrendingUp,
  Activity, Shield, ChevronRight, Dumbbell, KeyRound, Info,
  MessageSquare, Package, Upload, Download, Gift,
} from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import api from '../api/axios'
import toast from 'react-hot-toast'
import useLockBodyScroll from '../hooks/useLockBodyScroll'
import usePlans, { customTotal, BASIC_INCLUDES, fullIncludes } from '../hooks/usePlans'

// ── helpers ────────────────────────────────────────────────────────────────────

const PASSWORD_RULES = [
  { re: /.{8,}/,         label: 'Mínimo 8 caracteres'   },
  { re: /[A-Z]/,         label: 'Una mayúscula'          },
  { re: /[a-z]/,         label: 'Una minúscula'          },
  { re: /[0-9]/,         label: 'Un número'              },
  { re: /[^A-Za-z0-9]/, label: 'Un símbolo (@, #, !…)'  },
]

const fmt = (iso, opts = { day: '2-digit', month: 'long', year: 'numeric' }) =>
  iso ? new Date(iso).toLocaleDateString('es-MX', opts) : '—'

const fmtMoney = n =>
  n == null ? '—' : '$' + Number(n).toLocaleString('es-MX', { minimumFractionDigits: 0 })

const daysLeft = endsAt =>
  endsAt ? Math.ceil((new Date(endsAt) - new Date()) / 86400000) : null

const subProgress = (s, e) => {
  if (!s || !e) return 0
  const total = new Date(e) - new Date(s)
  if (total <= 0) return 100
  return Math.min(100, Math.max(0, ((new Date() - new Date(s)) / total) * 100))
}

const planLabel = (plan, type, plans) => {
  if (type === 'free')  return 'Gratuito'
  if (type === 'trial') return 'Prueba'
  if (plan === 'basic') return plans?.basic?.label ?? 'Basic'
  if (plan === 'full')  return plans?.full?.label ?? 'Full'
  if (plan === 'custom') return 'Custom'
  return { weekly: 'Semanal', monthly: 'Mensual', annual: 'Anual' }[plan] ?? plan ?? '—'
}

const billingDot = s => ({
  active: 'bg-emerald-500', payment_failed: 'bg-red-500',
  cancelled: 'bg-orange-400', trialing: 'bg-blue-500',
}[s] ?? 'bg-gray-300')

const billingText = s => ({
  active: 'Activa', payment_failed: 'Pago fallido',
  cancelled: 'Cancelada', trialing: 'Período de prueba',
}[s] ?? s ?? '—')


// ── PasswordStrength ────────────────────────────────────────────────────────────

function PasswordStrength({ pw }) {
  if (!pw) return null
  const n   = PASSWORD_RULES.filter(r => r.re.test(pw)).length
  const pct = (n / PASSWORD_RULES.length) * 100
  const col = pct <= 40 ? 'bg-red-400' : pct <= 80 ? 'bg-amber-400' : 'bg-emerald-500'
  return (
    <div className="mt-2 space-y-1.5">
      <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-300 ${col}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="grid grid-cols-2 gap-x-4">
        {PASSWORD_RULES.map(r => {
          const ok = r.re.test(pw)
          return (
            <span key={r.label} className={`flex items-center gap-1.5 text-xs ${ok ? 'text-emerald-600' : 'text-gray-400'}`}>
              <span className={`w-1 h-1 rounded-full flex-shrink-0 ${ok ? 'bg-emerald-500' : 'bg-gray-300'}`} />
              {r.label}
            </span>
          )
        })}
      </div>
    </div>
  )
}

// ── ChangePasswordPanel ─────────────────────────────────────────────────────────

function ChangePasswordPanel() {
  const [phase, setPhase]       = useState('idle')
  const [code, setCode]         = useState('')
  const [pw, setPw]             = useState('')
  const [cf, setCf]             = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [showCf, setShowCf]     = useState(false)

  const valid = PASSWORD_RULES.every(r => r.re.test(pw))
  const reset = () => { setPhase('idle'); setCode(''); setPw(''); setCf('') }

  const sendCode = async () => {
    setPhase('sending')
    try { await api.post('/auth/password/send-change-code'); toast.success('Código enviado'); setPhase('code') }
    catch (e) { toast.error(e.response?.data?.message ?? 'Error al enviar'); setPhase('idle') }
  }

  const confirm = async e => {
    e.preventDefault()
    if (!valid)       return toast.error('La contraseña no cumple los requisitos.')
    if (pw !== cf)    return toast.error('Las contraseñas no coinciden.')
    if (code.length !== 6) return toast.error('El código debe tener 6 dígitos.')
    setPhase('saving')
    try { await api.post('/auth/password/confirm-change', { code, password: pw, password_confirmation: cf }); toast.success('Contraseña actualizada'); setPhase('done') }
    catch (e) { toast.error(e.response?.data?.message ?? 'Código inválido'); setPhase('code') }
  }

  if (phase === 'done') return (
    <div className="flex items-center gap-3 py-2">
      <div className="w-9 h-9 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center flex-shrink-0">
        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
      </div>
      <div>
        <p className="text-sm font-semibold text-gray-800">Contraseña actualizada</p>
        <button onClick={reset} className="text-xs text-indigo-600 hover:underline mt-0.5">Cambiar de nuevo</button>
      </div>
    </div>
  )

  if (phase === 'idle' || phase === 'sending') return (
    <div className="flex items-start gap-3">
      <Lock className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
      <div>
        <p className="text-sm text-gray-600 mb-3">Se enviará un código de 6 dígitos a tu correo para confirmar el cambio.</p>
        <button onClick={sendCode} disabled={phase === 'sending'}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 transition-colors">
          {phase === 'sending' ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Enviando...</> : <><Mail className="w-3.5 h-3.5" />Enviar código</>}
        </button>
      </div>
    </div>
  )

  return (
    <form onSubmit={confirm} className="space-y-4 max-w-sm">
      <div className="flex items-center gap-2 text-xs text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2">
        <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0" /> Código enviado — válido por 15 minutos
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1.5">Código de verificación</label>
        <input value={code} onChange={e => setCode(e.target.value.replace(/\D/g,'').slice(0,6))}
          placeholder="000000" maxLength={6} autoFocus
          className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-center text-lg tracking-[0.4em] font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all" />
      </div>

      {[['Nueva contraseña', pw, setPw, showPw, setShowPw], ['Confirmar contraseña', cf, setCf, showCf, setShowCf]].map(([lbl, val, set, show, setShow], i) => (
        <div key={lbl}>
          <label className="block text-xs text-gray-500 mb-1.5">{lbl}</label>
          <div className="relative">
            <input type={show ? 'text' : 'password'} value={val} onChange={e => set(e.target.value)} placeholder="••••••••"
              className="w-full px-4 py-2.5 pr-10 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all" />
            <button type="button" onClick={() => setShow(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {i === 0 && <PasswordStrength pw={pw} />}
          {i === 1 && cf && pw !== cf && <p className="mt-1 text-xs text-red-500">Las contraseñas no coinciden</p>}
        </div>
      ))}

      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={phase === 'saving' || !valid || pw !== cf || code.length !== 6}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-colors">
          {phase === 'saving' ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Guardando...</> : <><Lock className="w-3.5 h-3.5" />Cambiar contraseña</>}
        </button>
        <button type="button" onClick={reset} className="px-4 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-100 transition-colors">Cancelar</button>
      </div>
    </form>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────────

export default function Profile() {
  const { sessionHash }                   = useAuthStore()
  const navigate                           = useNavigate()
  const [profile, setProfile]             = useState(null)
  const [stats, setStats]                 = useState(null)
  const [loading, setLoading]             = useState(true)
  const [showCancelModal, setShowCancel]  = useState(false)
  const [cancelLoading, setCancelLoading] = useState(false)
  const [changingPlan, setChangingPlan]   = useState(false)
  const [planBusy, setPlanBusy]           = useState(false)
  const [customFeatures, setCustomFeatures] = useState([])
  const [selectedExtras, setSelectedExtras] = useState([]) // cart — features not yet owned, picked to buy together
  const [extraCartBusy, setExtraCartBusy] = useState(false)
  const { plans } = usePlans()
  useLockBodyScroll(showCancelModal)

  useEffect(() => {
    Promise.all([
      api.get('/auth/me'),
      api.get('/dashboard/stats'),
    ]).then(([p, s]) => {
      setProfile(p.data)
      setStats(s.data?.stats ?? {})
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const handleCancelSubscription = async () => {
    setCancelLoading(true)
    try {
      const { data } = await api.post('/stripe/cancel-subscription')
      setProfile(prev => ({ ...prev, billing_status: data.billing_status }))
      setShowCancel(false)
      toast.success(data.message)
    } catch (e) {
      toast.error(e.response?.data?.message ?? 'No se pudo cancelar la suscripción.')
    } finally {
      setCancelLoading(false)
    }
  }

  // A paid gym switching plans goes through plan-change-checkout (billing
  // continues uninterrupted, remaining time credited). A free-trial gym
  // activating a plan for the first time goes through upgrade-to-paid
  // instead — a real conversion (its own schema gets created and the
  // trial's data migrated once payment clears), not a plan swap on an
  // account that's already paid.
  const handleChangePlan = async (planId) => {
    if (planId === profile?.plan || planBusy) return
    setPlanBusy(planId)
    try {
      const isFree = profile?.plan_type === 'free'
      const { data } = await api.post(
        isFree ? '/gym/upgrade-to-paid' : '/stripe/plan-change-checkout',
        {
          [isFree ? 'plan' : 'plan_id']: planId,
          ...(planId === 'custom' ? { features: customFeatures } : {}),
        }
      )
      window.location.href = data.url
    } catch (e) {
      toast.error(e.response?.data?.message ?? 'No se pudo iniciar el proceso de pago.')
      setPlanBusy(false)
    }
  }

  // Toggling only ever adds/removes a not-yet-owned extra from the cart
  // (selectedExtras) — no charge yet; buyExtrasCart() below checks out
  // everything selected in one Stripe payment. Already-purchased extras
  // aren't editable from here (shown shaded with an arrow instead).
  const toggleExtra = (key) => {
    setSelectedExtras(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
  }

  const extrasCartTotal = selectedExtras.reduce((sum, k) => sum + (plans?.addons?.[k]?.price ?? 0), 0)

  // One Stripe Checkout for every selected extra at once — same one-time,
  // per-subscription-only pricing as a single extra, just itemized together.
  const buyExtrasCart = async () => {
    if (selectedExtras.length === 0) return
    setExtraCartBusy(true)
    try {
      const { data } = await api.post('/gym/extras/checkout', { features: selectedExtras })
      window.location.href = data.url
    } catch (e) {
      toast.error(e.response?.data?.message ?? 'No se pudo iniciar el pago.')
      setExtraCartBusy(false)
    }
  }

  const days  = daysLeft(profile?.subscription_ends_at)
  const pct   = subProgress(profile?.subscription_starts_at, profile?.subscription_ends_at)
  const warn  = days !== null && days <= 7
  const bar   = days !== null && days <= 3 ? 'bg-red-400' : warn ? 'bg-amber-400' : 'bg-indigo-400'
  const init  = ((profile?.username ?? 'U').slice(0, 2)).toUpperCase()

  const skl = 'inline-block w-16 h-4 bg-gray-100 rounded animate-pulse'

  return (
    <>
    <div className="max-w-5xl mx-auto py-10 px-6 space-y-6">

      {/* Back */}
      <button onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Volver
      </button>

      {/* ══════════════════════════════════════════════════════
          ROW 1 — Identity + Stats
      ══════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">

        {/* Identity card — spans 1 col */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 flex flex-col justify-between">
          <div>
            <div className="w-14 h-14 rounded-xl bg-indigo-600 flex items-center justify-center text-white text-xl font-bold mb-4">
              {init}
            </div>
            <h1 className="text-xl font-bold text-gray-900 leading-tight">{profile?.username ?? '…'}</h1>
            <p className="text-sm text-gray-400 mt-0.5">{profile?.email}</p>
            {profile?.gym_name && (
              <p className="text-sm text-gray-500 mt-1 flex items-center gap-1.5">
                <Dumbbell className="w-3.5 h-3.5 text-gray-400" /> {profile.gym_name}
              </p>
            )}
          </div>

          <div className="mt-6 pt-5 border-t border-gray-100 flex items-center gap-3">
            <span className="text-xs border border-gray-200 rounded-full px-2.5 py-1 text-gray-500 font-medium">
              Propietario
            </span>
            {profile?.billing_status && (
              <span className="flex items-center gap-1.5 text-xs text-gray-500">
                <span className={`w-1.5 h-1.5 rounded-full ${billingDot(profile.billing_status)}`} />
                {billingText(profile.billing_status)}
              </span>
            )}
          </div>
        </div>

        {/* Stats — spans 2 cols, 2×2 grid */}
        <div className="lg:col-span-2 grid grid-cols-2 gap-4">
          {[
            { icon: Users,      label: 'Socios activos',     value: stats?.active_members,     sub: `de ${stats?.total_members ?? '—'} totales` },
            { icon: Activity,   label: 'Visitas hoy',        value: stats?.today_visits,       sub: `${stats?.month_visits ?? '—'} este mes` },
            { icon: TrendingUp, label: 'Ingresos del mes',   value: fmtMoney(stats?.month_revenue), sub: `${fmtMoney(stats?.year_revenue)} este año` },
            { icon: BadgeCheck, label: 'Membresías activas', value: stats?.active_memberships, sub: `${stats?.expiring_soon ?? '—'} por vencer` },
          ].map(({ icon: Icon, label, value, sub }) => (
            <div key={label} className="bg-white rounded-2xl border border-gray-200 p-6">
              <Icon className="w-4 h-4 text-gray-300 mb-3" />
              <p className="text-2xl font-bold text-gray-900 leading-none">
                {loading ? <span className={skl} /> : (value ?? '—')}
              </p>
              <p className="text-sm text-gray-500 mt-1.5">{label}</p>
              <p className="text-xs text-gray-300 mt-0.5">
                {loading ? <span className="inline-block w-20 h-3 bg-gray-100 rounded animate-pulse" /> : sub}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          ROW 2 — Subscription (full width)
      ══════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Suscripción</h2>
            <p className="text-sm text-gray-400 mt-0.5">Plan {planLabel(profile?.plan, profile?.plan_type, plans)}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {warn && days !== null && (
              <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                Vence en {days} día{days !== 1 ? 's' : ''}
              </div>
            )}
            {((profile?.plan_type === 'paid' && profile?.billing_status === 'active') || profile?.plan_type === 'free') && (
              <button
                onClick={() => setChangingPlan(v => !v)}
                className={`flex items-center gap-1.5 text-xs font-medium border rounded-lg px-3 py-1.5 transition-colors ${
                  changingPlan
                    ? 'text-gray-500 border-gray-200 bg-gray-50 hover:bg-gray-100'
                    : 'text-indigo-600 border-indigo-200 bg-indigo-50 hover:bg-indigo-100 hover:border-indigo-300'
                }`}>
                <CreditCard className="w-3.5 h-3.5" />
                {changingPlan ? 'Cerrar planes' : profile?.plan_type === 'free' ? 'Adquirir suscripción' : 'Cambiar plan'}
              </button>
            )}
            {profile?.plan_type === 'paid' && profile?.billing_status === 'active' && (
              <button
                onClick={() => setShowCancel(true)}
                className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 border border-red-200 hover:border-red-300 bg-red-50 hover:bg-red-100 rounded-lg px-3 py-1.5 transition-colors">
                Cancelar suscripción
              </button>
            )}
            {profile?.plan_type === 'paid' && profile?.billing_status === 'cancelled' && profile?.subscription_ends_at && (
              <div className="flex items-center gap-1.5 text-xs text-orange-600 bg-orange-50 border border-orange-200 rounded-lg px-3 py-1.5">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                Acceso hasta {fmt(profile.subscription_ends_at, { day: '2-digit', month: 'short', year: 'numeric' })}
              </div>
            )}
          </div>
        </div>

        {/* Progress bar */}
        {profile?.subscription_starts_at && profile?.subscription_ends_at && (
          <div className="mb-6">
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-2">
              <div className={`h-full rounded-full transition-all ${bar}`} style={{ width: `${pct}%` }} />
            </div>
            <div className="flex justify-between text-xs text-gray-400">
              <span>{fmt(profile.subscription_starts_at, { day: '2-digit', month: 'short', year: 'numeric' })}</span>
              <span className="font-medium text-gray-600">{Math.round(pct)}% consumido</span>
              <span>{fmt(profile.subscription_ends_at, { day: '2-digit', month: 'short', year: 'numeric' })}</span>
            </div>
          </div>
        )}

        {/* 3-column detail grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-5">
          {[
            { label: 'Plan',          value: planLabel(profile?.plan, profile?.plan_type, plans) },
            { label: 'Estado',        value: billingText(profile?.billing_status) },
            { label: 'Inicio',        value: fmt(profile?.subscription_starts_at) },
            { label: 'Vencimiento',   value: fmt(profile?.subscription_ends_at) },
            { label: 'Último pago',   value: fmt(profile?.last_payment_at) },
            { label: 'Cuenta creada', value: fmt(profile?.member_since) },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-xs text-gray-400 mb-0.5">{label}</p>
              <p className="text-sm font-medium text-gray-900">{value}</p>
            </div>
          ))}
        </div>

        {/* ── Plan selector (shows when "Cambiar plan"/"Adquirir suscripción" is open) ── */}
        {changingPlan && (profile?.plan_type === 'paid' || profile?.plan_type === 'free') && (
          <div className="mt-6 pt-6 border-t border-gray-100 space-y-3">
            <p className="text-xs text-gray-500 mb-1">
              {profile?.plan_type === 'free'
                ? 'Al pagar, tu cuenta se activa de inmediato — todo lo que ya registraste en tu prueba (socios, visitas, ventas) se conserva.'
                : 'El tiempo restante de tu plan actual se aplica como crédito en tu próxima factura.'}
            </p>

            {!plans ? (
              <div className="space-y-3">
                {[0, 1, 2].map(i => <div key={i} className="h-16 rounded-xl bg-gray-100 animate-pulse" />)}
              </div>
            ) : (
              <>
                {[
                  { id: 'basic', label: plans.basic.label, price: plans.basic.price, desc: BASIC_INCLUDES.join(' · ') },
                  { id: 'full',  label: plans.full.label,  price: plans.full.price,  desc: fullIncludes(plans).slice(1).join(' · ') },
                ].map(p => {
                  const isCurrent = p.id === profile?.plan
                  const isBusy    = planBusy === p.id
                  return (
                    <button key={p.id} type="button"
                      disabled={isCurrent || !!planBusy}
                      onClick={() => handleChangePlan(p.id)}
                      className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl border text-left transition-all ${
                        isCurrent
                          ? 'bg-indigo-50 border-indigo-300 cursor-default'
                          : 'bg-white border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/50 disabled:opacity-50 disabled:cursor-not-allowed'
                      }`}>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-sm font-bold text-gray-800">{p.label}</p>
                          {isCurrent && (
                            <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wide bg-indigo-100 px-1.5 py-0.5 rounded">
                              Actual
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-gray-400 truncate">{p.desc}</p>
                      </div>
                      <div className="flex items-center gap-2.5 flex-shrink-0 ml-4">
                        <div className="text-right">
                          <p className="text-base font-extrabold text-gray-900">${p.price.toLocaleString('es-MX')}</p>
                          <p className="text-[10px] text-gray-400">/mes</p>
                        </div>
                        {isBusy && <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />}
                      </div>
                    </button>
                  )
                })}

                {/* Custom — its own row with the 5-toggle picker inline */}
                <div className={`rounded-xl border p-4 ${profile?.plan === 'custom' ? 'bg-indigo-50 border-indigo-300' : 'bg-white border-gray-200'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-gray-800">Custom</p>
                      {profile?.plan === 'custom' && (
                        <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wide bg-indigo-100 px-1.5 py-0.5 rounded">
                          Actual
                        </span>
                      )}
                    </div>
                    <p className="text-base font-extrabold text-gray-900">
                      ${customTotal(plans, customFeatures).toLocaleString('es-MX')}<span className="text-[10px] font-normal text-gray-400">/mes</span>
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mb-3">
                    {Object.entries(plans.addons).map(([key, addon]) => {
                      const checked = customFeatures.includes(key)
                      return (
                        <label key={key}
                          className={`flex flex-col gap-1 px-2.5 py-2 rounded-lg border cursor-pointer text-xs transition-colors ${checked ? 'border-indigo-300 bg-indigo-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                          <span className="flex items-center justify-between gap-2">
                            <span className="flex items-center gap-2 text-gray-700">
                              <input type="checkbox" checked={checked}
                                onChange={() => setCustomFeatures(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])}
                                className="w-3.5 h-3.5 rounded accent-indigo-500 flex-shrink-0" />
                              {addon.label}
                            </span>
                            <span className="text-gray-400 flex-shrink-0">+${addon.price}</span>
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
                  <button type="button"
                    disabled={profile?.plan === 'custom' || !!planBusy}
                    onClick={() => handleChangePlan('custom')}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                    {planBusy === 'custom' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CreditCard className="w-3.5 h-3.5" />}
                    Elegir Custom
                  </button>
                </div>
              </>
            )}

            <div className="flex items-start gap-2 pt-1 text-[11px] text-gray-400 leading-relaxed">
              <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              {profile?.plan_type === 'free'
                ? 'Serás redirigido a la página de pago de Stripe para activar tu cuenta.'
                : 'Serás redirigido a la página de pago de Stripe. El tiempo restante de tu plan actual se aplica como crédito.'}
            </div>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════
          Extras individuales — selecciona uno, varios o todos y págalos
          juntos en un solo cobro (pago único, mismo precio individual que
          en el builder de Custom). Los ya comprados se muestran sombreados
          con una flecha — no editables desde aquí. Solo duran lo que dure
          la suscripción actual — no se conservan al resuscribirse.
      ══════════════════════════════════════════════════════ */}
      {profile?.plan_type === 'paid' && profile?.billing_status === 'active' && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-1">
            <Gift className="w-4 h-4 text-indigo-500" />
            <h2 className="text-base font-semibold text-gray-900">Extras individuales</h2>
          </div>
          <p className="text-sm text-gray-400 mb-4">
            Selecciona uno, varios o todos y págalos juntos en un solo cobro — mismo precio individual que en el
            builder de Custom. Quedan activos solo mientras dure tu suscripción actual: si esta termina y contratas
            una nueva, no se conservan y tendrás que volver a comprarlos.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {[
              { key: 'whatsapp', label: 'WhatsApp',         Icon: MessageSquare },
              { key: 'products', label: 'Productos',        Icon: Package },
              { key: 'classes',  label: 'Clases',            Icon: Calendar },
              { key: 'import',   label: 'Importar datos',    Icon: Upload },
              { key: 'export',   label: 'Exportar reportes', Icon: Download },
            ].map(({ key, label, Icon }) => {
              const enabled  = !!profile?.plan_features?.[key]
              const price    = plans?.addons?.[key]?.price
              const selected = selectedExtras.includes(key)
              return (
                <button
                  key={key}
                  type="button"
                  disabled={enabled || extraCartBusy}
                  onClick={() => toggleExtra(key)}
                  className={`flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl border text-left transition-colors disabled:cursor-default ${
                    enabled ? 'border-gray-100 bg-gray-50 opacity-70'
                    : selected ? 'border-indigo-300 bg-indigo-50/60 disabled:opacity-60'
                    : 'border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-60'
                  }`}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${enabled ? 'text-gray-400' : selected ? 'text-indigo-600' : 'text-gray-400'}`} />
                    <span className={`text-xs font-bold truncate ${enabled ? 'text-gray-500' : selected ? 'text-indigo-700' : 'text-gray-600'}`}>{label}</span>
                  </span>
                  {enabled ? (
                    <ChevronRight className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                  ) : (
                    <span className={`flex items-center gap-1 flex-shrink-0 ${selected ? '' : 'text-gray-500'}`}>
                      <input type="checkbox" readOnly checked={selected}
                        className="w-3.5 h-3.5 rounded accent-indigo-500 pointer-events-none" />
                      <span className="text-[10px] font-bold">${price}</span>
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {selectedExtras.length > 0 && (
            <div className="flex items-center justify-between gap-3 mt-4 pt-4 border-t border-gray-100">
              <p className="text-sm text-gray-600">
                <span className="font-bold text-gray-900">{selectedExtras.length}</span> extra{selectedExtras.length !== 1 ? 's' : ''} seleccionado{selectedExtras.length !== 1 ? 's' : ''}
                {' · '}<span className="font-bold text-gray-900">${extrasCartTotal.toLocaleString('es-MX')}</span>
              </p>
              <button
                onClick={buyExtrasCart}
                disabled={extraCartBusy}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 transition-colors flex-shrink-0"
              >
                {extraCartBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CreditCard className="w-3.5 h-3.5" />}
                Comprar seleccionados
              </button>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          ROW 3 — Account + Gym + Quick links
      ══════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

        {/* Account */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Cuenta</h2>
          <div className="space-y-4">
            {[
              { label: 'Usuario',   value: profile?.username },
              { label: 'Correo',    value: profile?.email    },
              { label: 'Gimnasio',  value: profile?.gym_name },
              { label: 'Rol',       value: 'Administrador'   },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-xs text-gray-400">{label}</p>
                <p className="text-sm font-medium text-gray-900 mt-0.5 truncate">{value ?? '—'}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Gym stats */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Gimnasio</h2>
          <div className="space-y-4">
            {[
              { label: 'Total de socios',     value: stats?.total_members      },
              { label: 'Por vencer (7 días)', value: stats?.expiring_soon      },
              { label: 'Nuevos este mes',     value: stats?.new_members_month  },
              { label: 'Ingresos del año',    value: fmtMoney(stats?.year_revenue) },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-xs text-gray-400">{label}</p>
                <p className="text-sm font-medium text-gray-900 mt-0.5">
                  {loading ? <span className="inline-block w-14 h-4 bg-gray-100 rounded animate-pulse" /> : (value ?? '—')}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Quick links */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden flex flex-col">
          <div className="px-6 pt-6 pb-4">
            <h2 className="text-sm font-semibold text-gray-900">Accesos rápidos</h2>
          </div>
          <div className="flex-1 divide-y divide-gray-100">
            {[
              { label: 'Mis miembros',        icon: Users,      path: `/g/${sessionHash}/socios`        },
              { label: 'Membresías',          icon: CreditCard, path: `/g/${sessionHash}/membresias`    },
              { label: 'Configuración',       icon: Building2,  path: `/g/${sessionHash}/configuracion` },
              { label: 'Seguridad',           icon: Shield,     path: null, action: () => document.getElementById('security-section')?.scrollIntoView({ behavior: 'smooth' }) },
            ].map(({ label, icon: Icon, path, action }) => (
              <button key={label}
                onClick={() => path ? navigate(path) : action?.()}
                className="w-full flex items-center gap-3 px-6 py-3.5 hover:bg-gray-50 transition-colors text-left">
                <Icon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                <span className="text-sm text-gray-700 flex-1">{label}</span>
                <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          ROW 4 — Security (full width)
      ══════════════════════════════════════════════════════ */}
      <div id="security-section" className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="flex items-start gap-4">
          <div className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center flex-shrink-0">
            <KeyRound className="w-4 h-4 text-gray-400" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold text-gray-900">Seguridad</h2>
            <p className="text-sm text-gray-400 mb-5">Cambia tu contraseña de acceso al sistema.</p>
            <ChangePasswordPanel />
          </div>
        </div>
      </div>

    </div>

    {/* ── Cancel subscription confirmation modal ─────────────────────── */}
    {showCancelModal && (
      <div
        className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
        onClick={() => !cancelLoading && setShowCancel(false)}
      >
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-7" onClick={e => e.stopPropagation()}>
          <div className="w-12 h-12 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center mb-5">
            <AlertTriangle className="w-6 h-6 text-red-500" />
          </div>

          <h3 className="text-lg font-bold text-gray-900 mb-2">¿Cancelar tu suscripción?</h3>
          <p className="text-sm text-gray-500 leading-relaxed mb-4">
            Se detendrán los cobros automáticos. Seguirás teniendo acceso completo hasta el vencimiento de tu período actual
            {profile?.subscription_ends_at ? ` (${fmt(profile.subscription_ends_at, { day: '2-digit', month: 'long', year: 'numeric' })})` : ''}.
            Después de esa fecha la cuenta quedará suspendida.
          </p>

          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-6 text-xs text-amber-700 leading-relaxed">
            Podrás reactivar tu cuenta en cualquier momento iniciando una nueva suscripción.
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => setShowCancel(false)}
              disabled={cancelLoading}
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50">
              Mantener suscripción
            </button>
            <button
              onClick={handleCancelSubscription}
              disabled={cancelLoading}
              className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
              {cancelLoading
                ? <><Loader2 className="w-4 h-4 animate-spin" />Cancelando...</>
                : 'Sí, cancelar suscripción'}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
