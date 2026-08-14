import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  MessageSquare, Plus, ArrowLeft, Send, Loader2,
  CheckCircle2, Clock, XCircle, Tag, ChevronRight,
  RefreshCw, HelpCircle, ChevronDown, Mail,
  Users, CreditCard, Scan, Download,
  Shield, Settings, Search, X, Star,
  Upload, MessageCircle,
} from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import api from '../api/axios'
import toast from 'react-hot-toast'

// ── Status / Cats ──────────────────────────────────────────────────────────────

const STATUS = {
  open:     { label: 'Abierto',     color: 'bg-blue-50 border-blue-200 text-blue-700',        icon: Clock        },
  accepted: { label: 'En atención', color: 'bg-indigo-50 border-indigo-200 text-indigo-700',  icon: CheckCircle2 },
  resolved: { label: 'Resuelto',   color: 'bg-emerald-50 border-emerald-200 text-emerald-700',icon: CheckCircle2 },
  closed:   { label: 'Cerrado',    color: 'bg-gray-100 border-gray-200 text-gray-500',         icon: XCircle      },
}

const CATS = {
  bug:     'Error en el sistema',
  feature: 'Sugerencia de mejora',
  billing: 'Facturación y pagos',
  account: 'Mi cuenta',
  other:   'Otro',
}

// ── Internal FAQ (guías de uso del sistema) ────────────────────────────────────

