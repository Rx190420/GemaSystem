import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import {
  Check, ChevronRight, ChevronLeft, Eye, EyeOff, Loader2,
  Users, CreditCard, BarChart3, Calendar, DollarSign,
  Tag, Zap, Shield, Globe, ArrowRight, CheckCircle2, CheckCheck,
  AlertTriangle, Lock, Building2, Phone, Mail, MapPin, Smile, MessageCircle,
} from 'lucide-react'
import GemaSystemLogo from './GemaSystemLogo'
import api from '../api/axios'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'
import useLockBodyScroll from '../hooks/useLockBodyScroll'

// ─── Constants ────────────────────────────────────────────────────────────────

const STEPS = [
  { label: 'Bienvenida'  },
  { label: 'Tu Gimnasio' },
  { label: 'Precios'     },
  { label: 'Sistema'     },
  { label: 'Descubre'    },
  { label: '¡Listo!'     },
]

const FEATURES = [
  {
    icon: BarChart3, color: '#6366F1', bg: '#EEF2FF',
    title: 'Dashboard inteligente',
    badge: 'Visión completa',
    desc: 'Ve de un vistazo: ingresos del mes, visitas de hoy, miembros activos y alertas de vencimiento. Toda tu operación en una sola pantalla.',
  },
  {
    id: 'whatsapp',
    icon: MessageCircle, badgeIcon: Zap, color: '#25D366', bg: '#E9FBF0',
    title: 'WhatsApp automático',
    badge: 'Nuevo',
    desc: 'Conecta tu número escaneando un QR y GemaSystem envía solo: bienvenida con código QR al registrar un socio, recordatorio antes de que venza su membresía, y el código para restablecer contraseña. Todo desde tu propio número.',
  },
  {
    icon: Zap, badgeIcon: Zap, color: '#10B981', bg: '#ECFDF5',
    title: 'Acceso QR en menos de 1 segundo',
    badge: 'Más innovador',
    desc: 'Cada miembro tiene su código QR único. Escanéalo con la cámara para registrar su entrada al instante. Sin filas, sin papel, sin errores.',
  },
  {
    icon: CreditCard, color: '#8B5CF6', bg: '#F5F3FF',
    title: 'Membresías con control automático',
    badge: 'Ahorra tiempo',
    desc: 'Crea membresías, registra pagos y recibe alertas 7 días antes de que expiren. El estado del miembro se actualiza de forma automática.',
  },
  {
    icon: Calendar, color: '#F59E0B', bg: '#FFFBEB',
    title: 'Clases y horarios semanales',
    badge: 'Organización total',
    desc: 'Organiza clases grupales con entrenadores, horarios recurrentes y control de cupo. Registra la asistencia de cada sesión.',
  },
  {
    icon: DollarSign, color: '#059669', bg: '#ECFDF5',
    title: 'Reportes financieros detallados',
    badge: 'Control total',
    desc: 'Ingresos por día, semana, mes y año. Desglose por membresías vs. visitas y los miembros que más aportan a tu negocio.',
  },
  {
    icon: Tag, color: '#EC4899', bg: '#FDF2F8',
    title: 'Etiquetas de colores',
    badge: 'Filtrado rápido',
    desc: 'Crea etiquetas: VIP, prueba gratuita, estudiante, frecuente. Filtra y encuentra a cualquier miembro en segundos.',
  },
]

const CURRENCIES = [
  { value: 'USD', label: 'USD — Dólar americano'   },
  { value: 'MXN', label: 'MXN — Peso mexicano'     },
  { value: 'COP', label: 'COP — Peso colombiano'   },
  { value: 'ARS', label: 'ARS — Peso argentino'    },
  { value: 'PEN', label: 'PEN — Sol peruano'       },
  { value: 'CLP', label: 'CLP — Peso chileno'      },
  { value: 'BRL', label: 'BRL — Real brasileño'    },
  { value: 'EUR', label: 'EUR — Euro'              },
]

const TIMEZONES = [
  { value: 'America/Mexico_City',  label: 'México (UTC-6)'              },
  { value: 'America/Bogota',       label: 'Bogotá, Lima, Quito (UTC-5)' },
  { value: 'America/Buenos_Aires', label: 'Buenos Aires (UTC-3)'        },
  { value: 'America/Santiago',     label: 'Santiago de Chile (UTC-4)'   },
  { value: 'America/Caracas',      label: 'Caracas (UTC-4)'             },
  { value: 'America/New_York',     label: 'Nueva York (UTC-5)'          },
  { value: 'Europe/Madrid',        label: 'Madrid (UTC+1)'              },
  { value: 'UTC',                  label: 'UTC (Coordinado universal)'   },
]

