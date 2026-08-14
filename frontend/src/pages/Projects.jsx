import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft, Globe, Code2, Sparkles,
  Send, Loader2, CheckCircle2, AlertTriangle,
  User, Mail, Building2, MessageSquare, Phone,
  ChevronRight, Info, X,
} from 'lucide-react'
import GemaSystemLogo from '../components/GemaSystemLogo'
import toast from 'react-hot-toast'
import api from '../api/axios'

// ─── Data ─────────────────────────────────────────────────────────────────────

const PROJECT_TYPES = [
  {
    id: 'whitelabel',
    icon: Globe,
    title: 'GemaSystem con dominio propio',
    subtitle: 'Tu marca, tu sistema',
    description: 'Despliega GemaSystem completamente configurado bajo tu propio dominio y con la identidad visual de tu negocio o marca.',
    features: ['Dominio personalizado', 'Logo y colores propios', 'Correos con tu dominio', 'Configuración inicial incluida'],
    accent: { bg: 'bg-indigo-50', border: 'border-indigo-200', ring: 'ring-indigo-400', text: 'text-indigo-700', iconBg: 'bg-indigo-100', dot: '#4F46E5' },
  },
  {
    id: 'custom',
    icon: Code2,
    title: 'Desarrollo a medida',
    subtitle: 'Desde cero, sin límites',
    description: 'Sistema completamente personalizado desarrollado desde cero según tus requerimientos, flujos y necesidades específicas.',
    features: ['Análisis de requerimientos', 'Diseño UX/UI propio', 'Frontend + Backend', 'Despliegue y documentación'],
    accent: { bg: 'bg-violet-50', border: 'border-violet-200', ring: 'ring-violet-400', text: 'text-violet-700', iconBg: 'bg-violet-100', dot: '#7C3AED' },
  },
  {
    id: 'other',
    icon: Sparkles,
    title: 'Otro proyecto',
    subtitle: 'Cuéntanos tu idea',
    description: 'Tienes una idea que no encaja en las opciones anteriores. Cuéntanos y lo analizamos juntos sin compromiso.',
    features: ['Consultoría inicial gratuita', 'Propuesta personalizada', 'Alcance definido en conjunto', 'Términos flexibles'],
    accent: { bg: 'bg-emerald-50', border: 'border-emerald-200', ring: 'ring-emerald-400', text: 'text-emerald-700', iconBg: 'bg-emerald-100', dot: '#059669' },
  },
]

const PRICE_NOTICE = {
  whitelabel: 'Desplegar GemaSystem bajo tu propio dominio y marca implica configuración, infraestructura y personalización que van mucho más allá de una suscripción estándar.',
  custom:     'Desarrollar un sistema desde cero requiere análisis, diseño, desarrollo y pruebas. El costo es completamente independiente y refleja el alcance real del proyecto.',
  other:      'Cualquier proyecto personalizado se cotiza de forma individual. El precio depende del alcance, la complejidad y el tiempo estimado de desarrollo.',
}

const CONTACT_METHODS = [
  { id: 'email',    label: 'Correo',   icon: Mail },
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
  { id: 'call',     label: 'Llamada',  icon: Phone },
]