const INTERNAL_FAQS = [
  {
    id: 'members', label: 'Socios', icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50',
    items: [
      {
        q: '¿Cómo registro a un nuevo socio desde cero?',
        a: '1. Ve al menú lateral → Miembros.\n2. Haz clic en "+ Nuevo miembro" (esquina superior derecha).\n3. Completa el formulario: nombre, apellido, correo, teléfono, género y fecha de nacimiento.\n4. Elige el tipo de membresía (Básica, Premium o VIP).\n5. Activa "Enviar QR al correo" para que reciba sus datos automáticamente.\n6. Guarda. El sistema genera el código DYM-XXXX y el QR de forma automática.',
      },
      {
        q: '¿Cómo edito los datos de un socio ya registrado?',
        a: '1. Ve a Miembros y haz clic sobre el nombre del socio.\n2. En su perfil, haz clic en el botón "Editar" (ícono de lápiz).\n3. Modifica los campos que necesites: nombre, correo, teléfono, dirección, contacto de emergencia, etc.\n4. Guarda los cambios.',
      },
      {
        q: '¿Cómo agrego o quito etiquetas a un socio?',
        a: 'En el perfil del miembro, desplázate hasta la sección "Etiquetas".\n— Para agregar: haz clic en una etiqueta existente (con borde de color) o en "+ Nueva etiqueta" para crear una con nombre y color personalizados.\n— Para quitar: haz clic en la × junto al nombre de la etiqueta.',
      },
      {
        q: '¿Cómo cambio el estado de un socio a Inactivo o Suspendido?',
        a: '1. Abre el perfil del miembro.\n2. Haz clic en "Editar".\n3. En el campo "Estado" elige entre Activo, Inactivo o Suspendido.\n4. Guarda. El cambio se refleja de inmediato en la lista y en el perfil.',
      },
      {
        q: '¿Cómo envío el QR o los días restantes al correo del socio?',
        a: 'En el perfil del miembro encontrarás dos botones:\n— "Enviar QR al usuario": manda su código QR, número de membresía y fechas de vigencia.\n— "Notificar días restantes": envía un correo con los días que le quedan y la fecha de vencimiento.\nAmbos muestran un modal de confirmación antes de enviar.',
      },
      {
        q: '¿Cómo veo la actividad de visitas de un socio por mes o semana?',
        a: 'En el perfil del miembro, desplázate hasta "Actividad de visitas". Usa las pestañas Año / Mes / Semana. Con los botones ‹ › puedes navegar a períodos anteriores. El gráfico muestra el mismo estilo heatmap que GitHub.',
      },
    ],
  },
  {
    id: 'memberships', label: 'Membresías', icon: CreditCard, color: 'text-emerald-600', bg: 'bg-emerald-50',
    items: [
      {
        q: '¿Cómo asigno una membresía nueva a un socio?',
        a: '1. Ve al menú → Membresías → "+ Nueva membresía".\n2. Busca y selecciona al miembro.\n3. Elige el plan: Semanal, Quincenal, Mensual, Trimestral, Semestral o Anual.\n4. Define fechas de inicio y fin.\n5. Ingresa el monto y el método de pago (Efectivo, Tarjeta o Transferencia).\n6. Guarda. El socio queda como Activo automáticamente.',
      },
      {
        q: '¿Qué pasa si el socio ya tiene una membresía activa?',
        a: 'El sistema detecta automáticamente la membresía activa anterior y la marca como Vencida antes de crear la nueva. Así el historial queda ordenado sin solapamientos.',
      },
      {
        q: '¿Cómo veo el historial de membresías de un socio?',
        a: 'En el perfil del miembro, la sección "Historial de membresías" muestra todas las membresías con: tipo de plan, fechas de inicio/fin, monto, método de pago y estado (activa, vencida o cancelada).',
      },
      {
        q: '¿Cómo cancelo una membresía activa?',
        a: 'Ve a Membresías, localiza la membresía activa del socio y haz clic en el ícono de cancelar. El estado cambia a "Cancelada" sin borrar el registro del historial.',
      },
      {
        q: '¿Cómo configuro los precios de cada tipo de plan?',
        a: 'Ve a Configuración → Precios. Define el precio sugerido para cada plan. Estos precios aparecen como referencia al registrar nuevas membresías.',
      },
    ],
  },
  {
    id: 'visits', label: 'Visitas', icon: Scan, color: 'text-blue-600', bg: 'bg-blue-50',
    items: [
      {
        q: '¿Cómo registro la entrada de un socio con el código QR?',
        a: '1. Ve al menú → Visitas → "Escanear QR".\n2. Permite el acceso a la cámara del dispositivo.\n3. Apunta la cámara al QR del socio (físico o en su teléfono).\n4. El sistema registra la visita automáticamente y muestra el nombre, estado y días restantes de membresía.',
      },
      {
        q: '¿Cómo registro una visita manualmente sin QR?',
        a: '1. Ve al menú → Visitas → "Registrar visita".\n2. Escribe el nombre, correo o código del socio en la búsqueda.\n3. Selecciona al socio.\n4. Elige el tipo de visita y agrega notas opcionales.\n5. Confirma. La visita queda registrada con la fecha y hora actual.',
      },
      {
        q: '¿Puedo registrar visitas con fecha retroactiva?',
        a: 'Sí. Al crear una visita manualmente puedes cambiar el campo "Fecha de visita" a cualquier día anterior. Útil para corregir omisiones o registros olvidados.',
      },
      {
        q: '¿Cómo veo todas las visitas del día de hoy?',
        a: 'El módulo Visitas muestra por defecto las visitas del día actual, de la más reciente a la más antigua. Puedes filtrar por rango de fechas con el selector en la parte superior.',
      },
      {
        q: '¿Qué información aparece al escanear el QR de un socio?',
        a: 'Al escanear exitosamente aparece:\n— Nombre completo del socio\n— Código DYM-XXXX\n— Estado de membresía (Activa / Por vencer / Vencida)\n— Días restantes y fecha de vencimiento\n— Total de visitas del mes\nEl recepcionista puede decidir el acceso al instante.',
      },
    ],
  },
  {
    id: 'trainers', label: 'Entrenadores y Clases', icon: Star, color: 'text-amber-600', bg: 'bg-amber-50',
    items: [
      {
        q: '¿Cómo registro a un entrenador?',
        a: '1. Ve a Clases → "+ Nueva clase" (o edita una existente).\n2. Junto a "Entrenador asignado" haz clic en "+ Nuevo entrenador".\n3. Completa nombre y apellido y guarda. Queda disponible de inmediato para asignarse a esa clase y las futuras.',
      },
      {
        q: '¿Cómo creo una clase grupal?',
        a: '1. Ve a Clases → "+ Nueva clase".\n2. Define: nombre, descripción, horario, capacidad máxima y entrenador asignado (obligatorio).\n3. Guarda. La clase aparece en el módulo con su disponibilidad.',
      },
      {
        q: '¿Cómo inscribo a un socio en una clase?',
        a: 'Abre la clase desde el módulo Clases, haz clic en "Agregar participante", busca al socio y confirma. El sistema valida que no se supere la capacidad máxima.',
      },
      {
        q: '¿Puedo cambiar el entrenador asignado a una clase?',
        a: 'Sí. Edita la clase desde el módulo Clases y selecciona otro entrenador en el campo "Entrenador asignado". El cambio se refleja de inmediato en la tarjeta de la clase.',
      },
    ],
  },
  {
    id: 'finances', label: 'Finanzas y Reportes', icon: Download, color: 'text-violet-600', bg: 'bg-violet-50',
    items: [
      {
        q: '¿Dónde veo los ingresos del mes?',
        a: 'El Dashboard muestra el resumen financiero del mes: ingresos totales, comparación con el mes anterior y gráfica de evolución. Para detalle completo ve al módulo Finanzas.',
      },
      {
        q: '¿Cómo exporto un reporte de pagos o membresías?',
        a: 'En Finanzas o Miembros haz clic en "Exportar" (esquina superior). Elige el formato (PDF o Excel) y el rango de fechas. El archivo se descarga automáticamente.',
      },
      {
        q: '¿Los pagos se registran automáticamente al crear una membresía?',
        a: 'Sí. Al crear una membresía el sistema genera un registro de pago con el monto, método y fecha indicados. Puedes verlos en Finanzas filtrando por miembro o período.',
      },
      {
        q: '¿Puedo ver qué socios han pagado más en el año?',
        a: 'Usa el módulo Finanzas con filtros por miembro o período para identificar los socios con mayor gasto. El Dashboard también muestra el top de visitantes del mes.',
      },
    ],
  },
  {
    id: 'config', label: 'Configuración', icon: Settings, color: 'text-gray-600', bg: 'bg-gray-100',
    items: [
      {
        q: '¿Cómo cambio el nombre de mi gimnasio?',
        a: 'Ve a Configuración → General. Edita el campo "Nombre del gimnasio" y guarda. El cambio se refleja en correos automáticos, reportes e interfaz del sistema.',
      },
      {
        q: '¿Cómo cambio el color principal del sistema?',
        a: 'Ve a Configuración → Apariencia. Elige el color de acento y guarda. El cambio se aplica en tiempo real a toda la interfaz.',
      },
      {
        q: '¿Cómo configuro los precios por defecto, tipos de membresía y descuentos?',
        a: 'Ve a Configuración → Precios — ahí se agrupan las tres cosas en una sola pantalla.\nPrecios por defecto:\n1. En "Visitas" define el precio de Visita, Clase, Consulta u Otro.\n2. En "Membresías" define el precio de cada duración: Semana, Quincena, Mensual, Trimestral, Semestral y Anual.\n3. Guarda — estos montos se auto-rellenan al registrar una visita o membresía nueva. Puedes dejarlos en 0 si el precio siempre varía y prefieres escribirlo a mano cada vez.\nTipos de membresía personalizados:\n1. En la sección "Tipos de membresía", haz clic en "+ Añadir".\n2. Escribe el nombre del nuevo tipo (ej. Familiar, Corporativo) y confirma.\n3. Aparece de inmediato como opción en los formularios de registro de socios — puedes eliminarlo en cualquier momento con la ×.\nCategorías de descuento:\n1. En la sección "Categorías de descuento", haz clic en "Nueva categoría de descuento".\n2. Escribe un nombre (ej. Estudiante, Adulto mayor) y el porcentaje de descuento (0–100%).\n3. Guarda — queda disponible para asignarla a cualquier socio al registrarlo o editarlo.\nEl porcentaje se muestra como referencia junto al nombre de la categoría; el monto final de la membresía lo escribes tú al momento de cobrar.',
      },
      {
        q: '¿Cómo activo los correos automáticos de membresías por vencer?',
        a: 'Ve a Configuración → Notificaciones.\n1. Activa "Enviar correo de vencimiento".\n2. Define cuántos días antes se envía el aviso (ej. 7 días).\n3. Guarda. Los socios recibirán correos automáticos cuando su membresía esté próxima a vencer.',
      },
      {
        q: '¿Cómo configuro el PIN de acceso para el operador?',
        a: 'Ve a Configuración → Seguridad. Establece el PIN de operador (6–30 caracteres). Permite al personal de recepción acceder al módulo de escaneo sin acceso a la configuración del sistema.',
      },
      {
        q: '¿Puedo activar o desactivar el correo de bienvenida a nuevos socios?',
        a: 'Sí. Ve a Configuración → Notificaciones y activa o desactiva "Enviar correo de bienvenida". Cuando está activo, cada nuevo socio recibe automáticamente su QR y datos de membresía.',
      },
    ],
  },
  {
    id: 'import', label: 'Importar datos', icon: Upload, color: 'text-cyan-600', bg: 'bg-cyan-50',
    items: [
      {
        q: '¿Cómo importo datos desde un archivo Excel o CSV?',
        a: 'Ve a Configuración → Importar datos.\n1. Elige qué vas a importar: Miembros, Entrenadores o Membresías.\n2. Marca en la lista de casillas qué datos trae tu archivo (desmarca los que no tenga).\n3. Sube el archivo arrastrándolo o haciendo clic para seleccionarlo.\n4. Asigna cada dato a la columna correspondiente de tu archivo.\n5. Revisa la vista previa y haz clic en "Importar".\nEl sistema procesa todas las filas y te muestra un resumen con lo importado, lo omitido y cualquier error.',
      },
      {
        q: '¿Qué formatos de archivo acepta?',
        a: 'Excel (.xlsx y .xls), CSV y hojas de cálculo de LibreOffice/OpenOffice (.ods). Exporta tu información desde Google Sheets, Excel o cualquier sistema anterior y súbela directamente — no necesitas seguir un formato exacto de columnas.',
      },
      {
        q: '¿Qué pasa si mi archivo no tiene todos los datos, o tiene columnas de más?',
        a: 'No hay problema.\n— En el primer paso desmarcas los datos que tu archivo no trae, y ya ni siquiera aparecen al mapear columnas.\n— En el paso de mapeo, cualquier columna de tu archivo que no necesites simplemente no la asignas a nada.\nSolo el nombre es obligatorio en los tres tipos de importación — el resto es opcional.',
      },
      {
        q: '¿Qué campos puedo importar en cada sección?',
        a: '— Miembros: nombre (obligatorio), correo, teléfono, tipo de membresía, contacto de emergencia y su teléfono, fecha de nacimiento, género y dirección.\n— Entrenadores: nombre (obligatorio), correo, teléfono, especialidad, certificaciones, biografía y fecha de contratación.\n— Membresías: nombre del socio (obligatorio), correo, teléfono, plan, fecha de inicio y fin, monto pagado, método de pago y estado (activa, vencida o cancelada).',
      },
      {
        q: '¿El sistema detecta si un socio o entrenador ya existe?',
        a: 'Sí. En cuanto asignas la columna de correo o teléfono, el sistema revisa automáticamente cuáles filas ya existen en tu base de datos y marca cada una como "Nuevo" o "Ya existe" antes de importar.\nAl importar Membresías, si el socio ya existe se le asigna la membresía sin duplicarlo; si no existe, se registra automáticamente.',
      },
      {
        q: '¿Es seguro importar un archivo que no elaboré yo mismo?',
        a: 'Sí. Antes de guardar cualquier dato, el sistema revisa cada celda y neutraliza contenido sospechoso (fórmulas ocultas, scripts o código malicioso), sin que tú tengas que detectarlo.\nSi un archivo tiene demasiadas celdas con contenido sospechoso, se rechaza por completo y no se importa nada — para proteger tu información y la del resto del sistema.',
      },
    ],
  },
  {
    id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, color: 'text-green-600', bg: 'bg-green-50',
    items: [
      {
        q: '¿Qué es la integración de WhatsApp?',
        a: 'Es una conexión directa entre tu número de WhatsApp (o WhatsApp Business) y el sistema, para enviar avisos automáticos a tus socios sin que tengas que escribirlos manualmente. Se vincula una sola vez, igual que WhatsApp Web.',
      },
      {
        q: '¿Cómo conecto mi WhatsApp al sistema?',
        a: 'Ve al menú lateral → WhatsApp.\n1. Haz clic en "Iniciar conexión".\n2. Escanea el código QR que aparece desde tu teléfono: WhatsApp → Dispositivos vinculados → Vincular dispositivo.\n3. Espera unos segundos — el estado cambia a "Conectado" y se muestra el número vinculado.\nRecomendamos usar WhatsApp Business (gratis) con el número del gimnasio, aunque también puedes usar tu número personal.',
      },
      {
        q: '¿Qué mensajes envía automáticamente?',
        a: '— Bienvenida con el código QR al registrar un socio nuevo.\n— Recordatorio cuando su membresía está próxima a vencer.\n— Código de verificación cuando alguien restablece su contraseña.\nNo se envía ningún mensaje promocional ni manual — solo estos tres avisos automáticos.',
      },
      {
        q: '¿Dónde veo los mensajes que se han enviado?',
        a: 'En el mismo panel de WhatsApp, en la sección "Mensajes enviados", verás una lista con destinatario, tipo de mensaje y fecha. Puedes abrir cualquiera para ver el texto completo o eliminarlo del historial.',
      },
      {
        q: '¿Puedo desconectar WhatsApp en cualquier momento?',
        a: 'Sí. En el panel de WhatsApp, con la sesión conectada, haz clic en "Desconectar". El sistema deja de enviar mensajes automáticos hasta que vuelvas a vincular un número.',
      },
    ],
  },
  {
    id: 'account', label: 'Mi cuenta', icon: Shield, color: 'text-rose-600', bg: 'bg-rose-50',
    items: [
      {
        q: '¿Cómo cambio mi contraseña de acceso?',
        a: '1. Ve a tu Perfil (menú superior → tu nombre).\n2. En la sección "Seguridad" haz clic en "Enviar código de verificación".\n3. Revisa tu correo: código de 6 dígitos válido 15 minutos.\n4. Ingrésalo junto a tu nueva contraseña y confirma.',
      },
      {
        q: '¿Cómo actualizo el correo de mi cuenta?',
        a: 'Abre un ticket de soporte con categoría "Mi cuenta" indicando el correo actual y el nuevo. Nuestro equipo lo actualizará de forma segura.',
      },
      {
        q: '¿Qué información puedo ver en mi perfil de propietario?',
        a: 'En tu perfil puedes ver:\n— Datos de cuenta (usuario, correo, gimnasio)\n— Estado y detalles de tu suscripción a GemaSystem\n— Estadísticas en tiempo real del gimnasio\n— Accesos rápidos a los módulos principales\n— Panel de cambio de contraseña',
      },
      {
        q: '¿Qué pasa si mi suscripción a GemaSystem vence?',
        a: 'Al vencer pierdes acceso al panel de administración. Tus datos se conservan 30 días adicionales. Puedes renovar desde el portal de Stripe o contactando a soporte@gemasystem.mx.',
      },
    ],
  },
]

