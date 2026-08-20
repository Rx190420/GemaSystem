import { useQuery } from '@tanstack/react-query'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  Users, Clock, DollarSign, Dumbbell, TrendingUp, TrendingDown,
  AlertCircle, Loader2, Eye, EyeOff, Cake, Wallet,
  CreditCard, Award, ChevronRight, Smile, Banknote, ArrowRightLeft, UserX, Activity,
} from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useSettingsStore } from '../store/settingsStore'
import ActivityGraph from '../components/ActivityGraph'
import { Panel, PanelHeader, FixedPanel, EmptyState } from '../components/Panel'
import MembershipTypeBadge from '../components/MembershipTypeBadge'
import useMembershipTypeColors from '../hooks/useMembershipTypeColors'
import api from '../api/axios'

const TYPE_COLORS  = { basic: '#6366F1', premium: '#8B5CF6', vip: '#F59E0B' }
const TYPE_LABELS  = { basic: 'Básica', premium: 'Premium', vip: 'VIP' }
const VISIT_LABELS = { training: 'Entrenamiento', class: 'Clase', consultation: 'Consulta', other: 'Otro' }
const MONTH_NAMES  = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const METHOD_LABELS = { cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia' }
const METHOD_ICONS  = { cash: Banknote, card: CreditCard, transfer: ArrowRightLeft }
const METHOD_COLORS = { cash: '#10B981', card: '#6366F1', transfer: '#F59E0B' }

function fmt(val) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(val ?? 0)
}
function fmtDate(str) {
  return new Date(str).toLocaleDateString('es-MX', { month: 'short', day: 'numeric' })
}
function pct(a, b) {
  if (!b || b === 0) return null
  return ((a - b) / b) * 100
}

/* ── Stat Card ─────────────────────────────────────────────────── */
const ACCENTS = {
  violet: '#8B5CF6',
  indigo: '#6366F1',
  green:  '#10B981',
  amber:  '#F59E0B',
  red:    '#EF4444',
  cyan:   '#06B6D4',
}

function StatCard({ icon: Icon, title, value, sub, sub2, change, accent = 'violet' }) {
  const color = ACCENTS[accent] ?? ACCENTS.violet
  const chg = change !== null && change !== undefined
  return (
    <div className="card p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{
            background: `color-mix(in srgb, ${color} 12%, transparent)`,
            border: `1px solid color-mix(in srgb, ${color} 20%, transparent)`,
          }}
        >
          <Icon style={{ width: 18, height: 18, color }} />
        </div>
        {chg && (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full"
            style={{
              fontSize: '10px', fontWeight: 600,
              background: change >= 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
              color: change >= 0 ? '#10B981' : '#EF4444',
              border: change >= 0 ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(239,68,68,0.2)',
            }}
          >
            {change >= 0
              ? <TrendingUp style={{ width: 10, height: 10 }} />
              : <TrendingDown style={{ width: 10, height: 10 }} />
            }
            {change >= 0 ? '+' : ''}{change.toFixed(1)}%
          </span>
        )}
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1">{title}</p>
        <p className="text-2xl font-bold text-gray-900 tabular-nums leading-tight">{value}</p>
        {sub  && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
        {sub2 && <p className="text-xs text-gray-500">{sub2}</p>}
      </div>
    </div>
  )
}

/* ── Chart theme ── */
const axisStyle = { tick: { fontSize: 10, fill: '#94A3B8', fontFamily: 'Sora' }, tickLine: false, axisLine: false }
const tipStyle  = {
  contentStyle: {
    background: 'var(--surface-2, #fff)',
    border: '1px solid var(--surface-border2, rgba(0,0,0,0.1))',
    borderRadius: '12px',
    fontSize: '12px',
    color: 'var(--text-primary, #0f172a)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
    fontFamily: 'Sora',
  },
  cursor: { stroke: 'rgba(139,92,246,0.15)', strokeWidth: 1 },
}

