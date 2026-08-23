import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams, useLocation, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import * as yup from 'yup'
import ReCAPTCHA from 'react-google-recaptcha'
import {
  Users, CreditCard, TrendingUp, Calendar,
  Shield, Eye, EyeOff, Loader2, Check, X,
  Lock, ArrowRight, Zap, BadgeCheck, Monitor,
  Scan, Gift, MessageSquare, Clock,
  Building2, User, Phone, Send,
  Bot, MonitorSmartphone, Store, Terminal, Mail, CheckCircle2, KeyRound, LogIn,
  MessageCircle,
  MailCheck,
} from 'lucide-react'

import { useAuthStore } from '../store/authStore'
import { isPageLoaderDone, onPageLoaderDone } from '../lib/pageLoaderSignal'
import api from '../api/axios'
import toast from 'react-hot-toast'
import Beams from '../components/Beams'
import GemaSystemLogo from '../components/GemaSystemLogo'
import MobileStaggeredMenu from '../components/MobileStaggeredMenu'
import StrokeLogoMark from '../components/StrokeLogoMark'
import StrokeText from '../components/StrokeText'
import TextType from '../components/TextType'
import Reveal from '../components/Reveal'
import RegisterModal from './Register'
import useLockBodyScroll from '../hooks/useLockBodyScroll'

// ─── Schemas ──────────────────────────────────────────────────────────────────

const loginSchema = yup.object({
  login:    yup.string().required('Ingresa tu usuario o correo'),
  password: yup.string().required('Ingresa tu contraseña'),
})

const trialSchema = yup.object({
  gym_name: yup.string().required('Nombre del gimnasio requerido').max(100),
  name:     yup.string().required('Tu nombre es requerido').max(100),
  email:    yup.string().email('Correo inválido').required('Correo requerido'),
  phone:    yup.string().max(20),
  acceptTerms: yup.boolean()
    .oneOf([true], 'Debes aceptar los Términos y Condiciones para continuar')
    .required('Debes aceptar los Términos y Condiciones para continuar'),
  recaptcha_token: yup.string().required('Verifica que no eres un robot'),
})

const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY



// ─── Data ─────────────────────────────────────────────────────────────────────

const FEATURES = [
  { icon: Users,      color: '#6366F1', title: 'Gestión de Miembros',     desc: 'Registra y administra socios con códigos únicos, historial de pagos, fotos y alertas de vencimiento.' },
  { icon: Scan,       color: '#10B981', title: 'Control de Visitas / QR',  desc: 'Registra asistencia por código QR o búsqueda instantánea. Estadísticas de visitas en tiempo real.' },
  { icon: CreditCard, color: '#3B82F6', title: 'Membresías Inteligentes',  desc: 'Gestiona planes semanales, mensuales y anuales con renovaciones y notificaciones automáticas.' },
  { icon: TrendingUp, color: '#8B5CF6', title: 'Análisis Financiero',      desc: 'Dashboard con gráficas de ingresos, mapa de actividad tipo GitHub, top pagadores y exportación.' },
  { icon: Calendar,   color: '#F59E0B', title: 'Clases y Entrenadores',    desc: 'Programa clases grupales, asigna entrenadores y gestiona horarios desde un panel centralizado.' },
]

// One screenshot per module, same order as FEATURES — drop the files (see
// FeatureShotImage) and each spotlight panel picks them up automatically.
const MODULE_IMAGES = [
  '/images/feature-members.webp',
  '/images/feature-visits.webp',
  '/images/feature-memberships.webp',
  '/images/feature-finances.webp',
  '/images/feature-classes.webp',
]

const PLANS = [
  {
    id: 'weekly', name: 'Semanal', price: '$417', period: '/semana',
    subtext: 'MXN · sin contrato', badge: null, highlight: false,
    features: ['Miembros ilimitados','Control de visitas QR','Membresías flexibles','Exportar básico','Soporte estándar'],
    cta: 'Comenzar', ctaColor: 'dark',
  },
  {
    id: 'monthly', name: 'Mensual', price: '$1,622', period: '/mes',
    subtext: 'MXN · cancela cuando quieras', badge: 'Más popular', highlight: true,
    features: ['Todo lo de Semanal','Análisis financiero completo','Mapa de actividad','Exportar PDF y Excel','Clases y entrenadores','Modo privacidad','Soporte prioritario'],
    cta: 'Comenzar ahora', ctaColor: 'white',
  },
  {
    id: 'annual', name: 'Anual', price: '$9,999', period: '/año',
    subtext: 'Pago único anual · equivale a $833/mes', badge: 'Mejor valor', highlight: false,
    features: ['Todo lo de Mensual','Pago único anual','API access (próx.)','Múltiples sucursales (próx.)','Soporte premium','Gestor de cuenta dedicado'],
    cta: 'Elegir Anual', ctaColor: 'gold',
  },
]

// ─── AuthModal ────────────────────────────────────────────────────────────────

const modalInp    = 'w-full py-3 rounded-xl text-sm text-gray-900 placeholder-gray-400 border bg-gray-50 border-gray-200 hover:border-gray-300 focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/15 outline-none transition-all'
const modalInpErr = 'w-full py-3 rounded-xl text-sm text-gray-900 placeholder-gray-400 border bg-red-50 border-red-300 focus:border-red-400 focus:ring-2 focus:ring-red-500/15 outline-none transition-all'

const FP_RULES = [
  { re: /.{8,}/,         label: 'Mínimo 8 caracteres' },
  { re: /[A-Z]/,         label: 'Una mayúscula' },
  { re: /[a-z]/,         label: 'Una minúscula' },
  { re: /[0-9]/,         label: 'Un número' },
  { re: /[^A-Za-z0-9]/, label: 'Un símbolo' },
]