// ─── Animations ───────────────────────────────────────────────────────────────

const STYLES = `
  @keyframes wiz-in {
    from { opacity: 0; transform: translateX(16px); }
    to   { opacity: 1; transform: translateX(0);    }
  }
  @keyframes wiz-pop {
    from { transform: scale(0.5); opacity: 0; }
    to   { transform: scale(1);   opacity: 1; }
  }
  @keyframes wiz-float {
    0%, 100% { transform: translateY(0px);  }
    50%       { transform: translateY(-6px); }
  }
  @keyframes wiz-blob {
    0%, 100% { transform: translate(0%, 0%) scale(1);     }
    33%      { transform: translate(6%, -8%) scale(1.15); }
    66%      { transform: translate(-5%, 6%) scale(0.9);  }
  }
  @keyframes wiz-pulse-ring {
    0%   { box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-primary-500) 50%, transparent); }
    70%  { box-shadow: 0 0 0 7px color-mix(in srgb, var(--color-primary-500) 0%, transparent); }
    100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-primary-500) 0%, transparent); }
  }
  @keyframes wiz-chat-in {
    from { opacity: 0; transform: translateX(14px) scale(0.92); }
    to   { opacity: 1; transform: translateX(0) scale(1);       }
  }
  @keyframes wiz-confetti-fall {
    0%   { transform: translateY(-10px) translateX(0) rotate(0deg); opacity: 1; }
    100% { transform: translateY(180px) translateX(var(--drift)) rotate(var(--rot)); opacity: 0; }
  }
  @keyframes wiz-typing {
    0%, 60%, 100% { opacity: 0.25; transform: translateY(0); }
    30%            { opacity: 1;    transform: translateY(-2px); }
  }
  .wiz-in         { animation: wiz-in  0.28s ease both; }
  .wiz-pop        { animation: wiz-pop 0.5s cubic-bezier(0.175,0.885,0.32,1.275) both; }
  .wiz-float      { animation: wiz-float 3s ease-in-out infinite; }
  .wiz-blob       { animation: wiz-blob 9s ease-in-out infinite; }
  .wiz-ring       { animation: wiz-pulse-ring 1.8s ease-out infinite; }
  .wiz-chat-in    { animation: wiz-chat-in 0.4s cubic-bezier(0.175,0.885,0.32,1.275) both; }
  .wiz-confetti   { position: absolute; top: 0; border-radius: 1px; animation: wiz-confetti-fall ease-out forwards; }
  .wiz-typing span{ animation: wiz-typing 1.1s ease-in-out infinite; }
  .wiz-card-hover { transition: transform 0.25s ease, box-shadow 0.25s ease; }
  .wiz-card-hover:hover { transform: translateY(-3px); box-shadow: 0 12px 28px rgba(0,0,0,0.08); }
`

// ─── Stepper ──────────────────────────────────────────────────────────────────

