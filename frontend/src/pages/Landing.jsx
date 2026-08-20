import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams, useLocation, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import * as yup from 'yup'
import ReCAPTCHA from 'react-google-recaptcha'
import {
  Users, CreditCard, TrendingUp, Calendar,
  Shield, Download, Eye, EyeOff, Loader2, Check, X,
  Lock, ArrowRight, ChevronDown, Zap, BadgeCheck, Monitor,
  Scan, Star, Gift, MessageSquare, Clock,
  Building2, User, Phone, Send, AlertTriangle,
  Bot, MonitorSmartphone, Store, Terminal, Mail, CheckCircle2, KeyRound, LogIn,
  MessageCircle, ScanLine,
} from 'lucide-react'

import { useAuthStore } from '../store/authStore'
import api from '../api/axios'
import toast from 'react-hot-toast'
import Beams from '../components/Beams'
import GemaSystemLogo from '../components/GemaSystemLogo'
import RegisterModal from './Register'
import { DashboardCard, MembersCard, FinancesCard, VisitsCard, MembershipsCard, TrainersCard, ClassesCard } from '../components/SystemCards'
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

const reviewSchema = yup.object({
  author:  yup.string().required('Tu nombre es requerido').max(80),
  role:    yup.string().max(80),
  comment: yup.string().required('El comentario es requerido').min(10,'Mínimo 10 caracteres').max(500),
})



// ─── LandingFaq ───────────────────────────────────────────────────────────────

const LANDING_FAQS = [
  { q: '¿GemaSystem tiene un período de prueba gratuito?',               a: 'Sí. Puedes probar GemaSystem gratis durante 10 días completos, sin tarjeta de crédito. Accedes a todas las funciones del plan mensual para que evalúes si se adapta a tu gimnasio sin ningún riesgo.' },
  { q: '¿Puedo cancelar mi suscripción en cualquier momento?',       a: 'Absolutamente. No hay contratos ni permanencias. Puedes cancelar desde el portal de Stripe o escribiéndonos a soporte@gemasystem.mx. Al cancelar, mantienes acceso hasta el final del período ya pagado.' },
  { q: '¿Cuántos miembros puedo registrar?',                         a: 'En todos los planes el número de miembros es ilimitado. Puedes registrar desde 10 hasta 10,000 socios sin costo adicional ni cambios de plan.' },
  { q: '¿Necesito conocimientos técnicos para configurarlo?',        a: 'No. GemaSystem está diseñado para que cualquier persona pueda configurarlo en menos de 10 minutos. Si tienes dudas, nuestro equipo de soporte te guía paso a paso sin costo adicional.' },
  { q: '¿Mis datos están seguros en GemaSystem?',                         a: 'Sí. Todos los datos se almacenan con cifrado SSL de 256 bits en servidores seguros con respaldos automáticos diarios. Tu información nunca se comparte con terceros.' },
  { q: '¿Funciona en dispositivos móviles?',                         a: 'Sí. GemaSystem es completamente responsivo y funciona en celulares, tablets y computadoras. Próximamente estará disponible como app instalable (PWA) en cualquier dispositivo.' },
  { q: '¿Puedo usarlo desde varios dispositivos al mismo tiempo?',   a: 'Sí. Puedes acceder desde cualquier dispositivo con internet de forma simultánea. Ideal para tener el sistema en recepción, oficina y teléfono al mismo tiempo.' },
  { q: '¿Cómo funciona el registro de visitas por QR?',              a: 'Cada miembro recibe un código QR único al registrarse. El recepcionista lo escanea desde el módulo de visitas y la entrada queda registrada automáticamente con fecha y hora en menos de 1 segundo.' },
  { q: '¿Puedo migrar mis datos desde otra plataforma?',             a: 'Sí. Nuestro equipo te ayuda a importar tus datos desde Excel, CSV u otras plataformas. El proceso de migración asistida es gratuito y sin costo adicional.' },
  { q: '¿Qué diferencia hay entre el plan Mensual y el Anual?',      a: 'El plan anual incluye todo lo del mensual más: ahorro en el precio, acceso anticipado a nuevas funciones, múltiples sucursales (próximamente) y un gestor de cuenta dedicado.' },
  { q: '¿Ofrecen descuentos para gimnasios pequeños?',               a: 'Sí. Si tu gimnasio tiene menos de 50 miembros o está comenzando, escríbenos a soporte@gemasystem.mx para conocer nuestros planes de arranque con tarifas especiales.' },
  { q: '¿Cómo recibo las actualizaciones del sistema?',              a: 'GemaSystem es un sistema web, por lo que las actualizaciones son automáticas. Siempre tendrás la versión más reciente sin descargas ni reinicios.' },
  { q: '¿Puedo personalizar el sistema con mi marca?',               a: 'Sí. Puedes configurar el nombre de tu gimnasio, el color principal de la interfaz y los precios de los planes desde Configuración. Los planes Enterprise incluyen branding completo.' },
  { q: '¿El sistema envía notificaciones automáticas a mis socios?', a: 'Sí. GemaSystem envía correos automáticos cuando una membresía está por vencer (con los días de anticipación que configures) y al registrar un nuevo socio. Puedes activar o desactivar cada tipo de notificación.' },
]

