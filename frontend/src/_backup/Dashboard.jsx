import { useQuery } from '@tanstack/react-query'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  Users, Clock, DollarSign, Dumbbell, TrendingUp, TrendingDown,
  AlertCircle, Loader2, Eye, EyeOff, Calendar, UserCheck,
  CreditCard, Award, Activity, ChevronRight, Smile,
} from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useSettingsStore } from '../store/settingsStore'
import api from '../api/axios'

const COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6']
const TYPE_COLORS  = { basic: '#3B82F6', premium: '#8B5CF6', vip: '#F59E0B' }
const TYPE_LABELS  = { basic: 'Básica', premium: 'Premium', vip: 'VIP' }
const VISIT_LABELS = { training: 'Entrenamiento', class: 'Clase', consultation: 'Consulta', other: 'Otro' }
const VISIT_COLORS_MAP = { training: '#6366F1', class: '#8B5CF6', consultation: '#3B82F6', other: '#94A3B8' }
const STATUS_COLORS = { active: '#10B981', expired: '#EF4444', cancelled: '#94A3B8' }
const STATUS_LABELS = { active: 'Activas', expired: 'Vencidas', cancelled: 'Canceladas' }

const MONTH_NAMES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

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

// ── Stat Card ────────────────────────────────────────────────────
function StatCard({ icon: Icon, title, value, sub, sub2, change, color = 'indigo' }) {
  const palette = {
    indigo:  'from-indigo-500 to-indigo-600',
    green:   'from-emerald-500 to-emerald-600',
    amber:   'from-amber-500 to-amber-600',
    red:     'from-red-500 to-red-600',
    violet:  'from-violet-500 to-violet-600',
    blue:    'from-blue-500 to-blue-600',
  }
  const chg = change !== null && change !== undefined
  return (
    <div className="card p-5 flex items-start gap-4">
      <div className={`p-3 rounded-xl bg-gradient-to-br ${palette[color] ?? palette.indigo} shadow-lg flex-shrink-0`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{title}</p>
        <p className="text-2xl font-bold text-gray-900 mt-0.5 tabular-nums">{value}</p>
        {sub  && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        {sub2 && <p className="text-xs text-gray-400">{sub2}</p>}
        {chg && (
          <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${change >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {change >= 0 ? '+' : ''}{change.toFixed(1)}% vs mes anterior
          </div>
        )}
      </div>
    </div>
  )
}

// ── Mini badge ───────────────────────────────────────────────────
function TypeBadge({ type }) {
  const colors = { basic: 'bg-blue-50 text-blue-700', premium: 'bg-violet-50 text-violet-700', vip: 'bg-amber-50 text-amber-700' }
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${colors[type] ?? 'bg-gray-100 text-gray-600'}`}>
      {TYPE_LABELS[type] ?? type}
    </span>
  )
}

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

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
    </div>
  )

  if (isError) return (
    <div className="flex flex-col items-center justify-center h-64 text-gray-500">
      <AlertCircle className="w-10 h-10 text-red-400 mb-2" />
      <p>No se pudo cargar el dashboard</p>
    </div>
  )

  const {
    stats,
    recent_visits,
    visits_by_day,
    members_by_type,
    revenue_by_month,
    expiring_members,
    top_visitors,
    visits_by_type_today,
    visits_by_type_month,
    memberships_by_status,
  } = data

  const revenueData = (revenue_by_month ?? []).map(r => ({
    name:  MONTH_NAMES[r.month - 1],
    total: parseFloat(r.total),
  }))

  const visitsData = (visits_by_day ?? []).map(v => ({
    date:  fmtDate(v.date),
    total: v.count,
  }))

  const pieData = (members_by_type ?? []).map(m => ({
    name:  TYPE_LABELS[m.membership_type] ?? m.membership_type,
    value: m.count,
    fill:  TYPE_COLORS[m.membership_type] ?? '#94A3B8',
  }))

  const visitTypesTodayData = (visits_by_type_today ?? []).map(v => ({
    name:  VISIT_LABELS[v.type] ?? v.type,
    count: v.count,
    fill:  VISIT_COLORS_MAP[v.type] ?? '#94A3B8',
  }))

  const visitTypesMonthData = (visits_by_type_month ?? []).map(v => ({
    name:  VISIT_LABELS[v.type] ?? v.type,
    count: v.count,
    fill:  VISIT_COLORS_MAP[v.type] ?? '#94A3B8',
  }))

  const membershipStatusData = (memberships_by_status ?? []).map(m => ({
    name:  STATUS_LABELS[m.status] ?? m.status,
    count: m.count,
    fill:  STATUS_COLORS[m.status] ?? '#94A3B8',
  }))

  const revChange = pct(stats.month_revenue, stats.last_month_revenue)
  const visChange = pct(stats.month_visits,  stats.last_month_visits)
  const memChange = pct(stats.new_members_month, stats.new_members_last)

  const axisProps = { tick: { fontSize: 11, fill: '#94A3B8' }, tickLine: false, axisLine: false }
  const tipStyle  = { contentStyle: { borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '12px' } }

  return (
    <div className="space-y-6">

      {/* ── Welcome ── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            Hola, {user?.username} <Smile className="w-5 h-5 inline-block align-text-bottom text-indigo-400" />
          </h2>
          <p className="text-gray-500 text-sm mt-0.5">
            {new Date().toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <button onClick={togglePrivacy} className="btn-secondary self-start flex items-center gap-2 text-sm">
          {privacyMode ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          {privacyMode ? 'Mostrar números' : 'Ocultar números'}
        </button>
      </div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          icon={Users} color="indigo" title="Miembros activos"
          value={mask(stats.active_members)}
          sub={`${mask(stats.total_members)} total`}
          sub2={`+${mask(stats.new_members_month)} nuevos este mes`}
          change={!privacyMode ? memChange : undefined}
        />
        <StatCard
          icon={Clock} color="green" title="Visitas hoy"
          value={mask(stats.today_visits)}
          sub={`${mask(stats.week_visits)} esta semana`}
          sub2={`${mask(stats.month_visits)} este mes`}
          change={!privacyMode ? visChange : undefined}
        />
        <StatCard
          icon={DollarSign} color="amber" title="Ingresos del mes"
          value={mask(fmt(stats.month_revenue))}
          sub={`${mask(fmt(stats.week_revenue))} esta semana`}
          sub2={`${mask(fmt(stats.year_revenue))} este año`}
          change={!privacyMode ? revChange : undefined}
        />
        <StatCard
          icon={CreditCard} color="violet" title="Membresías activas"
          value={mask(stats.active_memberships)}
          sub={`${mask(stats.expiring_soon)} vencen en 7 días`}
        />
        <StatCard
          icon={AlertCircle} color="red" title="Vencen pronto"
          value={mask(stats.expiring_soon)}
          sub="próximos 7 días"
        />
        <StatCard
          icon={Dumbbell} color="blue" title="Entrenadores"
          value={mask(stats.active_trainers)}
          sub="activos"
        />
      </div>

      {/* ── Charts row 1 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Visits area */}
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700">Visitas — últimos 30 días</h3>
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
              {stats.month_visits} este mes
            </span>
          </div>
          {visitsData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={visitsData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                <defs>
                  <linearGradient id="visitGradD" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#6366F1" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="date" {...axisProps} />
                <YAxis {...axisProps} allowDecimals={false} />
                <Tooltip {...tipStyle} formatter={v => [v, 'Visitas']} />
                <Area type="monotone" dataKey="total" stroke="#6366F1" strokeWidth={2} fill="url(#visitGradD)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-48 text-gray-400 text-sm">No hay datos de visitas</div>
          )}
        </div>

        {/* Member types pie + visit types today */}
        <div className="space-y-4">
          {/* Pie */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Tipo de membresía</h3>
            {pieData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={110}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={32} outerRadius={50} paddingAngle={3} dataKey="value">
                      {pieData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                    </Pie>
                    <Tooltip {...tipStyle} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5 mt-1">
                  {pieData.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: item.fill }} />
                        <span className="text-gray-600">{item.name}</span>
                      </div>
                      <span className="font-semibold text-gray-800">{item.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-24 text-gray-400 text-sm">Sin datos</div>
            )}
          </div>

          {/* Visit types today */}
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Tipos de visita hoy</h3>
            {visitTypesTodayData.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-3">Sin visitas hoy</p>
            ) : (
              <div className="space-y-2">
                {visitTypesTodayData.map((d, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.fill }} />
                    <span className="text-gray-600 flex-1">{d.name}</span>
                    <span className="font-semibold text-gray-800 tabular-nums">{d.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* ── Charts row 2: Revenue + Expiring ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* Revenue bar */}
        <div className="card p-5 lg:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700">Ingresos últimos 6 meses</h3>
            {!privacyMode && stats.last_month_revenue > 0 && (
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${revChange >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                {revChange >= 0 ? '↑' : '↓'}{Math.abs(revChange ?? 0).toFixed(1)}% vs mes anterior
              </span>
            )}
          </div>
          {revenueData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={revenueData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="name" {...axisProps} />
                <YAxis {...axisProps} tickFormatter={v => privacyMode ? '••' : `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip {...tipStyle} formatter={v => [privacyMode ? '••••' : fmt(v), 'Ingresos']} />
                <Bar dataKey="total" fill="#6366F1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-48 text-gray-400 text-sm">Sin datos de ingresos</div>
          )}
        </div>

        {/* Expiring members */}
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">Membresías por vencer</h3>
            {stats.expiring_soon > 0 && (
              <span className="text-xs font-medium bg-red-50 text-red-600 px-2 py-0.5 rounded-full">
                {stats.expiring_soon} en 7 días
              </span>
            )}
          </div>
          {(expiring_members ?? []).length === 0 ? (
            <div className="flex flex-col items-center justify-center h-36 text-gray-400">
              <UserCheck className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-xs">Sin vencimientos próximos</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {expiring_members.map((m, i) => {
                const daysLeft = Math.ceil((new Date(m.membership_end) - new Date()) / 86400000)
                return (
                  <div key={i}
                    className="flex items-center gap-2.5 cursor-pointer hover:bg-gray-50 -mx-2 px-2 py-1 rounded-lg transition-colors"
                    onClick={() => navigate(`/members/${m.id}`)}
                  >
                    <div className="w-7 h-7 rounded-full bg-red-100 flex items-center justify-center text-red-700 text-xs font-bold flex-shrink-0">
                      {m.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-800 truncate">{m.name}</p>
                      <TypeBadge type={m.membership_type} />
                    </div>
                    <span className={`text-xs font-semibold tabular-nums flex-shrink-0 ${daysLeft <= 2 ? 'text-red-600' : 'text-amber-600'}`}>
                      {daysLeft === 0 ? 'hoy' : daysLeft === 1 ? '1 día' : `${daysLeft} días`}
                    </span>
                  </div>
                )
              })}
              {stats.expiring_soon > (expiring_members?.length ?? 0) && (
                <p className="text-xs text-gray-400 text-center pt-1">
                  +{stats.expiring_soon - expiring_members.length} más...
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Row 3: More data ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Top visitors */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">Top visitantes del mes</h3>
            <Award className="w-4 h-4 text-amber-400" />
          </div>
          {(top_visitors ?? []).length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-6">Sin visitas este mes</p>
          ) : (
            <div className="space-y-3">
              {top_visitors.map((v, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0
                    ${i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-gray-100 text-gray-600' : 'bg-orange-50 text-orange-600'}`}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-800 truncate">{v.member}</p>
                    <TypeBadge type={v.membership_type} />
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-bold text-indigo-700 tabular-nums">{v.visits}</p>
                    <p className="text-xs text-gray-400">visitas</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Visit types this month + memberships status */}
        <div className="space-y-4">
          {/* Visit types month */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Visitas este mes — por tipo</h3>
            {visitTypesMonthData.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">Sin datos</p>
            ) : (
              <div className="space-y-2.5">
                {visitTypesMonthData.sort((a, b) => b.count - a.count).map((d, i) => {
                  const total = visitTypesMonthData.reduce((s, x) => s + x.count, 0)
                  return (
                    <div key={i}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ background: d.fill }} />
                          <span className="text-gray-600">{d.name}</span>
                        </div>
                        <span className="font-semibold text-gray-800">{d.count}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div className="h-1.5 rounded-full" style={{ width: `${(d.count / total) * 100}%`, background: d.fill }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Memberships by status */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Estado de membresías</h3>
            {membershipStatusData.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">Sin datos</p>
            ) : (
              <div className="space-y-2">
                {membershipStatusData.map((d, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: d.fill }} />
                      <span className="text-gray-600">{d.name}</span>
                    </div>
                    <span className="font-semibold text-gray-800 tabular-nums">{d.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent visits (expanded) */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">Visitas recientes</h3>
            <button onClick={() => navigate(`/g/${hash}/visitas`)} className="text-xs text-indigo-600 hover:underline flex items-center gap-0.5">
              Ver todas <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-2.5">
            {recent_visits.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-8">No hay visitas recientes</p>
            )}
            {recent_visits.slice(0, 10).map(visit => (
              <div key={visit.id} className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 text-xs font-bold flex-shrink-0">
                  {(visit.member ?? '?').slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-800 truncate">{visit.member ?? 'Desconocido'}</p>
                  <p className="text-xs text-gray-400">
                    {VISIT_LABELS[visit.visit_type] ?? visit.visit_type}
                    {' · '}
                    {new Date(visit.visit_date).toLocaleString('es-MX', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                {visit.price > 0 && (
                  <span className="text-xs font-semibold text-emerald-600 flex-shrink-0 tabular-nums">
                    {mask(fmt(visit.price))}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  )
}