// ── StatusBadge ────────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const s = STATUS[status] ?? STATUS.open
  const Icon = s.icon
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border ${s.color}`}>
      <Icon className="w-3 h-3" /> {s.label}
    </span>
  )
}

// ── InternalFaq ────────────────────────────────────────────────────────────────

// Turns plain-text answers into structured blocks so the UI can render real
// numbered steps and bullet lists instead of one dense paragraph. Answers use
// three lightweight conventions: "1. " for ordered steps, "— " for bullets,
// a short line ending in ":" for a sub-heading — any other line is a plain paragraph.
function parseAnswerBlocks(text) {
  const lines  = text.split('\n').filter(Boolean)
  const blocks = []
  let current  = null

  for (const line of lines) {
    const step   = line.match(/^(\d+)\.\s+(.*)$/)
    const bullet = line.match(/^—\s+(.*)$/)
    const isHeading = !step && !bullet && line.endsWith(':') && line.length < 60
    if (step) {
      if (current?.type !== 'ol') { current = { type: 'ol', items: [] }; blocks.push(current) }
      current.items.push(step[2])
    } else if (bullet) {
      if (current?.type !== 'ul') { current = { type: 'ul', items: [] }; blocks.push(current) }
      current.items.push(bullet[1])
    } else if (isHeading) {
      current = null
      blocks.push({ type: 'h', text: line.slice(0, -1) })
    } else {
      current = null
      blocks.push({ type: 'p', text: line })
    }
  }
  return blocks
}

function AnswerContent({ text }) {
  const blocks = useMemo(() => parseAnswerBlocks(text), [text])
  return (
    <div className="space-y-3">
      {blocks.map((b, i) => {
        if (b.type === 'ol') {
          return (
            <ol key={i} className="space-y-2">
              {b.items.map((step, j) => (
                <li key={j} className="flex items-start gap-2.5 text-sm text-gray-700 leading-relaxed">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-[11px] font-bold flex items-center justify-center mt-0.5">
                    {j + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          )
        }
        if (b.type === 'ul') {
          return (
            <ul key={i} className="space-y-1.5">
              {b.items.map((step, j) => (
                <li key={j} className="flex items-start gap-2 text-sm text-gray-700 leading-relaxed">
                  <span className="flex-shrink-0 text-gray-300 mt-0.5">—</span>
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          )
        }
        if (b.type === 'h') {
          return (
            <p key={i} className="text-xs font-bold uppercase tracking-wide text-indigo-500 pt-1 first:pt-0">
              {b.text}
            </p>
          )
        }
        return <p key={i} className="text-sm text-gray-700 leading-relaxed">{b.text}</p>
      })}
    </div>
  )
}

function InternalFaq({ onBack, initialSearch = '' }) {
  const [search, setSearch]     = useState(initialSearch)
  const [activeCat, setActiveCat] = useState('all')
  const [openKey, setOpenKey]   = useState(null)

  const total = INTERNAL_FAQS.reduce((s, c) => s + c.items.length, 0)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return INTERNAL_FAQS.map(cat => ({
      ...cat,
      items: cat.items.filter(item =>
        (activeCat === 'all' || activeCat === cat.id) &&
        (!q || item.q.toLowerCase().includes(q) || item.a.toLowerCase().includes(q))
      ),
    })).filter(cat => cat.items.length > 0)
  }, [search, activeCat])

  return (
    <div className="max-w-3xl space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors flex-shrink-0">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'color-mix(in srgb, #6366F1 12%, transparent)', border: '1px solid color-mix(in srgb, #6366F1 20%, transparent)' }}>
          <HelpCircle className="w-4.5 h-4.5" style={{ color: '#6366F1' }} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Guías del sistema</h1>
          <p className="text-sm text-gray-400">{total} guías de uso paso a paso</p>
        </div>
      </div>

      {/* Search + category filters — sticky so they stay reachable while scanning a long list */}
      <div className="sticky top-0 z-10 bg-slate-100/90 backdrop-blur-md pb-3 space-y-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input value={search} onChange={e => { setSearch(e.target.value); setOpenKey(null) }}
            placeholder={`Buscar entre ${total} guías del sistema…`}
            className="w-full pl-10 pr-10 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all" />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button onClick={() => { setActiveCat('all'); setOpenKey(null) }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
              activeCat === 'all' ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 text-gray-600 hover:border-gray-300 bg-white'
            }`}>
            Todas ({total})
          </button>
          {INTERNAL_FAQS.map(cat => {
            const Icon   = cat.icon
            const active = activeCat === cat.id
            return (
              <button key={cat.id} onClick={() => { setActiveCat(cat.id); setOpenKey(null) }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  active ? `${cat.bg} ${cat.color} border-transparent` : 'border-gray-200 text-gray-600 hover:border-gray-300 bg-white'
                }`}>
                <Icon className="w-3.5 h-3.5" /> {cat.label} ({cat.items.length})
              </button>
            )
          })}
        </div>
      </div>

      {/* No results */}
      {filtered.length === 0 && (
        <div className="text-center py-16">
          <HelpCircle className="w-10 h-10 mx-auto mb-3 text-gray-200" />
          <p className="font-semibold text-gray-500">Sin resultados para "{search}"</p>
          <p className="text-sm text-gray-400 mt-1">Intenta con otras palabras o abre un ticket</p>
        </div>
      )}

      {/* Categories */}
      {filtered.map(cat => {
        const Icon = cat.icon
        return (
          <div key={cat.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="flex items-center gap-2.5 px-5 py-4 border-b border-gray-100">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${cat.bg}`}>
                <Icon className={`w-3.5 h-3.5 ${cat.color}`} />
              </div>
              <span className="text-sm font-semibold text-gray-800">{cat.label}</span>
              <span className="ml-auto text-xs text-gray-400">{cat.items.length} guía{cat.items.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="divide-y divide-gray-50">
              {cat.items.map((item, idx) => {
                const key  = `${cat.id}_${idx}`
                const open = openKey === key
                return (
                  <div key={idx}>
                    <button onClick={() => setOpenKey(open ? null : key)}
                      className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50/60 transition-colors group">
                      <span className={`text-sm font-medium pr-4 leading-snug ${open ? 'text-indigo-700' : 'text-gray-700 group-hover:text-gray-900'}`}>
                        {item.q}
                      </span>
                      <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180 text-indigo-500' : 'text-gray-400'}`} />
                    </button>
                    {open && (
                      <div className="px-5 pb-5">
                        <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-4">
                          <AnswerContent text={item.a} />
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── NewTicketForm ──────────────────────────────────────────────────────────────

function NewTicketForm({ user, onCreated, onCancel }) {
  const [form, setForm]       = useState({ category: '', subject: '', message: '', priority: 'mid' })
  const [loading, setLoading] = useState(false)
  const [errors, setErrors]   = useState({})

  const set_ = (k, v) => { setForm(p => ({ ...p, [k]: v })); setErrors(p => ({ ...p, [k]: undefined })) }

  const validate = () => {
    const e = {}
    if (!form.category)                  e.category = 'Selecciona una categoría'
    if (!form.subject.trim())            e.subject  = 'Asunto requerido'
    if (form.message.trim().length < 10) e.message  = 'Mínimo 10 caracteres'
    return e
  }

  const submit = async (e) => {
    e.preventDefault()
    const e_ = validate()
    if (Object.keys(e_).length) { setErrors(e_); return }
    setLoading(true)
    try {
      const { data } = await api.post('/support/tickets', {
        name: user.username, email: user.email,
        category: form.category, subject: form.subject, message: form.message,
      })
      toast.success(`Ticket ${data.ticket_number} enviado`)
      onCreated()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al enviar el ticket')
    } finally { setLoading(false) }
  }

  const inp    = 'w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 focus:bg-white transition-all'
  const errCls = 'w-full px-3.5 py-2.5 text-sm border border-red-300 rounded-xl bg-red-50 outline-none transition-all'

  return (
    <div className="max-w-2xl">
      <button onClick={onCancel} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 mb-4 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Volver a soporte
      </button>
      <div className="card overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'color-mix(in srgb, #6366F1 12%, transparent)', border: '1px solid color-mix(in srgb, #6366F1 20%, transparent)' }}>
            <MessageSquare className="w-4 h-4" style={{ color: '#6366F1' }} />
          </div>
          <div>
            <h2 className="font-bold text-gray-900 text-base">Nuevo ticket de soporte</h2>
            <p className="text-gray-400 text-sm mt-0.5">Tu información se adjunta automáticamente</p>
          </div>
        </div>
        <form onSubmit={submit} className="px-6 py-6 space-y-5">
          {/* User info */}
          <div className="flex items-center gap-3 p-3.5 rounded-xl bg-gray-50 border border-gray-200">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {user.username?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800">{user.username}</p>
              <p className="text-xs text-gray-400">{user.email}</p>
            </div>
            <span className="text-[11px] text-gray-400">Detectado automáticamente</span>
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Categoría {errors.category && <span className="text-red-500 normal-case font-normal ml-1">— {errors.category}</span>}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {Object.entries(CATS).map(([k, label]) => (
                <button key={k} type="button" onClick={() => set_('category', k)}
                  className={`px-3 py-2.5 rounded-xl border text-sm font-medium text-left transition-all ${
                    form.category === k ? 'border-indigo-400 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-200' : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                  }`}>{label}</button>
              ))}
            </div>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Prioridad</label>
            <div className="flex gap-2">
              {[['low','Baja','bg-emerald-400'],['mid','Media','bg-amber-400'],['high','Alta','bg-red-400']].map(([v,l,dot]) => (
                <button key={v} type="button" onClick={() => set_('priority', v)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-all ${
                    form.priority === v ? 'border-indigo-300 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-200' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                  }`}>
                  <span className={`w-2 h-2 rounded-full ${dot}`} />{l}
                </button>
              ))}
            </div>
          </div>

          {/* Subject */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Asunto {errors.subject && <span className="text-red-500 normal-case font-normal ml-1">— {errors.subject}</span>}
            </label>
            <input value={form.subject} onChange={e => set_('subject', e.target.value)}
              placeholder="Describe brevemente tu problema" className={errors.subject ? errCls : inp} />
          </div>

          {/* Message */}
          <div>
            <div className="flex items-baseline justify-between mb-1.5">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Descripción {errors.message && <span className="text-red-500 normal-case font-normal ml-1">— {errors.message}</span>}
              </label>
              <span className={`text-[11px] ${form.message.length < 10 ? 'text-gray-400' : 'text-emerald-600'}`}>{form.message.length}/2000</span>
            </div>
            <textarea value={form.message} onChange={e => set_('message', e.target.value)}
              rows={5} placeholder="Detalla el problema, pasos para reproducirlo, mensajes de error, etc."
              className={`${errors.message ? errCls : inp} resize-none`} />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 transition-colors">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {loading ? 'Enviando…' : 'Enviar ticket'}
            </button>
            <button type="button" onClick={onCancel}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── TicketThread ───────────────────────────────────────────────────────────────

function TicketThread({ ticketId, user, onBack }) {
  const [ticket, setTicket]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [reply, setReply]     = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef             = useRef(null)

  const load = useCallback(async () => {
    try { const { data } = await api.get(`/support/tickets/${ticketId}`); setTicket(data) }
    catch { toast.error('Error cargando el ticket') }
    finally { setLoading(false) }
  }, [ticketId])

  useEffect(() => { load() }, [load])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [ticket?.messages])

  const sendReply = async () => {
    if (!reply.trim()) return
    setSending(true)
    try { await api.post(`/support/tickets/${ticketId}/messages`, { message: reply.trim() }); setReply(''); load() }
    catch { toast.error('Error al enviar el mensaje') }
    finally { setSending(false) }
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 text-gray-300 animate-spin" /></div>
  if (!ticket) return null

  const isOpen = !['resolved', 'closed'].includes(ticket.status)

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900 text-base truncate">{ticket.subject}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-gray-400 font-mono">{ticket.ticket_number}</span>
            <span className="text-gray-300">·</span>
            {ticket.category && <span className="text-xs text-gray-400">{CATS[ticket.category] ?? ticket.category}</span>}
            <span className="text-gray-300">·</span>
            <StatusBadge status={ticket.status} />
          </div>
        </div>
        <button onClick={load} className="p-2 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {ticket.status === 'accepted' && (
        <div className="flex items-center gap-3 p-3.5 rounded-xl bg-indigo-50 border border-indigo-200 text-sm text-indigo-700">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> Un agente de soporte está atendiendo tu caso.
        </div>
      )}
      {ticket.status === 'open' && (
        <div className="flex items-center gap-3 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-700">
          <Clock className="w-4 h-4 flex-shrink-0" /> Tu ticket está en cola. Nuestro equipo lo revisará pronto.
        </div>
      )}
      {!isOpen && (
        <div className="flex items-center gap-3 p-3.5 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-500">
          <XCircle className="w-4 h-4 flex-shrink-0" /> Este ticket está cerrado. Si el problema persiste, abre uno nuevo.
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="divide-y divide-gray-50">
          {ticket.messages?.map(msg => {
            const isOp = msg.sender_type === 'operator'
            return (
              <div key={msg.id} className={`px-5 py-4 ${isOp ? 'bg-indigo-50/30' : ''}`}>
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 ${isOp ? 'bg-indigo-600' : 'bg-gray-400'}`}>
                    {isOp ? 'S' : msg.sender_name?.[0]?.toUpperCase()}
                  </div>
                  <span className="text-xs font-semibold text-gray-700">{msg.sender_name}</span>
                  {isOp && <span className="text-[10px] font-bold text-indigo-500 bg-indigo-100 px-1.5 py-0.5 rounded-full">Soporte GemaSystem</span>}
                  <span className="text-xs text-gray-400 ml-auto">
                    {new Date(msg.created_at).toLocaleString('es-MX', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}
                  </span>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap ml-8">{msg.message}</p>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>
        {isOpen && (
          <div className="px-5 py-4 bg-gray-50 border-t border-gray-100">
            <div className="flex gap-3">
              <textarea value={reply} onChange={e => setReply(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) sendReply() }}
                rows={3} placeholder="Escribe tu mensaje… (Ctrl+Enter para enviar)"
                className="flex-1 px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl bg-white outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 resize-none transition-all" />
              <button onClick={sendReply} disabled={sending || !reply.trim()}
                className="self-end flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-40 transition-colors flex-shrink-0">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── SupportHub ─────────────────────────────────────────────────────────────────

function SupportHub({ tickets, loading, onSelect, onNew, onFaq }) {
  const [heroQuery, setHeroQuery] = useState('')
  const open   = tickets.filter(t => t.status === 'open').length
  const active = tickets.filter(t => t.status === 'accepted').length
  const total  = INTERNAL_FAQS.reduce((s, c) => s + c.items.length, 0)

  function handleHeroSearch(e) {
    e.preventDefault()
    onFaq(heroQuery.trim())
  }

  return (
    <div className="space-y-6 max-w-4xl">

      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl p-7 sm:p-9"
        style={{ background: '#4f46e5' }}>
        <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-white/10 blur-2xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-10 w-64 h-64 rounded-full bg-white/10 blur-2xl pointer-events-none" />

        <div className="relative flex items-start justify-between gap-3 flex-wrap mb-6">
          <div className="flex items-center gap-2 text-xs font-semibold text-white/90 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-3 py-1">
            <MessageSquare className="w-3.5 h-3.5" /> Centro de soporte
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-white/90 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-3 py-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
            Sistema operativo · Respuesta &lt; 24 hrs
          </div>
        </div>

        <h1 className="relative text-2xl sm:text-3xl font-bold text-white mb-1.5">¿En qué podemos ayudarte?</h1>
        <p className="relative text-sm text-indigo-100 mb-5">Busca en las guías del sistema o contáctanos directamente.</p>

        <form onSubmit={handleHeroSearch} className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400" />
          <input
            value={heroQuery} onChange={e => setHeroQuery(e.target.value)}
            placeholder="Ej. cómo registro un pago, cómo cambio mi PIN..."
            className="w-full pl-11 pr-24 sm:pr-28 py-3.5 rounded-2xl text-sm bg-white shadow-lg focus:outline-none focus:ring-4 focus:ring-white/30 transition-all"
          />
          <button type="submit"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3.5 sm:px-4 py-2 rounded-xl text-sm font-semibold text-white transition-colors hover:opacity-90"
            style={{ background: '#4f46e5' }}>
            Buscar
          </button>
        </form>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button onClick={onNew}
          className="flex items-center gap-3 p-4 rounded-2xl text-left bg-white border border-gray-200 transition-all hover:-translate-y-0.5 hover:shadow-md hover:border-indigo-200">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
            <Plus className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900">Nuevo ticket</p>
            <p className="text-xs text-gray-400">Reportar un problema</p>
          </div>
        </button>

        <button onClick={() => onFaq('')}
          className="flex items-center gap-3 p-4 rounded-2xl text-left bg-white border border-gray-200 transition-all hover:-translate-y-0.5 hover:shadow-md hover:border-indigo-200">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
            <HelpCircle className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900">Guías del sistema</p>
            <p className="text-xs text-gray-400">{total} guías paso a paso</p>
          </div>
        </button>

        <a href="mailto:soporte@gemasystem.mx"
          className="flex items-center gap-3 p-4 rounded-2xl text-left bg-white border border-gray-200 transition-all hover:-translate-y-0.5 hover:shadow-md hover:border-indigo-200">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
            <Mail className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900">Enviar correo</p>
            <p className="text-xs text-gray-400">soporte@gemasystem.mx</p>
          </div>
        </a>
      </div>

      {/* Tickets */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-gray-800">Mis tickets</h2>
            {open   > 0 && <span className="text-[11px] font-bold text-blue-600 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5">{open} abierto{open !== 1 ? 's' : ''}</span>}
            {active > 0 && <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-full px-2 py-0.5">{active} en atención</span>}
          </div>
          <button onClick={onNew} className="flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-700 transition-colors">
            <Plus className="w-4 h-4" /> Nuevo
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-5 h-5 text-gray-300 animate-spin" /></div>
        ) : tickets.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center">
            <MessageSquare className="w-8 h-8 text-gray-200 mx-auto mb-3" />
            <p className="text-sm font-semibold text-gray-700 mb-1">Sin tickets todavía</p>
            <p className="text-xs text-gray-400 mb-4">¿Tienes un problema? Abre tu primer ticket y te ayudamos.</p>
            <button onClick={onNew}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors">
              <Plus className="w-4 h-4" /> Abrir ticket
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {tickets.map(t => (
              <div key={t.id} onClick={() => onSelect(t.id)}
                className="flex items-center gap-4 px-5 py-4 bg-white border border-gray-200 rounded-xl hover:border-gray-300 cursor-pointer transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="text-sm font-semibold text-gray-900 truncate">{t.subject}</p>
                    <StatusBadge status={t.status} />
                    {t.last_reply_by === 'operator' && t.status === 'accepted' && (
                      <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-full border border-indigo-200">Nueva respuesta</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span className="font-mono">{t.ticket_number}</span>
                    {t.category && <><span>·</span><span>{CATS[t.category] ?? t.category}</span></>}
                    <span>·</span>
                    <span>{t.message_count} mensaje{t.message_count !== 1 ? 's' : ''}</span>
                    <span>·</span>
                    <span>{new Date(t.updated_at).toLocaleDateString('es-MX', { day:'2-digit', month:'short', year:'numeric' })}</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────

export default function SupportPanel() {
  const { user }                    = useAuthStore()
  const [view, setView]             = useState('list')  // list | faq | new | thread
  const [selectedId, setSelectedId] = useState(null)
  const [tickets, setTickets]       = useState([])
  const [loading, setLoading]       = useState(true)
  const [heroSearch, setHeroSearch] = useState('')

  const loadTickets = useCallback(async () => {
    setLoading(true)
    try { const { data } = await api.get('/support/tickets'); setTickets(data) }
    catch { toast.error('Error cargando tickets') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadTickets() }, [loadTickets])

  const openThread = id  => { setSelectedId(id); setView('thread') }
  const goList     = () => { setView('list'); setSelectedId(null); loadTickets() }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {view === 'list'   && <SupportHub   tickets={tickets} loading={loading} onSelect={openThread} onNew={() => setView('new')} onFaq={q => { setHeroSearch(q ?? ''); setView('faq') }} />}
      {view === 'faq'    && <InternalFaq  onBack={goList} initialSearch={heroSearch} />}
      {view === 'new'    && user && <NewTicketForm user={user} onCreated={goList} onCancel={goList} />}
      {view === 'thread' && selectedId && user && <TicketThread ticketId={selectedId} user={user} onBack={goList} />}
    </div>
  )
}