function StepperBar({ step, onJump }) {
  return (
    <div className="px-5 sm:px-8 pt-6 pb-5 bg-white border-b border-gray-100 flex-shrink-0">
      <div className="flex items-start">
        {STEPS.map((s, i) => {
          const done      = i < step
          const current   = i === step
          const last      = i === STEPS.length - 1
          const clickable = done
          return (
            <div key={i} className="flex items-start flex-1">
              {/* circle + label */}
              <button
                type="button"
                disabled={!clickable}
                onClick={() => clickable && onJump(i)}
                title={clickable ? `Volver a "${s.label}"` : undefined}
                className={`flex flex-col items-center gap-1.5 ${clickable ? 'cursor-pointer group' : 'cursor-default'}`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                  done || current
                    ? `text-white shadow-md ${current ? 'wiz-ring' : 'group-hover:scale-110'}`
                    : 'bg-white border-2 border-gray-200 text-gray-400'
                }`}
                  style={done || current
                    ? { background: 'linear-gradient(135deg,var(--color-primary-500),var(--color-primary-600))' }
                    : {}}>
                  {done ? <Check className="w-3.5 h-3.5 wiz-pop" /> : i + 1}
                </div>
                <span className={`text-[9px] font-semibold text-center leading-none transition-colors ${
                  current ? '' : done ? 'text-gray-400 group-hover:text-gray-600' : 'text-gray-300'
                }`} style={current ? { color: 'var(--color-primary-600)' } : {}}>{s.label}</span>
              </button>

              {/* connector */}
              {!last && (
                <div className="flex-1 mt-4 mx-1 h-0.5 bg-gray-100 overflow-hidden">
                  <div className="h-full transition-all duration-500"
                    style={{
                      width: done ? '100%' : '0%',
                      background: 'linear-gradient(90deg,var(--color-primary-500),var(--color-primary-600))',
                    }} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Shared nav buttons ───────────────────────────────────────────────────────

function NavRow({ onBack, saving, label = 'Guardar y continuar', hideBack }) {
  return (
    <div className="flex gap-3 pt-2">
      {!hideBack && (
        <button type="button" onClick={onBack}
          className="px-5 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 flex items-center gap-1.5 transition-colors flex-shrink-0">
          <ChevronLeft className="w-4 h-4" /> Atrás
        </button>
      )}
      <button type="submit" disabled={saving}
        className="flex-1 py-3 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2 transition-all hover:-translate-y-0.5 disabled:opacity-60"
        style={{ background: 'linear-gradient(135deg,var(--color-primary-500),var(--color-primary-600))', boxShadow: '0 6px 20px color-mix(in srgb, var(--color-primary-500) 35%, transparent)' }}>
        {saving
          ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</>
          : <>{label} <ChevronRight className="w-4 h-4" /></>}
      </button>
    </div>
  )
}

// ─── Step header ──────────────────────────────────────────────────────────────

function StepHeader({ icon: Icon, iconBg, iconColor, title, desc }) {
  return (
    <div className="mb-7">
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4" style={{ background: iconBg }}>
        <Icon className="w-6 h-6" style={{ color: iconColor }} />
      </div>
      <h2 className="text-xl font-bold text-gray-900 mb-1">{title}</h2>
      <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
    </div>
  )
}

// ─── Step 0: Welcome ─────────────────────────────────────────────────────────

function WelcomeStep({ accessCode, showCode, setShowCode, onNext, user }) {
  return (
    <div>
      {/* Gradient header */}
      <div className="relative overflow-hidden px-5 sm:px-8 py-10 text-center"
        style={{ background: 'linear-gradient(135deg,#0f0c29,#302b63,#24243e)' }}>
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% -10%,rgba(139,92,246,0.45) 0%,transparent 65%)' }} />
        {/* Drifting brand-color blobs — a slow, subtle "alive" background instead of a flat gradient */}
        <div className="absolute -left-8 -top-6 w-40 h-40 rounded-full wiz-blob pointer-events-none"
          style={{ background: 'color-mix(in srgb, var(--color-primary-500) 55%, transparent)', filter: 'blur(36px)' }} />
        <div className="absolute -right-6 bottom-0 w-32 h-32 rounded-full wiz-blob pointer-events-none"
          style={{ background: 'color-mix(in srgb, var(--color-primary-600) 45%, transparent)', filter: 'blur(32px)', animationDelay: '-4s' }} />
        <div className="relative">
          <div className="wiz-float inline-flex w-16 h-16 rounded-2xl items-center justify-center mb-5 shadow-2xl"
            style={{ background: 'linear-gradient(135deg,var(--color-primary-500),var(--color-primary-600))' }}>
            <GemaSystemLogo className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-extrabold text-white mb-2">
            ¡Bienvenido, {user?.username}! <Smile className="w-7 h-7 inline-block align-text-bottom text-indigo-200" />
          </h1>
          <p className="text-indigo-200 text-sm leading-relaxed max-w-sm mx-auto">
            Tu gimnasio está activo. En 5 pasos rápidos lo dejamos completamente configurado.
          </p>
        </div>
      </div>

      {/* Body */}
      <div className="px-5 sm:px-8 py-7 space-y-6">

        {/* Access code card */}
        <div className="rounded-2xl border-2 border-indigo-100 overflow-hidden"
          style={{ background: 'linear-gradient(135deg,rgba(99,102,241,0.04),rgba(139,92,246,0.07))' }}>
          <div className="flex items-center gap-2 px-5 py-3 border-b border-indigo-100">
            <Shield className="w-4 h-4 text-indigo-500" />
            <span className="text-sm font-semibold text-indigo-700">Tu código de acceso personal</span>
          </div>
          <div className="px-5 py-6 text-center">
            {accessCode ? (
              <>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Código de seguridad</p>
                <div className="flex items-center justify-center gap-3 mb-3">
                  <span className="text-4xl font-black tracking-[0.22em] font-mono text-gray-900">
                    {showCode ? accessCode.code : '••••••••'}
                  </span>
                  <button onClick={() => setShowCode(v => !v)}
                    className="p-2 rounded-xl border border-gray-200 hover:bg-white text-gray-400 hover:text-gray-700 transition-colors">
                    {showCode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-gray-400">También disponible en <strong className="text-gray-600">Configuración → Seguridad</strong></p>
              </>
            ) : (
              <div className="flex items-center justify-center gap-2 py-5 text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Cargando código...</span>
              </div>
            )}
          </div>
        </div>

        {/* Warning */}
        <div className="flex gap-3 p-4 rounded-xl border"
          style={{ background: 'rgba(245,158,11,0.06)', borderColor: 'rgba(245,158,11,0.3)' }}>
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-amber-800 mb-0.5">Guarda este código en un lugar seguro</p>
            <p className="text-xs text-amber-700 leading-relaxed">
              Por seguridad, viene <strong>activado por defecto</strong> y se pide en cada inicio de sesión junto con tu contraseña.
              Puedes cambiarlo hasta <strong>5 veces en total</strong>, y si prefieres desactivar este paso para todo el gimnasio,
              hay un interruptor en <strong>Configuración → Seguridad</strong>.
            </p>
          </div>
        </div>

        {/* Next steps grid */}
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Lo que haremos en los próximos pasos</p>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {[
              { label: 'Gimnasio', Icon: Building2,   color: '#6366F1' },
              { label: 'Precios',  Icon: DollarSign,  color: '#10B981' },
              { label: 'Sistema',  Icon: Globe,       color: '#8B5CF6' },
              { label: 'Tour',     Icon: BarChart3,   color: '#F59E0B' },
              { label: '¡Listo!', Icon: CheckCircle2, color: '#EC4899' },
            ].map(({ label, Icon, color }) => (
              <div key={label}
                className="wiz-card-hover flex flex-col items-center gap-1.5 p-3 rounded-xl bg-gray-50 border border-gray-100 cursor-default">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: color + '18' }}>
                  <Icon className="w-4 h-4" style={{ color }} />
                </div>
                <p className="text-[10px] text-gray-500 font-semibold text-center leading-tight">{label}</p>
              </div>
            ))}
          </div>
        </div>

        <button onClick={onNext}
          className="w-full py-3.5 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2 transition-all hover:-translate-y-0.5"
          style={{ background: 'linear-gradient(135deg,var(--color-primary-500),var(--color-primary-600))', boxShadow: '0 8px 24px color-mix(in srgb, var(--color-primary-500) 40%, transparent)' }}>
          Entendido, comenzar configuración <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// ─── Step 1: Gym Info ─────────────────────────────────────────────────────────

function GymInfoStep({ settings, onSave, saving, onBack }) {
  const { register, handleSubmit } = useForm({ values: settings })
  return (
    <div className="px-5 sm:px-8 py-7">
      <StepHeader
        icon={Building2} iconBg="#EEF2FF" iconColor="#6366F1"
        title="Información de tu gimnasio"
        desc="Estos datos aparecen en toda la aplicación. Puedes cambiarlos después en Configuración."
      />
      <form onSubmit={handleSubmit(d => onSave({
        gym_name: d.gym_name, gym_description: d.gym_description,
        gym_phone: d.gym_phone, gym_email: d.gym_email, gym_address: d.gym_address,
      }))} className="space-y-4">

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
            Nombre del gimnasio *
          </label>
          <input {...register('gym_name')} className="input" placeholder="Ej: FitZone Premium" />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
            Descripción breve
          </label>
          <textarea {...register('gym_description')} rows={2} className="input resize-none"
            placeholder="Ej: Tu mejor opción en fitness y bienestar" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Teléfono</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input {...register('gym_phone')} className="input pl-9" placeholder="+52 55 0000 0000" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Email de contacto</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input {...register('gym_email')} type="email" className="input pl-9" placeholder="info@migimnasio.com" />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Dirección</label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input {...register('gym_address')} className="input pl-9" placeholder="Calle, colonia, ciudad" />
          </div>
        </div>

        <NavRow onBack={onBack} saving={saving} />
      </form>
    </div>
  )
}

// ─── Step 2: Prices ───────────────────────────────────────────────────────────

function PricesStep({ settings, onSave, saving, onBack }) {
  const { register, handleSubmit } = useForm({ values: settings })

  const visitFields = [
    { key: 'price_visit_training',    label: 'Visita'    },
    { key: 'price_visit_class',        label: 'Clase'     },
    { key: 'price_visit_consultation', label: 'Consulta'  },
    { key: 'price_visit_other',        label: 'Otro'      },
  ]
  const membershipFields = [
    { key: 'price_membership_weekly',    label: 'Semana (7 días)'    },
    { key: 'price_membership_biweekly',  label: 'Quincena (15 días)' },
    { key: 'price_membership_monthly',   label: 'Mensual (1 mes)'    },
    { key: 'price_membership_quarterly', label: 'Trimestral (3 meses)'},
    { key: 'price_membership_biannual',  label: 'Semestral (6 meses)' },
    { key: 'price_membership_annual',    label: 'Anual (12 meses)'   },
  ]

  const PriceInput = ({ fieldKey, label }) => (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1.5">{label}</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-semibold">$</span>
        <input {...register(fieldKey)} type="number" min="0" step="0.01"
          className="input pl-7" placeholder="0.00" />
      </div>
    </div>
  )

  return (
    <div className="px-5 sm:px-8 py-7">
      <StepHeader
        icon={DollarSign} iconBg="#ECFDF5" iconColor="#10B981"
        title="Precios por defecto"
        desc="Se auto-rellenan al registrar visitas y membresías. Puedes ajustar cada registro individualmente. Deja en 0 si el precio varía."
      />
      <form onSubmit={handleSubmit(d => onSave({
        price_visit_training:        d.price_visit_training        || '0',
        price_visit_class:           d.price_visit_class           || '0',
        price_visit_consultation:    d.price_visit_consultation    || '0',
        price_visit_other:           d.price_visit_other           || '0',
        price_membership_weekly:     d.price_membership_weekly     || '0',
        price_membership_biweekly:   d.price_membership_biweekly   || '0',
        price_membership_monthly:    d.price_membership_monthly    || '0',
        price_membership_quarterly:  d.price_membership_quarterly  || '0',
        price_membership_biannual:   d.price_membership_biannual   || '0',
        price_membership_annual:     d.price_membership_annual     || '0',
      }))} className="space-y-6">

        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Visitas</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {visitFields.map(f => <PriceInput key={f.key} fieldKey={f.key} label={f.label} />)}
          </div>
        </div>

        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Membresías</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {membershipFields.map(f => <PriceInput key={f.key} fieldKey={f.key} label={f.label} />)}
          </div>
        </div>

        <NavRow onBack={onBack} saving={saving} />
      </form>
    </div>
  )
}

// ─── Step 3: System ───────────────────────────────────────────────────────────

function SystemStep({ settings, onSave, saving, onBack }) {
  const { register, handleSubmit } = useForm({ values: settings })
  return (
    <div className="px-5 sm:px-8 py-7">
      <StepHeader
        icon={Globe} iconBg="#F5F3FF" iconColor="#8B5CF6"
        title="Configuración regional"
        desc="Afecta cómo se muestran los precios y las fechas en todo el sistema."
      />
      <form onSubmit={handleSubmit(d => onSave({ currency: d.currency, timezone: d.timezone }))}
        className="space-y-5">

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Moneda</label>
          <select {...register('currency')} className="input">
            {CURRENCIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Zona horaria</label>
          <select {...register('timezone')} className="input">
            {TIMEZONES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>

        <div className="flex gap-3 p-4 rounded-xl bg-indigo-50 border border-indigo-100">
          <Lock className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-indigo-700 leading-relaxed">
            <strong>Recuerda:</strong> tu código de acceso siempre está en
            <strong> Configuración → Seguridad</strong>. Si lo olvidas, encuéntralo ahí — y ahí mismo
            puedes activar o desactivar si el sistema lo pide al iniciar sesión (viene activado por defecto).
          </p>
        </div>

        <NavRow onBack={onBack} saving={saving} />
      </form>
    </div>
  )
}

// ─── Step 4: Discover ─────────────────────────────────────────────────────────

const STORY_MS = 4200 // ms each feature stays on screen before auto-advancing

// Tiny animated WhatsApp mock-up — two chat bubbles that arrive one after the
// other with a "typing…" beat in between, so the WhatsApp card demonstrates
// the feature instead of just describing it.
function WhatsAppPreview() {
  const messages = [
    '¡Bienvenido a FitZone! 💪 Aquí tienes tu código QR de acceso.',
    'Tu membresía vence en 3 días. ¿La renovamos? 🔔',
  ]
  return (
    <div className="mt-4 rounded-xl p-3 space-y-2" style={{ background: 'rgba(0,0,0,0.05)' }}>
      {messages.map((m, i) => (
        <div key={i} className="wiz-chat-in flex justify-end" style={{ animationDelay: `${i * 0.55 + 0.25}s` }}>
          <div className="max-w-[85%] rounded-2xl rounded-tr-sm px-3 py-2 text-xs text-white shadow-sm leading-relaxed" style={{ background: '#25D366' }}>
            {m}
            <div className="flex items-center justify-end gap-1 mt-1 opacity-80">
              <span className="text-[9px]">10:0{i + 2}</span>
              <CheckCheck className="w-3 h-3" />
            </div>
          </div>
        </div>
      ))}
      <div className="wiz-chat-in flex items-center gap-2 pl-1" style={{ animationDelay: '1.5s' }}>
        <span className="wiz-typing flex items-center gap-0.5">
          <span className="w-1 h-1 rounded-full bg-gray-400 inline-block" style={{ animationDelay: '0s' }} />
          <span className="w-1 h-1 rounded-full bg-gray-400 inline-block" style={{ animationDelay: '0.15s' }} />
          <span className="w-1 h-1 rounded-full bg-gray-400 inline-block" style={{ animationDelay: '0.3s' }} />
        </span>
        <span className="text-[10px] text-gray-400">enviado automáticamente</span>
      </div>
    </div>
  )
}

function DiscoverStep({ onNext, onBack }) {
  const [idx, setIdx]         = useState(0)
  const [progress, setProgress] = useState(0)
  const [paused, setPaused]   = useState(false)
  const touchStartX = useRef(null)

  const feature   = FEATURES[idx]
  const Icon      = feature.icon
  const BadgeIcon = feature.badgeIcon ?? null

  // Stories-style auto-advance: fills the active segment over STORY_MS, then
  // moves to the next card and loops. Pauses on hover/touch so it doesn't
  // race past a card someone's actually reading.
  useEffect(() => {
    if (paused) return
    setProgress(0)
    const start = Date.now()
    const timer = setInterval(() => {
      const pct = ((Date.now() - start) / STORY_MS) * 100
      if (pct >= 100) setIdx(i => (i + 1) % FEATURES.length)
      else setProgress(pct)
    }, 40)
    return () => clearInterval(timer)
  }, [idx, paused])

  const goTo = i => setIdx(((i % FEATURES.length) + FEATURES.length) % FEATURES.length)
  const next = () => goTo(idx + 1)
  const prev = () => goTo(idx - 1)

  function onTouchStart(e) { touchStartX.current = e.touches[0].clientX }
  function onTouchEnd(e) {
    if (touchStartX.current == null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(dx) > 40) (dx < 0 ? next() : prev())
    touchStartX.current = null
  }

  return (
    <div className="px-5 sm:px-8 py-7">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-1">Descubre GemaSystem</h2>
        <p className="text-sm text-gray-500">Todo lo que puedes hacer con tu nuevo sistema — avanza solo, o tócalo para explorar a tu ritmo.</p>
      </div>

      {/* Feature card */}
      <div
        className="rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-4"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* Story-style progress segments */}
        <div className="flex gap-1 px-4 pt-4" style={{ background: feature.bg }}>
          {FEATURES.map((_, i) => (
            <button key={i} type="button" onClick={() => goTo(i)}
              className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.1)' }}>
              <div className="h-full rounded-full"
                style={{
                  width: i < idx ? '100%' : i === idx ? `${progress}%` : '0%',
                  background: feature.color,
                  transition: i === idx ? 'none' : 'width 0.2s ease',
                }} />
            </button>
          ))}
        </div>

        <div key={idx} className="p-6 wiz-in" style={{ background: feature.bg }}>
          <div className="flex items-start justify-between mb-5">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 wiz-pop"
              style={{ background: feature.color }}>
              <Icon className="w-6 h-6 text-white" />
            </div>
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full text-white inline-flex items-center gap-1"
              style={{ background: feature.color }}>
              {BadgeIcon && <BadgeIcon className="w-2.5 h-2.5" />}
              {feature.badge}
            </span>
          </div>
          <h3 className="text-base font-extrabold text-gray-900 mb-2">{feature.title}</h3>
          <p className="text-sm text-gray-600 leading-relaxed">{feature.desc}</p>
          {feature.id === 'whatsapp' && <WhatsAppPreview />}
        </div>

        {/* Controls */}
        <div className="px-6 py-3.5 bg-white flex items-center justify-between border-t border-gray-100">
          <span className="text-xs text-gray-400">{idx + 1} de {FEATURES.length} · {feature.title}</span>
          <div className="flex gap-2">
            <button onClick={prev}
              className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            </button>
            <button onClick={next}
              className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={onBack}
          className="px-5 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 flex items-center gap-1.5 transition-colors flex-shrink-0">
          <ChevronLeft className="w-4 h-4" /> Atrás
        </button>
        <button onClick={onNext}
          className="flex-1 py-3 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2 transition-all hover:-translate-y-0.5"
          style={{ background: 'linear-gradient(135deg,var(--color-primary-500),var(--color-primary-600))', boxShadow: '0 6px 20px color-mix(in srgb, var(--color-primary-500) 35%, transparent)' }}>
          Ver cómo empezar <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// ─── Step 5: Done ─────────────────────────────────────────────────────────────

const CONFETTI_COLORS = ['var(--color-primary-500)', 'var(--color-primary-600)', '#10B981', '#F59E0B', '#25D366', '#EC4899']

// A small burst of falling confetti pieces around the success badge — plays
// once on mount, no library needed. Purely decorative (aria-hidden).
function Confetti({ count = 26 }) {
  // Lazy initializer — random positions are rolled once when the piece list
  // is first created, not recomputed on every render.
  const [pieces] = useState(() => Array.from({ length: count }, (_, i) => ({
    id:       i,
    left:     10 + Math.random() * 80,
    delay:    Math.random() * 0.35,
    duration: 1.1 + Math.random() * 0.9,
    rotate:   (Math.random() - 0.5) * 420,
    drift:    (Math.random() - 0.5) * 130,
    size:     5 + Math.random() * 5,
    color:    CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  })))

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
      {pieces.map(p => (
        <span key={p.id} className="wiz-confetti" style={{
          left: `${p.left}%`,
          width: `${p.size}px`, height: `${p.size * 0.42}px`,
          background: p.color,
          animationDelay: `${p.delay}s`,
          animationDuration: `${p.duration}s`,
          '--drift': `${p.drift}px`,
          '--rot': `${p.rotate}deg`,
        }} />
      ))}
    </div>
  )
}

function DoneStep({ onComplete, saving, navigate, sessionHash }) {
  const quickActions = [
    {
      Icon: Users, color: '#6366F1', bg: '#EEF2FF',
      title: 'Registrar primer miembro',
      desc: 'Añade un miembro y genera su código QR automáticamente.',
      path: 'socios',
    },
    {
      Icon: CreditCard, color: '#8B5CF6', bg: '#F5F3FF',
      title: 'Crear una membresía',
      desc: 'Asigna un plan y registra el pago en el momento.',
      path: 'membresias',
    },
    {
      Icon: Zap, color: '#10B981', bg: '#ECFDF5',
      title: 'Registrar entrada QR',
      desc: 'Escanea el QR de un miembro para registrar su visita al instante.',
      path: 'visitas',
    },
    {
      Icon: MessageCircle, color: '#25D366', bg: '#E9FBF0',
      title: 'Conectar WhatsApp',
      desc: 'Escanea un QR y activa bienvenidas, recordatorios de vencimiento y códigos de acceso automáticos.',
      path: 'whatsapp',
    },
  ]

  const handleAction = async (path) => {
    await onComplete()
    navigate(`/g/${sessionHash}/${path}`)
  }

  return (
    <div className="px-5 sm:px-8 py-7">
      {/* Success */}
      <div className="relative text-center mb-8">
        <Confetti />
        <div className="wiz-pop w-20 h-20 rounded-full mx-auto mb-5 flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg,var(--color-primary-500),var(--color-primary-600))', boxShadow: '0 16px 40px color-mix(in srgb, var(--color-primary-500) 45%, transparent)' }}>
          <CheckCircle2 className="w-10 h-10 text-white" />
        </div>
        <h2 className="text-2xl font-extrabold text-gray-900 mb-2">¡Tu gimnasio está listo!</h2>
        <p className="text-sm text-gray-500">Configuración completada. ¿Por dónde quieres empezar?</p>
      </div>

      {/* Checklist */}
      <div className="bg-gray-50 rounded-2xl p-5 mb-7 border border-gray-100">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Configurado</p>
        <div className="space-y-2.5">
          {[
            'Información del gimnasio',
            'Precios por defecto',
            'Moneda y zona horaria',
            'Código de acceso personal',
          ].map((item, i) => (
            <div key={item} className="wiz-in flex items-center gap-3" style={{ animationDelay: `${i * 0.08}s` }}>
              <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: 'linear-gradient(135deg,#10B981,#059669)' }}>
                <Check className="w-3 h-3 text-white" />
              </div>
              <span className="text-sm text-gray-700">{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Quick actions */}
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">¿Por dónde quieres empezar?</p>
      <div className="space-y-2.5 mb-6">
        {quickActions.map(({ Icon, color, bg, title, desc, path }) => (
          <button key={path} onClick={() => handleAction(path)} disabled={saving}
            className="wiz-card-hover w-full flex items-center gap-4 p-4 rounded-xl border border-gray-100 hover:border-indigo-200 text-left transition-colors group bg-white disabled:opacity-60">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: bg }}>
              <Icon className="w-5 h-5" style={{ color }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 mb-0.5">{title}</p>
              <p className="text-xs text-gray-500">{desc}</p>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-400 transition-colors flex-shrink-0" />
          </button>
        ))}
      </div>

      {/* Dashboard CTA */}
      <button onClick={onComplete} disabled={saving}
        className="w-full py-3.5 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 transition-all hover:-translate-y-0.5 disabled:opacity-60"
        style={{ background: 'linear-gradient(135deg,var(--color-primary-500),var(--color-primary-600))', boxShadow: '0 8px 24px color-mix(in srgb, var(--color-primary-500) 40%, transparent)' }}>
        {saving
          ? <><Loader2 className="w-4 h-4 animate-spin" /> Abriendo...</>
          : <><BarChart3 className="w-4 h-4" /> Ir al Dashboard</>}
      </button>
    </div>
  )
}

// ─── Main Wizard ──────────────────────────────────────────────────────────────

export default function OnboardingWizard() {
  useLockBodyScroll()
  const [step, setStep]         = useState(0)
  const [accessCode, setCode]   = useState(null)
  const [showCode, setShowCode] = useState(false)
  const [settings, setSettings] = useState({})
  const [saving, setSaving]     = useState(false)

  const { user, completeOnboarding, sessionHash } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    api.get('/auth/access-code').then(r => setCode(r.data)).catch(() => {})
    api.get('/settings').then(r => setSettings(r.data)).catch(() => {})
  }, [])

  const goNext = () => setStep(s => s + 1)
  const goBack = () => setStep(s => s - 1)
  const goJump = (i) => setStep(s => (i < s ? i : s)) // stepper circles only jump backward to already-completed steps

  const saveSettings = async (data) => {
    setSaving(true)
    try {
      await api.put('/settings', data)
      setSettings(prev => ({ ...prev, ...data }))
      goNext()
    } catch {
      toast.error('Error al guardar la configuración')
    } finally {
      setSaving(false)
    }
  }

  const handleComplete = async () => {
    setSaving(true)
    try { await api.post('/auth/complete-onboarding') } catch {}
    completeOnboarding()
    setSaving(false)
  }

  const steps = [
    <WelcomeStep  key="welcome"  accessCode={accessCode} showCode={showCode} setShowCode={setShowCode} onNext={goNext} user={user} />,
    <GymInfoStep  key="gym"      settings={settings} onSave={saveSettings} saving={saving} onBack={goBack} />,
    <PricesStep   key="prices"   settings={settings} onSave={saveSettings} saving={saving} onBack={goBack} />,
    <SystemStep   key="system"   settings={settings} onSave={saveSettings} saving={saving} onBack={goBack} />,
    <DiscoverStep key="discover" onNext={goNext} onBack={goBack} />,
    <DoneStep     key="done"     onComplete={handleComplete} saving={saving} navigate={navigate} sessionHash={sessionHash} />,
  ]

  return (
    <>
      <style>{STYLES}</style>

      {/* Backdrop */}
      <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 sm:p-6"
        style={{ background: 'rgba(2,8,23,0.75)', backdropFilter: 'blur(6px)' }}>

        {/* Modal */}
        <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col"
          style={{ maxHeight: '92vh' }}>

          <StepperBar step={step} onJump={goJump} />

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto wiz-in" key={step}>
            {steps[step]}
          </div>

        </div>
      </div>
    </>
  )
}