/* ══════════════════════════════════════════════════════════════════ */
export default function Dashboard() {
  const navigate = useNavigate()
  const { hash } = useParams()
  const { user } = useAuthStore()
  const { privacyMode, togglePrivacy } = useSettingsStore()
  const mask = val => privacyMode ? '••••' : val

  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => api.get('/dashboard/stats').then(r => r.data),
    refetchInterval: 60_000,
  })
  const typeColors = useMembershipTypeColors()

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--color-primary-500)' }} />
    </div>
  )

  if (isError) return (
    <div className="flex flex-col items-center justify-center h-64 text-gray-500 gap-2">
      <AlertCircle className="w-10 h-10 text-red-400" />
      <p>No se pudo cargar el dashboard</p>
    </div>
  )

  const {
    stats, recent_visits, visits_by_day, members_by_type,
    revenue_by_month, top_visitors, upcoming_birthdays, revenue_by_method,
    at_risk_members,
  } = data

  const revenueData = (revenue_by_month ?? []).map(r => ({ name: MONTH_NAMES[r.month - 1], total: parseFloat(r.total) }))
  const visitsData  = (visits_by_day ?? []).map(v => ({ date: fmtDate(v.date), total: v.count }))
  const pieData     = (members_by_type ?? []).map(m => ({
    name: TYPE_LABELS[m.membership_type] ?? m.membership_type,
    value: m.count,
    fill: typeColors[m.membership_type] || TYPE_COLORS[m.membership_type] || '#94A3B8',
  }))
  const methodData  = revenue_by_method ?? []
  const methodTotal = methodData.reduce((s, x) => s + x.total, 0)

  const revChange = pct(stats.month_revenue,     stats.last_month_revenue)
  const visChange = pct(stats.month_visits,      stats.last_month_visits)
  const memChange = pct(stats.new_members_month, stats.new_members_last)

  return (
    <div className="space-y-6">

      {/* ── Welcome ── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            Hola, {user?.username}
            <Smile className="w-5 h-5" style={{ color: 'var(--color-primary-500)' }} />
          </h2>
          <p className="text-gray-500 text-sm mt-0.5">
            {new Date().toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <button onClick={togglePrivacy} className="btn-secondary self-start flex items-center gap-2 text-sm">
          {privacyMode ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          {privacyMode ? 'Mostrar cifras' : 'Ocultar cifras'}
        </button>
      </div>

      {/* ── KPI row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard icon={Users}       accent="violet" title="Miembros activos"   value={mask(stats.active_members)}     sub={`${mask(stats.total_members)} total`}            sub2={`+${mask(stats.new_members_month)} nuevos`} change={!privacyMode ? memChange : undefined} />
        <StatCard icon={Clock}       accent="green"  title="Visitas hoy"        value={mask(stats.today_visits)}       sub={`${mask(stats.week_visits)} esta semana`}        sub2={`${mask(stats.month_visits)} este mes`}    change={!privacyMode ? visChange : undefined} />
        <StatCard icon={DollarSign}  accent="amber"  title="Ingresos del mes"   value={mask(fmt(stats.month_revenue))} sub={`${mask(fmt(stats.week_revenue))} semana`}       sub2={`${mask(fmt(stats.year_revenue))} año`}    change={!privacyMode ? revChange : undefined} />
        <StatCard icon={CreditCard}  accent="indigo" title="Membresías activas" value={mask(stats.active_memberships)} sub={`${mask(stats.expiring_soon)} vencen en 7 días`} />
        <StatCard icon={AlertCircle} accent="red"    title="Vencen pronto"      value={mask(stats.expiring_soon)}      sub="próximos 7 días" />
        <StatCard icon={Dumbbell}    accent="cyan"   title="Entrenadores"       value={mask(stats.active_trainers)}    sub="activos" />
      </div>

      {/* ── Ingresos 6 meses + Tipo de membresía, mismo tamaño ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

        <FixedPanel height={300}>
          <PanelHeader
            title="Ingresos últimos 6 meses"
            badge={!privacyMode && stats.last_month_revenue > 0 && (
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${revChange >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                {revChange >= 0 ? '↑' : '↓'}{Math.abs(revChange ?? 0).toFixed(1)}% vs anterior
              </span>
            )}
          />
          {revenueData.length > 0 ? (
            <div className="flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueData} margin={{ top: 5, right: 5, bottom: 0, left: -16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-border, rgba(0,0,0,0.06))" vertical={false} />
                  <XAxis dataKey="name" {...axisStyle} />
                  <YAxis {...axisStyle} tickFormatter={v => privacyMode ? '••' : `$${(v/1000).toFixed(0)}k`} />
                  <Tooltip {...tipStyle} formatter={v => [privacyMode ? '••••' : fmt(v), 'Ingresos']} />
                  <Bar dataKey="total" fill="var(--color-primary-500)" radius={[6,6,0,0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState icon={DollarSign} text="Sin datos de ingresos" />
          )}
        </FixedPanel>

        <FixedPanel height={300}>
          <PanelHeader title="Tipo de membresía" />
          {pieData.length > 0 ? (
            <div className="flex-1 flex flex-col justify-center">
              <ResponsiveContainer width="100%" height={150}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={42} outerRadius={65} paddingAngle={3} dataKey="value" strokeWidth={0}>
                    {pieData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                  </Pie>
                  <Tooltip {...tipStyle} />
                </PieChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {pieData.map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: item.fill }} />
                      <span className="text-gray-600 truncate">{item.name}</span>
                    </div>
                    <span className="font-semibold text-gray-700 tabular-nums">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <EmptyState icon={CreditCard} text="Sin datos" />
          )}
        </FixedPanel>
      </div>

      {/* ── Visitas 30 días — a lo ancho ── */}
      <Panel>
        <PanelHeader
          title="Visitas — últimos 30 días"
          badge={
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
              {stats.month_visits} este mes
            </span>
          }
        />
        {visitsData.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={visitsData} margin={{ top: 5, right: 5, bottom: 0, left: -16 }}>
              <defs>
                <linearGradient id="vGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="var(--color-primary-500)" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="var(--color-primary-500)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-border, rgba(0,0,0,0.06))" vertical={false} />
              <XAxis dataKey="date" {...axisStyle} />
              <YAxis {...axisStyle} allowDecimals={false} />
              <Tooltip {...tipStyle} formatter={v => [v, 'Visitas']} />
              <Area type="monotone" dataKey="total" stroke="var(--color-primary-500)" strokeWidth={2} fill="url(#vGrad)" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-48 text-gray-500 text-sm">Sin datos de visitas</div>
        )}
      </Panel>

      {/* ── Actividad del gimnasio (mapa de calor) + Miembros sin visitar, en mitades ── */}
      {/* Sin fixed height (el mapa de calor necesita su tamaño natural), pero
          sin items-start: el grid estira ambas tarjetas a la misma altura y
          la lista de la derecha usa flex-1 + scroll interno para llenarla. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        <Panel className="h-full flex flex-col">
          <ActivityGraph endpoint="/visits/activity" title="Actividad del gimnasio" icon={Activity} views={['month', 'year']} />
        </Panel>

        <Panel className="h-full flex flex-col">
          <PanelHeader
            title="Miembros sin visitar"
            badge={(at_risk_members ?? []).length > 0 && (
              <span className="text-xs font-medium bg-red-50 text-red-600 px-2 py-0.5 rounded-full">
                14+ días
              </span>
            )}
          />
          {(at_risk_members ?? []).length === 0 ? (
            <EmptyState icon={UserX} text="Todos tus socios activos han venido recientemente" />
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto pr-1 -mr-1 space-y-2.5">
              {at_risk_members.map((m, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2.5 cursor-pointer hover:bg-gray-50 -mx-2 px-2 py-1.5 rounded-xl transition-colors"
                  onClick={() => navigate(`/members/${m.id}`)}
                >
                  <div className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center text-red-600 text-xs font-bold flex-shrink-0">
                    {m.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-800 truncate">{m.name}</p>
                    <MembershipTypeBadge type={m.membership_type} />
                  </div>
                  <span className="text-xs font-bold tabular-nums flex-shrink-0 text-red-500">
                    {m.days_since === null ? 'nunca' : `${m.days_since}d`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>


      {/* ── Visitas recientes + Top visitantes — mismo tamaño, con o sin datos ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

        <FixedPanel>
          <PanelHeader
            title="Visitas recientes"
            action={
              <button
                onClick={() => navigate(`/g/${hash}/visitas`)}
                className="text-xs font-semibold flex items-center gap-0.5 transition-colors hover:opacity-75"
                style={{ color: 'var(--color-primary-600)' }}
              >
                Ver todas <ChevronRight className="w-3 h-3" />
              </button>
            }
          />
          {recent_visits.length === 0 ? (
            <EmptyState icon={Clock} text="No hay visitas recientes" />
          ) : (
            <div className="flex-1 overflow-y-auto pr-1 -mr-1 space-y-2.5">
              {recent_visits.map(visit => (
                <div key={visit.id} className="flex items-center gap-2.5">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{
                      background: 'color-mix(in srgb, var(--color-primary-500) 10%, transparent)',
                      color: 'var(--color-primary-600)',
                    }}
                  >
                    {(visit.member ?? '?').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-800 truncate">{visit.member ?? 'Desconocido'}</p>
                    <p className="text-xs text-gray-500">
                      {VISIT_LABELS[visit.visit_type] ?? visit.visit_type}
                      {' · '}
                      {new Date(visit.visit_date).toLocaleString('es-MX', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  {visit.price > 0 && (
                    <span className="text-xs font-bold text-emerald-600 flex-shrink-0 tabular-nums">
                      {mask(fmt(visit.price))}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </FixedPanel>

        <FixedPanel>
          <PanelHeader title="Top visitantes del mes" action={<Award className="w-4 h-4 text-amber-400" />} />
          {(top_visitors ?? []).length === 0 ? (
            <EmptyState icon={Award} text="Sin visitas este mes" />
          ) : (
            <div className="flex-1 overflow-y-auto pr-1 -mr-1 space-y-3">
              {top_visitors.map((v, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0
                    ${i === 0 ? 'bg-amber-50 text-amber-600' : i === 1 ? 'bg-gray-100 text-gray-700' : 'bg-orange-50 text-orange-500'}`}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-800 truncate">{v.member}</p>
                    <MembershipTypeBadge type={v.membership_type} />
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-bold tabular-nums" style={{ color: 'var(--color-primary-600)' }}>{v.visits}</p>
                    <p className="text-xs text-gray-400">visitas</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </FixedPanel>
      </div>

      {/* ── Cumpleaños próximos + Ingresos por método — mismo tamaño que la fila anterior ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

        <FixedPanel>
          <PanelHeader title="Cumpleaños próximos" action={<Cake className="w-4 h-4 text-pink-400" />} />
          {(upcoming_birthdays ?? []).length === 0 ? (
            <EmptyState icon={Cake} text="Sin cumpleaños en los próximos 30 días" />
          ) : (
            <div className="flex-1 overflow-y-auto pr-1 -mr-1 space-y-2.5">
              {upcoming_birthdays.map((b, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2.5 cursor-pointer hover:bg-gray-50 -mx-2 px-2 py-1.5 rounded-xl transition-colors"
                  onClick={() => navigate(`/members/${b.id}`)}
                >
                  <div className="w-7 h-7 rounded-lg bg-pink-50 flex items-center justify-center text-pink-600 text-xs font-bold flex-shrink-0">
                    {b.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-800 truncate">{b.name}</p>
                    <p className="text-xs text-gray-400">Cumple {b.turning} años</p>
                  </div>
                  <span className="text-xs font-bold tabular-nums flex-shrink-0 text-pink-500">
                    {b.days_until === 0 ? 'hoy' : b.days_until === 1 ? '1 día' : `${b.days_until}d`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </FixedPanel>

        <FixedPanel>
          <PanelHeader
            title="Ingresos por método de pago"
            badge={<span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">este mes</span>}
          />
          {methodData.length === 0 ? (
            <EmptyState icon={Wallet} text="Sin ingresos registrados este mes" />
          ) : (
            <div className="flex-1 overflow-y-auto pr-1 -mr-1 space-y-3.5">
              {methodData.map((r, i) => {
                const Icon = METHOD_ICONS[r.method] ?? Wallet
                const share = methodTotal > 0 ? (r.total / methodTotal) * 100 : 0
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <div className="flex items-center gap-2">
                        <Icon className="w-3.5 h-3.5" style={{ color: METHOD_COLORS[r.method] ?? '#94A3B8' }} />
                        <span className="text-gray-600">{METHOD_LABELS[r.method] ?? r.method}</span>
                      </div>
                      <span className="font-semibold text-gray-700 tabular-nums">{mask(fmt(r.total))}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-1.5 rounded-full transition-all duration-500"
                        style={{ width: `${share}%`, background: METHOD_COLORS[r.method] ?? '#94A3B8' }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </FixedPanel>
      </div>
    </div>
  )
}
