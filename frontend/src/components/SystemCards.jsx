/**
 * Fiel recreación en miniatura de las páginas reales de GemaSystem.
 * Cada componente simula la pantalla completa: sidebar + topbar + contenido.
 * Se usan como hijos del SystemShowcase en la landing.
 */
import { Users, Clock } from 'lucide-react'

// ── Paleta compartida ──────────────────────────────────────────────────────────
const IND = '#6366F1'
const VIO = '#8B5CF6'

// ── Sidebar mini ──────────────────────────────────────────────────────────────
const NAV_DOTS = [IND, '#94a3b8', '#94a3b8', '#94a3b8', '#94a3b8', '#94a3b8', '#94a3b8']
function Sidebar({ active = 0 }) {
  return (
    <div className="flex flex-col flex-shrink-0 bg-white border-r border-gray-100" style={{ width: 44 }}>
      {/* logo */}
      <div className="flex items-center justify-center" style={{ height: 44, borderBottom: '1px solid #f1f5f9' }}>
        <div className="w-6 h-6 rounded-lg flex items-center justify-center"
          style={{ background: `linear-gradient(135deg,${IND},${VIO})` }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" className="w-3.5 h-3.5">
            <path d="M6 4v16M18 4v16M6 12h12M2 8h4M18 8h4M2 16h4M18 16h4"/>
          </svg>
        </div>
      </div>
      {/* nav icons */}
      <div className="flex flex-col items-center gap-2 pt-3 flex-1">
        {NAV_DOTS.map((c, i) => (
          <div key={i} className="w-7 h-7 rounded-xl flex items-center justify-center"
            style={{ background: i === active ? `${IND}18` : 'transparent' }}>
            <div className="w-3 h-3 rounded" style={{ background: i === active ? IND : '#cbd5e1' }} />
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Topbar mini ───────────────────────────────────────────────────────────────
function Topbar({ title }) {
  return (
    <div className="flex items-center justify-between px-4 flex-shrink-0 bg-white border-b border-gray-100"
      style={{ height: 44 }}>
      <span className="text-xs font-bold text-gray-800">{title}</span>
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 rounded-full border border-gray-200 bg-gray-100" />
        <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[8px] font-bold"
          style={{ background: `linear-gradient(135deg,${IND},${VIO})` }}>GE</div>
      </div>
    </div>
  )
}

// ── Stat card mini ────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color = IND, up = true, change }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-2.5 flex items-start gap-2 shadow-sm">
      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: `${color}18` }}>
        <div className="w-3 h-3 rounded-sm" style={{ background: color }} />
      </div>
      <div className="min-w-0 flex-1">
        <p style={{ fontSize: 8, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
        <p className="font-bold text-gray-900" style={{ fontSize: 13, lineHeight: 1.2, marginTop: 1 }}>{value}</p>
        {sub && <p style={{ fontSize: 8, color: '#94a3b8', marginTop: 1 }}>{sub}</p>}
        {change != null && (
          <p style={{ fontSize: 8, fontWeight: 600, color: up ? '#10b981' : '#ef4444', marginTop: 1 }}>
            {up ? '↑' : '↓'} {change}
          </p>
        )}
      </div>
    </div>
  )
}

// ── Mini area chart (SVG) ─────────────────────────────────────────────────────
function AreaMini({ data, color = IND, h = 52 }) {
  const max = Math.max(...data, 1)
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * 200
    const y = h - (v / max) * (h - 4)
    return `${x},${y}`
  })
  const path = `M${pts.join(' L')}`
  const fill = `${path} L200,${h} L0,${h} Z`
  return (
    <svg viewBox={`0 0 200 ${h}`} style={{ width: '100%', height: h }} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`ag${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fill} fill={`url(#ag${color.replace('#','')})`} />
      <path d={path} stroke={color} strokeWidth="1.5" fill="none" />
    </svg>
  )
}

// ── Mini bar chart (SVG) ──────────────────────────────────────────────────────
function BarMini({ data, color = IND, h = 52, highlight = -1 }) {
  const max = Math.max(...data, 1)
  const gap = 2, bw = (200 - gap * (data.length - 1)) / data.length
  return (
    <svg viewBox={`0 0 200 ${h}`} style={{ width: '100%', height: h }} preserveAspectRatio="none">
      {data.map((v, i) => {
        const bh = (v / max) * (h - 2)
        return (
          <rect key={i}
            x={i * (bw + gap)} y={h - bh} width={bw} height={bh}
            rx="2"
            fill={i === highlight ? color : `${color}45`}
          />
        )
      })}
    </svg>
  )
}

// ── Mini donut (SVG) ──────────────────────────────────────────────────────────
function DonutMini({ slices, size = 60 }) {
  const r = 20, cx = size / 2, cy = size / 2
  const total = slices.reduce((s, x) => s + x.value, 0)
  let angle = -Math.PI / 2
  const arcs = slices.map(s => {
    const a = (s.value / total) * 2 * Math.PI
    const x1 = cx + r * Math.cos(angle), y1 = cy + r * Math.sin(angle)
    angle += a
    const x2 = cx + r * Math.cos(angle), y2 = cy + r * Math.sin(angle)
    const large = a > Math.PI ? 1 : 0
    return { path: `M${cx},${cy} L${x1},${y1} A${r},${r},0,${large},1,${x2},${y2} Z`, color: s.color }
  })
  return (
    <svg viewBox={`0 0 ${size} ${size}`} style={{ width: size, height: size }}>
      {arcs.map((a, i) => <path key={i} d={a.path} fill={a.color} />)}
      <circle cx={cx} cy={cy} r={r * 0.6} fill="white" />
    </svg>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════════════════════════════════════════
export function DashboardCard() {
  const visits30 = [12,8,15,20,18,22,10,17,25,19,14,28,21,16,24,30,22,18,26,31,23,19,28,35,27,22,30,38,25,33]
  const revenue6  = [14200, 16800, 15400, 18200, 17600, 18420]
  const expiring  = [
    { name: 'Carlos M.',  days: 2,  type: 'Premium' },
    { name: 'Laura P.',   days: 5,  type: 'Básica'  },
    { name: 'Diego R.',   days: 6,  type: 'VIP'     },
    { name: 'Marco V.',   days: 7,  type: 'Básica'  },
  ]
  const recentVisits = [
    { name: 'Ana G.',    type: 'Entrenamiento', time: '10:32' },
    { name: 'Carlos M.', type: 'Clase',         time: '10:28' },
    { name: 'Laura P.',  type: 'Entrenamiento', time: '09:58' },
    { name: 'Sofía T.',  type: 'Consulta',      time: '09:44' },
    { name: 'Marco V.',  type: 'Entrenamiento', time: '09:31' },
  ]
  const pieSlices = [
    { value: 120, color: '#3B82F6' },
    { value: 85,  color: VIO },
    { value: 42,  color: '#F59E0B' },
  ]

  return (
    <div className="flex w-full h-full" style={{ background: '#f8fafc' }}>
      <Sidebar active={0} />
      <div className="flex flex-col flex-1 min-w-0">
        <Topbar title="Dashboard" />
        <div className="flex-1 overflow-hidden p-3" style={{ background: '#f8fafc' }}>

          {/* Welcome */}
          <div className="flex items-center justify-between mb-2.5">
            <div>
              <p className="font-semibold text-gray-900" style={{ fontSize: 11 }}>Hola, GymElite</p>
              <p style={{ fontSize: 9, color: '#94a3b8' }}>sábado, 31 de mayo de 2026</p>
            </div>
            <div className="px-2 py-1 rounded-lg bg-white border border-gray-200 flex items-center gap-1">
              <div className="w-2 h-2 rounded-sm bg-gray-300" />
              <span style={{ fontSize: 8, color: '#64748b', fontWeight: 600 }}>Modo privacidad</span>
            </div>
          </div>

          {/* Stat cards 3+3 */}
          <div className="grid grid-cols-3 gap-1.5 mb-2.5">
            <StatCard label="Miembros activos" value="247" sub="312 total" color={IND} up change="+8.2%" />
            <StatCard label="Visitas hoy"       value="38"  sub="264 este mes" color="#10b981" up change="+5.1%" />
            <StatCard label="Ingresos del mes"  value="$18,420" sub="$4,280 semana" color="#f59e0b" up={false} change="-2.0%" />
          </div>
          <div className="grid grid-cols-3 gap-1.5 mb-2.5">
            <StatCard label="Membresías activas" value="189" sub="12 vencen pronto" color={VIO} />
            <StatCard label="Vencen pronto"       value="12"  sub="próximos 7 días"  color="#ef4444" up={false} />
            <StatCard label="Entrenadores"         value="6"   sub="activos"           color="#3b82f6" />
          </div>

          {/* Charts row */}
          <div className="grid gap-1.5 mb-1.5" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>

            {/* Visits area */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-2.5" style={{ gridColumn: 'span 2' }}>
              <div className="flex items-center justify-between mb-1">
                <p style={{ fontSize: 9, fontWeight: 700, color: '#374151' }}>Visitas — últimos 30 días</p>
                <span style={{ fontSize: 8, color: '#94a3b8', background: '#f1f5f9', padding: '1px 6px', borderRadius: 999 }}>264 este mes</span>
              </div>
              <AreaMini data={visits30} color={IND} h={56} />
            </div>

            {/* Donut + legend */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-2.5">
              <p style={{ fontSize: 9, fontWeight: 700, color: '#374151', marginBottom: 4 }}>Tipo de membresía</p>
              <div className="flex items-center gap-2">
                <DonutMini slices={pieSlices} size={52} />
                <div className="space-y-1">
                  {[['Básica','#3B82F6','120'],['Premium',VIO,'85'],['VIP','#F59E0B','42']].map(([n,c,v]) => (
                    <div key={n} className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: c }} />
                      <span style={{ fontSize: 8, color: '#64748b' }}>{n}</span>
                      <span style={{ fontSize: 8, fontWeight: 700, color: '#374151', marginLeft: 'auto' }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Revenue + expiring + recent */}
          <div className="grid gap-1.5" style={{ gridTemplateColumns: '1.4fr 1fr 1fr' }}>

            {/* Revenue bars */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-2.5">
              <div className="flex items-center justify-between mb-1">
                <p style={{ fontSize: 9, fontWeight: 700, color: '#374151' }}>Ingresos — 6 meses</p>
                <span style={{ fontSize: 8, color: '#10b981', background: '#f0fdf4', padding: '1px 5px', borderRadius: 999 }}>↑4.7%</span>
              </div>
              <BarMini data={revenue6} color={IND} h={52} highlight={5} />
              <div className="flex justify-between mt-0.5">
                {['Dic','Ene','Feb','Mar','Abr','May'].map(m => (
                  <span key={m} style={{ fontSize: 7, color: '#94a3b8', flex: 1, textAlign: 'center' }}>{m}</span>
                ))}
              </div>
            </div>

            {/* Expiring */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-2.5">
              <div className="flex items-center justify-between mb-1.5">
                <p style={{ fontSize: 9, fontWeight: 700, color: '#374151' }}>Membresías por vencer</p>
                <span style={{ fontSize: 8, color: '#ef4444', background: '#fef2f2', padding: '1px 5px', borderRadius: 999 }}>12 en 7 días</span>
              </div>
              <div className="space-y-1.5">
                {expiring.map((m, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: '#fee2e2', fontSize: 7, fontWeight: 700, color: '#b91c1c' }}>
                      {m.name.slice(0,2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p style={{ fontSize: 9, fontWeight: 600, color: '#374151', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</p>
                      <p style={{ fontSize: 7, color: '#94a3b8' }}>{m.type}</p>
                    </div>
                    <span style={{ fontSize: 8, fontWeight: 700, color: m.days <= 2 ? '#ef4444' : '#f59e0b', flexShrink: 0 }}>
                      {m.days === 1 ? '1 día' : `${m.days} días`}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent visits */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-2.5">
              <div className="flex items-center justify-between mb-1.5">
                <p style={{ fontSize: 9, fontWeight: 700, color: '#374151' }}>Visitas recientes</p>
                <span style={{ fontSize: 8, color: IND, cursor: 'pointer' }}>Ver todas →</span>
              </div>
              <div className="space-y-1.5">
                {recentVisits.map((v, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: `${IND}18`, fontSize: 7, fontWeight: 700, color: IND }}>
                      {v.name.slice(0,2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p style={{ fontSize: 9, fontWeight: 600, color: '#374151' }}>{v.name}</p>
                      <p style={{ fontSize: 7, color: '#94a3b8' }}>{v.type}</p>
                    </div>
                    <span style={{ fontSize: 7, color: '#94a3b8', flexShrink: 0 }}>{v.time}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// MEMBERS
// ══════════════════════════════════════════════════════════════════════════════
export function MembersCard() {
  const members = [
    { name: 'Ana García',      code: 'M-0041', type: 'Premium', end: '28 Jun 2026', status: 'active'  },
    { name: 'Carlos Mendoza',  code: 'M-0038', type: 'Básica',  end: '15 Jun 2026', status: 'active'  },
    { name: 'Laura Pérez',     code: 'M-0035', type: 'VIP',     end: '05 Jun 2026', status: 'active'  },
    { name: 'Diego Ramírez',   code: 'M-0033', type: 'Básica',  end: '02 Jun 2026', status: 'active'  },
    { name: 'Sofía Torres',    code: 'M-0029', type: 'Premium', end: '30 May 2026', status: 'inactive'},
    { name: 'Marco Villanueva',code: 'M-0027', type: 'Básica',  end: '22 May 2026', status: 'inactive'},
    { name: 'Elena Fuentes',   code: 'M-0024', type: 'VIP',     end: '10 Jul 2026', status: 'active'  },
  ]
  const stats = [
    { label: 'Total socios', value: '247', color: IND },
    { label: 'Activos',      value: '189', color: '#10b981' },
    { label: 'Vencidos',     value: '45',  color: '#ef4444' },
    { label: 'Este mes',     value: '+12', color: '#f59e0b' },
  ]
  const badgeClass = s => s === 'active' ? { bg: '#f0fdf4', color: '#15803d' } : { bg: '#fef2f2', color: '#b91c1c' }
  const typeColor  = t => t === 'Premium' ? VIO : t === 'VIP' ? '#f59e0b' : '#3b82f6'

  const byMonth = [18,22,15,28,20,25,19,30,24,17,26,12]

  return (
    <div className="flex w-full h-full" style={{ background: '#f8fafc' }}>
      <Sidebar active={1} />
      <div className="flex flex-col flex-1 min-w-0">
        <Topbar title="Socios" />
        <div className="flex-1 overflow-hidden p-3" style={{ background: '#f8fafc' }}>

          {/* Stat cards */}
          <div className="grid grid-cols-4 gap-1.5 mb-2.5">
            {stats.map((s, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 p-2.5 shadow-sm">
                <div className="w-6 h-6 rounded-lg mb-1 flex items-center justify-center" style={{ background: `${s.color}15` }}>
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ background: s.color }} />
                </div>
                <p style={{ fontSize: 8, color: '#94a3b8' }}>{s.label}</p>
                <p style={{ fontSize: 14, fontWeight: 800, color: s.color }}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Controls row */}
          <div className="flex items-center gap-2 mb-2">
            <div className="flex-1 bg-white rounded-xl border border-gray-200 flex items-center gap-2 px-2.5 py-1.5 shadow-sm">
              <svg viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" style={{ width: 12, height: 12 }}>
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <span style={{ fontSize: 9, color: '#cbd5e1' }}>Buscar por nombre, código o correo...</span>
            </div>
            <div className="px-3 py-1.5 rounded-xl border border-gray-200 bg-white flex items-center gap-1 shadow-sm">
              <div className="w-2 h-2 rounded-sm bg-gray-300" />
              <span style={{ fontSize: 8, color: '#64748b', fontWeight: 600 }}>Todos</span>
            </div>
            <div className="px-3 py-1.5 rounded-xl text-white flex items-center gap-1 shadow-sm"
              style={{ background: `linear-gradient(135deg,${IND},${VIO})`, fontSize: 8, fontWeight: 700 }}>
              + Nuevo socio
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="grid border-b border-gray-100 px-2.5 py-1.5"
              style={{ gridTemplateColumns: '2fr 1fr 1fr 1.2fr 1fr', gap: 4 }}>
              {['Nombre','Código','Membresía','Vencimiento','Estado'].map(h => (
                <span key={h} style={{ fontSize: 8, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</span>
              ))}
            </div>
            {/* Rows */}
            {members.map((m, i) => {
              const b = badgeClass(m.status)
              return (
                <div key={i} className="grid border-b border-gray-50 last:border-0 px-2.5 items-center"
                  style={{ gridTemplateColumns: '2fr 1fr 1fr 1.2fr 1fr', gap: 4, height: 28 }}>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: `${IND}18`, fontSize: 7, fontWeight: 700, color: IND }}>
                      {m.name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()}
                    </div>
                    <span style={{ fontSize: 9, fontWeight: 600, color: '#374151', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</span>
                  </div>
                  <span style={{ fontSize: 8, color: '#94a3b8', fontFamily: 'monospace' }}>{m.code}</span>
                  <span style={{ fontSize: 8, fontWeight: 600, color: typeColor(m.type) }}>{m.type}</span>
                  <span style={{ fontSize: 8, color: '#64748b' }}>{m.end}</span>
                  <span style={{ fontSize: 8, fontWeight: 600, padding: '2px 6px', borderRadius: 999, background: b.bg, color: b.color, display: 'inline-block' }}>
                    {m.status === 'active' ? 'Activo' : 'Vencido'}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Chart */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-2.5 mt-1.5">
            <p style={{ fontSize: 9, fontWeight: 700, color: '#374151', marginBottom: 4 }}>Altas de socios — últimos 12 meses</p>
            <BarMini data={byMonth} color={IND} h={40} highlight={11} />
          </div>

        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// FINANCES
// ══════════════════════════════════════════════════════════════════════════════
export function FinancesCard() {
  const revenue6  = [14200, 16800, 15400, 18200, 17600, 18420]
  const txs = [
    { label: 'Membresía Premium — Ana G.',   amount: '+$1,560', type: 'in',  method: 'Tarjeta', date: '31 May' },
    { label: 'Membresía Básica — Carlos M.', amount: '+$780',   type: 'in',  method: 'Efectivo', date: '31 May' },
    { label: 'Membresía VIP — Laura P.',     amount: '+$2,400', type: 'in',  method: 'Transferencia', date: '30 May' },
    { label: 'Mantenimiento equipos',        amount: '-$850',   type: 'out', method: '—', date: '29 May' },
    { label: 'Visita suelta — Diego R.',     amount: '+$120',   type: 'in',  method: 'Efectivo', date: '29 May' },
    { label: 'Publicidad redes sociales',    amount: '-$500',   type: 'out', method: '—', date: '28 May' },
    { label: 'Membresía Básica — Marco V.',  amount: '+$780',   type: 'in',  method: 'Tarjeta', date: '28 May' },
  ]

  return (
    <div className="flex w-full h-full" style={{ background: '#f8fafc' }}>
      <Sidebar active={2} />
      <div className="flex flex-col flex-1 min-w-0">
        <Topbar title="Finanzas" />
        <div className="flex-1 overflow-hidden p-3" style={{ background: '#f8fafc' }}>

          {/* Summary cards */}
          <div className="grid grid-cols-4 gap-1.5 mb-2.5">
            {[
              { label: 'Ingresos del mes', value: '$18,420', color: '#10b981', bg: '#f0fdf4' },
              { label: 'Gastos del mes',   value: '$2,350',  color: '#ef4444', bg: '#fef2f2' },
              { label: 'Balance neto',     value: '$16,070', color: IND,       bg: `${IND}10` },
              { label: 'Esta semana',      value: '$4,280',  color: '#f59e0b', bg: '#fffbeb' },
            ].map((s, i) => (
              <div key={i} className="rounded-xl border p-2.5 shadow-sm"
                style={{ background: s.bg, borderColor: `${s.color}30` }}>
                <p style={{ fontSize: 8, color: s.color, fontWeight: 600 }}>{s.label}</p>
                <p style={{ fontSize: 13, fontWeight: 800, color: s.color, marginTop: 2 }}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Chart + table */}
          <div className="grid gap-1.5 mb-1.5" style={{ gridTemplateColumns: '1.3fr 1fr' }}>
            {/* Revenue bar */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-2.5">
              <div className="flex items-center justify-between mb-1">
                <p style={{ fontSize: 9, fontWeight: 700, color: '#374151' }}>Ingresos últimos 6 meses</p>
                <span style={{ fontSize: 8, color: '#10b981', background: '#f0fdf4', padding: '1px 5px', borderRadius: 999 }}>↑4.7%</span>
              </div>
              <BarMini data={revenue6} color={IND} h={56} highlight={5} />
              <div className="flex justify-between mt-0.5">
                {['Dic','Ene','Feb','Mar','Abr','May'].map(m => (
                  <span key={m} style={{ fontSize: 7, color: '#94a3b8', flex: 1, textAlign: 'center' }}>{m}</span>
                ))}
              </div>
            </div>

            {/* Breakdown */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-2.5">
              <p style={{ fontSize: 9, fontWeight: 700, color: '#374151', marginBottom: 6 }}>Desglose ingresos</p>
              {[
                { label: 'Membresías', pct: 82, color: IND },
                { label: 'Visitas',    pct: 12, color: '#10b981' },
                { label: 'Otros',      pct: 6,  color: '#f59e0b' },
              ].map(r => (
                <div key={r.label} className="mb-2">
                  <div className="flex items-center justify-between mb-0.5">
                    <span style={{ fontSize: 8, color: '#64748b' }}>{r.label}</span>
                    <span style={{ fontSize: 8, fontWeight: 700, color: r.color }}>{r.pct}%</span>
                  </div>
                  <div className="w-full rounded-full" style={{ height: 4, background: '#f1f5f9' }}>
                    <div className="rounded-full" style={{ height: 4, width: `${r.pct}%`, background: r.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Transactions table */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="grid border-b border-gray-100 px-2.5 py-1.5"
              style={{ gridTemplateColumns: '3fr 1fr 1fr 1fr' }}>
              {['Descripción','Monto','Método','Fecha'].map(h => (
                <span key={h} style={{ fontSize: 8, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>{h}</span>
              ))}
            </div>
            {txs.map((t, i) => (
              <div key={i} className="grid border-b border-gray-50 last:border-0 px-2.5 items-center"
                style={{ gridTemplateColumns: '3fr 1fr 1fr 1fr', height: 26 }}>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: t.type === 'in' ? '#10b981' : '#ef4444' }} />
                  <span style={{ fontSize: 8, color: '#374151', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.label}</span>
                </div>
                <span style={{ fontSize: 8, fontWeight: 700, color: t.type === 'in' ? '#10b981' : '#ef4444' }}>{t.amount}</span>
                <span style={{ fontSize: 8, color: '#94a3b8' }}>{t.method}</span>
                <span style={{ fontSize: 8, color: '#94a3b8' }}>{t.date}</span>
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// VISITS / QR
// ══════════════════════════════════════════════════════════════════════════════
export function VisitsCard() {
  const visits30 = [8,12,15,10,18,22,14,20,25,17,12,28,21,16,24,30,19,15,22,31,20,18,26,35,24,21,28,38,22,29]
  const recent = [
    { name: 'Ana García',      code: 'M-0041', type: 'Entrenamiento', time: '10:32 am', ok: true  },
    { name: 'Carlos Mendoza',  code: 'M-0038', type: 'Clase grupal',  time: '10:28 am', ok: true  },
    { name: 'Marco Villanueva',code: 'M-0027', type: 'Entrenamiento', time: '10:15 am', ok: false },
    { name: 'Laura Pérez',     code: 'M-0035', type: 'Consulta',      time: '09:58 am', ok: true  },
    { name: 'Sofía Torres',    code: 'M-0029', type: 'Entrenamiento', time: '09:44 am', ok: true  },
    { name: 'Elena Fuentes',   code: 'M-0024', type: 'Clase grupal',  time: '09:31 am', ok: true  },
  ]
  const byType = [
    { label: 'Entrenamiento', count: 21, color: IND,       pct: 68 },
    { label: 'Clase grupal',  count: 8,  color: VIO,       pct: 26 },
    { label: 'Consulta',      count: 2,  color: '#3b82f6', pct: 6  },
  ]

  return (
    <div className="flex w-full h-full" style={{ background: '#f8fafc' }}>
      <Sidebar active={3} />
      <div className="flex flex-col flex-1 min-w-0">
        <Topbar title="Control de visitas" />
        <div className="flex-1 overflow-hidden p-3" style={{ background: '#f8fafc' }}>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-1.5 mb-2.5">
            {[
              { label: 'Visitas hoy',     value: '38',  color: IND },
              { label: 'Esta semana',     value: '189', color: '#10b981' },
              { label: 'Este mes',        value: '264', color: '#f59e0b' },
              { label: 'Membresías venc.',value: '12',  color: '#ef4444' },
            ].map((s, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 p-2.5 shadow-sm">
                <div className="w-5 h-5 rounded-lg mb-1" style={{ background: `${s.color}15` }} />
                <p style={{ fontSize: 8, color: '#94a3b8' }}>{s.label}</p>
                <p style={{ fontSize: 14, fontWeight: 800, color: s.color }}>{s.value}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-1.5" style={{ gridTemplateColumns: '1fr 1.8fr' }}>

            {/* QR Scanner + visit type breakdown */}
            <div className="flex flex-col gap-1.5">
              {/* QR */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-2.5">
                <p style={{ fontSize: 9, fontWeight: 700, color: '#374151', marginBottom: 6 }}>Registrar visita — QR</p>
                <div className="flex items-center gap-2.5">
                  {/* QR code mock */}
                  <div className="rounded-xl border-2 border-dashed flex items-center justify-center flex-shrink-0"
                    style={{ width: 48, height: 48, borderColor: IND }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,6px)', gap: 1 }}>
                      {Array.from({length:25}).map((_,i) => (
                        <div key={i} style={{
                          width: 6, height: 6, borderRadius: 1,
                          background: [0,1,2,3,4,5,9,10,14,15,19,20,21,22,23,24].includes(i) ? IND : `${IND}30`
                        }} />
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-1 mb-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span style={{ fontSize: 8, fontWeight: 700, color: '#10b981' }}>Escáner activo</span>
                    </div>
                    <p style={{ fontSize: 8, color: '#94a3b8', lineHeight: 1.4 }}>Apunta la cámara al código QR del socio</p>
                  </div>
                </div>
              </div>

              {/* Visit types */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-2.5 flex-1">
                <p style={{ fontSize: 9, fontWeight: 700, color: '#374151', marginBottom: 6 }}>Tipos de visita hoy</p>
                {byType.map(t => (
                  <div key={t.label} className="mb-2">
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: t.color }} />
                        <span style={{ fontSize: 8, color: '#64748b' }}>{t.label}</span>
                      </div>
                      <span style={{ fontSize: 8, fontWeight: 700, color: '#374151' }}>{t.count}</span>
                    </div>
                    <div className="rounded-full" style={{ height: 3, background: '#f1f5f9' }}>
                      <div className="rounded-full" style={{ height: 3, width: `${t.pct}%`, background: t.color }} />
                    </div>
                  </div>
                ))}
                <div className="mt-2 pt-2 border-t border-gray-100">
                  <p style={{ fontSize: 9, fontWeight: 700, color: '#374151', marginBottom: 4 }}>Visitas 30 días</p>
                  <AreaMini data={visits30} color={IND} h={36} />
                </div>
              </div>
            </div>

            {/* Recent visits table */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-gray-100">
                <p style={{ fontSize: 9, fontWeight: 700, color: '#374151' }}>Visitas recientes</p>
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg border border-gray-200 bg-gray-50">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" style={{ width: 10, height: 10 }}>
                    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                  </svg>
                  <span style={{ fontSize: 8, color: '#cbd5e1' }}>Buscar...</span>
                </div>
              </div>
              {/* Table header */}
              <div className="grid px-2.5 py-1 border-b border-gray-100"
                style={{ gridTemplateColumns: '2fr 1fr 1.2fr 0.8fr 0.5fr', gap: 4 }}>
                {['Socio','Código','Tipo','Hora',''].map((h, i) => (
                  <span key={i} style={{ fontSize: 7, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>{h}</span>
                ))}
              </div>
              {/* Rows */}
              {recent.map((v, i) => (
                <div key={i} className="grid border-b border-gray-50 last:border-0 px-2.5 items-center"
                  style={{ gridTemplateColumns: '2fr 1fr 1.2fr 0.8fr 0.5fr', height: 28, gap: 4 }}>
                  <div className="flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: `${IND}18`, fontSize: 7, fontWeight: 700, color: IND }}>
                      {v.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}
                    </div>
                    <span style={{ fontSize: 9, fontWeight: 600, color: '#374151', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.name}</span>
                  </div>
                  <span style={{ fontSize: 8, color: '#94a3b8', fontFamily: 'monospace' }}>{v.code}</span>
                  <span style={{ fontSize: 8, color: '#64748b' }}>{v.type}</span>
                  <span style={{ fontSize: 8, color: '#94a3b8' }}>{v.time}</span>
                  <div className="w-3 h-3 rounded-full" style={{ background: v.ok ? '#10b981' : '#ef4444' }} />
                </div>
              ))}
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// MEMBERSHIPS
// ══════════════════════════════════════════════════════════════════════════════
export function MembershipsCard() {
  const VIO2 = '#8B5CF6'
  const mems = [
    { name: 'Ana García',       type: 'Anual',       start: '01 Jun 25', end: '01 Jun 26', amount: '$9,600', method: 'Tarjeta',       status: 'active'    },
    { name: 'Carlos Mendoza',   type: 'Mensual',     start: '10 May 26', end: '10 Jun 26', amount: '$780',   method: 'Efectivo',      status: 'active'    },
    { name: 'Laura Pérez',      type: 'Trimestral',  start: '01 Mar 26', end: '01 Jun 26', amount: '$2,100', method: 'Transferencia', status: 'expired'   },
    { name: 'Diego Ramírez',    type: 'Semestral',   start: '01 Dec 25', end: '01 Jun 26', amount: '$3,900', method: 'Tarjeta',       status: 'active'    },
    { name: 'Sofía Torres',     type: 'Mensual',     start: '05 May 26', end: '05 Jun 26', amount: '$780',   method: 'Efectivo',      status: 'active'    },
    { name: 'Marco Villanueva', type: 'Mensual',     start: '01 Apr 26', end: '01 May 26', amount: '$780',   method: 'Tarjeta',       status: 'cancelled' },
    { name: 'Elena Fuentes',    type: 'Anual',       start: '15 Jul 25', end: '15 Jul 26', amount: '$9,600', method: 'Transferencia', status: 'active'    },
  ]
  const typeDat = [
    { label: 'Mensual',    count: 89, pct: 47, color: '#3b82f6' },
    { label: 'Trimestral', count: 54, pct: 29, color: IND       },
    { label: 'Semestral',  count: 28, pct: 15, color: VIO2      },
    { label: 'Anual',      count: 18, pct: 9,  color: '#a855f7' },
  ]
  const trend6 = [14, 18, 22, 19, 25, 28]
  const statusBadge = s =>
    s === 'active'    ? { bg: '#f0fdf4', color: '#15803d', label: 'Activa'    } :
    s === 'expired'   ? { bg: '#fef2f2', color: '#b91c1c', label: 'Vencida'   } :
                        { bg: '#f9fafb', color: '#6b7280', label: 'Cancelada' }
  const typeColor = t =>
    t === 'Anual'     ? '#a855f7' : t === 'Semestral' ? VIO2 :
    t === 'Trimestral'? IND       : '#3b82f6'

  return (
    <div className="flex w-full h-full" style={{ background: '#f8fafc' }}>
      <Sidebar active={4} />
      <div className="flex flex-col flex-1 min-w-0">
        <Topbar title="Membresías" />
        <div className="flex-1 overflow-hidden p-3" style={{ background: '#f8fafc' }}>
          <div className="grid grid-cols-4 gap-1.5 mb-2.5">
            {[['Total','189',IND],['Activas','156','#10b981'],['Vencidas','24','#ef4444'],['Canceladas','9','#94a3b8']].map(([label,value,color],i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 p-2.5 shadow-sm">
                <div className="w-5 h-5 rounded-lg mb-1" style={{ background: `${color}18` }} />
                <p style={{ fontSize: 8, color: '#94a3b8' }}>{label}</p>
                <p style={{ fontSize: 14, fontWeight: 800, color }}>{value}</p>
              </div>
            ))}
          </div>
          <div className="grid gap-1.5 mb-1.5" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-2.5">
              <p style={{ fontSize: 9, fontWeight: 700, color: '#374151', marginBottom: 6 }}>Por tipo de plan</p>
              {typeDat.map(t => (
                <div key={t.label} className="mb-1.5">
                  <div className="flex items-center justify-between mb-0.5">
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: t.color }} />
                      <span style={{ fontSize: 8, color: '#64748b' }}>{t.label}</span>
                    </div>
                    <span style={{ fontSize: 8, fontWeight: 700, color: '#374151' }}>{t.count}</span>
                  </div>
                  <div className="rounded-full" style={{ height: 3, background: '#f1f5f9' }}>
                    <div className="rounded-full" style={{ height: 3, width: `${t.pct}%`, background: t.color }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-2.5">
              <p style={{ fontSize: 9, fontWeight: 700, color: '#374151', marginBottom: 4 }}>Altas — 6 meses</p>
              <BarMini data={trend6} color={VIO2} h={52} highlight={5} />
              <div className="flex justify-between mt-0.5">
                {['Dic','Ene','Feb','Mar','Abr','May'].map(m => (
                  <span key={m} style={{ fontSize: 7, color: '#94a3b8', flex: 1, textAlign: 'center' }}>{m}</span>
                ))}
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-2.5 py-1.5 border-b border-gray-100">
              <div className="flex-1 flex items-center gap-1 bg-gray-50 rounded-lg px-2 py-1">
                <span style={{ fontSize: 8, color: '#cbd5e1' }}>Filtrar por estado...</span>
              </div>
              <div className="px-2 py-0.5 rounded-lg text-white" style={{ background: `linear-gradient(135deg,${IND},${VIO2})`, fontSize: 8, fontWeight: 700 }}>
                + Nueva membresía
              </div>
            </div>
            <div className="grid px-2.5 py-1 border-b border-gray-100"
              style={{ gridTemplateColumns: '1.8fr 1fr 0.9fr 0.9fr 0.8fr 0.8fr 0.8fr', gap: 2 }}>
              {['Miembro','Plan','Inicio','Vence','Monto','Método','Estado'].map(h => (
                <span key={h} style={{ fontSize: 7, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>{h}</span>
              ))}
            </div>
            {mems.map((m, i) => {
              const b = statusBadge(m.status)
              return (
                <div key={i} className="grid border-b border-gray-50 last:border-0 px-2.5 items-center"
                  style={{ gridTemplateColumns: '1.8fr 1fr 0.9fr 0.9fr 0.8fr 0.8fr 0.8fr', height: 26, gap: 2 }}>
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: `${IND}18`, fontSize: 6, fontWeight: 700, color: IND }}>
                      {m.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}
                    </div>
                    <span style={{ fontSize: 8, fontWeight: 600, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</span>
                  </div>
                  <span style={{ fontSize: 8, fontWeight: 600, color: typeColor(m.type) }}>{m.type}</span>
                  <span style={{ fontSize: 7, color: '#94a3b8' }}>{m.start}</span>
                  <span style={{ fontSize: 7, color: '#94a3b8' }}>{m.end}</span>
                  <span style={{ fontSize: 8, fontWeight: 700, color: '#10b981' }}>{m.amount}</span>
                  <span style={{ fontSize: 7, color: '#94a3b8' }}>{m.method}</span>
                  <span style={{ fontSize: 7, fontWeight: 600, padding: '1px 4px', borderRadius: 999, background: b.bg, color: b.color, display: 'inline-block', whiteSpace: 'nowrap' }}>
                    {b.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// TRAINERS
// ══════════════════════════════════════════════════════════════════════════════
export function TrainersCard() {
  const GRN = '#10b981'
  const trainers = [
    { name: 'Carlos López',    spec: 'Crossfit · Funcional',   email: 'carlos@gym.com',    status: 'active',   sessions: 142 },
    { name: 'María Sánchez',   spec: 'Yoga · Meditación',      email: 'maria@gym.com',     status: 'active',   sessions: 98  },
    { name: 'Roberto Cruz',    spec: 'Musculación · Nutrición', email: 'roberto@gym.com',   status: 'active',   sessions: 207 },
    { name: 'Valeria Reyes',   spec: 'Zumba · Aerobics',       email: 'valeria@gym.com',   status: 'active',   sessions: 65  },
    { name: 'Javier Morales',  spec: 'Boxeo · Cardio',         email: 'javier@gym.com',    status: 'inactive', sessions: 310 },
    { name: 'Patricia Luna',   spec: 'Pilates · Stretching',   email: 'patricia@gym.com',  status: 'active',   sessions: 41  },
  ]
  const gradients = [
    ['#34d399','#059669'],['#818cf8','#6366f1'],['#f97316','#ea580c'],
    ['#e879f9','#c026d3'],['#38bdf8','#0284c7'],['#4ade80','#16a34a'],
  ]
  return (
    <div className="flex w-full h-full" style={{ background: '#f8fafc' }}>
      <Sidebar active={5} />
      <div className="flex flex-col flex-1 min-w-0">
        <Topbar title="Entrenadores" />
        <div className="flex-1 overflow-hidden p-3" style={{ background: '#f8fafc' }}>
          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1 bg-white rounded-xl border border-gray-200 flex items-center gap-2 px-2.5 py-1.5 shadow-sm">
              <span style={{ fontSize: 9, color: '#cbd5e1' }}>Buscar por nombre o especialidad...</span>
            </div>
            <div className="px-2.5 py-1.5 rounded-xl text-white shadow-sm"
              style={{ background: `linear-gradient(135deg,${IND},${VIO})`, fontSize: 8, fontWeight: 700 }}>
              + Nuevo entrenador
            </div>
          </div>
          <div className="flex items-center gap-2 mb-3">
            {[['6 registrados','#64748b','#f1f5f9'],['5 activos',GRN,'#f0fdf4'],['1 inactivo','#94a3b8','#f9fafb']].map(([label,color,bg]) => (
              <span key={label} style={{ fontSize: 8, fontWeight: 600, color, background: bg, padding: '2px 8px', borderRadius: 999 }}>{label}</span>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {trainers.map((t, i) => {
              const [c1, c2] = gradients[i]
              return (
                <div key={i} className="bg-white rounded-xl border border-gray-100 shadow-sm p-2.5">
                  <div className="flex items-start gap-2 mb-2">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-white text-xs font-bold"
                      style={{ background: `linear-gradient(135deg,${c1},${c2})` }}>
                      {t.name.split(' ').map(w=>w[0]).join('').slice(0,2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p style={{ fontSize: 9, fontWeight: 700, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</p>
                      <p style={{ fontSize: 7.5, color: GRN, fontWeight: 600, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.spec}</p>
                    </div>
                  </div>
                  <p style={{ fontSize: 7.5, color: '#94a3b8', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.email}</p>
                  <div className="flex items-center justify-between mb-2">
                    <span style={{ fontSize: 7, fontWeight: 600, padding: '1px 5px', borderRadius: 999, background: t.status === 'active' ? '#f0fdf4' : '#f9fafb', color: t.status === 'active' ? '#15803d' : '#94a3b8' }}>
                      {t.status === 'active' ? 'Activo' : 'Inactivo'}
                    </span>
                    <span style={{ fontSize: 7, color: '#94a3b8' }}>{t.sessions} sesiones</span>
                  </div>
                  <div className="flex gap-1.5 pt-2 border-t border-gray-50">
                    <div className="flex-1 text-center py-0.5 rounded-lg border border-gray-200" style={{ fontSize: 7.5, color: '#64748b', fontWeight: 600 }}>Editar</div>
                    <div className="flex-1 text-center py-0.5 rounded-lg border border-red-100 bg-red-50" style={{ fontSize: 7.5, color: '#ef4444', fontWeight: 600 }}>Eliminar</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// CLASSES
// ══════════════════════════════════════════════════════════════════════════════
export function ClassesCard() {
  const classes = [
    { name: 'CrossFit Intensivo',  trainer: 'Carlos López',  diff: 'advanced',     desc: 'Entrenamiento funcional de alta intensidad con movimientos variados.', cap: 15, dur: 60, schedules: [{ day: 'Lunes',      time: '07:00–08:00', room: 'Sala A' },{ day: 'Miércoles', time: '07:00–08:00', room: 'Sala A' }] },
    { name: 'Yoga & Meditación',   trainer: 'María Sánchez', diff: 'beginner',     desc: 'Sesión de yoga suave con enfoque en respiración y mindfulness.',        cap: 20, dur: 75, schedules: [{ day: 'Martes',     time: '09:00–10:15', room: 'Sala B' },{ day: 'Jueves',    time: '09:00–10:15', room: 'Sala B' }] },
    { name: 'Musculación Avanzada',trainer: 'Roberto Cruz',  diff: 'advanced',     desc: 'Programa de hipertrofia para atletas con experiencia en pesas.',         cap: 12, dur: 90, schedules: [{ day: 'Lunes',      time: '18:00–19:30', room: 'Pesas'  },{ day: 'Viernes',   time: '18:00–19:30', room: 'Pesas'  }] },
    { name: 'Zumba Fit',           trainer: 'Valeria Reyes', diff: 'intermediate', desc: 'Clase de baile aeróbico al ritmo de música latina y pop.',               cap: 25, dur: 50, schedules: [{ day: 'Miércoles', time: '19:00–19:50', room: 'Sala C' }] },
    { name: 'Boxeo Cardio',        trainer: 'Javier Morales',diff: 'intermediate', desc: 'Técnicas de boxeo combinadas con circuitos de cardio explosivo.',        cap: 16, dur: 60, schedules: [{ day: 'Martes',     time: '17:00–18:00', room: 'Ring'   },{ day: 'Sábado',    time: '10:00–11:00', room: 'Ring'   }] },
    { name: 'Pilates Core',        trainer: 'Patricia Luna', diff: 'beginner',     desc: 'Fortalecimiento del core y mejora de postura con técnica Pilates.',      cap: 18, dur: 55, schedules: [{ day: 'Jueves',     time: '08:00–08:55', room: 'Sala B' },{ day: 'Sábado',    time: '08:00–08:55', room: 'Sala B' }] },
  ]
  const diffStyle = d =>
    d === 'advanced'     ? { bg: '#fef2f2', color: '#b91c1c', label: 'Avanzado'     } :
    d === 'intermediate' ? { bg: '#fffbeb', color: '#b45309', label: 'Intermedio'   } :
                           { bg: '#f0fdf4', color: '#15803d', label: 'Principiante' }
  return (
    <div className="flex w-full h-full" style={{ background: '#f8fafc' }}>
      <Sidebar active={6} />
      <div className="flex flex-col flex-1 min-w-0">
        <Topbar title="Clases" />
        <div className="flex-1 overflow-hidden p-3" style={{ background: '#f8fafc' }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#1e293b' }}>Clases disponibles</p>
              <p style={{ fontSize: 8, color: '#94a3b8' }}>6 clases · 12 horarios activos</p>
            </div>
            <div className="px-2.5 py-1.5 rounded-xl text-white shadow-sm"
              style={{ background: `linear-gradient(135deg,${IND},${VIO})`, fontSize: 8, fontWeight: 700 }}>
              + Nueva clase
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {classes.map((c, i) => {
              const d = diffStyle(c.diff)
              return (
                <div key={i} className="bg-white rounded-xl border border-gray-100 shadow-sm p-2.5 flex flex-col">
                  <div className="flex items-start justify-between gap-1 mb-1.5">
                    <p style={{ fontSize: 9, fontWeight: 700, color: '#1e293b', lineHeight: 1.2 }}>{c.name}</p>
                    <span style={{ fontSize: 6.5, fontWeight: 700, padding: '1px 4px', borderRadius: 999, background: d.bg, color: d.color, flexShrink: 0 }}>
                      {d.label}
                    </span>
                  </div>
                  <p style={{ fontSize: 7.5, color: IND, fontWeight: 600, marginBottom: 3 }}>{c.trainer}</p>
                  <p style={{ fontSize: 7, color: '#94a3b8', lineHeight: 1.4, marginBottom: 5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {c.desc}
                  </p>
                  <div className="flex items-center gap-3 mb-2">
                    <span style={{ fontSize: 7.5, color: '#64748b' }} className="inline-flex items-center gap-0.5"><Users style={{ width: 8, height: 8 }} /> {c.cap}</span>
                    <span style={{ fontSize: 7.5, color: '#64748b' }} className="inline-flex items-center gap-0.5"><Clock style={{ width: 8, height: 8 }} /> {c.dur} min</span>
                  </div>
                  <div className="flex-1 pt-2 border-t border-gray-50">
                    <p style={{ fontSize: 6.5, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 3 }}>Horarios</p>
                    {c.schedules.map((s, j) => (
                      <div key={j} className="flex items-center gap-1 mb-1">
                        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: IND }} />
                        <span style={{ fontSize: 7, color: '#374151', fontWeight: 600 }}>{s.day}</span>
                        <span style={{ fontSize: 6.5, color: '#94a3b8' }}>{s.time}</span>
                        <span style={{ fontSize: 6.5, color: '#c7d2fe', marginLeft: 'auto' }}>{s.room}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-1.5 mt-2 pt-2 border-t border-gray-50">
                    <div className="flex-1 text-center py-0.5 rounded-lg border border-gray-200" style={{ fontSize: 7.5, color: '#64748b', fontWeight: 600 }}>Editar</div>
                    <div className="flex-1 text-center py-0.5 rounded-lg border border-red-100 bg-red-50" style={{ fontSize: 7.5, color: '#ef4444', fontWeight: 600 }}>Eliminar</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