const inp    = 'w-full pl-10 pr-4 py-2.5 rounded-xl text-sm border outline-none transition-all bg-gray-50 border-gray-200 focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 text-gray-900 placeholder-gray-400'
const inpErr = 'w-full pl-10 pr-4 py-2.5 rounded-xl text-sm border outline-none transition-all bg-red-50 border-red-300 focus:ring-2 focus:ring-red-200 text-gray-900 placeholder-gray-400'

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Projects() {
  const [projectType, setProjectType] = useState(null)
  const [dismissedNotice, setDismissedNotice] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', company: '', description: '', budget: '', contact: 'email' })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const set = (k, v) => {
    setForm(f => ({ ...f, [k]: v }))
    if (errors[k]) setErrors(e => ({ ...e, [k]: undefined }))
  }

  const selectType = (id) => {
    setProjectType(id)
    setDismissedNotice(false)
    if (errors.projectType) setErrors(e => ({ ...e, projectType: undefined }))
  }

  const validate = () => {
    const e = {}
    if (!projectType)                          e.projectType   = 'Selecciona el tipo de proyecto'
    if (!form.name.trim())                     e.name          = 'Tu nombre es requerido'
    if (!form.email.trim())                    e.email         = 'El correo es requerido'
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email        = 'Correo no válido'
    if (form.description.trim().length < 20)   e.description   = 'Describe tu proyecto (mínimo 20 caracteres)'
    return e
  }

  const submit = async () => {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    setLoading(true)
    try {
      await api.post('/submissions', {
        type:           'contact',
        name:           form.name.trim(),
        email:          form.email.trim(),
        company:        form.company.trim() || undefined,
        category:       projectType,
        message:        form.description.trim(),
        budget:         form.budget || undefined,
        contact_method: form.contact,
      })
      setDone(true)
      toast.success('¡Solicitud enviada! Te contactaremos pronto.')
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'No se pudo enviar la solicitud. Inténtalo de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const selectedType = PROJECT_TYPES.find(t => t.id === projectType)
  const showNotice   = projectType && !dismissedNotice

  // ── Success state ──────────────────────────────────────────────────────────

  if (done) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <TopBar />
        <div className="flex-1 flex items-center justify-center px-6 py-16">
          <div className="max-w-md w-full text-center">
            <div className="w-20 h-20 rounded-3xl mx-auto mb-6 flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#d1fae5,#a7f3d0)' }}>
              <CheckCircle2 className="w-10 h-10 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-extrabold text-gray-900 mb-3">¡Solicitud enviada!</h2>
            <p className="text-gray-500 leading-relaxed mb-8">
              Revisaré tu proyecto y me pondré en contacto contigo en menos de 24 horas para platicar sobre los detalles.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-white text-sm transition-all hover:opacity-90"
                style={{ background: 'linear-gradient(135deg,#4F46E5,#7C3AED)' }}>
                <ArrowLeft className="w-4 h-4" />
                Volver al inicio
              </Link>
              <Link to="/support"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-gray-600 text-sm bg-white border border-gray-200 hover:bg-gray-50 transition-all">
                Centro de soporte
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Main ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      <TopBar />

      <div className="max-w-5xl mx-auto px-6 py-10 lg:py-14">

        {/* Header */}
        <div className="mb-10 lg:mb-12">
          <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-2">Proyectos personalizados</p>
          <h1 className="text-3xl lg:text-4xl font-extrabold text-gray-900 tracking-tight mb-3">
            Hagamos tu idea realidad
          </h1>
          <p className="text-gray-500 max-w-lg leading-relaxed">
            GemaSystem como tu propia marca, un sistema completamente a medida, o cualquier otro proyecto.
            Cuéntame y lo analizamos juntos.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">

          {/* ── LEFT: project selector ── */}
          <div className="space-y-3">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">
              ¿Qué tipo de proyecto tienes en mente?
            </p>

            {PROJECT_TYPES.map(type => {
              const active = projectType === type.id
              const Icon   = type.icon
              const a      = type.accent
              return (
                <button key={type.id} onClick={() => selectType(type.id)}
                  className={`w-full text-left p-4 rounded-2xl border-2 transition-all duration-200 ${
                    active
                      ? `${a.bg} ${a.border} ring-2 ${a.ring} ring-offset-1 shadow-sm`
                      : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'
                  }`}>
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${active ? a.iconBg : 'bg-gray-100'}`}>
                      <Icon className={`w-5 h-5 ${active ? a.text : 'text-gray-400'}`} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <p className={`font-bold text-sm ${active ? 'text-gray-900' : 'text-gray-700'}`}>{type.title}</p>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full transition-colors ${
                          active ? `${a.bg} ${a.text}` : 'bg-gray-100 text-gray-400'
                        }`}>{type.subtitle}</span>
                      </div>
                      <p className="text-xs text-gray-500 leading-relaxed">{type.description}</p>

                      {active && (
                        <div className="mt-3 grid grid-cols-2 gap-y-1.5 gap-x-2">
                          {type.features.map(f => (
                            <div key={f} className="flex items-center gap-1.5">
                              <ChevronRight className={`w-3 h-3 flex-shrink-0 ${a.text}`} />
                              <span className={`text-[11px] font-medium ${a.text}`}>{f}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Radio dot */}
                    <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 mt-0.5 transition-all ${
                      active ? `border-current ${a.text}` : 'border-gray-300'
                    } flex items-center justify-center`}>
                      {active && <div className="w-2 h-2 rounded-full" style={{ background: a.dot }} />}
                    </div>
                  </div>
                </button>
              )
            })}

            {errors.projectType && (
              <p className="text-xs text-red-500 flex items-center gap-1.5 pt-1">
                <AlertTriangle className="w-3 h-3 flex-shrink-0" />{errors.projectType}
              </p>
            )}

            {/* ── Price notice ── */}
            {showNotice && (
              <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-4">
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <Info className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-amber-900 mb-1">
                      El precio no corresponde a las suscripciones
                    </p>
                    <p className="text-xs text-amber-800 leading-relaxed">
                      {PRICE_NOTICE[projectType]}
                      {' '}Al tratarse de trabajo personalizado, el costo se define en base al
                      alcance — y puede ser <strong>muy diferente</strong> a los precios que ves en esta página.
                    </p>
                  </div>
                  <button onClick={() => setDismissedNotice(true)}
                    className="text-amber-400 hover:text-amber-600 transition-colors flex-shrink-0 mt-0.5">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── RIGHT: form ── */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Form header accent */}
            <div className="h-1" style={{ background: 'linear-gradient(90deg,#4F46E5,#7C3AED,#059669)' }} />

            <div className="p-6 space-y-5">
              <div>
                <h2 className="font-extrabold text-gray-900 text-base mb-0.5">Cuéntanos tu proyecto</h2>
                <p className="text-xs text-gray-400">Respondo en menos de 24 horas · Sin compromiso</p>
              </div>

              {/* Selected project badge */}
              {selectedType && (
                <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${selectedType.accent.bg} ${selectedType.accent.border}`}>
                  <selectedType.icon className={`w-3.5 h-3.5 flex-shrink-0 ${selectedType.accent.text}`} />
                  <span className={`text-xs font-semibold ${selectedType.accent.text}`}>{selectedType.title}</span>
                </div>
              )}

              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Nombre completo</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <input value={form.name} onChange={e => set('name', e.target.value)}
                    placeholder="Tu nombre completo"
                    className={errors.name ? inpErr : inp} />
                </div>
                {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Correo electrónico</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <input value={form.email} onChange={e => set('email', e.target.value)}
                    type="email" placeholder="tu@correo.com"
                    className={errors.email ? inpErr : inp} />
                </div>
                {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email}</p>}
              </div>

              {/* Company */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Empresa / Negocio
                  <span className="ml-1 normal-case font-normal text-gray-400">(opcional)</span>
                </label>
                <div className="relative">
                  <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <input value={form.company} onChange={e => set('company', e.target.value)}
                    placeholder="Nombre de tu empresa o negocio"
                    className={inp} />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Descripción del proyecto
                </label>
                <textarea value={form.description} onChange={e => set('description', e.target.value)}
                  rows={4} placeholder="¿Qué necesitas? ¿Qué funcionalidades son esenciales? ¿En qué plazo lo necesitas?"
                  className={`w-full px-4 py-2.5 rounded-xl text-sm border outline-none transition-all resize-none text-gray-900 placeholder-gray-400 ${
                    errors.description
                      ? 'bg-red-50 border-red-300 focus:ring-2 focus:ring-red-200'
                      : 'bg-gray-50 border-gray-200 focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100'
                  }`} />
                <div className="flex items-center justify-between mt-1">
                  {errors.description
                    ? <p className="text-xs text-red-500">{errors.description}</p>
                    : <span />}
                  <span className={`text-[10px] ${form.description.length < 20 ? 'text-gray-400' : 'text-emerald-500'}`}>
                    {form.description.length}/500
                  </span>
                </div>
              </div>

              {/* Budget */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Presupuesto aproximado
                  <span className="ml-1 normal-case font-normal text-gray-400">(opcional)</span>
                </label>
                <select value={form.budget} onChange={e => set('budget', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl text-sm border outline-none transition-all bg-gray-50 border-gray-200 focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 text-gray-700">
                  <option value="">Prefiero no especificar por ahora</option>
                  <option value="<5k">Menos de $5,000 MXN</option>
                  <option value="5-15k">$5,000 – $15,000 MXN</option>
                  <option value="15-40k">$15,000 – $40,000 MXN</option>
                  <option value="40-100k">$40,000 – $100,000 MXN</option>
                  <option value=">100k">Más de $100,000 MXN</option>
                </select>
              </div>

              {/* Contact preference */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  ¿Cómo prefieres que te contactemos?
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {CONTACT_METHODS.map(({ id, label, icon: Icon }) => (
                    <button key={id} type="button" onClick={() => set('contact', id)}
                      className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 text-xs font-semibold transition-all ${
                        form.contact === id
                          ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                          : 'border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-300 hover:bg-white'
                      }`}>
                      <Icon className="w-4 h-4" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Submit */}
              <button type="button" onClick={submit} disabled={loading}
                className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl font-bold text-sm text-white transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                style={{ background: 'linear-gradient(135deg,#4F46E5,#7C3AED)', boxShadow: '0 8px 24px rgba(99,102,241,0.28)' }}>
                {loading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando solicitud...</>
                  : <><Send className="w-4 h-4" /> Enviar solicitud</>}
              </button>

              <p className="text-[11px] text-center text-gray-400 leading-relaxed">
                Tu información es confidencial y solo se usa para contactarte sobre tu proyecto.
                <br />Al enviar aceptas que revisemos tu solicitud antes de responder.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Shared top bar ───────────────────────────────────────────────────────────

function TopBar() {
  return (
    <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-gray-200 shadow-sm">
      <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-indigo-600 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Volver al inicio
        </Link>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
            <GemaSystemLogo className="w-3 h-3" />
          </div>
          <span className="font-bold text-sm text-gray-900">GemaSystem</span>
          <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-violet-50 border border-violet-200 text-violet-700">
            Proyectos
          </span>
        </div>
      </div>
    </div>
  )
}