function LandingFaq() {
  const [open, setOpen] = useState(null)
  return (
    <div className="space-y-2">
      {LANDING_FAQS.map((item, i) => {
        const isOpen = open === i
        return (
          <div key={i}
            className={`rounded-2xl border transition-all duration-200 overflow-hidden
              ${isOpen ? 'border-indigo-500/40 bg-white/5' : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/5'}`}>
            <button
              onClick={() => setOpen(isOpen ? null : i)}
              className="w-full flex items-center justify-between px-6 py-4 text-left gap-4 group">
              <span className={`text-sm font-semibold leading-relaxed transition-colors
                ${isOpen ? 'text-indigo-300' : 'text-slate-300 group-hover:text-white'}`}>
                {item.q}
              </span>
              <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-all duration-200
                ${isOpen ? 'bg-indigo-500/20 text-indigo-300 rotate-180' : 'bg-white/10 text-slate-400 group-hover:bg-white/15'}`}>
                <ChevronDown className="w-3.5 h-3.5" />
              </div>
            </button>
            {isOpen && (
              <div className="px-6 pb-5 pt-0">
                <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl px-4 py-3.5">
                  <p className="text-sm text-slate-300 leading-relaxed">{item.a}</p>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const FEATURES = [
  { icon: Users,      color: '#6366F1', title: 'Gestión de Miembros',     desc: 'Registra y administra socios con códigos únicos, historial de pagos, fotos y alertas de vencimiento.' },
  { icon: Scan,       color: '#10B981', title: 'Control de Visitas / QR',  desc: 'Registra asistencia por código QR o búsqueda instantánea. Estadísticas de visitas en tiempo real.' },
  { icon: CreditCard, color: '#3B82F6', title: 'Membresías Inteligentes',  desc: 'Gestiona planes semanales, mensuales y anuales con renovaciones y notificaciones automáticas.' },
  { icon: TrendingUp, color: '#8B5CF6', title: 'Análisis Financiero',      desc: 'Dashboard con gráficas de ingresos, mapa de actividad tipo GitHub, top pagadores y exportación.' },
  { icon: Calendar,   color: '#F59E0B', title: 'Clases y Entrenadores',    desc: 'Programa clases grupales, asigna entrenadores y gestiona horarios desde un panel centralizado.' },
  { icon: Download,   color: '#EF4444', title: 'Reportes Exportables',     desc: 'Genera y descarga reportes en PDF o Excel de cualquier módulo con un solo clic.' },
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

const VS_CATEGORIES = [
  { id: 'all',       label: 'Todo' },
  { id: 'gestion',   label: 'Gestión diaria',   icon: Users },
  { id: 'finanzas',  label: 'Finanzas',         icon: TrendingUp },
  { id: 'facilidad', label: 'Facilidad de uso', icon: Zap },
  { id: 'soporte',   label: 'Soporte',          icon: MessageSquare },
]

const VS_ROWS = [
  {
    aspect: 'Buscar un socio',
    category: 'gestion',
    without: 'Revisar cuadernos hoja por hoja',
    other:   'Navegar menús y submenús confusos, 3–5 clics',
    with:    'Búsqueda instantánea en menos de 1 segundo',
  },
  {
    aspect: 'Control de pagos',
    category: 'finanzas',
    without: 'Cálculos manuales con calculadora, errores',
    other:   'Módulos de facturación complejos y lentos',
    with:    'Historial automático, sin errores ni omisiones',
  },
  {
    aspect: 'Curva de aprendizaje',
    category: 'facilidad',
    without: 'Nula — pero sin datos útiles',
    other:   'Semanas de capacitación, manuales extensos',
    with:    'Listo en 10 min, interfaz intuitiva',
  },
  {
    aspect: 'Costo mensual',
    category: 'finanzas',
    without: 'Solo cuadernos (~$50 MXN)',
    other:   'Desde $3,000 hasta $15,000 MXN / mes',
    with:    'Desde $417 MXN / semana',
  },
  {
    aspect: 'Membresías vencidas',
    category: 'gestion',
    without: 'Te enteras tarde o nunca',
    other:   'Configuración técnica avanzada requerida',
    with:    'Alertas automáticas sin configurar nada',
  },
  {
    aspect: 'Registro de asistencia',
    category: 'gestion',
    without: 'Lista en papel, fácil de perder',
    other:   'Requiere hardware adicional costoso',
    with:    'QR con cualquier dispositivo existente',
  },
  {
    aspect: 'Reportes financieros',
    category: 'finanzas',
    without: 'Horas con calculadora o Excel manual',
    other:   'Módulos de BI extra con costo adicional',
    with:    'PDF o Excel con un solo clic',
  },
  {
    aspect: 'Soporte técnico',
    category: 'soporte',
    without: 'Ninguno',
    other:   'Tickets lentos, soporte premium con costo extra',
    with:    'Soporte directo e incluido en el plan',
  },
  {
    aspect: 'Funciones innecesarias',
    category: 'facilidad',
    without: 'No aplica',
    other:   'Decenas de módulos que nunca usarás',
    with:    'Solo lo que un gimnasio realmente necesita',
  },
  {
    aspect: 'Tiempo de implementación',
    category: 'facilidad',
    without: 'Inmediato (seguir con papel)',
    other:   'Semanas o meses de configuración e instalación',
    with:    'Operativo el mismo día',
  },
]

const VS_CELL_STYLES = {
  red:     { text: 'text-red-400/80', iconBg: 'bg-red-500/10', icon: 'text-red-400' },
  amber:   { text: 'text-amber-400/80', iconBg: 'bg-amber-500/10', icon: 'text-amber-400' },
  emerald: { text: 'text-emerald-300 font-semibold', iconBg: 'bg-emerald-500/15', icon: 'text-emerald-400' },
}

function VsLegendPill({ icon: Icon, color, label, highlight }) {
  const c = VS_CELL_STYLES[color]
  return (
    <div className={`flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-xl border ${
      highlight ? 'bg-emerald-500/10 border-emerald-500/25' : `${c.iconBg} border-white/5`}`}>
      <Icon className={`w-3.5 h-3.5 ${c.icon}`} />
      <span className={`text-[11px] font-bold uppercase tracking-wide ${c.icon}`}>{label}</span>
    </div>
  )
}

function VsCell({ icon: Icon, color, text, label, highlight }) {
  const c = VS_CELL_STYLES[color]
  return (
    <div className={`flex items-start gap-2 rounded-xl px-3 py-2.5 ${highlight ? 'bg-emerald-500/[0.06] border border-emerald-500/15' : ''}`}>
      <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${c.iconBg}`}>
        <Icon className={`w-3 h-3 ${c.icon}`} />
      </div>
      <div className="min-w-0">
        {label && <p className={`sm:hidden text-[9px] font-bold uppercase tracking-wide mb-0.5 ${c.icon}`}>{label}</p>}
        <span className={`text-xs leading-relaxed ${c.text}`}>{text}</span>
      </div>
    </div>
  )
}

function VSComparison() {
  const [filter, setFilter] = useState('all')
  const rows = filter === 'all' ? VS_ROWS : VS_ROWS.filter(r => r.category === filter)

  return (
    <div>
      {/* Filter chips */}
      <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
        {VS_CATEGORIES.map(cat => {
          const active = filter === cat.id
          const count = cat.id === 'all' ? VS_ROWS.length : VS_ROWS.filter(r => r.category === cat.id).length
          return (
            <button key={cat.id} onClick={() => setFilter(cat.id)}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold border transition-all duration-200 ${
                active
                  ? 'bg-indigo-500 border-indigo-400 text-white shadow-lg shadow-indigo-500/30'
                  : 'bg-[#0d1020] border-white/10 text-slate-400 hover:text-white hover:border-white/20 hover:bg-[#161a35]'
              }`}>
              {cat.icon && <cat.icon className="w-3.5 h-3.5" />}
              {cat.label}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${active ? 'bg-white/20' : 'bg-white/10'}`}>{count}</span>
            </button>
          )
        })}
      </div>

      <p className="text-center text-xs text-slate-500 mb-7">
        Mostrando <span className="text-white font-semibold">{rows.length}</span> de {VS_ROWS.length} comparaciones
      </p>

      {/* Legend — desktop only, shown once above the cards */}
      <div className="hidden sm:grid grid-cols-[1fr_1.3fr_1.3fr_1.3fr] gap-3 mb-3 px-1">
        <div />
        <VsLegendPill icon={X} color="red" label="Sin sistema" />
        <VsLegendPill icon={AlertTriangle} color="amber" label="Otros sistemas" />
        <VsLegendPill icon={Check} color="emerald" label="Con GemaSystem" highlight />
      </div>

      {/* Comparison cards */}
      <div className="space-y-3">
        {rows.map((row) => {
          const CategoryIcon = VS_CATEGORIES.find(c => c.id === row.category)?.icon
          return (
            <div key={row.aspect}
              className="fade-up grid grid-cols-1 sm:grid-cols-[1fr_1.3fr_1.3fr_1.3fr] gap-2 sm:gap-3 rounded-2xl border border-white/10 bg-[#0d1020] hover:bg-[#12162c] hover:border-white/15 transition-all duration-200 p-4">
              <div className="flex items-center gap-2 mb-1 sm:mb-0">
                {CategoryIcon && <CategoryIcon className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />}
                <span className="font-bold text-white text-sm sm:text-xs leading-snug">{row.aspect}</span>
              </div>
              <VsCell icon={X} color="red" text={row.without} label="Sin sistema" />
              <VsCell icon={AlertTriangle} color="amber" text={row.other} label="Otros sistemas" />
              <VsCell icon={Check} color="emerald" text={row.with} label="Con GemaSystem" highlight />
            </div>
          )
        })}

        {rows.length === 0 && (
          <p className="text-center text-slate-500 text-sm py-10">No hay comparaciones en esta categoría.</p>
        )}
      </div>
    </div>
  )
}

const MEMBER_REVIEWS = [
  {
    author: 'Ana García', role: 'Le mostraron el sistema · Monterrey', rating: 5,
    comment: 'No podía creer que con solo escanear un código QR ya quedara registrada la entrada. Es algo que nunca había visto en ningún gimnasio. Completamente innovador.',
    highlight: 'Código QR instantáneo',
  },
  {
    author: 'Luis Ramírez', role: 'Conoció el sistema en demo · CDMX', rating: 5,
    comment: 'Lo que más me impresionó fue ver cómo el sistema manda un correo automático al Gmail del socio cuando su membresía está por vencer. Eso es pensar en el cliente de verdad.',
    highlight: 'Alertas automáticas por Gmail',
  },
  {
    author: 'Sofía Torres', role: 'Visitó un gym con GemaSystem · Guadalajara', rating: 5,
    comment: 'Ver todo: miembros, pagos, asistencia y reportes en una sola pantalla, en tiempo real, desde una tablet es impresionante. Es lo que todos los gimnasios necesitan.',
    highlight: 'Panel en tiempo real',
  },
]

// ─── Style constants ──────────────────────────────────────────────────────────

const grayInp    = 'w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all hover:border-gray-300'
const grayInpErr = 'w-full px-4 py-3 rounded-xl border border-red-300 bg-red-50/40 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400 transition-all'

// ─── StarRating ───────────────────────────────────────────────────────────────

function StarRating({ value, onChange, readOnly = false, size = 'md' }) {
  const [hovered, setHovered] = useState(0)
  const sz = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(n => (
        <button key={n} type="button"
          onClick={readOnly ? undefined : () => onChange(n)}
          onMouseEnter={readOnly ? undefined : () => setHovered(n)}
          onMouseLeave={readOnly ? undefined : () => setHovered(0)}
          className={`focus:outline-none ${readOnly ? 'cursor-default' : 'cursor-pointer'}`}
          disabled={readOnly}>
          <Star className={`${sz} transition-colors ${(hovered || value) >= n ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}`} />
        </button>
      ))}
    </div>
  )
}

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

// ─── System Showcase (tabbed mock-UI) ────────────────────────────────────────

const TABS = [
  { id: 'dashboard',  label: 'Dashboard',   icon: Monitor,    Component: DashboardCard    },
  { id: 'socios',     label: 'Socios',      icon: Users,      Component: MembersCard      },
  { id: 'finanzas',   label: 'Finanzas',    icon: TrendingUp, Component: FinancesCard     },
  { id: 'visitas',    label: 'Visitas QR',  icon: Scan,       Component: VisitsCard       },
  { id: 'membresias', label: 'Membresías',  icon: CreditCard, Component: MembershipsCard  },
  { id: 'entrena',    label: 'Entrenadores',icon: User,       Component: TrainersCard     },
  { id: 'clases',     label: 'Clases',      icon: Calendar,   Component: ClassesCard      },
]