function AuthModal({ onClose }) {
  useLockBodyScroll()
  const [step, setStep]             = useState(1) // 1=login 2=code 3=blocked 4=pin-consola 5=fp-email 6=fp-code 7=fp-done
  const [savedCreds, setSavedCreds] = useState(null)
  const [showPass, setShowPass]     = useState(false)
  const [showCode, setShowCode]     = useState(false)
  const [showPin, setShowPin]       = useState(false)
  const [blockInfo, setBlockInfo]   = useState(null)
  const [reactivating, setReactivating] = useState(false)
  // ── Forgot password state ──
  const [fpEmail,    setFpEmail]    = useState('')
  const [fpCode,     setFpCode]     = useState('')
  const [fpPass,     setFpPass]     = useState('')
  const [fpConf,     setFpConf]     = useState('')
  const [fpShowPass, setFpShowPass] = useState(false)
  const [fpShowConf, setFpShowConf] = useState(false)
  const [fpLoading,  setFpLoading]  = useState(false)
  const { login, operatorLogin, isLoading } = useAuthStore()
  const navigate                    = useNavigate()

  const fpPasswordValid = FP_RULES.every(r => r.re.test(fpPass))

  const fpSendCode = async (e) => {
    e.preventDefault()
    setFpLoading(true)
    try {
      await api.post('/auth/password/send-code', { email: fpEmail })
      toast.success('Código enviado — revisa tu correo')
      setStep(6)
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Error al enviar. Intenta de nuevo.')
    } finally {
      setFpLoading(false)
    }
  }

  const fpConfirmReset = async (e) => {
    e.preventDefault()
    if (!fpPasswordValid) return toast.error('La contraseña no cumple los requisitos.')
    if (fpPass !== fpConf) return toast.error('Las contraseñas no coinciden.')
    if (fpCode.length !== 6) return toast.error('El código debe tener 6 dígitos.')
    setFpLoading(true)
    try {
      await api.post('/auth/password/reset', { email: fpEmail, code: fpCode, password: fpPass, password_confirmation: fpConf })
      setStep(7)
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Código inválido o expirado.')
    } finally {
      setFpLoading(false)
    }
  }

  const fpReset = () => { setFpEmail(''); setFpCode(''); setFpPass(''); setFpConf(''); setFpShowPass(false); setFpShowConf(false) }

  const lf = useForm({ resolver: yupResolver(loginSchema) })
  const cf = useForm({ resolver: yupResolver(yup.object({ access_code: yup.string().required('Ingresa tu código de acceso') })) })
  const pf = useForm({ resolver: yupResolver(yup.object({ pin: yup.string().required('Ingresa el PIN de consola') })) })

  const onLogin = async (data) => {
    try {
      const result = await login({ login: data.login, password: data.password })
      if (result?.requiresPin)  { setSavedCreds({ login: data.login, password: data.password }); setStep(4); return }
      if (result?.requiresCode) { setSavedCreds({ login: data.login, password: data.password }); setStep(2); return }
      toast.success('¡Bienvenido de vuelta!')
      onClose()
      navigate(`/g/${result.sessionHash}/panel`)
    } catch (err) {
      const d = err.response?.data
      if (d?.account_blocked) {
        // Password was already verified by the login attempt above — remember it so
        // reactivation doesn't have to ask for it again.
        setSavedCreds({ password: data.password })
        setBlockInfo({ type: d.block_type, reason: d.reason, subscriptionEnds: d.subscription_ends, plan: d.plan, email: d.email })
        setStep(3)
        return
      }
      toast.error(d?.errors?.login?.[0] ?? d?.message ?? 'Credenciales incorrectas')
    }
  }

  // Reactivate directly with the credentials already validated at login — no need
  // to ask the user for their password a second time.
  const reactivateNow = async (planId) => {
    if (!blockInfo?.email || !savedCreds?.password) return
    setReactivating(true)
    try {
      const res = await api.post('/stripe/create-session', {
        email:                  blockInfo.email,
        password:                savedCreds.password,
        password_confirmation:   savedCreds.password,
        plan_id:                 planId,
      })
      window.location.href = res.data.url
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'No se pudo iniciar la reactivación. Intenta de nuevo.')
      setReactivating(false)
    }
  }

  const onSubmitCode = async (data) => {
    try {
      const r2 = await login({ ...savedCreds, access_code: data.access_code })
      toast.success('¡Bienvenido de vuelta!')
      onClose()
      navigate(`/g/${r2.sessionHash}/panel`)
    } catch (err) {
      toast.error(err.response?.data?.errors?.access_code?.[0] ?? err.response?.data?.message ?? 'Código incorrecto')
    }
  }

  const onSubmitPin = async (data) => {
    try {
      const result = await operatorLogin({ ...savedCreds, pin: data.pin })
      toast.success('Acceso a consola concedido')
      onClose()
      navigate(`/sys/${result.operatorHash}`)
    } catch (err) {
      const d = err.response?.data
      toast.error(d?.errors?.pin?.[0] ?? d?.message ?? 'PIN incorrecto')
    }
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 overflow-hidden">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-lg" onClick={onClose} />

      <div className="relative w-full max-w-sm z-10" style={{ animation: 'modalIn 0.3s cubic-bezier(0.34,1.56,0.64,1) both' }}>
        <div className="bg-white rounded-3xl overflow-hidden shadow-2xl shadow-slate-900/15 border border-gray-100">

          {/* Top accent bar */}
          <div className="h-1" style={{ background: 'linear-gradient(90deg,#6366F1,#8B5CF6,#6366F1)' }} />

          {/* Header */}
          <div className="px-7 pt-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
                  <GemaSystemLogo className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-extrabold text-gray-900 leading-none tracking-tight">GemaSystem</p>
                  <p className="text-[9px] font-mono text-gray-400 mt-0.5">v1.0.0-beta.1</p>
                </div>
              </div>
              <button onClick={onClose}
                className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-all">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="mb-5">
              <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">
                {step === 3
                  ? blockInfo?.type === 'payment_due'   ? 'Pago requerido'
                  : blockInfo?.type === 'trial_expired' ? 'Prueba gratuita finalizada'
                  : blockInfo?.type === 'suspended'     ? 'Cuenta suspendida'
                  :                                       'Acceso restringido'
                  : step === 4 ? 'Verificación de consola'
                  : step === 2 ? 'Verificación en 2 pasos'
                  : step === 5 ? '¿Olvidaste tu contraseña?'
                  : step === 6 ? 'Crea tu nueva contraseña'
                  : step === 7 ? '¡Contraseña actualizada!'
                  : 'Bienvenido de vuelta'}
              </h2>
              <p className="text-sm text-gray-400 mt-0.5">
                {step === 3
                  ? blockInfo?.type === 'payment_due'
                    ? 'Tu suscripción no pudo renovarse. Actualiza tu método de pago.'
                  : blockInfo?.type === 'trial_expired'
                    ? 'Tu período de 10 días gratuitos ha terminado.'
                    : 'Tu cuenta no puede iniciar sesión en este momento'
                  : step === 4 ? 'Ingresa el PIN del sistema para acceder a la consola'
                  : step === 2 ? 'Tu cuenta tiene un código de seguridad habilitado'
                  : step === 5 ? 'Te enviaremos un código de 6 dígitos a tu correo'
                  : step === 6 ? `Código enviado a ${fpEmail}`
                  : step === 7 ? 'Ya puedes iniciar sesión con tu nueva contraseña'
                  : 'Ingresa tus credenciales para continuar'}
              </p>
            </div>
          </div>

          {/* Forms */}
          <div className="px-7 pb-6">
            {step === 1 && (
              <form onSubmit={lf.handleSubmit(onLogin)} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                    Usuario o correo
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    <input {...lf.register('login')} type="text" placeholder="usuario@ejemplo.com"
                      className={`${lf.formState.errors.login ? modalInpErr : modalInp} pl-10 pr-4`}
                      autoComplete="username" />
                  </div>
                  {lf.formState.errors.login && (
                    <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                      <X className="w-3 h-3 flex-shrink-0" />{lf.formState.errors.login.message}
                    </p>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Contraseña
                    </label>
                    <button type="button" onClick={() => { setStep(5); lf.reset() }}
                      className="text-xs text-indigo-500 hover:text-indigo-700 font-medium transition-colors">
                      ¿Olvidaste tu contraseña?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    <input {...lf.register('password')} type={showPass ? 'text' : 'password'} placeholder="••••••••"
                      className={`${lf.formState.errors.password ? modalInpErr : modalInp} pl-10 pr-11`}
                      autoComplete="current-password" />
                    <button type="button" onClick={() => setShowPass(s => !s)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-0.5">
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {lf.formState.errors.password && (
                    <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                      <X className="w-3 h-3 flex-shrink-0" />{lf.formState.errors.password.message}
                    </p>
                  )}
                </div>

                <button type="submit" disabled={isLoading}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm text-white transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 mt-1"
                  style={{ background: 'linear-gradient(135deg,#4F46E5,#7C3AED)', boxShadow: '0 8px 24px rgba(99,102,241,0.35)' }}>
                  {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Verificando...</> : <>Continuar <ArrowRight className="w-4 h-4" /></>}
                </button>
              </form>
            )}

            {step === 2 && (
              <form onSubmit={cf.handleSubmit(onSubmitCode)} className="space-y-4">
                <div className="flex flex-col items-center gap-3 py-1">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                    <Shield className="w-7 h-7 text-indigo-500" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-gray-700">Código de acceso</p>
                    <p className="text-xs text-gray-400 mt-0.5">Ingresa el código configurado en tu cuenta</p>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                    Código de acceso
                  </label>
                  <div className="relative">
                    <Shield className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    <input {...cf.register('access_code')} type={showCode ? 'text' : 'password'}
                      placeholder="XXXXXXXX" autoComplete="off" autoFocus
                      className={`${cf.formState.errors.access_code ? modalInpErr : modalInp} pl-10 pr-11 text-center tracking-[0.3em] font-mono`} />
                    <button type="button" onClick={() => setShowCode(s => !s)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-0.5">
                      {showCode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {cf.formState.errors.access_code && (
                    <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                      <X className="w-3 h-3 flex-shrink-0" />{cf.formState.errors.access_code.message}
                    </p>
                  )}
                </div>
                <button type="submit" disabled={isLoading}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm text-white transition-all hover:-translate-y-0.5 disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg,#4F46E5,#7C3AED)', boxShadow: '0 8px 24px rgba(99,102,241,0.35)' }}>
                  {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Verificando...</> : 'Iniciar sesión'}
                </button>
                <button type="button" onClick={() => { setStep(1); cf.reset(); setShowCode(false) }}
                  className="w-full py-2 text-xs text-gray-400 hover:text-gray-600 transition-colors flex items-center justify-center gap-1">
                  <ArrowRight className="w-3 h-3 rotate-180" /> Volver y cambiar credenciales
                </button>
              </form>
            )}

            {/* ── Step 4: PIN de consola ── */}
            {step === 4 && (
              <form onSubmit={pf.handleSubmit(onSubmitPin)} className="space-y-4">
                <div className="flex flex-col items-center gap-3 py-1">
                  <div className="w-14 h-14 rounded-2xl bg-slate-900 flex items-center justify-center shadow-lg">
                    <Terminal className="w-7 h-7 text-emerald-400" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-gray-700">PIN del sistema</p>
                    <p className="text-xs text-gray-400 mt-0.5">Este PIN es exclusivo para cuentas de operador</p>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                    PIN de consola
                  </label>
                  <div className="relative">
                    <Terminal className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    <input {...pf.register('pin')} type={showPin ? 'text' : 'password'}
                      placeholder="••••••••" autoComplete="off" autoFocus
                      className={`${pf.formState.errors.pin ? modalInpErr : modalInp} pl-10 pr-11 font-mono tracking-[0.3em] text-center`} />
                    <button type="button" onClick={() => setShowPin(s => !s)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-0.5">
                      {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {pf.formState.errors.pin && (
                    <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                      <X className="w-3 h-3 flex-shrink-0" />{pf.formState.errors.pin.message}
                    </p>
                  )}
                </div>
                <button type="submit" disabled={isLoading}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm text-white transition-all hover:-translate-y-0.5 disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg,#0f172a,#1e293b)', boxShadow: '0 8px 24px rgba(0,0,0,0.35)' }}>
                  {isLoading
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Verificando...</>
                    : <><Terminal className="w-4 h-4" /> Acceder a consola</>}
                </button>
                <button type="button" onClick={() => { setStep(1); pf.reset(); setShowPin(false) }}
                  className="w-full py-2 text-xs text-gray-400 hover:text-gray-600 transition-colors flex items-center justify-center gap-1">
                  <ArrowRight className="w-3 h-3 rotate-180" /> Volver
                </button>
              </form>
            )}

            {/* ── Step 3: Account blocked ── */}
            {step === 3 && blockInfo && (
              <div className="space-y-4">

                {/* ── Trial expirado ── */}
                {blockInfo.type === 'trial_expired' && (
                  <>
                    <div className="flex justify-center">
                      <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center">
                        <Clock className="w-8 h-8 text-indigo-500" />
                      </div>
                    </div>
                    <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 space-y-1.5">
                      <p className="text-sm font-bold text-indigo-900">Cuenta suspendida — período de prueba terminado</p>
                      <p className="text-xs text-indigo-700 leading-relaxed">
                        Tu acceso gratuito de 10 días venció
                        {blockInfo.subscriptionEnds ? <> el <span className="font-semibold">{blockInfo.subscriptionEnds}</span>.</> : '.'}{' '}
                        Activa un plan para recuperar el acceso a tu cuenta.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-1">Activa tu cuenta con un plan</p>
                      {[
                        { id: 'weekly',  label: 'Semanal',  price: '$399/sem',   desc: 'Sin contrato' },
                        { id: 'monthly', label: 'Mensual', price: '$1,560/mes', desc: 'Más popular' },
                      ].map(p => (
                        <button key={p.id} type="button" disabled={reactivating}
                          onClick={() => reactivateNow(p.id)}
                          className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-all group disabled:opacity-60">
                          <div className="text-left">
                            <p className="text-sm font-bold text-gray-800 group-hover:text-indigo-700">{p.label}</p>
                            <p className="text-[10px] text-gray-400">{p.desc}</p>
                          </div>
                          {reactivating ? <Loader2 className="w-4 h-4 animate-spin text-indigo-500" /> : <span className="text-sm font-extrabold text-indigo-600">{p.price}</span>}
                        </button>
                      ))}
                    </div>
                    <a href="mailto:soporte@gemasystem.mx"
                      className="flex items-center gap-2 text-xs text-gray-400 hover:text-indigo-600 transition-colors justify-center">
                      <Send className="w-3 h-3" /> soporte@gemasystem.mx
                    </a>
                  </>
                )}

                {/* ── Pago vencido ── */}
                {blockInfo.type === 'payment_due' && (
                  <>
                    <div className="flex justify-center">
                      <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center">
                        <CreditCard className="w-8 h-8 text-amber-500" />
                      </div>
                    </div>
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-1.5">
                      <p className="text-sm font-bold text-amber-900">Cuenta suspendida por falta de pago</p>
                      <p className="text-xs text-amber-700 leading-relaxed">
                        Tu suscripción al plan <span className="font-semibold">{blockInfo.plan === 'weekly' ? 'Semanal' : 'Mensual'}</span> venció
                        {blockInfo.subscriptionEnds
                          ? <> el <span className="font-semibold">{blockInfo.subscriptionEnds}</span>.</>
                          : <> y no se renovó.</>
                        }
                        {' '}Reactiva tu cuenta para recuperar el acceso.
                      </p>
                    </div>

                    {/* Botón principal de reactivación */}
                    <button
                      type="button" disabled={reactivating}
                      onClick={() => reactivateNow(blockInfo.plan ?? 'monthly')}
                      className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm text-white transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60"
                      style={{ background: 'linear-gradient(135deg,#4F46E5,#7C3AED)', boxShadow: '0 8px 24px rgba(99,102,241,0.35)' }}>
                      {reactivating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                      {reactivating ? 'Redirigiendo a Stripe...' : 'Reactivar mi cuenta'}
                    </button>

                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-1">O elige un plan diferente</p>
                      {[
                        { id: 'weekly',  label: 'Semanal',  price: '$399/sem',   desc: 'Sin contrato' },
                        { id: 'monthly', label: 'Mensual', price: '$1,560/mes', desc: 'Más popular' },
                      ].map(p => (
                        <button key={p.id} type="button" disabled={reactivating}
                          onClick={() => reactivateNow(p.id)}
                          className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-all group disabled:opacity-60">
                          <div className="text-left">
                            <p className="text-sm font-bold text-gray-800 group-hover:text-indigo-700">{p.label}</p>
                            <p className="text-[10px] text-gray-400">{p.desc}</p>
                          </div>
                          <span className="text-sm font-extrabold text-indigo-600">{p.price}</span>
                        </button>
                      ))}
                    </div>
                    <a href="mailto:soporte@gemasystem.mx"
                      className="flex items-center gap-2 text-xs text-gray-400 hover:text-indigo-600 transition-colors justify-center">
                      <Send className="w-3 h-3" /> soporte@gemasystem.mx
                    </a>
                  </>
                )}

                {/* ── Suspended / Restricted ── */}
                {blockInfo.type !== 'payment_due' && (
                  <>
                    <div className="flex justify-center">
                      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
                        blockInfo.type === 'suspended' ? 'bg-red-50' : 'bg-orange-50'
                      }`}>
                        <Shield className={`w-8 h-8 ${blockInfo.type === 'suspended' ? 'text-red-500' : 'text-orange-500'}`} />
                      </div>
                    </div>
                    <div className={`rounded-2xl border p-4 ${blockInfo.type === 'suspended' ? 'bg-red-50 border-red-200' : 'bg-orange-50 border-orange-200'}`}>
                      <p className={`text-sm font-bold mb-1 ${blockInfo.type === 'suspended' ? 'text-red-800' : 'text-orange-800'}`}>
                        {blockInfo.type === 'suspended' ? 'Acceso completamente suspendido' : 'Acceso temporalmente restringido'}
                      </p>
                      <p className={`text-xs leading-relaxed ${blockInfo.type === 'suspended' ? 'text-red-700' : 'text-orange-700'}`}>
                        {blockInfo.type === 'suspended'
                          ? 'Tu cuenta fue desactivada por el administrador del sistema.'
                          : 'Tu cuenta tiene restricciones activas que impiden el acceso.'}
                      </p>
                    </div>
                    {blockInfo.reason && (
                      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Motivo</p>
                        <p className="text-sm text-gray-700 leading-relaxed">{blockInfo.reason}</p>
                      </div>
                    )}
                    <div className="rounded-2xl border border-gray-200 p-4 space-y-2.5">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">¿Necesitas ayuda?</p>
                      <a href="mailto:soporte@gemasystem.mx"
                        className="flex items-center gap-2.5 text-sm text-gray-700 hover:text-indigo-600 transition-colors group">
                        <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-100 transition-colors">
                          <Send className="w-3.5 h-3.5 text-indigo-600" />
                        </div>
                        soporte@gemasystem.mx
                      </a>
                    </div>
                  </>
                )}

                <button onClick={() => { setStep(1); setBlockInfo(null); lf.reset() }}
                  className="w-full py-2.5 text-xs font-semibold text-gray-500 hover:text-gray-800 border border-gray-200 rounded-xl hover:bg-gray-50 transition-all flex items-center justify-center gap-1.5">
                  <ArrowRight className="w-3.5 h-3.5 rotate-180" /> Intentar con otra cuenta
                </button>
              </div>
            )}

            {/* ── Step 5: Forgot password — enter email ── */}
            {step === 5 && (
              <form onSubmit={fpSendCode} className="space-y-4">
                <div className="flex justify-center py-1">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                    <Mail className="w-7 h-7 text-indigo-500" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                    Correo de tu cuenta
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    <input
                      type="email" value={fpEmail} onChange={e => setFpEmail(e.target.value)}
                      placeholder="correo@ejemplo.com" required autoFocus
                      className={`${modalInp} pl-10 pr-4`}
                    />
                  </div>
                </div>
                <button type="submit" disabled={fpLoading || !fpEmail}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm text-white transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                  style={{ background: 'linear-gradient(135deg,#4F46E5,#7C3AED)', boxShadow: '0 8px 24px rgba(99,102,241,0.35)' }}>
                  {fpLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</> : <>Enviar código <ArrowRight className="w-4 h-4" /></>}
                </button>
                <button type="button" onClick={() => { setStep(1); fpReset() }}
                  className="w-full py-2 text-xs text-gray-400 hover:text-gray-600 transition-colors flex items-center justify-center gap-1">
                  <ArrowRight className="w-3 h-3 rotate-180" /> Volver al inicio de sesión
                </button>
              </form>
            )}

            {/* ── Step 6: Forgot password — code + new password ── */}
            {step === 6 && (
              <form onSubmit={fpConfirmReset} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                    Código de verificación (6 dígitos)
                  </label>
                  <input
                    type="text" value={fpCode}
                    onChange={e => setFpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000" maxLength={6} autoFocus
                    className={`${modalInp} text-center text-xl tracking-[0.5em] font-mono`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                    Nueva contraseña
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    <input type={fpShowPass ? 'text' : 'password'} value={fpPass}
                      onChange={e => setFpPass(e.target.value)} placeholder="••••••••"
                      className={`${modalInp} pl-10 pr-11`} />
                    <button type="button" onClick={() => setFpShowPass(s => !s)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-0.5">
                      {fpShowPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {fpPass && (
                    <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
                      {FP_RULES.map(r => {
                        const ok = r.re.test(fpPass)
                        return (
                          <span key={r.label} className={`flex items-center gap-1.5 text-[10px] ${ok ? 'text-emerald-600' : 'text-gray-400'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${ok ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                            {r.label}
                          </span>
                        )
                      })}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                    Confirmar contraseña
                  </label>
                  <div className="relative">
                    <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    <input type={fpShowConf ? 'text' : 'password'} value={fpConf}
                      onChange={e => setFpConf(e.target.value)} placeholder="••••••••"
                      className={`${modalInp} pl-10 pr-11`} />
                    <button type="button" onClick={() => setFpShowConf(s => !s)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-0.5">
                      {fpShowConf ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {fpConf && fpPass !== fpConf && (
                    <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                      <X className="w-3 h-3 flex-shrink-0" /> Las contraseñas no coinciden
                    </p>
                  )}
                </div>
                <button type="submit"
                  disabled={fpLoading || !fpPasswordValid || fpPass !== fpConf || fpCode.length !== 6}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm text-white transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                  style={{ background: 'linear-gradient(135deg,#4F46E5,#7C3AED)', boxShadow: '0 8px 24px rgba(99,102,241,0.35)' }}>
                  {fpLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</> : 'Cambiar contraseña'}
                </button>
                <button type="button" onClick={() => setStep(5)}
                  className="w-full py-2 text-xs text-gray-400 hover:text-gray-600 transition-colors flex items-center justify-center gap-1">
                  <ArrowRight className="w-3 h-3 rotate-180" /> ¿No recibiste el código? Volver
                </button>
              </form>
            )}

            {/* ── Step 7: Forgot password — success ── */}
            {step === 7 && (
              <div className="flex flex-col items-center py-4 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                </div>
                <p className="text-sm text-gray-500 leading-relaxed">
                  Tu contraseña fue actualizada correctamente. Ya puedes iniciar sesión con tu nueva contraseña.
                </p>
                <button onClick={() => { setStep(1); fpReset() }}
                  className="w-full py-3.5 rounded-xl font-bold text-sm text-white transition-all hover:-translate-y-0.5"
                  style={{ background: 'linear-gradient(135deg,#4F46E5,#7C3AED)', boxShadow: '0 8px 24px rgba(99,102,241,0.35)' }}>
                  Iniciar sesión
                </button>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-7 py-4 border-t border-gray-100 bg-gray-50/70 flex items-center justify-between">
            <p className="text-xs text-gray-400">
              ¿Sin cuenta?{' '}
              <button onClick={() => { onClose(); navigate('/register') }}
                className="text-indigo-600 hover:text-indigo-700 font-semibold transition-colors">
                Ver planes
              </button>
            </p>
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <Shield className="w-3 h-3 text-emerald-500" />
              <span>Datos protegidos</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── HeroPreviewImage (static screenshot — drop the file, it just appears) ────

const HERO_PREVIEW_SRC = '/images/hero-preview.webp'

function HeroPreviewImage() {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <div className="w-full max-w-6xl mx-auto aspect-video rounded-2xl border border-dashed border-white/15 bg-white/[0.02] flex flex-col items-center justify-center gap-2 text-slate-500 px-6 text-center">
        <Monitor className="w-8 h-8" />
        <p className="text-sm font-medium">
          Coloca tu captura en <span className="text-indigo-300 font-mono">frontend/public/images/hero-preview.webp</span>
        </p>
      </div>
    )
  }

  return (
    <img
      src={HERO_PREVIEW_SRC}
      alt="Panel de GemaSystem"
      className="w-full max-w-6xl mx-auto block rounded-t-2xl border border-b-0 border-white/10"
      style={{
        maskImage: 'linear-gradient(to bottom, black 55%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(to bottom, black 55%, transparent 100%)',
      }}
      onError={() => setFailed(true)}
    />
  )
}

// ─── FeatureShotImage (static screenshots for the módulos section) ───────────
// Fills its wrapping card exactly like the live mock-UI components did —
// same `object-cover`, same rounded/overflow-hidden container — just drop
// the file at the given path and it replaces the placeholder automatically.

function FeatureShotImage({ src, alt }) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-slate-500 bg-white/[0.02] px-4 text-center">
        <Monitor className="w-6 h-6" />
        <p className="text-xs font-medium">
          Coloca <span className="text-indigo-300 font-mono">frontend/public{src}</span>
        </p>
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      className="w-full h-full object-cover object-top block"
      onError={() => setFailed(true)}
    />
  )
}

// ─── ModuleSpotlight (módulos section) ────────────────────────────────────────
// One "app window" — real browser chrome, a tab per module — instead of a
// card grid or a sidebar list. Switching tabs crossfades the screenshot;
// small floating glass chips and a color-shifting ambient glow give it
// depth. Auto-advances on a timer (paused on hover, skipped for
// prefers-reduced-motion), with a dot-progress rail underneath doubling as
// manual navigation.

function slugify(s) {
  return s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function ModuleSpotlight({ features, images }) {
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)
  const reduceMotion = typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  useEffect(() => {
    if (paused || reduceMotion) return
    const t = setInterval(() => setActive(i => (i + 1) % features.length), 4800)
    return () => clearInterval(t)
  }, [paused, reduceMotion, features.length])

  const current = features[active]
  const CurrentIcon = current.icon
  const shot = images[active]

  return (
    <div
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <style>{`
        @keyframes moduleFade { from { opacity: 0; transform: scale(1.015) } to { opacity: 1; transform: scale(1) } }
        .ms-tabs::-webkit-scrollbar { display: none }
        .ms-tabs { scrollbar-width: none }
      `}</style>

      {/* Ambient glow — shifts to the active module's color */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none -z-10" aria-hidden="true">
        <div className="w-[85%] h-[75%] rounded-full transition-colors duration-700"
          style={{ background: current.color, opacity: 0.16, filter: 'blur(110px)' }} />
      </div>

      {/* App window */}
      <div className="relative max-w-4xl mx-auto rounded-3xl overflow-hidden border shadow-2xl transition-colors duration-500"
        style={{ borderColor: `${current.color}35` }}>

        {/* Chrome bar — traffic lights, url, tabs */}
        <div className="flex items-center gap-3 px-4 sm:px-5 py-3 border-b flex-wrap sm:flex-nowrap"
          style={{ background: '#0b0e14', borderColor: 'rgba(255,255,255,0.06)' }}>
          <div className="flex gap-1.5 flex-shrink-0">
            <span className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-400/70" />
            <span className="w-2.5 h-2.5 rounded-full bg-green-400/70" />
          </div>
          <div className="hidden sm:flex items-center gap-1.5 bg-white/5 rounded-lg px-3 py-1.5 text-[11px] font-mono text-slate-500 min-w-0 order-3 sm:order-none w-full sm:w-auto sm:flex-1">
            <Lock className="w-3 h-3 text-slate-600 flex-shrink-0" />
            <span className="truncate">app.gemasystem.app/{slugify(current.title)}</span>
          </div>
          <div className="ms-tabs flex items-center gap-1 overflow-x-auto ml-auto flex-shrink-0">
            {features.map((f, i) => {
              const FIcon = f.icon
              const isActive = i === active
              return (
                <button key={f.title} onClick={() => setActive(i)} title={f.title} aria-label={f.title}
                  className="relative flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300"
                  style={{
                    background: isActive ? f.color + '22' : 'transparent',
                    border: `1px solid ${isActive ? f.color + '55' : 'transparent'}`,
                  }}>
                  <FIcon className="w-3.5 h-3.5" style={{ color: isActive ? f.color : '#64748b' }} />
                </button>
              )
            })}
          </div>
        </div>

        {/* Screenshot */}
        <div className="relative min-h-[240px] sm:min-h-[320px] md:min-h-[420px]">
          <div key={shot ?? active} className="w-full h-full min-h-[240px] sm:min-h-[320px] md:min-h-[420px]" style={{ animation: reduceMotion ? 'none' : 'moduleFade 0.45s ease both' }}>
            {shot
              ? <FeatureShotImage src={shot} alt={current.title} />
              : (
                <div className="w-full h-full min-h-[240px] sm:min-h-[320px] md:min-h-[420px] flex items-center justify-center">
                  <CurrentIcon className="w-16 h-16" style={{ color: current.color, opacity: 0.3 }} />
                </div>
              )}
          </div>

          {/* Floating glass chip — active module */}
          <div className="hidden sm:flex absolute left-5 top-6 items-center gap-2 pl-2 pr-3.5 py-2 rounded-xl border shadow-xl backdrop-blur-md transition-colors duration-500"
            style={{ background: 'rgba(13,17,23,0.82)', borderColor: `${current.color}40`, transform: 'rotate(-3deg)' }}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: current.color + '25' }}>
              <CurrentIcon className="w-3.5 h-3.5" style={{ color: current.color }} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-white leading-none truncate max-w-[160px]">{current.title}</p>
              <p className="text-[9px] text-slate-500 mt-0.5">Módulo activo</p>
            </div>
          </div>

          {/* Floating glass chip — live pulse */}
          <div className="hidden sm:flex absolute right-5 bottom-6 items-center gap-1.5 px-3 py-1.5 rounded-full border shadow-xl backdrop-blur-md"
            style={{ background: 'rgba(13,17,23,0.82)', borderColor: 'rgba(16,185,129,0.4)' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] font-bold text-emerald-300">En vivo</span>
          </div>
        </div>
      </div>

      {/* Caption + dot progress */}
      <div className="text-center mt-8 max-w-lg mx-auto px-4">
        <h3 className="text-xl font-bold text-white">{current.title}</h3>
        <p className="text-sm text-slate-400 mt-2 leading-relaxed">{current.desc}</p>
        <div className="flex items-center justify-center gap-1.5 mt-6">
          {features.map((f, i) => (
            <button key={f.title} onClick={() => setActive(i)} aria-label={f.title}
              className="h-1.5 rounded-full transition-all duration-300"
              style={{ width: i === active ? 26 : 8, background: i === active ? f.color : 'rgba(255,255,255,0.15)' }} />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Landing ──────────────────────────────────────────────────────────────────

export default function Landing() {
  const [searchParams]            = useSearchParams()
  const location                  = useLocation()
  const [loginOpen, setLoginOpen] = useState(() => searchParams.get('login') === '1')
  const [registerOpen, setRegisterOpen] = useState(() => location.pathname === '/register')
  useEffect(() => {
    if (location.pathname === '/register') setRegisterOpen(true)
  }, [location.pathname])
  const [navOpen, setNavOpen]         = useState(false)
  const navigate                  = useNavigate()

  // The hero's stroke-draw title should only start once App's full-screen
  // splash loader is gone — otherwise it plays and finishes while hidden
  // underneath it and is never actually seen.
  const [heroReady, setHeroReady] = useState(isPageLoaderDone)
  useEffect(() => onPageLoaderDone(() => setHeroReady(true)), [])

  const [trialDone, setTrialDone]       = useState(false)
  const [trialLoading, setTrialLoading] = useState(false)
  const trialForm = useForm({ resolver: yupResolver(trialSchema) })
  const recaptchaRefTrial = useRef(null)

  const goRegister = (planId = 'monthly') => { navigate(`/register?plan=${planId}`); setNavOpen(false) }

  const scrollToTrial = () => {
    document.getElementById('prueba-gratis')?.scrollIntoView({ behavior: 'smooth' })
    setNavOpen(false)
  }

  const onTrialSubmit = async (data) => {
    setTrialLoading(true)
    try {
      await api.post('/trial-requests', {
        gym_name: data.gym_name,
        contact_name: data.name,
        email: data.email,
        phone: data.phone || null,
        recaptcha_token: data.recaptcha_token,
      })
      setTrialDone(true)
    } catch (err) {
      const msg = err.response?.data?.message || 'Ocurrió un error, intenta de nuevo.'
      toast.error(msg)
      // reCAPTCHA tokens are single-use — force a fresh check before retrying.
      recaptchaRefTrial.current?.reset()
      trialForm.setValue('recaptcha_token', '')
    } finally {
      setTrialLoading(false)
    }
  }

  const tf = trialForm

  // Only reveal the reCAPTCHA once the visitor has actually finished filling the
  // required fields + accepted the terms — keeps the form looking simple up front
  // instead of front-loading a security widget before there's anything to verify.
  const [trialGymName, trialContactName, trialEmail, trialAcceptTerms] =
    tf.watch(['gym_name', 'name', 'email', 'acceptTerms'])
  const trialFormReady = !!(trialGymName?.trim() && trialContactName?.trim() && trialEmail?.trim() && trialAcceptTerms)

  return (
    <div className="relative">
      <style>{`
        @keyframes modalIn { from { opacity:0; transform:scale(0.94) translateY(8px); } to { opacity:1; transform:scale(1) translateY(0); } }
        @keyframes fadeUp  { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        .fade-up { animation: fadeUp 0.5s ease both; }
        /* Traveling pulse dot for the #automatizaciones step-by-step pipeline —
           position is keyframed as a % of the connector it sits in, color/glow
           set per-instance via inline style so one keyframe serves every step. */
        @keyframes flowMoveY {
          0%   { top: 0%;   opacity: 0; }
          15%  { opacity: 1; }
          85%  { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        .flow-dot-v { position: absolute; left: -3px; width: 7px; height: 7px; border-radius: 9999px; animation: flowMoveY 2s ease-in-out infinite; }
        /* Anchor-linked sections (#automatizaciones, #precios, ...) land
           flush at the very top of the viewport when jumped to, but the
           fixed header (logo + menu toggle) floats over that same space
           — without this, each section's heading lands hidden behind it. */
        section[id] { scroll-margin-top: 96px; }
      `}</style>

      {/* Beams — animated light beams background */}
      <div className="fixed inset-0" style={{ zIndex: 0, background: '#000000' }}>
        <Beams
          lightColor="#A855F7"
          rotation={64}
          beamNumber={17}
          scale={0.22}
          beamWidth={3.1}
          noiseIntensity={0.45}
        />
      </div>

      {/* ── Header — reactbits.dev's "Staggered Menu" pattern
          (https://reactbits.dev/components/staggered-menu): a permanently
          transparent fixed header (just logo + toggle, no bar/background of
          its own — this page is dark-themed top to bottom via the fixed
          Beams canvas, so light text reads fine at any scroll position, no
          scroll-driven morphing needed) that opens the full-screen panel
          below. Login/trial actions live in that panel now, not here —
          matches reactbits' own minimal header instead of the previous
          CardNav's inline buttons + 3-column dropdown. */}
      <div className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-5 sm:px-8 py-5 sm:py-6 pointer-events-none">
        <div className="flex items-center gap-2.5 pointer-events-auto">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-md shadow-indigo-500/30 flex-shrink-0">
            <GemaSystemLogo className="w-4 h-4" />
          </div>
          <span className="font-extrabold text-base text-white tracking-tight">GemaSystem</span>
          <span className="hidden sm:inline-block text-[9px] font-black uppercase tracking-wide text-black bg-amber-400 rounded px-1.5 py-0.5 -rotate-3 shadow-sm select-none">
            en desarrollo
          </span>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button onClick={() => setLoginOpen(true)} aria-label="Iniciar sesión" title="Iniciar sesión"
            className="pointer-events-auto w-10 h-10 sm:w-auto sm:h-auto flex items-center justify-center gap-1.5 rounded-lg sm:px-4 sm:py-2 text-sm font-semibold text-white border border-white/20 hover:bg-white/10 transition-colors flex-shrink-0">
            <LogIn className="w-4 h-4" />
            <span className="hidden sm:inline">Iniciar sesión</span>
          </button>

          <button onClick={() => setNavOpen(o => !o)} aria-label={navOpen ? 'Cerrar menú' : 'Abrir menú'} aria-expanded={navOpen}
            className="pointer-events-auto w-10 h-10 flex flex-col items-center justify-center gap-[5px] rounded-lg hover:bg-white/10 transition-colors flex-shrink-0">
            <span className={`block w-5 h-[1.5px] bg-white rounded-full transition-all duration-300 origin-center ${navOpen ? 'translate-y-[3.5px] rotate-45' : ''}`} />
            <span className={`block w-5 h-[1.5px] bg-white rounded-full transition-all duration-300 ${navOpen ? '-translate-y-[3.5px] -rotate-45' : ''}`} />
          </button>
        </div>
      </div>

      <MobileStaggeredMenu
        open={navOpen}
        onClose={() => setNavOpen(false)}
        onLogin={() => setLoginOpen(true)}
        onTrial={scrollToTrial}
      />

      {/* ── Hero ── */}
      {/* min-h-screen is the fallback for browsers without svh support;
          min-h-[100svh] (small viewport height) wins where available so
          mobile browser chrome showing/hiding doesn't leave the title+image
          group looking off-center on first load. */}
      <section className="relative z-10 overflow-hidden min-h-screen min-h-[100svh] flex flex-col items-center justify-center text-center px-4 sm:px-6 py-16 pt-32">
        {heroReady ? (
          <h1 className="flex items-center justify-center gap-0.5 sm:gap-1">
            <StrokeLogoMark
              className="h-[clamp(52px,9vw,140px)]"
              delay={0}
              duration={0.8}
            />
            <StrokeText
              text="emaSystem"
              className="h-[clamp(52px,9vw,140px)]"
              delay={0.55}
            />
          </h1>
        ) : (
          <div className="h-[clamp(52px,9vw,140px)]" aria-hidden="true" />
        )}
        <TextType
          texts={[
            'La plataforma que tu gimnasio necesita',
            'Miembros, pagos y visitas en un solo lugar',
            'Tu gimnasio, siempre bajo control',
            'Moderniza tu gimnasio en minutos',
          ]}
          as="p"
          className="mt-5 sm:mt-6 text-sm sm:text-base md:text-lg font-semibold text-violet-300 min-h-[1.6em] px-2"
        />

        {/* Product preview — pulled in close behind the two hero texts (no CTA
            button between them anymore) — small gap, not flush. */}
        <div className="relative w-full max-w-6xl mx-auto px-2 sm:px-6 mt-8 sm:mt-10">
          <HeroPreviewImage />
        </div>
      </section>

      {/* ── Content ── */}
      <div className="relative z-10">

        {/* Features */}
        <section id="características" className="relative py-24 overflow-hidden">
          {/* Glow background */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[520px] rounded-full opacity-20"
              style={{ background: 'radial-gradient(ellipse,#6366F1,transparent 70%)', filter: 'blur(100px)' }} />
          </div>

          <div className="relative max-w-6xl mx-auto px-6">
            <Reveal as="div" className="text-center mb-14">
              <p className="text-xs font-bold uppercase tracking-widest text-indigo-400 mb-3">Módulos</p>
              <h2 className="text-[clamp(1.75rem,5vw,2.5rem)] font-extrabold text-white leading-tight">Todo lo que necesita tu gimnasio</h2>
              <p className="text-slate-400 mt-4 text-lg max-w-xl mx-auto">Herramientas profesionales diseñadas para la operación diaria de un gimnasio moderno.</p>
            </Reveal>

            <Reveal delay={0.1}>
              <ModuleSpotlight features={FEATURES} images={MODULE_IMAGES} />
            </Reveal>
          </div>
        </section>

        {/* ── Automatizaciones (correo + WhatsApp) Section ── */}
        <section id="automatizaciones" className="relative z-10 py-28 overflow-hidden">
          {/* Glow background */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] rounded-full opacity-10"
              style={{ background: 'radial-gradient(ellipse,#6366F1,transparent 70%)', filter: 'blur(90px)' }} />
          </div>

          <div className="relative max-w-2xl mx-auto px-6 text-center">
            <Reveal as="div">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-xs font-bold mb-6">
                <Zap className="w-3.5 h-3.5" /> Automatizaciones
              </div>
              <h2 className="text-[clamp(1.9rem,5vw,2.75rem)] font-extrabold text-white leading-tight">
                Así se envía,{' '}
                <span className="bg-gradient-to-r from-indigo-400 to-emerald-400 bg-clip-text text-transparent">paso a paso</span>
              </h2>
              <p className="text-slate-400 mt-5 text-base max-w-md mx-auto">
                Desde que algo pasa en tu gimnasio hasta que tu socio lo recibe — sin que tú escribas ni envíes nada.
              </p>
            </Reveal>

            {/* Step-by-step pipeline */}
            <div className="mt-16 flex flex-col items-center">

              {/* Step 1 — trigger */}
              <Reveal className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full flex items-center justify-center"
                  style={{ background: '#0d1117', border: '1.5px solid #F59E0B55', boxShadow: '0 8px 24px #F59E0B25' }}>
                  <Zap className="w-6 h-6" style={{ color: '#F59E0B' }} />
                </div>
                <p className="mt-4 text-sm font-bold text-white">1. Algo pasa</p>
                <p className="text-xs text-slate-500 mt-1 max-w-[16rem] leading-snug">Un socio se registra, paga, o su membresía está por vencer.</p>
              </Reveal>

              {/* Connector */}
              <div className="relative w-px h-12" style={{ background: 'linear-gradient(180deg, #F59E0B55, #6366F155)' }}>
                <span className="flow-dot-v" style={{ background: '#FBBF24', boxShadow: '0 0 8px #FBBF24' }} />
              </div>

              {/* Step 2 — engine */}
              <Reveal delay={0.1} className="flex flex-col items-center text-center">
                <div className="w-20 h-20 rounded-full flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)', boxShadow: '0 0 0 6px rgba(99,102,241,0.12), 0 8px 28px rgba(99,102,241,0.4)' }}>
                  <GemaSystemLogo className="w-8 h-8" />
                </div>
                <p className="mt-4 text-sm font-bold text-white">2. GemaSystem lo detecta</p>
                <p className="text-xs text-slate-500 mt-1 max-w-[16rem] leading-snug">Al instante, sin que tengas que hacer nada.</p>
              </Reveal>

              {/* Connector */}
              <div className="relative w-px h-12" style={{ background: 'linear-gradient(180deg, #6366F155, #6366F155)' }}>
                <span className="flow-dot-v" style={{ background: '#A5B4FC', boxShadow: '0 0 8px #A5B4FC' }} />
              </div>

              {/* Step 3 — dual channel dispatch */}
              <Reveal delay={0.2} className="w-full">
                <p className="text-sm font-bold text-white mb-4">3. Se envía por los dos canales</p>
                <div className="rounded-3xl border border-white/10 overflow-hidden grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-white/10"
                  style={{ background: '#0d1117' }}>
                  {/* Correo half */}
                  <div className="p-5 text-left">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#6366F120', border: '1px solid #6366F135' }}>
                        <Mail className="w-3.5 h-3.5" style={{ color: '#6366F1' }} />
                      </div>
                      <span className="text-xs font-bold text-indigo-300">Correo</span>
                    </div>
                    <div className="flex items-start gap-3 px-3 py-3 rounded-xl" style={{ background: '#fff', border: '1px solid #EBEBF0' }}>
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(16,185,129,0.12)' }}>
                        <MailCheck className="w-3.5 h-3.5" style={{ color: '#10B981' }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-800 truncate">¡Bienvenido a GemaSystem!</p>
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">Tu membresía fue registrada exitosamente...</p>
                      </div>
                    </div>
                  </div>
                  {/* WhatsApp half */}
                  <div className="p-5 text-left">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#25D36620', border: '1px solid #25D36635' }}>
                        <MessageCircle className="w-3.5 h-3.5" style={{ color: '#25D366' }} />
                      </div>
                      <span className="text-xs font-bold text-emerald-300">WhatsApp</span>
                    </div>
                    <div className="px-4 py-3 text-xs text-slate-800 max-w-[16rem]"
                      style={{ background: '#fff', border: '1px solid #EBEBF0', borderRadius: '14px 14px 14px 4px' }}>
                      👋 ¡Hola, <strong>Carlos</strong>! Tu membresía fue registrada. 🆔 <strong>FP-0231</strong>
                    </div>
                  </div>
                </div>
              </Reveal>

              {/* Connector */}
              <div className="relative w-px h-12" style={{ background: 'linear-gradient(180deg, #6366F155, #10B98155)' }}>
                <span className="flow-dot-v" style={{ background: '#6EE7B7', boxShadow: '0 0 8px #6EE7B7' }} />
              </div>

              {/* Step 4 — delivered */}
              <Reveal delay={0.3} className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full flex items-center justify-center"
                  style={{ background: '#0d1117', border: '1.5px solid #10B98155', boxShadow: '0 8px 24px #10B98125' }}>
                  <CheckCircle2 className="w-6 h-6" style={{ color: '#10B981' }} />
                </div>
                <p className="mt-4 text-sm font-bold text-white">4. Recibido</p>
                <p className="text-xs text-slate-500 mt-1 max-w-[16rem] leading-snug">Tu socio ya lo tiene, en segundos.</p>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ── Beta / roadmap — same split mockup+list grammar as Correos and
            WhatsApp above, so it reads as one design system instead of a
            bolted-on "we're in beta" disclaimer. Roadmap is always visible now
            (no click-to-expand), consistent with the rest of the page. ── */}
        <section id="beta" className="relative z-10 py-28 overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] rounded-full opacity-10"
              style={{ background: 'radial-gradient(ellipse,#F59E0B,transparent 70%)', filter: 'blur(80px)' }} />
          </div>
          <div className="relative max-w-6xl mx-auto px-6">

            {/* Header */}
            <Reveal as="div" className="text-center mb-20">
              <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 text-amber-300 text-xs font-bold mb-6">
                <Terminal className="w-3.5 h-3.5" /> Acceso anticipado · v1.0.0-beta.1
              </div>
              <h2 className="text-[clamp(2rem,6vw,3rem)] font-extrabold text-white leading-tight">
                Construido en{' '}
                <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">público</span>
              </h2>
              <p className="text-slate-400 mt-5 text-lg max-w-2xl mx-auto leading-relaxed">
                GemaSystem se actualiza semana a semana. Como usuario beta tu feedback decide qué se construye después, y tu precio queda congelado mientras dure el programa.
              </p>
            </Reveal>

            {/* Bento row — one big status tile + a 2×2 grid of quick facts,
                instead of another split mockup+list (already used twice above
                for Correos/WhatsApp) or the old click-to-expand roadmap. */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch mb-4">
              <Reveal as="div" className="relative rounded-3xl border p-8 overflow-hidden flex flex-col justify-between min-h-[220px]"
                style={{ background: 'linear-gradient(155deg,#1a1206 0%,#0d1020 60%)', borderColor: 'rgba(245,158,11,0.25)' }}>
                <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full pointer-events-none"
                  style={{ background: 'radial-gradient(circle,#F59E0B,transparent 70%)', opacity: 0.15 }} />
                <div className="relative flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  <span className="text-xs font-bold text-amber-300 uppercase tracking-widest">En desarrollo activo</span>
                </div>
                <p className="relative font-mono font-extrabold text-white tracking-tight mt-4" style={{ fontSize: 'clamp(1.75rem,4vw,2.75rem)' }}>
                  v1.0.0<span className="text-amber-400">-beta.1</span>
                </p>
                <p className="relative text-slate-400 text-sm leading-relaxed mt-5 max-w-sm">
                  Nada aquí es estático — sale algo nuevo cada semana, y tu opinión como usuario beta decide qué sigue.
                </p>
              </Reveal>

              <div className="grid grid-cols-2 gap-4">
                {[
                  { icon: Zap,           color: '#F59E0B', title: 'Semanal',    desc: 'Nuevas funciones' },
                  { icon: BadgeCheck,    color: '#6366F1', title: 'Congelado',  desc: 'Tu precio beta' },
                  { icon: Shield,        color: '#10B981', title: 'Protegido',  desc: 'Estándar de producción' },
                  { icon: MessageSquare, color: '#EC4899', title: 'Directo',   desc: 'Tu feedback cuenta' },
                ].map(({ icon: Icon, color, title, desc }, i) => (
                  <Reveal key={title} delay={0.08 + i * 0.05}
                    className="rounded-2xl border p-5 flex flex-col gap-3" style={{ background: '#0d1020', borderColor: 'rgba(255,255,255,0.1)' }}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: color + '18', border: `1px solid ${color}30` }}>
                      <Icon className="w-4 h-4" style={{ color }} />
                    </div>
                    <div>
                      <p className="text-white font-extrabold text-base leading-none">{title}</p>
                      <p className="text-slate-500 text-xs mt-1.5 leading-snug">{desc}</p>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>

            {/* Roadmap — numbered tickets, 3-up */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { n: '01', version: 'v1.2.0', status: 'En desarrollo', Icon: Bot,               title: 'Chatbot de Soporte', desc: 'Asistente integrado en el panel que resuelve dudas de socios y de configuración en tiempo real.', accent: '#6366f1' },
                { n: '02', version: 'v1.5.0', status: 'Planeado',      Icon: Store,              title: 'Portal del Socio',   desc: 'Tus miembros consultan su membresía, reservan clases y compran productos desde su propio portal.', accent: '#10b981' },
                { n: '03', version: 'v2.0.0', status: 'Planeado',      Icon: MonitorSmartphone,  title: 'GemaSystem PWA',     desc: 'App instalable en cualquier dispositivo, como app nativa, con soporte básico sin conexión.', accent: '#8b5cf6' },
              ].map((item, i) => (
                <Reveal key={item.version} delay={0.1 + i * 0.08}
                  className="rounded-2xl border p-5 flex flex-col gap-3" style={{ background: '#0d1020', borderColor: 'rgba(255,255,255,0.1)' }}>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono font-bold text-slate-600">{item.n}</span>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: item.accent + '20', color: item.accent }}>
                      {item.status}
                    </span>
                  </div>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: item.accent + '18', border: `1px solid ${item.accent}30` }}>
                    <item.Icon className="w-5 h-5" style={{ color: item.accent }} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-white font-bold text-sm leading-tight">{item.title}</p>
                      <span className="text-[10px] font-mono font-bold" style={{ color: item.accent }}>{item.version}</span>
                    </div>
                    <p className="text-slate-400 text-xs leading-relaxed mt-1.5">{item.desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── Free trial section ── */}
        <section id="prueba-gratis" className="relative z-10 py-24">
          <div className="relative max-w-6xl mx-auto px-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
              {/* Left: info */}
              <Reveal as="div">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/15 border border-violet-500/30 text-violet-300 text-xs font-bold mb-6">
                  <Clock className="w-3.5 h-3.5" /> 10 días completamente gratis
                </div>
                <h2 className="text-[clamp(1.75rem,5vw,2.25rem)] font-extrabold text-white leading-tight mb-4">
                  Prueba GemaSystem sin compromiso
                </h2>
                <p className="text-slate-400 text-lg leading-relaxed mb-8">
                  Sin tarjeta de crédito. Sin contrato. Accede a todas las funciones durante 10 días y comprueba la diferencia en tu gimnasio.
                </p>
                <ul className="space-y-3">
                  {[
                    'Acceso completo a todos los módulos',
                    'Sin límite de miembros durante la prueba',
                    'Soporte de configuración incluido',
                    'Sin compromisos — cancela en cualquier momento',
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center flex-shrink-0">
                        <Check className="w-3 h-3 text-indigo-400" />
                      </div>
                      <span className="text-slate-300 text-sm">{item}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-10 flex items-center gap-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5" /> Sin tarjeta</span>
                  <span>·</span>
                  <span className="flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> Datos seguros</span>
                  <span>·</span>
                  <span className="flex items-center gap-1.5"><Zap className="w-3.5 h-3.5" /> Activo en minutos</span>
                </div>
              </Reveal>

              {/* Right: form */}
              <Reveal as="div" delay={0.15} className="rounded-2xl border border-white/10 shadow-2xl shadow-black/50 p-8"
                style={{ background: 'rgba(13,15,28,0.85)', backdropFilter: 'blur(16px)' }}>
                {trialDone ? (
                  <div className="text-center py-6">
                    <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto mb-5">
                      <Check className="w-8 h-8 text-emerald-400" />
                    </div>
                    <h3 className="text-xl font-extrabold text-white mb-2">¡Solicitud recibida!</h3>
                    <p className="text-slate-400 text-sm leading-relaxed mb-6">
                      Recibirás un correo en los próximos minutos con las instrucciones para activar tu prueba gratuita. Revisa también tu carpeta de spam.
                    </p>
                    <div className="bg-indigo-500/10 rounded-xl px-5 py-4 text-sm text-indigo-300 font-medium border border-indigo-500/20">
                      ¿Ya tienes cuenta?{' '}
                      <button onClick={() => setLoginOpen(true)} className="font-bold underline">Inicia sesión →</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="mb-6">
                      <h3 className="text-xl font-extrabold text-white">Activar prueba gratuita</h3>
                      <p className="text-slate-500 text-sm mt-1">Completa el formulario y te contactamos hoy mismo</p>
                    </div>
                    <form onSubmit={tf.handleSubmit(onTrialSubmit)} className="space-y-4">
                      <div>
                        <label htmlFor="trial_gym_name" className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Nombre del gimnasio</label>
                        <div className="relative">
                          <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                          <input id="trial_gym_name" {...tf.register('gym_name')} placeholder="GymFit Monterrey"
                            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-indigo-500/60 focus:bg-white/8 transition-all" />
                        </div>
                        {tf.formState.errors.gym_name && <p className="mt-1 text-xs text-red-400">{tf.formState.errors.gym_name.message}</p>}
                      </div>
                      <div>
                        <label htmlFor="trial_name" className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Tu nombre</label>
                        <div className="relative">
                          <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                          <input id="trial_name" {...tf.register('name')} placeholder="Carlos Mendoza"
                            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-indigo-500/60 focus:bg-white/8 transition-all" />
                        </div>
                        {tf.formState.errors.name && <p className="mt-1 text-xs text-red-400">{tf.formState.errors.name.message}</p>}
                      </div>
                      <div>
                        <label htmlFor="trial_email" className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Correo electrónico</label>
                        <div className="relative">
                          <MessageSquare className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                          <input id="trial_email" {...tf.register('email')} type="email" placeholder="carlos@gymfit.mx"
                            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-indigo-500/60 focus:bg-white/8 transition-all" />
                        </div>
                        {tf.formState.errors.email && <p className="mt-1 text-xs text-red-400">{tf.formState.errors.email.message}</p>}
                      </div>
                      <div>
                        <label htmlFor="trial_phone" className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
                          Teléfono <span className="text-slate-600 normal-case font-normal">(opcional)</span>
                        </label>
                        <div className="relative">
                          <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                          <input id="trial_phone" {...tf.register('phone')} type="tel" placeholder="+52 81 0000 0000"
                            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-indigo-500/60 focus:bg-white/8 transition-all" />
                        </div>
                      </div>
                      <div>
                        <label className="flex items-start gap-2.5 cursor-pointer group">
                          <input type="checkbox" {...tf.register('acceptTerms')}
                            style={{ accentColor: '#818CF8' }}
                            className="mt-0.5 w-4 h-4 rounded border-white/20 bg-white/5 cursor-pointer flex-shrink-0" />
                          <span className="text-xs text-slate-400 leading-relaxed">
                            Acepto los{' '}
                            <a href="/terminos" target="_blank" rel="noopener noreferrer"
                              className="text-indigo-300 hover:text-indigo-200 font-semibold underline-offset-2 hover:underline">
                              Términos y Condiciones
                            </a>
                            {' '}y el{' '}
                            <a href="/privacidad" target="_blank" rel="noopener noreferrer"
                              className="text-indigo-300 hover:text-indigo-200 font-semibold underline-offset-2 hover:underline">
                              Aviso de Privacidad
                            </a>
                            {' '}de GemaSystem.
                          </span>
                        </label>
                        {tf.formState.errors.acceptTerms && (
                          <p className="mt-1 text-xs text-red-400 pl-6">{tf.formState.errors.acceptTerms.message}</p>
                        )}
                      </div>
                      {trialFormReady && (
                        <div className="fade-up">
                          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Verificación de seguridad</label>
                          <div className="flex justify-center rounded-xl border border-white/10 bg-white/[0.03] p-3">
                            <div className="scale-[0.85] origin-center sm:scale-100">
                              <ReCAPTCHA
                                ref={recaptchaRefTrial}
                                sitekey={RECAPTCHA_SITE_KEY}
                                theme="dark"
                                onChange={(token) => tf.setValue('recaptcha_token', token || '', { shouldValidate: true })}
                                onExpired={() => tf.setValue('recaptcha_token', '', { shouldValidate: true })}
                                onErrored={() => tf.setValue('recaptcha_token', '', { shouldValidate: true })}
                              />
                            </div>
                          </div>
                          {tf.formState.errors.recaptcha_token && (
                            <p className="mt-1.5 text-xs text-red-400 text-center">{tf.formState.errors.recaptcha_token.message}</p>
                          )}
                        </div>
                      )}
                      <button type="submit" disabled={trialLoading}
                        className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl font-bold text-sm text-white transition-all mt-2 disabled:opacity-60"
                        style={{ background: 'linear-gradient(135deg,#4F46E5,#7C3AED)', boxShadow: '0 8px 24px rgba(99,102,241,0.35)' }}>
                        {trialLoading
                          ? <><Loader2 className="w-4 h-4 animate-spin" /> Procesando...</>
                          : <><Gift className="w-4 h-4" /> Activar 10 días gratis</>}
                      </button>
                      <p className="text-center text-xs text-slate-600">Sin tarjeta de crédito · Sin compromisos</p>
                    </form>
                  </>
                )}
              </Reveal>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="precios" className="relative z-10 py-28 overflow-hidden">

          {/* Ambient glows */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full opacity-20"
              style={{ background: 'radial-gradient(circle,#6366f1,transparent 70%)', filter: 'blur(60px)' }} />
            <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full opacity-15"
              style={{ background: 'radial-gradient(circle,#f59e0b,transparent 70%)', filter: 'blur(60px)' }} />
          </div>

          <div className="relative max-w-6xl mx-auto px-6">

            {/* Header */}
            <Reveal as="div" className="text-center mb-14">
              <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-indigo-400 mb-5">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse inline-block" />
                Precios
              </span>
              <h2 className="text-[clamp(2rem,6vw,3rem)] font-extrabold text-white leading-tight">
                Planes para cada etapa<br className="hidden md:block" /> de tu negocio
              </h2>
              <p className="text-slate-400 mt-5 text-lg max-w-xl mx-auto">
                Sin permanencia, cancela cuando quieras.{' '}
                <span className="text-amber-400 font-semibold">Precio beta congelado</span> mientras dure el acceso anticipado.
              </p>
            </Reveal>

            {/* Asymmetric layout — one large featured plan instead of three
                equal-weight columns, with the other two options as compact
                secondary cards beside it. Leads the eye to the recommended
                plan first, instead of asking the visitor to compare three
                equally-weighted choices. */}
            <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6 items-stretch">

              {/* Featured — Mensual */}
              <Reveal as="div" className="relative rounded-3xl border overflow-hidden p-9 flex flex-col"
                style={{ borderColor: 'rgba(139,92,246,0.35)', background: 'linear-gradient(160deg,#211c4d 0%,#0f0d24 65%)' }}>
                <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full opacity-25 pointer-events-none"
                  style={{ background: 'radial-gradient(circle,#8B5CF6,transparent 70%)' }} />
                <div className="relative flex items-center gap-2 mb-6">
                  <span className="text-xs font-bold uppercase tracking-widest text-violet-300">Mensual</span>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-white/15 text-white">Recomendado</span>
                </div>
                <p className="relative text-sm text-violet-300/40 line-through leading-none mb-1.5">$2,499/mes</p>
                <div className="relative flex items-end gap-2 flex-wrap">
                  <span className="text-6xl font-black text-white leading-none">$1,622</span>
                  <span className="text-violet-300 text-sm mb-2">/mes</span>
                </div>
                <span className="relative mt-2 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 w-fit">
                  Ahorras $877
                </span>
                <p className="relative text-xs text-violet-300/70 mt-3 mb-8">MXN · cancela cuando quieras</p>
                <ul className="relative grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-2.5 flex-1 mb-8">
                  {PLANS[1].features.map((f, j) => (
                    <li key={j} className="flex items-start gap-2.5 text-sm">
                      <Check className="w-4 h-4 text-violet-300 flex-shrink-0 mt-0.5" />
                      <span className="text-white/90">{f}</span>
                    </li>
                  ))}
                </ul>
                <button onClick={() => goRegister('monthly')}
                  className="relative w-full py-4 rounded-2xl font-bold text-base bg-white text-indigo-700 hover:bg-indigo-50 transition-all duration-200 shadow-xl">
                  Comenzar ahora
                </button>
              </Reveal>

              {/* Secondary — Semanal + Prueba gratis, stacked and compact */}
              <div className="flex flex-col gap-6">
                <Reveal delay={0.1} as="div" className="rounded-2xl border border-white/10 p-6 flex flex-col flex-1" style={{ background: '#0d1020' }}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Semanal</span>
                    <span className="text-[10px] font-bold text-emerald-400">Ahorras $282</span>
                  </div>
                  <div className="flex items-end gap-2">
                    <span className="text-3xl font-black text-white leading-none">$417</span>
                    <span className="text-slate-400 text-xs mb-1">/semana</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1.5 mb-4">MXN · sin contrato</p>
                  <div className="flex flex-wrap gap-1.5 mb-5">
                    {PLANS[0].features.slice(0, 3).map((f) => (
                      <span key={f} className="text-[10px] px-2 py-1 rounded-full bg-white/5 text-slate-300 border border-white/10">{f}</span>
                    ))}
                  </div>
                  <button onClick={() => goRegister('weekly')}
                    className="mt-auto w-full py-2.5 rounded-xl font-bold text-xs text-white border border-white/15 hover:bg-white/10 transition-colors">
                    Comenzar
                  </button>
                </Reveal>

                <Reveal delay={0.18} as="div" className="rounded-2xl border p-6 flex flex-col flex-1"
                  style={{ borderColor: 'rgba(16,185,129,0.3)', background: 'linear-gradient(160deg,#062a17 0%,#0d1020 75%)' }}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">Prueba gratis</span>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">Sin tarjeta</span>
                  </div>
                  <div className="flex items-end gap-2">
                    <span className="text-3xl font-black text-white leading-none">$0</span>
                    <span className="text-emerald-300 text-xs mb-1">/ 10 días</span>
                  </div>
                  <p className="text-xs text-emerald-400/80 mt-1.5 mb-4">Acceso completo desde el día uno</p>
                  <div className="flex flex-wrap gap-1.5 mb-5">
                    {['Todo incluido', 'Sin límites', 'Soporte real'].map((f) => (
                      <span key={f} className="text-[10px] px-2 py-1 rounded-full bg-white/5 text-emerald-200 border border-emerald-500/20">{f}</span>
                    ))}
                  </div>
                  <button onClick={scrollToTrial}
                    className="mt-auto w-full py-2.5 rounded-xl font-bold text-xs text-white hover:brightness-110 transition-all duration-200"
                    style={{ background: 'linear-gradient(90deg,#10b981,#059669)' }}>
                    Comenzar gratis
                  </button>
                </Reveal>
              </div>
            </div>

            <p className="text-center text-xs text-slate-600 mt-8">
              Precios en pesos mexicanos (MXN) · IVA no incluido · Sin contrato de permanencia · Cancela cuando quieras
            </p>

          </div>
        </section>

        {/* Footer — multi-column, à la wope.com */}
        <footer className="pt-16 pb-8 px-6" style={{ background: '#040812', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-[1.3fr_1fr_1fr_1fr_1.2fr] gap-10 pb-12">

              {/* Brand + CTA */}
              <div>
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
                    <GemaSystemLogo className="w-3.5 h-3.5" />
                  </div>
                  <span className="font-extrabold text-white text-sm">GemaSystem</span>
                </div>
                <p className="text-sm text-slate-400 leading-relaxed max-w-[220px]">
                  La nueva generación de gestión para gimnasios.
                </p>
                <button onClick={scrollToTrial}
                  className="mt-5 inline-flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-lg border border-white/15 bg-white/5 text-white hover:bg-white/10 transition-colors">
                  Prueba 10 días gratis
                </button>
              </div>

              {/* Producto */}
              <div>
                <p className="text-white text-sm font-bold mb-4">Producto</p>
                <div className="flex flex-col gap-2.5">
                  {[
                    { label: 'Características',      href: '#características' },
                    { label: 'Automatizaciones',      href: '#automatizaciones' },
                    { label: 'Precios',               href: '#precios' },
                  ].map(l => (
                    <a key={l.label} href={l.href} className="text-sm text-slate-400 hover:text-white transition-colors">{l.label}</a>
                  ))}
                </div>
              </div>

              {/* Legal */}
              <div>
                <p className="text-white text-sm font-bold mb-4">Legal</p>
                <div className="flex flex-col gap-2.5">
                  <a href="/privacidad" className="text-sm text-slate-400 hover:text-white transition-colors">Privacidad</a>
                  <a href="/terminos" className="text-sm text-slate-400 hover:text-white transition-colors">Términos</a>
                </div>
              </div>

              {/* Recursos */}
              <div>
                <p className="text-white text-sm font-bold mb-4">Recursos</p>
                <div className="flex flex-col gap-2.5">
                  <Link to="/support" className="text-sm text-slate-400 hover:text-white transition-colors">Centro de soporte</Link>
                </div>
              </div>

              {/* Contacto */}
              <div className="rounded-2xl border border-white/10 p-5" style={{ background: 'rgba(255,255,255,0.02)' }}>
                <p className="text-white text-sm font-bold mb-3">Contacto</p>
                <div className="space-y-2">
                  <a href="mailto:soporte@gemasystem.mx" className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors">
                    <Send className="w-3.5 h-3.5 flex-shrink-0" /> soporte@gemasystem.mx
                  </a>
                  <p className="flex items-center gap-2 text-sm text-slate-400">
                    <BadgeCheck className="w-3.5 h-3.5 flex-shrink-0" /> Hecho en México
                  </p>
                </div>
              </div>
            </div>

            {/* Bottom bar */}
            <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-xs text-slate-500 text-center sm:text-left">
                © {new Date().getFullYear()} GemaSystem · Software de gestión para gimnasios · Todos los derechos reservados
              </p>
              <span className="text-xs text-slate-500 border border-white/15 rounded-full px-2.5 py-0.5 font-mono">v1.0.0-beta.1</span>
            </div>
          </div>
        </footer>
      </div>

      {loginOpen && <AuthModal onClose={() => setLoginOpen(false)} />}
      {registerOpen && (
        <RegisterModal onClose={() => { setRegisterOpen(false); navigate('/', { replace: true }) }} />
      )}
    </div>
  )
}
