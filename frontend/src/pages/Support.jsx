import { useState, useMemo, useRef } from 'react'
import {
  MessageSquare, HelpCircle, FileText,
  ChevronDown, ChevronUp, Send, Search, Clock, Check, X,
  AlertCircle, Zap, CreditCard, User, Tag, Loader2,
  Mail, Shield, Download, Users, Scan, CheckCircle2,
  LifeBuoy, ArrowRight, ArrowLeft, Dumbbell, Hash, RefreshCw,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import axiosInstance from '../api/axios'
import toast from 'react-hot-toast'

// ─── FAQ data ─────────────────────────────────────────────────────────────────

const FAQS = [
  {
    id: 'members', category: 'Miembros', icon: Users,
    items: [
      {
        q: '¿Cómo registro a un nuevo miembro?',
        a: 'Ve al módulo de Miembros en el menú lateral y haz clic en "Nuevo miembro". Completa el formulario con nombre, correo, teléfono y datos opcionales. Al guardar, el sistema genera automáticamente un código único (DYM-XXXX) y envía el QR al correo del socio.',
      },
      {
        q: '¿Cómo busco a un socio rápidamente?',
        a: 'En el módulo de Miembros encontrarás una barra de búsqueda en la parte superior. Puedes buscar por nombre, apellido, correo electrónico o código de socio. Los resultados aparecen en tiempo real mientras escribes.',
      },
      {
        q: '¿Puedo editar los datos de un miembro después de registrarlo?',
        a: 'Sí. Haz clic en el nombre del miembro en la lista y verás el botón "Editar". Desde ahí puedes modificar cualquier dato: nombre, teléfono, correo, género, fecha de nacimiento, dirección y contacto de emergencia.',
      },
      {
        q: '¿Qué son las etiquetas de miembro?',
        a: 'Las etiquetas son marcadores de color personalizados que puedes asignar a los socios para organizarlos. Por ejemplo: "VIP", "Monitoreado", "Descuento especial". Cada miembro puede tener múltiples etiquetas y puedes crear las que necesites.',
      },
      {
        q: '¿Puedo dar de baja temporalmente a un socio sin eliminarlo?',
        a: 'Sí. En el perfil del miembro puedes cambiar su estado a "Inactivo" o "Suspendido" sin borrar su historial. Esto es útil para socios que pagarán más adelante o que pausaron temporalmente su asistencia.',
      },
      {
        q: '¿Cómo envío el código QR a un miembro que ya existe?',
        a: 'Abre el perfil del miembro y haz clic en "Enviar QR al usuario". El sistema mandará su código QR y datos de membresía al correo registrado. También puedes notificarle los días restantes de membresía con el botón "Notificar días restantes".',
      },
    ],
  },
  {
    id: 'billing', category: 'Membresías y pagos', icon: CreditCard,
    items: [
      {
        q: '¿Qué pasa cuando vence la membresía de un socio?',
        a: 'El sistema puede enviar automáticamente un correo de alerta al socio con anticipación configurable desde Configuración → Notificaciones. El socio también aparecerá marcado como "Por vencer" o "Vencida" en su perfil y en el listado general.',
      },
      {
        q: '¿Cómo asigno o renuevo una membresía?',
        a: 'Ve al módulo de Membresías y haz clic en "Nueva membresía". Selecciona al miembro, el tipo de plan (semanal, quincenal, mensual, trimestral, semestral o anual), las fechas y el monto. Puedes registrar el método de pago (efectivo, tarjeta o transferencia).',
      },
      {
        q: '¿Puedo registrar pagos parciales o abonos?',
        a: 'Actualmente el sistema registra pagos completos por membresía. Si manejas abonos, puedes usar el campo de notas para llevar el control y registrar la membresía cuando se complete el pago.',
      },
      {
        q: '¿Qué tipos de planes de membresía están disponibles?',
        a: 'GemaSystem soporta planes: Semanal, Quincenal, Mensual, Trimestral, Semestral y Anual. Cada plan puede tener su propio precio configurado desde Configuración → Precios.',
      },
      {
        q: '¿Puedo cancelar mi suscripción a GemaSystem en cualquier momento?',
        a: 'Sí, no hay contratos de permanencia. Puedes cancelar cuando quieras desde el portal de Stripe o contactando a soporte@gemasystem.app. Al cancelar, mantendrás acceso hasta el final del período pagado.',
      },
      {
        q: '¿El sistema lleva un historial de todas las membresías de un socio?',
        a: 'Sí. En el perfil de cada miembro verás el historial completo de membresías anteriores: fechas de inicio y vencimiento, monto pagado, tipo de plan y estado (activa, vencida, cancelada).',
      },
    ],
  },
  {
    id: 'visits', category: 'Control de visitas', icon: Scan,
    items: [
      {
        q: '¿Cómo funciona el registro de visitas por código QR?',
        a: 'Cada miembro tiene un código QR único en su perfil. Al llegar al gimnasio, el recepcionista lo escanea desde el módulo de Visitas con la cámara del dispositivo. El sistema registra la entrada con fecha y hora de forma automática en menos de 1 segundo.',
      },
      {
        q: '¿Puedo registrar visitas manualmente sin QR?',
        a: 'Sí. En el módulo de Visitas, usa la barra de búsqueda para encontrar al socio por nombre o código y haz clic en "Registrar visita". Útil si el socio olvidó su código o el dispositivo de escaneo no está disponible.',
      },
      {
        q: '¿Cómo veo el historial de visitas de un socio?',
        a: 'Abre el perfil del miembro. Verás la gráfica de actividad estilo GitHub con visitas del último año, filtrables por mes o semana. También hay una sección de "Visitas recientes" con las últimas 5 entradas.',
      },
      {
        q: '¿Puedo ver cuántos socios visitaron el gimnasio en un día específico?',
        a: 'Sí. En el módulo de Visitas puedes filtrar por fecha o rango de fechas para ver todos los registros de ese día, incluyendo el tipo de visita (entrenamiento, clase, consulta u otro).',
      },
      {
        q: '¿El sistema impide el acceso a socios con membresía vencida al escanear el QR?',
        a: 'Al escanear el QR, el sistema muestra el estado actual de la membresía del socio (activa, por vencer o vencida) y los días restantes. La decisión de permitir o denegar el acceso queda en manos del recepcionista.',
      },
    ],
  },
  {
    id: 'security', category: 'Seguridad y cuenta', icon: Shield,
    items: [
      {
        q: '¿Cómo configuro o cambio mi código de acceso (PIN)?',
        a: 'Ve a Configuración → Seguridad. Puedes establecer un PIN personalizado de entre 6 y 30 caracteres para proteger el acceso al sistema. Este PIN es adicional a tu contraseña principal.',
      },
      {
        q: '¿Qué es el código de acceso y para qué sirve?',
        a: 'Es un segundo factor de seguridad para el panel de administración. Cuando está habilitado, el sistema lo solicita al ingresar a la consola de operador. Ideal si compartes dispositivos con el personal del gimnasio.',
      },
      {
        q: '¿Los datos de mi gimnasio están respaldados?',
        a: 'Sí. Los datos se almacenan en servidores seguros con respaldos automáticos. Tu información nunca se comparte con terceros y el sistema utiliza cifrado SSL de 256 bits, el mismo estándar que la banca digital.',
      },
      {
        q: '¿Cómo cambio mi contraseña de GemaSystem?',
        a: 'Ve a la pantalla de inicio de sesión y haz clic en "¿Olvidaste tu contraseña?". Te enviaremos un código al correo registrado para que puedas establecer una nueva contraseña de forma segura.',
      },
      {
        q: '¿Puedo tener varios usuarios con diferentes permisos?',
        a: 'Actualmente el sistema tiene el rol de administrador (dueño del gimnasio) y el operador de recepción que accede a través del PIN. El sistema de roles múltiples con permisos granulares está en desarrollo.',
      },
    ],
  },
  {
    id: 'reports', category: 'Reportes y exportación', icon: Download,
    items: [
      {
        q: '¿Cómo exporto un reporte en PDF o Excel?',
        a: 'En los módulos de Finanzas, Miembros y Visitas encontrarás el botón "Exportar" en la parte superior. Elige el formato (PDF o Excel) y el rango de fechas. El archivo se descarga automáticamente en tu dispositivo.',
      },
      {
        q: '¿Qué información incluyen los reportes financieros?',
        a: 'Incluyen ingresos por período, desglose por tipo de pago (efectivo, tarjeta, transferencia), membresías activas vs vencidas, top pagadores y gráficas de evolución mensual. Puedes filtrar por mes, trimestre o año personalizado.',
      },
      {
        q: '¿Puedo ver un resumen del día o de la semana rápidamente?',
        a: 'Sí. El Dashboard principal muestra estadísticas en tiempo real: socios activos, ingresos del mes, visitas de hoy y membresías próximas a vencer. Es la primera pantalla que ves al iniciar sesión.',
      },
      {
        q: '¿Los reportes incluyen gráficas?',
        a: 'Sí. El módulo de Finanzas y el Dashboard incluyen gráficas de barras y líneas con la evolución de ingresos, nuevos miembros por mes y visitas por período. Puedes ver tendencias de hasta 12 meses.',
      },
    ],
  },
  {
    id: 'config', category: 'Configuración general', icon: Zap,
    items: [
      {
        q: '¿Cómo cambio el nombre de mi gimnasio en el sistema?',
        a: 'Ve a Configuración → General. Ahí puedes actualizar el nombre del gimnasio, que aparecerá en los correos automáticos, reportes y en la interfaz del sistema.',
      },
      {
        q: '¿Puedo personalizar los precios de los planes de membresía?',
        a: 'Sí. En Configuración → Precios puedes establecer el costo de cada tipo de plan (semanal, quincenal, mensual, etc.). Estos precios se muestran como referencia al registrar nuevas membresías.',
      },
      {
        q: '¿Cómo activo las alertas automáticas de membresías por vencer?',
        a: 'Ve a Configuración → Notificaciones. Ahí puedes activar el envío de correos automáticos y definir con cuántos días de anticipación se notifica al socio antes de que venza su membresía.',
      },
      {
        q: '¿Puedo cambiar el tema de color del sistema?',
        a: 'Sí. En Configuración → Apariencia puedes personalizar el color principal del sistema para que coincida con la identidad visual de tu gimnasio.',
      },
    ],
  },
  {
    id: 'trainers', category: 'Entrenadores y clases', icon: Users,
    items: [
      {
        q: '¿Cómo registro a un entrenador en el sistema?',
        a: 'Al crear o editar una clase en el módulo de Clases, junto al selector de "Entrenador asignado" haz clic en "Nuevo entrenador", ingresa su nombre y apellido y quedará disponible de inmediato para esa clase y las futuras.',
      },
      {
        q: '¿Cómo creo y gestiono clases grupales?',
        a: 'En el módulo de Clases puedes crear clases con nombre, descripción, horario, capacidad máxima y entrenador asignado (obligatorio en cada clase). Los socios pueden registrarse a clases y el sistema lleva el control de asistencia.',
      },
      {
        q: '¿Puedo ver qué clases tiene asignadas cada entrenador?',
        a: 'Sí. Cada tarjeta del módulo de Clases muestra el entrenador asignado; usa la barra de búsqueda de Clases con su nombre para ver de un vistazo todas las clases que imparte.',
      },
      {
        q: '¿Los socios pueden inscribirse solos a las clases?',
        a: 'Actualmente la inscripción a clases la gestiona el administrador o el operador desde el sistema. El portal de autoservicio para socios está en el roadmap de próximas funciones.',
      },
    ],
  },
  {
    id: 'gemasystem-billing', category: 'Facturación de GemaSystem', icon: CreditCard,
    items: [
      {
        q: '¿Cómo funciona la facturación de mi suscripción a GemaSystem?',
        a: 'GemaSystem utiliza Stripe como procesador de pagos. Al contratar un plan, Stripe gestiona el cobro automático mensual o anual según el plan elegido. Recibirás una factura por correo en cada período.',
      },
      {
        q: '¿Qué métodos de pago aceptan para la suscripción a GemaSystem?',
        a: 'Aceptamos tarjetas de crédito y débito Visa, Mastercard y American Express a través de Stripe. En algunos países también están disponibles transferencias bancarias.',
      },
      {
        q: '¿Hay un período de prueba gratuito?',
        a: 'Sí. Puedes probar GemaSystem gratis durante 10 días completos sin necesidad de tarjeta de crédito. Al vencer el período, puedes elegir el plan que mejor se adapte a tu gimnasio o dejar de usar el sistema sin cargos.',
      },
    ],
  },
]

// ─── Ticket categories ────────────────────────────────────────────────────────

const TICKET_CATS = [
  { id: 'bug',     label: 'Error en el sistema',  icon: AlertCircle },
  { id: 'feature', label: 'Sugerencia de mejora', icon: Zap         },
  { id: 'billing', label: 'Facturación y pagos',  icon: CreditCard  },
  { id: 'account', label: 'Mi cuenta',            icon: User        },
  { id: 'other',   label: 'Otro',                 icon: Tag         },
]

const PRIORITIES = [
  { id: 'low',  label: 'Baja',  dot: 'bg-emerald-400' },
  { id: 'mid',  label: 'Media', dot: 'bg-amber-400'   },
  { id: 'high', label: 'Alta',  dot: 'bg-red-400'     },
]

// ─── Chat sample messages ─────────────────────────────────────────────────────

const SAMPLE_MSGS = [
  { from: 'bot',  text: '¡Hola! Soy GymBot, tu asistente de soporte. ¿En qué puedo ayudarte hoy?' },
  { from: 'user', text: '¿Cómo registro la entrada de un socio con QR?' },
  { from: 'bot',  text: 'Claro, es muy sencillo. Ve al módulo de Visitas y usa la cámara para escanear el código QR del socio. El registro se hace automáticamente en menos de 1 segundo. ¿Necesitas ayuda con algo más?' },
]

const QUICK_ACTIONS = ['Registrar visita QR', 'Ver membresías vencidas', 'Exportar reportes', 'Cambiar mi plan']

// ─── Styles ───────────────────────────────────────────────────────────────────

const fieldInp  = 'w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-900 placeholder-gray-400 hover:border-gray-300 focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/15 outline-none transition-all'
const fieldErr  = 'w-full px-4 py-3 rounded-xl border border-red-300 bg-red-50 text-sm text-gray-900 placeholder-gray-400 outline-none transition-all'

// ─── Sub-components ───────────────────────────────────────────────────────────

function TabBtn({ active, icon: Icon, label, badge, onClick }) {
  return (
    <button onClick={onClick}
      className={`relative flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
        active
          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25'
          : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
      }`}>
      <Icon className="w-4 h-4" />
      {label}
      {badge && (
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
          active ? 'bg-white/20 text-white' : 'bg-red-100 text-red-600'
        }`}>{badge}</span>
      )}
    </button>
  )
}

function StatusBadge({ ok, label }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${ok ? 'bg-emerald-400' : 'bg-amber-400'}`}
        style={ok ? { boxShadow: '0 0 0 3px rgba(52,211,153,0.25)' } : {}} />
      <span className="text-sm text-gray-600">{label}</span>
    </div>
  )
}

// ─── FAQ Tab ─────────────────────────────────────────────────────────────────

function FaqTab() {
  const [openKey, setOpenKey]     = useState(null)
  const [search, setSearch]       = useState('')

  const filtered = useMemo(() => {
    if (!search.trim()) return FAQS
    const q = search.toLowerCase()
    return FAQS.map(cat => ({
      ...cat,
      items: cat.items.filter(item =>
        item.q.toLowerCase().includes(q) || item.a.toLowerCase().includes(q)
      ),
    })).filter(cat => cat.items.length > 0)
  }, [search])

  const total = FAQS.reduce((s, c) => s + c.items.length, 0)

  return (
    <div className="space-y-6">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder={`Buscar entre ${total} preguntas frecuentes...`}
          className="w-full pl-11 pr-4 py-3 rounded-2xl border border-gray-200 bg-white text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all shadow-sm" />
        {search && (
          <button onClick={() => setSearch('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* No results */}
      {filtered.length === 0 && (
        <div className="text-center py-16">
          <HelpCircle className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-semibold">Sin resultados para "{search}"</p>
          <p className="text-gray-400 text-sm mt-1">Intenta con otras palabras o abre un ticket de soporte</p>
        </div>
      )}

      {/* Categories */}
      {filtered.map(cat => (
        <div key={cat.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
          {/* Category header */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 bg-indigo-50">
              <cat.icon className="w-4 h-4 text-indigo-600" />
            </div>
            <h3 className="font-bold text-gray-900 text-sm">{cat.category}</h3>
            <span className="ml-auto text-xs text-gray-400 font-medium">{cat.items.length} preguntas</span>
          </div>

          {/* Items */}
          <div className="divide-y divide-gray-50">
            {cat.items.map((item, idx) => {
              const key = `${cat.id}_${idx}`
              const open = openKey === key
              return (
                <div key={idx}>
                  <button onClick={() => setOpenKey(open ? null : key)}
                    className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50/60 transition-colors group">
                    <span className={`text-sm font-medium pr-4 leading-relaxed transition-colors ${open ? 'text-indigo-700' : 'text-gray-700 group-hover:text-gray-900'}`}>
                      {item.q}
                    </span>
                    <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                      open ? 'bg-indigo-100 text-indigo-600 rotate-180' : 'bg-gray-100 text-gray-400'
                    }`}>
                      <ChevronDown className="w-3.5 h-3.5" />
                    </div>
                  </button>
                  {open && (
                    <div className="px-5 pb-5 pt-0">
                      <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl px-4 py-3.5">
                        <p className="text-sm text-gray-700 leading-relaxed">{item.a}</p>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  open:        { label: 'Abierto',      color: 'text-blue-600',   bg: 'bg-blue-50',   border: 'border-blue-200'   },
  accepted:    { label: 'En atención',  color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-200' },
  in_progress: { label: 'En atención',  color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-200' },
  resolved:    { label: 'Resuelto',     color: 'text-emerald-600',bg: 'bg-emerald-50',border: 'border-emerald-200'},
  closed:      { label: 'Cerrado',      color: 'text-gray-500',   bg: 'bg-gray-100',  border: 'border-gray-200'   },
}

const canReply = (status) => !['resolved', 'closed'].includes(status)

function TicketStatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.open
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${cfg.color} ${cfg.bg} ${cfg.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${status === 'in_progress' ? 'bg-violet-500 animate-pulse' : 'bg-current'}`} />
      {cfg.label}
    </span>
  )
}

function fmt(iso) {
  return new Date(iso).toLocaleString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ─── Ticket Search Tab ─────────────────────────────────────────────────────────

function TicketSearchTab() {
  const [ticketNum, setTicketNum] = useState('')
  const [email, setEmail]         = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [ticket, setTicket]       = useState(null)
  const [reply, setReply]         = useState('')
  const [sending, setSending]     = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [lastRefresh, setLastRefresh] = useState(null)
  const messagesEndRef             = useRef(null)

  const search = async (e) => {
    e.preventDefault()
    if (!ticketNum.trim() || !email.trim()) {
      setError('Ingresa el número de ticket y tu correo.')
      return
    }
    setError('')
    setLoading(true)
    setTicket(null)
    try {
      const { data } = await axiosInstance.post('/support/tickets/lookup', {
        ticket_number: ticketNum.trim().toUpperCase(),
        email:         email.trim().toLowerCase(),
      })
      setTicket(data)
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    } catch (err) {
      setError(err.response?.data?.message ?? 'No se pudo buscar el ticket.')
    } finally {
      setLoading(false)
    }
  }

  const refreshTicket = async () => {
    if (refreshing) return
    setRefreshing(true)
    try {
      const { data } = await axiosInstance.post('/support/tickets/lookup', {
        ticket_number: ticket.ticket_number,
        email:         email.trim().toLowerCase(),
      })
      setTicket(data)
      setLastRefresh(new Date())
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 80)
    } catch {
      toast.error('No se pudo refrescar la conversación.')
    } finally {
      setRefreshing(false)
    }
  }

  const sendReply = async (e) => {
    e.preventDefault()
    if (!reply.trim()) return
    setSending(true)
    try {
      const { data: newMsg } = await axiosInstance.post('/support/tickets/reply', {
        ticket_number: ticket.ticket_number,
        email:         email.trim().toLowerCase(),
        message:       reply.trim(),
      })
      setTicket(prev => ({ ...prev, messages: [...prev.messages, newMsg] }))
      setReply('')
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 80)
      toast.success('Mensaje enviado')
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'No se pudo enviar el mensaje.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-6">

      {/* Search form */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
            <Search className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-sm">Buscar mi ticket</h3>
            <p className="text-xs text-gray-400 mt-0.5">Ingresa el número de ticket y el correo que usaste al crearlo</p>
          </div>
        </div>

        <form onSubmit={search} className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Número de ticket
              </label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  value={ticketNum}
                  onChange={e => setTicketNum(e.target.value)}
                  placeholder="TKT-2026-001234"
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all hover:border-gray-300"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Correo electrónico
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="tu@correo.com"
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all hover:border-gray-300"
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <button type="submit" disabled={loading}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm text-white transition-all hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0"
            style={{ background: '#4F46E5', boxShadow: '0 4px 14px rgba(79,70,229,0.35)' }}>
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Buscando...</>
              : <><Search className="w-4 h-4" /> Buscar ticket</>}
          </button>
        </form>
      </div>

      {/* Ticket result */}
      {ticket && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

          {/* Ticket header */}
          <div className="px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
                <FileText className="w-4 h-4 text-indigo-600" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-sm font-bold text-gray-900">{ticket.ticket_number}</span>
                  <TicketStatusBadge status={ticket.status} />
                </div>
                <p className="text-sm text-gray-600 mt-0.5 leading-tight">{ticket.subject}</p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2 flex-shrink-0">
              <button
                onClick={refreshTicket}
                disabled={refreshing}
                title="Refrescar conversación"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                  refreshing
                    ? 'bg-indigo-50 border-indigo-200 text-indigo-400 cursor-not-allowed'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-600 active:scale-95'
                }`}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                {refreshing ? 'Actualizando…' : 'Refrescar'}
              </button>
              <div className="flex flex-col items-end gap-0.5 text-[10px] text-gray-400">
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Creado: {fmt(ticket.created_at)}</span>
                {ticket.messages.length > 0 && (
                  <span className="flex items-center gap-1">
                    <MessageSquare className="w-3 h-3" />
                    {ticket.messages.length} mensaje{ticket.messages.length !== 1 ? 's' : ''}
                  </span>
                )}
                {lastRefresh && (
                  <span className="flex items-center gap-1 text-emerald-500">
                    <Check className="w-3 h-3" /> Actualizado {lastRefresh.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="bg-gray-50/60 px-6 py-5 space-y-4 max-h-96 overflow-y-auto">
            {ticket.messages.length === 0 ? (
              <div className="text-center py-10">
                <MessageSquare className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Aún no hay mensajes en este ticket.</p>
                <p className="text-xs text-gray-300 mt-1">Nuestro equipo responderá pronto.</p>
              </div>
            ) : (
              ticket.messages.map((msg) => {
                const isOperator = msg.sender_type === 'operator'
                return (
                  <div key={msg.id} className={`flex gap-3 ${isOperator ? 'justify-start' : 'justify-end'}`}>
                    {isOperator && (
                      <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
                        <Shield className="w-3.5 h-3.5 text-white" />
                      </div>
                    )}
                    <div className={`max-w-[78%] ${isOperator ? '' : 'items-end'} flex flex-col gap-1`}>
                      <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                        isOperator
                          ? 'bg-white border border-gray-200 text-gray-700 rounded-tl-none shadow-sm'
                          : 'bg-indigo-600 text-white rounded-tr-none shadow-sm'
                      }`}>
                        {msg.message}
                      </div>
                      <div className={`flex items-center gap-1.5 text-[10px] text-gray-400 ${isOperator ? '' : 'justify-end'}`}>
                        <span className="font-medium">{isOperator ? `Soporte GemaSystem` : msg.sender_name}</span>
                        <span>·</span>
                        <span>{fmt(msg.created_at)}</span>
                      </div>
                    </div>
                    {!isOperator && (
                      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <User className="w-3.5 h-3.5 text-gray-500" />
                      </div>
                    )}
                  </div>
                )
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Reply form — visible si el ticket acepta respuestas */}
          {canReply(ticket.status) ? (
            <form onSubmit={sendReply} className="border-t border-gray-100 bg-white px-5 py-4">
              <div className="flex items-end gap-3">
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 mb-0.5">
                  <User className="w-3.5 h-3.5 text-gray-500" />
                </div>
                <div className="flex-1 relative">
                  <textarea
                    value={reply}
                    onChange={e => setReply(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(e) } }}
                    placeholder="Escribe tu respuesta… (Enter para enviar)"
                    rows={2}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all hover:border-gray-300 pr-12"
                  />
                  <button
                    type="submit"
                    disabled={!reply.trim() || sending}
                    className="absolute right-2 bottom-2 w-8 h-8 rounded-lg flex items-center justify-center transition-all disabled:opacity-40"
                    style={{ background: reply.trim() ? '#4F46E5' : '#e5e7eb' }}
                  >
                    {sending
                      ? <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                      : <Send className="w-3.5 h-3.5 text-white" />}
                  </button>
                </div>
              </div>
              <p className="text-[10px] text-gray-400 mt-2 ml-11">Shift+Enter para salto de línea</p>
            </form>
          ) : (
            <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 flex items-center gap-2 text-xs text-gray-400">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
              Este ticket está {ticket.status === 'resolved' ? 'resuelto' : 'cerrado'} — no acepta más respuestas.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Ticket Tab ────────────────────────────────────────────────────────────────

function TicketTab({ userEmail }) {
  const [category, setCategory]   = useState('')
  const [priority, setPriority]   = useState('mid')
  const [name, setName]           = useState('')
  const [subject, setSubject]     = useState('')
  const [description, setDesc]    = useState('')
  const [email, setEmail]         = useState(userEmail || '')
  const [errors, setErrors]       = useState({})
  const [loading, setLoading]     = useState(false)
  const [done, setDone]           = useState(false)

  const validate = () => {
    const e = {}
    if (!category)              e.category    = 'Selecciona una categoría'
    if (!name.trim())           e.name        = 'Tu nombre es requerido'
    if (!subject.trim())        e.subject     = 'El asunto es requerido'
    if (description.trim().length < 20) e.description = 'Mínimo 20 caracteres'
    if (!email.trim())          e.email       = 'El correo es requerido'
    return e
  }

  const submit = async () => {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    setLoading(true)
    try {
      await axiosInstance.post('/support/tickets/public', {
        name:     name,
        email:    email,
        category: category,
        subject:  subject,
        message:  description,
      })
      setDone(true)
      toast.success('¡Ticket enviado! Te responderemos pronto.')
    } catch (err) {
      const msg = err.response?.data?.message || 'Ocurrió un error. Intenta de nuevo.'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-12 text-center">
        <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-5">
          <CheckCircle2 className="w-10 h-10 text-emerald-600" />
        </div>
        <h3 className="text-xl font-extrabold text-gray-900 mb-2">¡Ticket enviado correctamente!</h3>
        <p className="text-gray-500 text-sm max-w-sm mx-auto leading-relaxed mb-2">
          Hemos recibido tu solicitud. Nuestro equipo te responderá en un plazo de 24 horas al correo:
        </p>
        <p className="font-bold text-indigo-600 text-sm mb-7">{email}</p>
        <button onClick={() => { setDone(false); setCategory(''); setName(''); setSubject(''); setDesc(''); setErrors({}) }}
          className="px-6 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-all">
          Enviar otro ticket
        </button>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-100">
        <h3 className="font-extrabold text-gray-900 text-base">Nuevo ticket de soporte</h3>
        <p className="text-gray-400 text-sm mt-0.5">Describe tu problema y te respondemos en menos de 24 horas</p>
      </div>

      <div className="px-6 py-6 space-y-6">
        {/* Category */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Categoría {errors.category && <span className="text-red-500 normal-case font-normal ml-1">— {errors.category}</span>}
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {TICKET_CATS.map(cat => (
              <button key={cat.id} type="button" onClick={() => { setCategory(cat.id); setErrors(p => ({ ...p, category: undefined })) }}
                className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all ${
                  category === cat.id
                    ? 'bg-indigo-50 border-indigo-200 ring-2 ring-indigo-400'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}>
                <cat.icon className={`w-4 h-4 flex-shrink-0 ${category === cat.id ? 'text-indigo-600' : 'text-gray-400'}`} />
                <span className={`text-xs font-semibold leading-tight ${category === cat.id ? 'text-indigo-700' : 'text-gray-600'}`}>
                  {cat.label}
                </span>
                {category === cat.id && (
                  <Check className="w-3.5 h-3.5 ml-auto flex-shrink-0 text-indigo-600" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Priority */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Prioridad</label>
          <div className="flex gap-2">
            {PRIORITIES.map(p => (
              <button key={p.id} type="button" onClick={() => setPriority(p.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-semibold transition-all ${
                  priority === p.id
                    ? 'border-indigo-300 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-400'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50'
                }`}>
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${p.dot}`} />
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Name */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
            Tu nombre {errors.name && <span className="text-red-500 normal-case font-normal ml-1">— {errors.name}</span>}
          </label>
          <input value={name} onChange={e => { setName(e.target.value); setErrors(p => ({ ...p, name: undefined })) }}
            placeholder="¿Cómo te llamamos?"
            className={errors.name ? fieldErr : fieldInp} />
        </div>

        {/* Subject */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
            Asunto {errors.subject && <span className="text-red-500 normal-case font-normal ml-1">— {errors.subject}</span>}
          </label>
          <input value={subject} onChange={e => { setSubject(e.target.value); setErrors(p => ({ ...p, subject: undefined })) }}
            placeholder="Resumen breve del problema"
            className={errors.subject ? fieldErr : fieldInp} />
        </div>

        {/* Description */}
        <div>
          <div className="flex items-baseline justify-between mb-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Descripción {errors.description && <span className="text-red-500 normal-case font-normal ml-1">— {errors.description}</span>}
            </label>
            <span className={`text-[10px] font-medium ${description.length < 20 ? 'text-gray-400' : 'text-emerald-500'}`}>
              {description.length} / 2000
            </span>
          </div>
          <textarea value={description} onChange={e => { setDesc(e.target.value); setErrors(p => ({ ...p, description: undefined })) }}
            rows={5} placeholder="Describe el problema con el mayor detalle posible. Incluye los pasos para reproducirlo si es un error..."
            className={`${errors.description ? fieldErr : fieldInp} resize-none`} />
        </div>

        {/* Email */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
            Correo de contacto {errors.email && <span className="text-red-500 normal-case font-normal ml-1">— {errors.email}</span>}
          </label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input value={email} onChange={e => { setEmail(e.target.value); setErrors(p => ({ ...p, email: undefined })) }}
              type="email" placeholder="tu@correo.com"
              className={`${errors.email ? fieldErr : fieldInp} pl-10`} />
          </div>
        </div>

        {/* Submit */}
        <button type="button" onClick={submit} disabled={loading}
          className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl font-bold text-sm text-white transition-all hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
          style={{ background: '#4F46E5', boxShadow: '0 8px 24px rgba(79,70,229,0.3)' }}>
          {loading
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando ticket...</>
            : <><Send className="w-4 h-4" /> Enviar ticket de soporte</>}
        </button>
      </div>
    </div>
  )
}

// ─── Support page ─────────────────────────────────────────────────────────────

export default function Support() {
  const { user, sessionHash } = useAuthStore()
  const [tab, setTab]         = useState('faq')

  const TABS = [
    { id: 'faq',    icon: HelpCircle,  label: 'Preguntas frecuentes' },
    { id: 'search', icon: Search,      label: 'Buscar ticket'        },
    { id: 'ticket', icon: FileText,    label: 'Abrir ticket'         },
  ]

  return (
    <div className="min-h-screen bg-gray-50/60">
      {/* Top nav bar */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-gray-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link to={user && sessionHash ? `/g/${sessionHash}/panel` : '/'} className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-indigo-600 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            {user ? 'Volver al sistema' : 'Volver al inicio'}
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Dumbbell className="w-3 h-3 text-white" />
            </div>
            <span className="font-bold text-sm text-gray-900">GemaSystem</span>
            <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-gray-100 border border-gray-200 text-gray-500">Soporte</span>
          </div>
        </div>
      </div>

      <div className="p-6">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center shadow-md shadow-indigo-500/25">
                <LifeBuoy className="w-4 h-4 text-white" />
              </div>
              <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Centro de soporte</h1>
            </div>
            <p className="text-gray-500 text-sm mt-0.5 ml-11">¿Cómo podemos ayudarte hoy?</p>
          </div>

          {/* Status indicators */}
          <div className="flex flex-wrap items-center gap-5 bg-white border border-gray-200 rounded-2xl px-5 py-3 shadow-sm">
            <StatusBadge ok label="Sistema operativo" />
            <div className="w-px h-5 bg-gray-100" />
            <div className="flex items-center gap-1.5 text-sm text-gray-600">
              <Clock className="w-3.5 h-3.5 text-gray-400" />
              Respuesta &lt; 24 hrs
            </div>
            <div className="w-px h-5 bg-gray-100" />
            <div className="flex items-center gap-1.5 text-sm text-gray-600">
              <Mail className="w-3.5 h-3.5 text-gray-400" />
              soporte@gemasystem.app
            </div>
          </div>
        </div>

        {/* Quick help cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { icon: HelpCircle, title: 'Preguntas frecuentes', desc: `${FAQS.reduce((s,c) => s + c.items.length, 0)} respuestas rápidas`, tab: 'faq' },
            { icon: Search,     title: 'Buscar mi ticket',     desc: 'Consulta el estado en segundos', tab: 'search' },
            { icon: FileText,   title: 'Abrir un ticket',      desc: 'Respuesta en < 24 horas', tab: 'ticket' },
          ].map(card => (
            <button key={card.tab} onClick={() => setTab(card.tab)}
              className={`text-left p-5 rounded-2xl border transition-all hover:-translate-y-0.5 hover:shadow-md ${
                tab === card.tab ? 'bg-indigo-50 ring-2 ring-indigo-400 border-indigo-200' : 'bg-white border-gray-200'
              }`}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-indigo-50">
                <card.icon className="w-5 h-5 text-indigo-600" />
              </div>
              <p className="font-bold text-gray-900 text-sm">{card.title}</p>
              <p className="text-gray-400 text-xs mt-0.5">{card.desc}</p>
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === 'faq'    && <FaqTab />}
        {tab === 'search' && <TicketSearchTab />}
        {tab === 'ticket' && <TicketTab userEmail={user?.email} />}
      </div>
      </div>
    </div>
  )
}