function SystemShowcase() {
  const [active, setActive] = useState('dashboard')
  const tab = TABS.find(t => t.id === active)

  return (
    <div className="relative">
      {/* Glow background */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[600px] h-[400px] rounded-full blur-3xl opacity-20"
          style={{ background: 'radial-gradient(ellipse,#6366F1 0%,transparent 70%)' }} />
      </div>

      {/* Tab pills */}
      <div className="flex justify-center mb-8 relative z-10">
        <div className="inline-flex items-center gap-1 p-1 rounded-2xl bg-gray-100 border border-gray-200 shadow-inner">
          {TABS.map(t => {
            const isActive = t.id === active
            return (
              <button key={t.id} onClick={() => setActive(t.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  isActive
                    ? 'bg-white text-indigo-600 shadow-md shadow-indigo-500/10'
                    : 'text-gray-400 hover:text-gray-600 hover:bg-white/50'
                }`}>
                <t.icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Mock screen with 3D perspective */}
      <div className="relative flex justify-center" style={{ perspective: '1200px' }}>
        {/* Shadow / depth layer */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4/5 h-12 blur-2xl rounded-full opacity-20"
          style={{ background: '#6366F1' }} />

        <div
          key={active}
          className="relative w-full max-w-3xl rounded-2xl overflow-hidden shadow-2xl border border-gray-200/60"
          style={{
            transform: 'rotateX(3deg)',
            transformOrigin: 'bottom center',
            animation: 'showcaseFadeIn 0.35s ease-out both',
          }}
        >
          {/* Browser chrome */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 bg-gray-100">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-yellow-400" />
              <div className="w-3 h-3 rounded-full bg-green-400" />
            </div>
            <div className="flex-1 bg-white rounded-md px-3 py-1 text-xs text-gray-400 font-mono border border-gray-200">
              app.gemasystem.mx/{active}
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              En vivo
            </div>
          </div>

          {/* Content */}
          <div style={{ height: 380 }}>
            <tab.Component />
          </div>
        </div>
      </div>

      <style>{`
        @keyframes showcaseFadeIn {
          from { opacity: 0; transform: rotateX(6deg) translateY(12px); }
          to   { opacity: 1; transform: rotateX(3deg) translateY(0); }
        }
      `}</style>
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
  const [roadmapOpen, setRoadmapOpen] = useState(false)
  const [emailOpen, setEmailOpen]     = useState('welcome')
  const [waOpen, setWaOpen]           = useState('connect')
  const navigate                  = useNavigate()

  const [trialDone, setTrialDone]       = useState(false)
  const [trialLoading, setTrialLoading] = useState(false)
  const trialForm = useForm({ resolver: yupResolver(trialSchema) })
  const recaptchaRefTrial = useRef(null)

  const [reviewRating, setReviewRating]     = useState(5)
  const [reviewDone, setReviewDone]         = useState(false)
  const [activeReviewTab, setActiveReviewTab] = useState('socios')
  const reviewForm = useForm({ resolver: yupResolver(reviewSchema) })

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

  const onReviewSubmit = async (data) => {
    if (reviewRating === 0) { toast.error('Selecciona una calificación'); return }
    try {
      // Se incluye el tipo de reseñante para que el admin los distinga en el panel
      const reviewerPrefix = activeReviewTab === 'duenos' ? 'Dueño/Admin' : 'Socio'
      const roleLabel = data.role
        ? `${reviewerPrefix} · ${data.role}`
        : reviewerPrefix

      await api.post('/submissions', {
        type:    'review',
        name:    data.author,
        role:    roleLabel,
        rating:  reviewRating,
        message: data.comment,
      })
      setReviewDone(true)
      toast.success('¡Gracias! Tu reseña será revisada y publicada pronto.')
    } catch {
      toast.error('No se pudo enviar tu reseña. Intenta de nuevo.')
    }
  }

  const tf = trialForm
  const rf = reviewForm

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

      {/* ── CardNav ── */}
      <div className="fixed top-0 left-0 right-0 z-40 flex justify-center px-4 pt-4 pointer-events-none">
        <div className="pointer-events-auto w-full max-w-[820px]"
          style={{
            background: 'white',
            borderRadius: '12px',
            boxShadow: navOpen
              ? '0 20px 60px rgba(0,0,0,0.18), 0 4px 12px rgba(0,0,0,0.08)'
              : '0 4px 24px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.05)',
            overflow: 'hidden',
            maxHeight: navOpen ? '520px' : '60px',
            transition: 'max-height 0.45s cubic-bezier(0.4,0,0.2,1), box-shadow 0.3s ease',
          }}>

          {/* ── Top bar ── */}
          <div style={{ height: '60px' }} className="flex items-center justify-between px-3 flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-md shadow-indigo-500/30 flex-shrink-0">
                <GemaSystemLogo className="w-3.5 h-3.5" />
              </div>
              <span className="font-extrabold text-base text-gray-900 tracking-tight">GemaSystem</span>
              <span className="hidden sm:inline text-xs font-bold px-1.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700">BETA</span>
            </div>
            <div className="flex items-center gap-1.5">
              {/* Below `sm` these collapse to icon-only — the full-text versions
                  were `hidden` below sm/md with no equivalent anywhere else in the
                  mobile nav, so on phones the buttons simply never appeared. */}
              <button onClick={() => setLoginOpen(true)} aria-label="Iniciar sesión" title="Iniciar sesión"
                className="sm:hidden w-8 h-8 flex items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 transition-colors flex-shrink-0">
                <LogIn className="w-4 h-4" />
              </button>
              <button onClick={() => setLoginOpen(true)}
                className="hidden sm:block text-sm font-semibold px-3 py-1.5 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors">
                Iniciar sesión
              </button>

              <button onClick={scrollToTrial} aria-label="Prueba gratis" title="Prueba gratis"
                className="sm:hidden w-8 h-8 flex items-center justify-center rounded-lg text-white flex-shrink-0"
                style={{ background: 'linear-gradient(135deg,#4F46E5,#7C3AED)' }}>
                <Gift className="w-4 h-4" />
              </button>
              <button onClick={scrollToTrial}
                className="hidden sm:flex items-center gap-1.5 text-sm font-bold px-3.5 py-1.5 rounded-lg text-white"
                style={{ background: 'linear-gradient(135deg,#4F46E5,#7C3AED)' }}>
                <Gift className="w-3.5 h-3.5" />
                Prueba gratis
              </button>
              <button onClick={() => setNavOpen(o => !o)} aria-label="Menú"
                className="w-9 h-9 flex flex-col items-center justify-center gap-[5px] rounded-lg hover:bg-gray-100 transition-colors ml-1 flex-shrink-0">
                <span className={`block w-5 h-[1.5px] bg-gray-700 rounded-full transition-all duration-300 origin-center ${navOpen ? 'translate-y-[3.5px] rotate-45' : ''}`} />
                <span className={`block w-5 h-[1.5px] bg-gray-700 rounded-full transition-all duration-300 ${navOpen ? '-translate-y-[3.5px] -rotate-45' : ''}`} />
              </button>
            </div>
          </div>

          {/* ── Cards ── */}
          <div className="px-2 pb-2 grid grid-cols-1 sm:grid-cols-3 gap-2"
            style={{ opacity: navOpen ? 1 : 0, transition: 'opacity 0.25s ease 0.1s', pointerEvents: navOpen ? 'auto' : 'none' }}>

            {/* Explorar */}
            <div className="rounded-xl p-4 flex flex-col" style={{ background: '#18181b', minHeight: '190px' }}>
              <span className="text-white/30 text-[10px] font-bold uppercase tracking-widest mb-2">01</span>
              <p className="text-white text-xl font-semibold leading-tight tracking-tight mb-auto">Explorar<br/>GemaSystem</p>
              <div className="mt-4 space-y-2">
                {[
                  { label: 'Características', href: '#características' },
                  { label: 'Correos automáticos', href: '#correos' },
                  { label: 'WhatsApp',         href: '#whatsapp' },
                  { label: 'Precios',          href: '#precios' },
                  { label: 'Prueba gratis',    href: '#prueba-gratis' },
                  { label: 'Reseñas',          href: '#reseñas' },
                  { label: 'Comparativa',      href: '#comparativa' },
                  { label: 'Preguntas',        href: '#faq' },
                ].map(({ label, href }) => (
                  <a key={label} href={href} onClick={() => setNavOpen(false)}
                    className="flex items-center gap-2 text-white/50 hover:text-white text-sm font-medium transition-colors group">
                    <ArrowRight className="w-3 h-3 text-white/25 group-hover:text-white/60 transition-colors flex-shrink-0" />
                    {label}
                  </a>
                ))}
              </div>
            </div>

            {/* Soporte */}
            <div className="rounded-xl p-4 flex flex-col" style={{ background: '#1e1b4b', minHeight: '190px' }}>
              <span className="text-white/30 text-[10px] font-bold uppercase tracking-widest mb-2">02</span>
              <p className="text-white text-xl font-semibold leading-tight tracking-tight mb-auto">Centro de<br/>Soporte</p>
              <div className="mt-4 space-y-2">
                {[
                  { label: 'Preguntas frecuentes', to: '/support' },
                  { label: 'Abrir ticket',          to: '/support' },
                  { label: 'soporte@gemasystem.mx',      href: 'mailto:soporte@gemasystem.mx' },
                  { label: 'Chat (próximamente)',    disabled: true },
                ].map(({ label, to, href, disabled }) => {
                  const cls = 'flex items-center gap-2 text-white/50 hover:text-white text-sm font-medium transition-colors group'
                  const ico = <ArrowRight className="w-3 h-3 text-white/25 group-hover:text-white/60 transition-colors flex-shrink-0" />
                  if (disabled) return <span key={label} className="flex items-center gap-2 text-white/20 text-sm">{ico}{label}</span>
                  if (to)   return <Link key={label} to={to} onClick={() => setNavOpen(false)} className={cls}>{ico}{label}</Link>
                  return <a key={label} href={href} className={cls}>{ico}{label}</a>
                })}
              </div>
            </div>

            {/* Proyectos y Contacto */}
            <div className="rounded-xl p-4 flex flex-col" style={{ background: '#134e4a', minHeight: '190px' }}>
              <span className="text-white/30 text-[10px] font-bold uppercase tracking-widest mb-2">03</span>
              <p className="text-white text-xl font-semibold leading-tight tracking-tight mb-auto">Proyectos y<br/>Contacto</p>
              <div className="mt-4 space-y-2">
                {[
                  { label: 'GemaSystem como tu marca',  to: '/proyectos' },
                  { label: 'Desarrollo a medida',   to: '/proyectos' },
                  { label: 'Otro proyecto',          to: '/proyectos' },
                  { label: 'Contactar al creador',   href: 'mailto:brayantisidro05@gmail.com' },
                ].map(({ label, to, href }) =>
                  to
                    ? <Link key={label} to={to} onClick={() => setNavOpen(false)}
                        className="flex items-center gap-2 text-white/50 hover:text-white text-sm font-medium transition-colors group">
                        <ArrowRight className="w-3 h-3 text-white/25 group-hover:text-white/60 transition-colors flex-shrink-0" />
                        {label}
                      </Link>
                    : <a key={label} href={href}
                        className="flex items-center gap-2 text-white/50 hover:text-white text-sm font-medium transition-colors group">
                        <ArrowRight className="w-3 h-3 text-white/25 group-hover:text-white/60 transition-colors flex-shrink-0" />
                        {label}
                      </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Hero ── */}
      <section className="relative z-10 min-h-screen flex flex-col items-center justify-center text-center px-6 pt-20">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-300 text-xs font-semibold mb-6 backdrop-blur-sm">
          <Zap className="w-3 h-3" /> v1.0.0-beta.1 · Acceso anticipado disponible
        </div>
        <h1 className="text-[clamp(2.25rem,7vw,4.5rem)] font-extrabold text-white max-w-4xl leading-[1.08] tracking-tight">
          La plataforma que tu{' '}
          <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-purple-400 bg-clip-text text-transparent">
            gimnasio necesita
          </span>
        </h1>
        <p className="mt-6 text-lg md:text-xl text-slate-400 max-w-2xl leading-relaxed">
          Gestiona miembros, visitas, finanzas y clases desde un solo panel.
          Moderno, potente y diseñado para crecer contigo.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4 mt-10">
          <button onClick={scrollToTrial}
            className="flex items-center gap-2.5 px-8 py-4 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-base transition-all shadow-2xl shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:-translate-y-0.5 duration-200">
            <Gift className="w-5 h-5" /> Prueba 10 días gratis
          </button>
          <button onClick={() => goRegister()}
            className="flex items-center gap-2.5 px-8 py-4 rounded-xl border border-white/20 bg-white/5 backdrop-blur-sm text-white font-semibold text-base hover:bg-white/10 transition-all">
            Ver planes <ArrowRight className="w-4 h-4" />
          </button>
        </div>
        <div className="flex flex-wrap justify-center gap-10 mt-16 pb-6">
          {[
            { val: '6+',      lbl: 'Módulos integrados'    },
            { val: '12+',     lbl: 'Gráficas interactivas' },
            { val: 'PDF/XLS', lbl: 'Exportación de reportes'},
            { val: 'QR',      lbl: 'Registro de visitas'   },
          ].map(s => (
            <div key={s.lbl} className="text-center">
              <p className="text-3xl font-extrabold text-white tracking-tight">{s.val}</p>
              <p className="text-xs text-slate-500 mt-1 font-medium">{s.lbl}</p>
            </div>
          ))}
        </div>
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce text-slate-600">
          <ChevronDown className="w-6 h-6" />
        </div>
      </section>

      {/* ── Content ── */}
      <div className="relative z-10">

        {/* Dashboard screenshot */}
        <section className="max-w-6xl mx-auto px-6 py-24">
          <div className="text-center mb-12">
            <p className="text-xs font-bold uppercase tracking-widest text-indigo-400 mb-3">Vista previa</p>
            <h2 className="text-[clamp(1.75rem,5vw,2.25rem)] font-extrabold text-white leading-tight">Un solo panel. Todo bajo control.</h2>
            <p className="text-slate-400 mt-4 text-lg max-w-xl mx-auto">Dashboard en tiempo real con métricas clave de tu negocio en un vistazo.</p>
          </div>
          <SystemShowcase />
        </section>

        {/* Features */}
        <section id="características" className="py-24">
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-16">
              <p className="text-xs font-bold uppercase tracking-widest text-indigo-400 mb-3">Módulos</p>
              <h2 className="text-[clamp(1.75rem,5vw,2.25rem)] font-extrabold text-white leading-tight">Todo lo que necesita tu gimnasio</h2>
              <p className="text-slate-400 mt-4 text-lg max-w-xl mx-auto">Herramientas profesionales diseñadas para la operación diaria de un gimnasio moderno.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {FEATURES.map((f, i) => (
                <div key={i} className="group rounded-2xl border p-6 hover:-translate-y-1 transition-all duration-300 cursor-default"
                  style={{
                    background: '#0d1117',
                    borderColor: 'rgba(99,102,241,0.18)',
                    boxShadow: '0 2px 16px rgba(0,0,0,0.4)',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = f.color + '55'; e.currentTarget.style.boxShadow = `0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px ${f.color}33` }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.18)'; e.currentTarget.style.boxShadow = '0 2px 16px rgba(0,0,0,0.4)' }}
                >
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5 transition-transform group-hover:scale-110 duration-300" style={{ background: f.color + '20', border: `1px solid ${f.color}35` }}>
                    <f.icon className="w-6 h-6" style={{ color: f.color }} />
                  </div>
                  <h3 className="text-base font-bold text-white mb-2">{f.title}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
            {/* Module previews — two side-by-side mock UIs */}
            <div className="grid md:grid-cols-2 gap-8 mt-16">
              {[
                { Component: TrainersCard,    label: 'entrenadores', title: 'Gestión de entrenadores' },
                { Component: MembershipsCard, label: 'membresias',   title: 'Control de membresías'   },
              ].map(({ Component, label, title }) => (
                <div key={label} className="flex flex-col gap-3">
                  <div className="rounded-2xl overflow-hidden shadow-xl border border-white/10"
                    style={{ perspective: '900px' }}>
                    <div style={{ transform: 'rotateX(2deg)', transformOrigin: 'bottom center' }}>
                      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10 bg-black/40">
                        <div className="flex gap-1.5">
                          <div className="w-2 h-2 rounded-full bg-red-400" />
                          <div className="w-2 h-2 rounded-full bg-yellow-400" />
                          <div className="w-2 h-2 rounded-full bg-green-400" />
                        </div>
                        <span className="text-[10px] font-mono text-slate-400">app.gemasystem.mx/{label}</span>
                      </div>
                      <div style={{ height: 300 }}>
                        <Component />
                      </div>
                    </div>
                  </div>
                  <p className="text-center text-xs font-semibold text-slate-400">{title}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Correos automáticos Section ── */}
        <section id="correos" className="relative z-10 py-28 overflow-hidden">
          {/* Glow background */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] rounded-full opacity-10"
              style={{ background: 'radial-gradient(ellipse,#6366F1,transparent 70%)', filter: 'blur(80px)' }} />
          </div>

          <div className="relative max-w-6xl mx-auto px-6">

            {/* Header */}
            <div className="text-center mb-20">
              <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-xs font-bold mb-6">
                <Mail className="w-3.5 h-3.5" /> Notificaciones automáticas · Correo electrónico
              </div>
              <h2 className="text-[clamp(2rem,6vw,3rem)] font-extrabold text-white leading-tight">
                Correos que se envían{' '}
                <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">solos</span>
              </h2>
              <p className="text-slate-400 mt-5 text-lg max-w-2xl mx-auto leading-relaxed">
                GemaSystem le escribe a tus socios en el momento exacto — bienvenida, recordatorios de vencimiento, recibos de pago y más — sin que tengas que redactar ni enviar nada tú mismo.
              </p>
            </div>

            {/* Main split layout */}
            <div className="grid lg:grid-cols-2 gap-10 items-center mb-20">

              {/* Left — preview card */}
              <div className="relative">
                {/* Inbox mockup */}
                <div className="rounded-2xl overflow-hidden shadow-2xl border border-white/8"
                  style={{ boxShadow: '0 0 0 1px rgba(99,102,241,0.12), 0 32px 80px rgba(0,0,0,0.6)' }}>
                  {/* Dark panel header */}
                  <div className="flex items-center gap-3 px-5 py-4" style={{ background: '#0D1526' }}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)', boxShadow: '0 4px 12px rgba(99,102,241,0.4)' }}>
                      <Mail style={{ width: 16, height: 16, color: '#fff' }} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white leading-none">Bandeja de entrada</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                        <span className="text-[10px] font-medium" style={{ color: '#A5B4FC' }}>notificaciones@gemasystem.mx</span>
                      </div>
                    </div>
                  </div>
                  {/* Email list */}
                  <div className="p-3 space-y-2" style={{ background: '#F7F8FA' }}>
                    {[
                      { icon: CheckCircle2, color: '#10B981', bg: 'rgba(16,185,129,0.12)', subject: '¡Bienvenido a GemaSystem!', snippet: 'Tu membresía ha sido registrada exitosamente. Aquí tienes tus datos de acceso...', time: 'Ahora' },
                      { icon: Clock,        color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', subject: 'Tu membresía vence en 3 días',  snippet: 'Renueva antes del 21/08 para seguir entrenando sin interrupciones...', time: '9:00 a.m.' },
                      { icon: CreditCard,   color: '#6366F1', bg: 'rgba(99,102,241,0.12)', subject: 'Recibo de tu pago — $417 MXN',   snippet: 'Gracias por tu pago. Tu membresía está vigente hasta...', time: 'Ayer' },
                    ].map(({ icon: Icon, color, bg, subject, snippet, time }) => (
                      <div key={subject} className="flex items-start gap-3 px-3 py-3 rounded-xl"
                        style={{ background: '#fff', border: '1px solid #EBEBF0', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: bg }}>
                          <Icon className="w-4 h-4" style={{ color }} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-bold text-slate-800 truncate">{subject}</p>
                            <span className="text-[10px] text-slate-400 flex-shrink-0">{time}</span>
                          </div>
                          <p className="text-xs text-slate-500 truncate mt-0.5">{snippet}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Floating badge */}
                <div className="absolute -top-4 -right-4 bg-indigo-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg"
                  style={{ boxShadow: '0 4px 14px rgba(99,102,241,0.5)' }}>
                  Incluido en GemaSystem
                </div>
              </div>

              {/* Right — accordion benefits */}
              <div className="space-y-2">
                {[
                  {
                    id: 'welcome',
                    icon: CheckCircle2,
                    color: '#10B981',
                    accentBg: '#091410',
                    accentBorder: 'rgba(16,185,129,0.4)',
                    badge: null,
                    title: 'Bienvenida automática',
                    desc: 'Cuando registras un nuevo socio, recibe al instante un correo de bienvenida con los datos de su membresía — sin que tengas que redactar nada.',
                    extra: null,
                  },
                  {
                    id: 'reminders',
                    icon: Clock,
                    color: '#F59E0B',
                    accentBg: '#131008',
                    accentBorder: 'rgba(245,158,11,0.4)',
                    badge: 'Configurable',
                    title: 'Recordatorios de vencimiento',
                    desc: 'Elige con cuántos días de anticipación se avisa a tus socios antes de que venza su membresía, desde Configuración → Notificaciones. El correo se envía solo, cada día.',
                    extra: null,
                  },
                  {
                    id: 'receipts',
                    icon: CreditCard,
                    color: '#6366F1',
                    accentBg: '#0f1022',
                    accentBorder: 'rgba(99,102,241,0.4)',
                    badge: null,
                    title: 'Recibos y pagos',
                    desc: 'Cada pago exitoso genera un recibo automático por correo con el monto, el plan y la vigencia. Si un cobro falla, tú y tu socio reciben un aviso para regularizarlo.',
                    extra: null,
                  },
                  {
                    id: 'birthday',
                    icon: Gift,
                    color: '#EC4899',
                    accentBg: '#1a0f16',
                    accentBorder: 'rgba(236,72,153,0.4)',
                    badge: null,
                    title: 'Cumpleaños y renovaciones',
                    desc: 'GemaSystem también felicita a tus socios el día de su cumpleaños y les invita a renovar cuando su membresía está por expirar — con plantillas ya integradas en el sistema.',
                    extra: null,
                  },
                ].map(({ id, icon: Icon, color, accentBg, accentBorder, badge, title, desc, extra }) => {
                  const isOpen = emailOpen === id
                  return (
                    <div
                      key={id}
                      className="rounded-2xl border overflow-hidden transition-all duration-200"
                      style={{
                        background: isOpen ? accentBg : '#0d1117',
                        borderColor: isOpen ? accentBorder : 'rgba(255,255,255,0.1)',
                      }}
                    >
                      <button
                        className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
                        onClick={() => setEmailOpen(isOpen ? null : id)}
                      >
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all"
                          style={{ background: color + (isOpen ? '25' : '18'), border: `1px solid ${color}${isOpen ? '40' : '28'}` }}>
                          <Icon className="w-4 h-4" style={{ color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-bold text-white text-sm leading-snug">{title}</p>
                            {badge && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                                style={{ background: 'rgba(99,102,241,0.2)', color: '#A5B4FC', border: '1px solid rgba(99,102,241,0.3)' }}>
                                {badge}
                              </span>
                            )}
                          </div>
                        </div>
                        <ChevronDown
                          className="w-4 h-4 flex-shrink-0 transition-transform duration-300"
                          style={{ color: isOpen ? color : '#475569', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                        />
                      </button>
                      <div style={{
                        maxHeight: isOpen ? '400px' : '0px',
                        overflow: 'hidden',
                        transition: 'max-height 0.35s cubic-bezier(0.4,0,0.2,1)',
                      }}>
                        <div className="px-4 pb-4">
                          <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
                          {extra}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Bottom stat pills */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { val: '9',            lbl: 'Tipos de correo automático',   color: '#6366F1' },
                { val: '0',            lbl: 'Correos que escribes a mano',  color: '#10B981' },
                { val: 'Configurable', lbl: 'Días de anticipación',         color: '#F59E0B' },
                { val: 'SSL',          lbl: 'Envío cifrado y seguro',       color: '#EC4899' },
              ].map(({ val, lbl, color }) => (
                <div key={lbl} className="rounded-2xl border border-white/8 p-5 text-center hover:-translate-y-1 transition-all duration-200 cursor-default"
                  style={{ background: '#0d1117' }}>
                  <p className="text-2xl font-extrabold leading-none mb-1" style={{ color }}>{val}</p>
                  <p className="text-xs text-slate-500 leading-snug">{lbl}</p>
                </div>
              ))}
            </div>

          </div>
        </section>

        {/* ── WhatsApp Section ── */}
        <section id="whatsapp" className="relative z-10 py-28 overflow-hidden">
          {/* Glow background */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] rounded-full opacity-10"
              style={{ background: 'radial-gradient(ellipse,#25D366,transparent 70%)', filter: 'blur(80px)' }} />
          </div>

          <div className="relative max-w-6xl mx-auto px-6">

            {/* Header */}
            <div className="text-center mb-20">
              <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-xs font-bold mb-6">
                <MessageCircle className="w-3.5 h-3.5" /> Integración con WhatsApp · Nuevo
              </div>
              <h2 className="text-[clamp(2rem,6vw,3rem)] font-extrabold text-white leading-tight">
                Tu gimnasio, también en{' '}
                <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">WhatsApp</span>
              </h2>
              <p className="text-slate-400 mt-5 text-lg max-w-2xl mx-auto leading-relaxed">
                Vincula el WhatsApp del gimnasio y deja que GemaSystem envíe automáticamente bienvenidas, recordatorios y avisos a tus socios por el canal que ya usan todos los días.
              </p>
            </div>

            {/* Main split layout */}
            <div className="grid lg:grid-cols-2 gap-10 items-center mb-20">

              {/* Left — preview card */}
              <div className="relative">
                {/* WhatsApp chat mockup */}
                <div className="rounded-2xl overflow-hidden shadow-2xl border border-white/8"
                  style={{ boxShadow: '0 0 0 1px rgba(37,211,102,0.12), 0 32px 80px rgba(0,0,0,0.6)' }}>
                  {/* Dark panel header */}
                  <div className="flex items-center gap-3 px-5 py-4" style={{ background: '#0D1526' }}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg,#25D366,#128C7E)', boxShadow: '0 4px 12px rgba(37,211,102,0.4)' }}>
                      <MessageCircle style={{ width: 16, height: 16, color: '#fff' }} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white leading-none">WhatsApp del gimnasio</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        <span className="text-[10px] font-medium" style={{ color: '#6EE7B7' }}>Conectado · Sesión activa</span>
                      </div>
                    </div>
                  </div>
                  {/* Chat area */}
                  <div className="p-5 space-y-4" style={{ background: '#F7F8FA' }}>
                    {/* Automated message 1 */}
                    <div className="flex gap-2.5 items-start">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: 'linear-gradient(135deg,#25D366,#128C7E)' }}>
                        <MessageCircle style={{ width: 12, height: 12, color: '#fff' }} />
                      </div>
                      <div className="px-4 py-3 rounded-2xl text-sm text-slate-800 max-w-xs"
                        style={{ background: '#fff', border: '1px solid #EBEBF0', borderRadius: '16px 16px 16px 4px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                        👋 ¡Hola, <strong>Carlos</strong>! Bienvenido en <strong>Fitness Pro</strong>. Tu membresía fue registrada. 🆔 Socio: <strong>FP-0231</strong> 💪
                      </div>
                    </div>
                    {/* Automated message 2 */}
                    <div className="flex gap-2.5 items-start">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: 'linear-gradient(135deg,#25D366,#128C7E)' }}>
                        <MessageCircle style={{ width: 12, height: 12, color: '#fff' }} />
                      </div>
                      <div className="px-4 py-3 rounded-2xl text-sm text-slate-800 max-w-xs"
                        style={{ background: '#fff', border: '1px solid #EBEBF0', borderRadius: '16px 16px 16px 4px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                        ⏳ Hola, <strong>Carlos</strong> — tu membresía vence en <strong>3 días</strong> (el 21/08). Renuévala en recepción.
                      </div>
                    </div>
                    {/* Delivered indicator */}
                    <div className="flex items-center gap-1.5 justify-end pr-1">
                      <CheckCircle2 className="w-3.5 h-3.5" style={{ color: '#25D366' }} />
                      <span className="text-[10px] font-medium text-slate-400">Entregado automáticamente</span>
                    </div>
                  </div>
                </div>

                {/* Floating badge */}
                <div className="absolute -top-4 -right-4 bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg"
                  style={{ boxShadow: '0 4px 14px rgba(37,211,102,0.5)' }}>
                  Incluido en GemaSystem
                </div>
              </div>

              {/* Right — accordion benefits */}
              <div className="space-y-2">
                {[
                  {
                    id: 'connect',
                    icon: ScanLine,
                    color: '#25D366',
                    accentBg: '#091410',
                    accentBorder: 'rgba(37,211,102,0.4)',
                    badge: 'Sin número nuevo',
                    title: 'Vincula tu WhatsApp en segundos',
                    desc: 'Conecta el WhatsApp del gimnasio escaneando un código QR, igual que WhatsApp Web. No necesitas contratar una API externa ni pedir un número nuevo — usas el que ya tienes.',
                    extra: (
                      <div className="mt-3 space-y-2">
                        {[
                          { n: '1', text: 'Entra a la sección WhatsApp del sistema' },
                          { n: '2', text: 'Escanea el código QR con tu teléfono' },
                          { n: '3', text: 'Tu WhatsApp queda conectado y listo para enviar' },
                          { n: '4', text: 'Si se desconecta, vuelve a escanear cuando quieras' },
                        ].map(({ n, text }) => (
                          <div key={n} className="flex items-start gap-2.5">
                            <span className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-extrabold mt-0.5"
                              style={{ background: 'rgba(37,211,102,0.25)', color: '#6EE7B7' }}>{n}</span>
                            <p className="text-xs text-slate-400 leading-snug">{text}</p>
                          </div>
                        ))}
                      </div>
                    ),
                  },
                  {
                    id: 'welcome-qr',
                    icon: Scan,
                    color: '#10B981',
                    accentBg: '#0a1a12',
                    accentBorder: 'rgba(16,185,129,0.4)',
                    badge: null,
                    title: 'Bienvenida con código QR de acceso',
                    desc: 'Al registrar un nuevo socio, GemaSystem le envía por WhatsApp un mensaje de bienvenida junto con su código QR — listo para presentar en recepción desde el primer día.',
                    extra: null,
                  },
                  {
                    id: 'reminders',
                    icon: Clock,
                    color: '#F59E0B',
                    accentBg: '#131008',
                    accentBorder: 'rgba(245,158,11,0.4)',
                    badge: null,
                    title: 'Recordatorios de vencimiento',
                    desc: 'Tus socios reciben un WhatsApp automático cuando su membresía está por vencer o ya venció, con el mismo lenguaje cercano que usarías tú.',
                    extra: null,
                  },
                  {
                    id: 'history',
                    icon: MessageSquare,
                    color: '#6366F1',
                    accentBg: '#0f1022',
                    accentBorder: 'rgba(99,102,241,0.4)',
                    badge: null,
                    title: 'Historial de cada mensaje enviado',
                    desc: 'Todos los mensajes automáticos — bienvenidas, recordatorios, cumpleaños y pagos — quedan guardados en un historial que puedes revisar cuando quieras.',
                    extra: null,
                  },
                ].map(({ id, icon: Icon, color, accentBg, accentBorder, badge, title, desc, extra }) => {
                  const isOpen = waOpen === id
                  return (
                    <div
                      key={id}
                      className="rounded-2xl border overflow-hidden transition-all duration-200"
                      style={{
                        background: isOpen ? accentBg : '#0d1117',
                        borderColor: isOpen ? accentBorder : 'rgba(255,255,255,0.1)',
                      }}
                    >
                      <button
                        className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
                        onClick={() => setWaOpen(isOpen ? null : id)}
                      >
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all"
                          style={{ background: color + (isOpen ? '25' : '18'), border: `1px solid ${color}${isOpen ? '40' : '28'}` }}>
                          <Icon className="w-4 h-4" style={{ color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-bold text-white text-sm leading-snug">{title}</p>
                            {badge && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                                style={{ background: 'rgba(37,211,102,0.2)', color: '#6EE7B7', border: '1px solid rgba(37,211,102,0.3)' }}>
                                {badge}
                              </span>
                            )}
                          </div>
                        </div>
                        <ChevronDown
                          className="w-4 h-4 flex-shrink-0 transition-transform duration-300"
                          style={{ color: isOpen ? color : '#475569', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                        />
                      </button>
                      <div style={{
                        maxHeight: isOpen ? '400px' : '0px',
                        overflow: 'hidden',
                        transition: 'max-height 0.35s cubic-bezier(0.4,0,0.2,1)',
                      }}>
                        <div className="px-4 pb-4">
                          <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
                          {extra}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Bottom stat pills */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { val: 'QR',        lbl: 'Vinculación sin número nuevo', color: '#25D366' },
                { val: '24/7',      lbl: 'Mensajes automáticos',         color: '#F59E0B' },
                { val: 'Historial', lbl: 'Registro de cada envío',       color: '#6366F1' },
                { val: 'Incluido',  lbl: 'Sin costo adicional',          color: '#10B981' },
              ].map(({ val, lbl, color }) => (
                <div key={lbl} className="rounded-2xl border border-white/8 p-5 text-center hover:-translate-y-1 transition-all duration-200 cursor-default"
                  style={{ background: '#0d1117' }}>
                  <p className="text-2xl font-extrabold leading-none mb-1" style={{ color }}>{val}</p>
                  <p className="text-xs text-slate-500 leading-snug">{lbl}</p>
                </div>
              ))}
            </div>

          </div>
        </section>

        {/* ── Free trial section ── */}
        <section id="prueba-gratis" className="relative z-10 py-24">
          <div className="relative max-w-6xl mx-auto px-6">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              {/* Left: info */}
              <div>
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
              </div>

              {/* Right: form */}
              <div className="rounded-2xl border border-white/10 shadow-2xl shadow-black/50 p-8"
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
              </div>
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
            <div className="text-center mb-20">
              <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-indigo-400 mb-5">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse inline-block" />
                Precios
              </span>
              <h2 className="text-[clamp(2rem,6vw,3rem)] font-extrabold text-white leading-tight">
                Planes para cada etapa<br className="hidden md:block" /> de tu negocio
              </h2>
              <p className="text-slate-400 mt-5 text-lg max-w-xl mx-auto">Sin permanencia. Cancela cuando quieras.</p>
              <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-full border border-amber-500/25 bg-amber-500/10">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
                <span className="text-xs font-bold text-amber-400">Precios especiales de fase beta — garantizados mientras dure el acceso anticipado</span>
              </div>
            </div>

            {/* Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">

              {/* ── Semanal ── */}
              <div className="relative flex flex-col rounded-3xl p-7 border border-white/10 backdrop-blur-sm
                hover:-translate-y-2 transition-all duration-300 group"
                style={{ background: 'rgba(255,255,255,0.04)' }}>
                <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-4">Semanal</p>
                <p className="text-sm text-slate-600 line-through leading-none mb-1.5">$699/semana</p>
                <div className="mb-1 flex items-end gap-2 flex-wrap">
                  <span className="text-5xl font-black text-white leading-none">$417</span>
                  <span className="text-slate-400 text-sm mb-1.5">/semana</span>
                  <span className="mb-1.5 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">Ahorras $282</span>
                </div>
                <p className="text-xs text-slate-500 mb-8">MXN · sin contrato</p>
                <ul className="space-y-3 flex-1 mb-8">
                  {PLANS[0].features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm">
                      <Check className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                      <span className="text-slate-300">{f}</span>
                    </li>
                  ))}
                </ul>
                <button onClick={() => goRegister('weekly')}
                  className="w-full py-3.5 rounded-2xl font-bold text-sm text-white border border-white/15
                    hover:bg-white/10 transition-all duration-200"
                  style={{ background: 'rgba(255,255,255,0.06)' }}>
                  Comenzar
                </button>
              </div>

              {/* ── Mensual (destacado) ── */}
              <div className="relative flex flex-col rounded-3xl p-[1.5px] transition-all duration-300 hover:-translate-y-2"
                style={{ background: 'linear-gradient(135deg,#6366f1 0%,#8b5cf6 50%,#ec4899 100%)',
                  boxShadow: '0 0 60px rgba(99,102,241,0.35), 0 30px 60px rgba(99,102,241,0.2)' }}>
                {/* Badge */}
                <div className="absolute -top-5 left-1/2 -translate-x-1/2 z-10">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold px-4 py-1.5 rounded-full text-white shadow-lg"
                    style={{ background: 'linear-gradient(90deg,#6366f1,#8b5cf6)' }}>
                    ⭐ Más popular
                  </span>
                </div>
                <div className="flex flex-col flex-1 rounded-[22px] p-7 pt-10"
                  style={{ background: 'linear-gradient(160deg,#312e81,#4c1d95)' }}>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-indigo-300 mb-4">Mensual</p>
                  <p className="text-sm text-indigo-300/40 line-through leading-none mb-1.5">$2,499/mes</p>
                  <div className="mb-1 flex items-end gap-2 flex-wrap">
                    <span className="text-5xl font-black text-white leading-none">$1,622</span>
                    <span className="text-indigo-300 text-sm mb-1.5">/mes</span>
                    <span className="mb-1.5 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-white/15 text-white border border-white/25">Ahorras $877</span>
                  </div>
                  <p className="text-xs text-indigo-300/70 mb-8">MXN · cancela cuando quieras</p>
                  <ul className="space-y-3 flex-1 mb-8">
                    {PLANS[1].features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm">
                        <Check className="w-4 h-4 text-indigo-300 flex-shrink-0 mt-0.5" />
                        <span className="text-white/90">{f}</span>
                      </li>
                    ))}
                  </ul>
                  <button onClick={() => goRegister('monthly')}
                    className="w-full py-3.5 rounded-2xl font-bold text-sm bg-white text-indigo-700
                      hover:bg-indigo-50 transition-all duration-200 shadow-xl">
                    Comenzar ahora
                  </button>
                </div>
              </div>

              {/* ── Prueba gratuita ── */}
              <div className="relative flex flex-col rounded-3xl p-[1.5px] transition-all duration-300 hover:-translate-y-2"
                style={{ background: 'linear-gradient(135deg,#10b981 0%,#059669 50%,#34d399 100%)',
                  boxShadow: '0 0 40px rgba(16,185,129,0.2)' }}>
                {/* Badge */}
                <div className="absolute -top-5 left-1/2 -translate-x-1/2 z-10">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold px-4 py-1.5 rounded-full text-white shadow-lg"
                    style={{ background: 'linear-gradient(90deg,#059669,#10b981)' }}>
                    <Gift className="w-3 h-3" /> Sin tarjeta
                  </span>
                </div>
                <div className="flex flex-col flex-1 rounded-[22px] p-7 pt-10"
                  style={{ background: 'linear-gradient(160deg,#052e16,#064e3b)' }}>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-400 mb-4">Prueba gratis</p>
                  <div className="mb-1 flex items-end gap-2">
                    <span className="text-5xl font-black text-white leading-none">$0</span>
                    <span className="text-emerald-300 text-sm mb-1.5">/ 10 días</span>
                  </div>
                  <p className="text-xs text-emerald-400 mb-8">Sin tarjeta de crédito · acceso completo</p>
                  <ul className="space-y-3 flex-1 mb-8">
                    {[
                      'Todas las funciones incluidas',
                      'Miembros y visitas ilimitados',
                      'Control QR desde el primer día',
                      'Soporte en tiempo real',
                      'Sin compromisos, cancela cuando quieras',
                    ].map((f, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm">
                        <Check className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                        <span className="text-slate-200">{f}</span>
                      </li>
                    ))}
                  </ul>
                  <button onClick={scrollToTrial}
                    className="w-full py-3.5 rounded-2xl font-bold text-sm text-white
                      hover:brightness-110 transition-all duration-200 shadow-xl"
                    style={{ background: 'linear-gradient(90deg,#10b981,#059669)' }}>
                    Comenzar gratis
                  </button>
                </div>
              </div>

            </div>

            <p className="text-center text-xs text-slate-600 mt-12">
              Precios en pesos mexicanos (MXN) · IVA no incluido · Sin contrato de permanencia · Cancela cuando quieras
            </p>

          </div>
        </section>

        {/* ── VS Comparison ── */}
        <section id="comparativa" className="relative z-10 py-20 px-6">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <p className="text-xs font-bold uppercase tracking-widest text-indigo-400 mb-3">Comparativa</p>
              <h2 className="text-3xl font-extrabold text-white">¿Por qué GemaSystem y no otra opción?</h2>
              <p className="text-slate-400 mt-3 max-w-2xl mx-auto text-base">
                Comparamos GemaSystem contra el caos del papel y contra sistemas overcomplicated que nadie termina usando.
              </p>
            </div>
            <VSComparison />
            <div className="mt-8 text-center">
              <button onClick={scrollToTrial}
                className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition-all shadow-lg shadow-indigo-500/25 hover:-translate-y-0.5">
                <Gift className="w-4 h-4" /> Empieza gratis hoy — 10 días sin costo
              </button>
            </div>
          </div>
        </section>

        {/* ── Reviews ── */}
        <section id="reseñas" className="relative z-10 py-24">
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-10">
              <p className="text-xs font-bold uppercase tracking-widest text-indigo-400 mb-3">Reseñas</p>
              <h2 className="text-3xl font-extrabold text-white">Lo que dicen nuestros usuarios</h2>
              <p className="text-slate-400 mt-3 max-w-lg mx-auto">Opiniones reales de quienes ya usan GemaSystem en su día a día.</p>
            </div>

            {/* Tabs */}
            <div className="flex justify-center mb-10">
              <div className="inline-flex border border-white/10 rounded-2xl p-1.5 gap-1" style={{ background: '#0d1020' }}>
                {[
                  { id: 'socios',  label: 'Personas que conocieron el sistema', icon: Users },
                  { id: 'duenos', label: 'Dueños y Administrativos', icon: BadgeCheck },
                ].map(tab => (
                  <button key={tab.id} onClick={() => setActiveReviewTab(tab.id)}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                      activeReviewTab === tab.id
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/30'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}>
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab: Personas que conocieron el sistema */}
            {activeReviewTab === 'socios' && (
              <>
                <div className="flex justify-center mb-6">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-semibold">
                    <Zap className="w-3.5 h-3.5" />
                    Opiniones de personas a quienes se les mostró o explicó el sistema
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                  {MEMBER_REVIEWS.map((r, i) => (
                    <div key={i} className="rounded-2xl border border-white/10 p-6 hover:-translate-y-1 transition-all duration-300 flex flex-col" style={{ background: '#0d1020' }}>
                      <div className="flex items-center justify-between mb-3">
                        <StarRating value={r.rating} onChange={() => {}} readOnly size="sm" />
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/25 whitespace-nowrap">
                          {r.highlight}
                        </span>
                      </div>
                      <p className="text-slate-300 text-sm leading-relaxed flex-1">"{r.comment}"</p>
                      <div className="mt-5 pt-4 border-t border-white/10">
                        <p className="font-bold text-white text-sm">{r.author}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{r.role}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Tab: Dueños — empty state */}
            {activeReviewTab === 'duenos' && (
              <div className="mb-12">
                <div className="max-w-md mx-auto text-center py-14 rounded-2xl border border-dashed border-white/20" style={{ background: '#0d1020' }}>
                  <div className="w-16 h-16 rounded-2xl bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center mx-auto mb-5">
                    <MessageSquare className="w-7 h-7 text-indigo-400" />
                  </div>
                  <h3 className="font-extrabold text-white text-lg mb-2">Aún no hay reseñas</h3>
                  <p className="text-slate-400 text-sm max-w-xs mx-auto leading-relaxed">
                    ¿Ya tienes GemaSystem en tu gimnasio? Sé el primero en dejar tu opinión como propietario o administrativo.
                  </p>
                  <div className="mt-6 inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-400 text-xs font-bold">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    Sé el primero en calificar
                  </div>
                </div>
              </div>
            )}

            {/* Submit review form — shown in both tabs */}
            <div className="max-w-xl mx-auto rounded-2xl border border-white/10 p-8" style={{ background: '#0d1020' }}>
              {reviewDone ? (
                <div className="text-center py-4">
                  <div className="w-14 h-14 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                    <Check className="w-7 h-7 text-emerald-400" />
                  </div>
                  <h3 className="font-extrabold text-white text-lg mb-2">¡Gracias por tu reseña!</h3>
                  <p className="text-slate-400 text-sm">La revisaremos y publicaremos muy pronto.</p>
                </div>
              ) : (
                <>
                  <div className="mb-6">
                    <h3 className="font-extrabold text-white text-lg">
                      {activeReviewTab === 'duenos' ? '¿Administras un gimnasio con GemaSystem?' : '¿Asistes a un gimnasio que usa GemaSystem?'}
                    </h3>
                    <p className="text-slate-400 text-sm mt-1">
                      {activeReviewTab === 'duenos'
                        ? 'Comparte tu experiencia como propietario o administrativo'
                        : 'Cuéntanos cómo ha sido tu experiencia como socio'}
                    </p>
                  </div>
                  <form onSubmit={rf.handleSubmit(onReviewSubmit)} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Tu calificación</label>
                      <StarRating value={reviewRating} onChange={setReviewRating} />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="review_author" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Tu nombre</label>
                        <input id="review_author" {...rf.register('author')}
                          placeholder={activeReviewTab === 'duenos' ? 'Carlos M.' : 'Ana G.'}
                          className={rf.formState.errors.author ? grayInpErr : grayInp} />
                        {rf.formState.errors.author && <p className="mt-1 text-xs text-red-500">{rf.formState.errors.author.message}</p>}
                      </div>
                      <div>
                        <label htmlFor="review_role" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                          {activeReviewTab === 'duenos' ? 'Cargo' : 'Gimnasio'}{' '}
                          <span className="text-gray-300 normal-case font-normal">(opcional)</span>
                        </label>
                        <input id="review_role" {...rf.register('role')}
                          placeholder={activeReviewTab === 'duenos' ? 'Propietario' : 'GymFit Monterrey'}
                          className={grayInp} />
                      </div>
                    </div>
                    <div>
                      <label htmlFor="review_comment" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Tu comentario</label>
                      <textarea id="review_comment" {...rf.register('comment')} rows={4}
                        placeholder={activeReviewTab === 'duenos'
                          ? 'Cuéntanos cómo GemaSystem cambió la operación de tu gimnasio...'
                          : 'Cuéntanos tu experiencia como socio...'}
                        className={`${rf.formState.errors.comment ? grayInpErr : grayInp} resize-none`} />
                      {rf.formState.errors.comment && <p className="mt-1 text-xs text-red-500">{rf.formState.errors.comment.message}</p>}
                    </div>
                    <button type="submit"
                      className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm text-white transition-all"
                      style={{ background: 'linear-gradient(135deg,#4F46E5,#7C3AED)', boxShadow: '0 6px 20px rgba(99,102,241,0.3)' }}>
                      <Send className="w-4 h-4" /> Enviar reseña
                    </button>
                  </form>
                </>
              )}
            </div>
          </div>
        </section>

        {/* Beta section */}
        <section id="beta" className="relative z-10 py-24 overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-violet-600/10 rounded-full blur-3xl" />
          </div>
          <div className="relative max-w-5xl mx-auto px-6 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-300 text-sm font-bold mb-8">
              <Zap className="w-4 h-4" /> Programa de Acceso Anticipado — v1.0.0-beta.1
            </div>
            <h2 className="text-[clamp(1.75rem,7vw,3rem)] font-extrabold text-white mb-5 leading-tight">
              Estás usando una versión <span className="text-amber-400">BETA</span>
            </h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto mb-14 leading-relaxed">
              GemaSystem está en desarrollo activo. Como usuario beta, eres parte del proceso. Tu feedback moldea directamente cada nueva versión del producto.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-left">
              {[
                { icon: Zap,        title: 'Desarrollo activo',    desc: 'Nuevas funciones se agregan constantemente. Las actualizaciones son automáticas y sin costo adicional.' },
                { icon: Shield,     title: 'Datos protegidos',     desc: 'Aunque es beta, tu información está protegida con los mismos estándares de un sistema en producción.' },
                { icon: BadgeCheck, title: 'Precio especial beta', desc: 'Los usuarios beta reciben precio reducido mientras dure el programa de acceso anticipado. Precio garantizado.' },
              ].map((item, i) => (
                <div key={i} className="border border-white/10 rounded-2xl p-6 transition-colors" style={{ background: '#0d1020' }}>
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/15 flex items-center justify-center mb-4">
                    <item.icon className="w-5 h-5 text-indigo-400" />
                  </div>
                  <h3 className="font-bold text-white mb-2">{item.title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
            {/* ── Roadmap ── */}
            <div className="mt-12 w-full max-w-2xl mx-auto text-left">

              {/* Toggle header */}
              <button onClick={() => setRoadmapOpen(o => !o)}
                className="w-full flex items-center justify-between gap-4 px-5 py-4 rounded-2xl border border-white/10 transition-all duration-200 group" style={{ background: '#0d1020' }}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500/25 to-violet-500/25 border border-white/10 flex items-center justify-center flex-shrink-0">
                    <Zap className="w-3.5 h-3.5 text-indigo-300" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-white leading-none">Próximas versiones</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">2026 · Hoja de ruta</p>
                  </div>
                  <span className="hidden sm:inline text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    3 lanzamientos
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 group-hover:text-slate-400 transition-colors">
                    {roadmapOpen ? 'Ocultar' : 'Ver roadmap'}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform duration-300 ${roadmapOpen ? 'rotate-180' : ''}`} />
                </div>
              </button>

              {/* Cards */}
              <div style={{
                maxHeight: roadmapOpen ? '1100px' : '0px',
                overflow: 'hidden',
                opacity: roadmapOpen ? 1 : 0,
                transition: 'max-height 0.5s cubic-bezier(0.4,0,0.2,1), opacity 0.3s ease',
              }}>
                <div className="mt-4 relative flex flex-col gap-3">
                  {/* Connector line */}
                  <div className="absolute left-7 top-14 bottom-14 w-px pointer-events-none"
                    style={{ background: 'linear-gradient(to bottom,rgba(99,102,241,0.45),rgba(139,92,246,0.25),transparent)' }} />

                  {[
                    {
                      version: 'v1.2.0', year: '2026', status: 'En desarrollo',
                      Icon: Bot,
                      title: 'Chatbot de Soporte',
                      subtitle: 'Asistente inteligente 24/7',
                      desc: 'Asistente integrado directamente en el panel de GemaSystem. Responde preguntas de socios, guía la configuración y resuelve dudas operativas en tiempo real sin salir de la plataforma.',
                      tags: ['Inteligencia Artificial', 'Automatización', 'Soporte'],
                      grad: 'linear-gradient(135deg,#4f46e5,#2563eb)',
                      glow: 'rgba(99,102,241,0.35)',
                      accent: '#6366f1',
                      tagStyle: { bg: 'rgba(99,102,241,0.12)', border: 'rgba(99,102,241,0.28)', text: '#a5b4fc' },
                      statusStyle: { bg: 'rgba(99,102,241,0.15)', border: 'rgba(99,102,241,0.3)', text: '#a5b4fc' },
                    },
                    {
                      version: 'v1.5.0', year: '2026', status: 'Planeado',
                      Icon: Store,
                      title: 'Portal del Socio',
                      subtitle: 'Tu gimnasio en la palma de tu mano',
                      desc: 'Los miembros del gimnasio tendrán acceso a su propio portal donde podrán consultar su membresía activa, historial de visitas y actividades, reservar clases y adquirir membresías o productos que el gimnasio gestione directamente desde GemaSystem — todo sin salir de casa.',
                      tags: ['Portal Miembro', 'Tienda Online', 'Reserva de Clases', 'Autogestión'],
                      grad: 'linear-gradient(135deg,#059669,#10b981)',
                      glow: 'rgba(16,185,129,0.35)',
                      accent: '#10b981',
                      tagStyle: { bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.28)', text: '#6ee7b7' },
                      statusStyle: { bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.3)', text: '#6ee7b7' },
                    },
                    {
                      version: 'v2.0.0', year: '2026', status: 'Planeado',
                      Icon: MonitorSmartphone,
                      title: 'GemaSystem PWA',
                      subtitle: 'App instalable multiplataforma',
                      desc: 'GemaSystem disponible como Progressive Web App instalable en cualquier dispositivo. Accede desde el celular, tablet o escritorio como app nativa, con soporte básico sin conexión.',
                      tags: ['PWA', 'Móvil', 'Offline'],
                      grad: 'linear-gradient(135deg,#7c3aed,#9333ea)',
                      glow: 'rgba(139,92,246,0.35)',
                      accent: '#8b5cf6',
                      tagStyle: { bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.28)', text: '#c4b5fd' },
                      statusStyle: { bg: 'rgba(139,92,246,0.15)', border: 'rgba(139,92,246,0.3)', text: '#c4b5fd' },
                    },
                  ].map(item => (
                    <div key={item.version} className="flex gap-4 items-start">
                      {/* Icon box */}
                      <div className="flex-shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg"
                        style={{ background: item.grad, boxShadow: `0 8px 20px ${item.glow}` }}>
                        <item.Icon className="w-7 h-7 text-white" />
                      </div>

                      {/* Card */}
                      <div className="flex-1 min-w-0 rounded-2xl border border-white/10 overflow-hidden transition-colors" style={{ background: '#0d1020' }}>
                        <div className="h-[2px]" style={{ background: `linear-gradient(90deg,${item.accent},transparent)` }} />
                        <div className="p-4">
                          <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                            <div>
                              <p className="text-white font-bold text-sm leading-tight">{item.title}</p>
                              <p className="text-slate-500 text-[11px] mt-0.5">{item.subtitle}</p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className="text-[10px] font-mono font-bold" style={{ color: item.accent }}>{item.version}</span>
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-lg border"
                                style={{ background: item.statusStyle.bg, color: item.statusStyle.text, borderColor: item.statusStyle.border }}>
                                {item.status}
                              </span>
                            </div>
                          </div>
                          <p className="text-slate-400 text-xs leading-relaxed mb-3">{item.desc}</p>
                          <div className="flex flex-wrap gap-1.5">
                            {item.tags.map(tag => (
                              <span key={tag} className="text-[10px] font-semibold px-2 py-0.5 rounded-full border"
                                style={{ background: item.tagStyle.bg, color: item.tagStyle.text, borderColor: item.tagStyle.border }}>
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section id="faq" className="relative z-10 py-24 px-6">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-12">
              <p className="text-xs font-bold uppercase tracking-widest text-indigo-400 mb-3">FAQ</p>
              <h2 className="text-3xl font-extrabold text-white">Preguntas frecuentes</h2>
              <p className="text-slate-400 mt-3 max-w-lg mx-auto">Todo lo que necesitas saber antes de empezar.</p>
            </div>
            <LandingFaq />
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-28 text-center px-6">
          <div className="max-w-3xl mx-auto">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-indigo-500/30">
              <GemaSystemLogo className="w-10 h-10" />
            </div>
            <h2 className="text-[clamp(2rem,7vw,3rem)] font-extrabold text-white leading-tight mb-5">
              ¿Listo para modernizar<br className="hidden sm:block" /> tu gimnasio?
            </h2>
            <p className="text-xl text-slate-400 mb-12 max-w-xl mx-auto leading-relaxed">
              Empieza con 10 días gratis o elige tu plan. Sin permanencia. Sin riesgos.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <button onClick={scrollToTrial}
                className="flex items-center gap-2.5 px-10 py-4 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-lg transition-all shadow-2xl shadow-indigo-500/30 hover:-translate-y-1 duration-200">
                <Gift className="w-5 h-5" /> Prueba 10 días gratis
              </button>
              <button onClick={() => goRegister()}
                className="flex items-center gap-2 px-10 py-4 rounded-xl border-2 border-white/20 text-white font-bold text-lg hover:border-indigo-400 hover:text-indigo-300 transition-all duration-200">
                Ver planes <ArrowRight className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-slate-500 mt-8 flex flex-wrap justify-center gap-4">
              <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-400" />Sin tarjeta de crédito</span>
              <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-400" />Configura en minutos</span>
              <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-400" />Cancela cuando quieras</span>
              <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-400" />Soporte incluido</span>
            </p>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-10 px-6" style={{ background: '#040812', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
                <GemaSystemLogo className="w-3.5 h-3.5" />
              </div>
              <span className="font-extrabold text-white text-sm">GemaSystem</span>
              <span className="text-xs text-slate-500 border border-white/15 rounded-full px-2 py-0.5 font-mono">v1.0.0-beta.1</span>
            </div>
            <p className="text-xs text-slate-500 text-center">
              © {new Date().getFullYear()} GemaSystem · Software de gestión para gimnasios · Todos los derechos reservados
            </p>
            <div className="flex items-center gap-5 text-xs text-slate-500">
              <span className="font-medium">Hecho en México</span>
              <a href="/privacidad" className="hover:text-slate-300 transition-colors">Privacidad</a>
              <a href="/terminos"   className="hover:text-slate-300 transition-colors">Términos</a>
              <Link to="/support" className="hover:text-slate-300 transition-colors">Soporte</Link>
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
