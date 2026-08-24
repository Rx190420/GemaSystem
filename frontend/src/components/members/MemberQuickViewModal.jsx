import { useQuery } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import {
  X, Loader2, Mail, Phone, Hash, ExternalLink, Activity, TrendingUp, Clock,
  Calendar, CreditCard, ShieldCheck, History, Zap, CalendarCheck2,
} from 'lucide-react'
import api from '../../api/axios'
import ActivityGraph from '../ActivityGraph'
import useLockBodyScroll from '../../hooks/useLockBodyScroll'
import { avatarColor } from '../../utils/avatarColor'

const STATUS_BADGE = { active: 'badge-green', inactive: 'badge-gray', suspended: 'badge-red' }
const STATUS_LABEL = { active: 'Activo', inactive: 'Inactivo', suspended: 'Suspendido' }
const PLAN_BADGE = { weekly: 'badge-teal', biweekly: 'badge-cyan', monthly: 'badge-blue', quarterly: 'badge-purple', biannual: 'badge-indigo', annual: 'badge-yellow' }
const PLAN_LABEL = { weekly: 'Semanal', biweekly: 'Quincenal', monthly: 'Mensual', quarterly: 'Trimestral', biannual: 'Semestral', annual: 'Anual' }
const MEMSTATUS_BADGE = { active: 'badge-green', expired: 'badge-red', cancelled: 'badge-gray' }
const MEMSTATUS_LABEL = { active: 'Activa', expired: 'Vencida', cancelled: 'Cancelada' }
const VISIT_LABEL = { training: 'Entrenamiento', class: 'Clase', consultation: 'Consulta', other: 'Otro' }
const VISIT_COLOR = { training: 'badge-indigo', class: 'badge-purple', consultation: 'badge-blue', other: 'badge-gray' }
const PAY_LABEL   = { cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia' }

function fmtDate(dateStr, opts = { day: '2-digit', month: 'short', year: 'numeric' }) {
  if (!dateStr) return '—'
  const [y, m, d] = String(dateStr).split('T')[0].split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-MX', opts)
}

function daysUntil(dateStr) {
  if (!dateStr) return null
  const [y, m, d] = String(dateStr).split('T')[0].split('-').map(Number)
  return Math.ceil((new Date(y, m - 1, d, 23, 59, 59) - new Date()) / 86400000)
}

function membershipProgress(startStr, endStr) {
  if (!startStr || !endStr) return 0
  const parseLocal = s => { const [y, m, d] = s.split('T')[0].split('-').map(Number); return new Date(y, m - 1, d) }
  const start = parseLocal(startStr), end = parseLocal(endStr), now = new Date()
  const total = end - start
  if (total <= 0) return 100
  return Math.min(100, Math.max(0, ((now - start) / total) * 100))
}

function StatTile({ icon: Icon, label, value, color = 'indigo' }) {
  const palette = {
    indigo:  'bg-indigo-50 text-indigo-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    blue:    'bg-blue-50 text-blue-600',
    violet:  'bg-violet-50 text-violet-600',
    amber:   'bg-amber-50 text-amber-600',
  }
  return (
    <div className="rounded-xl bg-gray-50 border border-gray-100 p-3 flex items-center gap-2.5">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${palette[color] ?? palette.indigo}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-gray-400 leading-none">{label}</p>
        <p className="text-sm font-bold text-gray-900 mt-0.5 truncate">{value}</p>
      </div>
    </div>
  )
}

/**
 * Read-only quick-view of one member, opened by clicking a row in the
 * Visitas or Membresías tables. Same `/members/{id}` payload the full
 * profile page uses, but only the section relevant to where it was opened
 * from (`focus`) — an activity chart + recent visits from Visitas, or the
 * current membership + full history from Membresías. "Ver perfil completo"
 * jumps to the full page for anything not covered here.
 */
export default function MemberQuickViewModal({ memberId, focus = 'visits', onClose }) {
  useLockBodyScroll()
  const { hash } = useParams()
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['member', memberId],
    queryFn: () => api.get(`/members/${memberId}`).then(r => r.data),
  })

  const member       = data?.member
  const stats        = data?.stats
  const recentVisits = data?.recent_visits ?? []
  const memberships  = member?.memberships ?? []
  // Laravel snake_cases relation keys on JSON serialization by default, so
  // the `activeMembership()` relation comes back as `active_membership` —
  // not `activeMembership` — even though that's the method name we loaded.
  const active       = member?.active_membership

  const daysLeft  = active ? daysUntil(active.end_date) : null
  const pct       = active ? membershipProgress(active.start_date, active.end_date) : 0
  const totalPaid = memberships.reduce((sum, m) => sum + (m.status !== 'cancelled' ? parseFloat(m.amount || 0) : 0), 0)
  const lastVisit = recentVisits[0]?.visit_date

  function goToProfile() {
    onClose()
    navigate(`/g/${hash}/socio/${memberId}`)
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {isLoading || !member ? (
          <div className="flex justify-center items-center h-64"><Loader2 className="w-6 h-6 animate-spin text-indigo-600" /></div>
        ) : (
          <>
            {/* Header */}
            <div className="p-5 border-b border-gray-100 flex items-start gap-3">
              <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${avatarColor(member.id)} flex items-center justify-center text-white text-base font-bold flex-shrink-0`}>
                {member.first_name?.[0]}{member.last_name?.[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center flex-wrap gap-1.5">
                  <h2 className="text-base font-semibold text-gray-900">{member.first_name} {member.last_name}</h2>
                  <span className={STATUS_BADGE[member.status] ?? 'badge-gray'}>{STATUS_LABEL[member.status] ?? member.status}</span>
                </div>
                <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-gray-500">
                  {member.member_code && <span className="flex items-center gap-1 font-mono text-indigo-500"><Hash className="w-3 h-3" />{member.member_code}</span>}
                  {member.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3 text-gray-400" />{member.email}</span>}
                  {member.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3 text-gray-400" />{member.phone}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={goToProfile} title="Ver perfil completo" className="p-2 rounded-lg hover:bg-indigo-50 text-indigo-400 hover:text-indigo-600 transition-colors">
                  <ExternalLink className="w-4 h-4" />
                </button>
                <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"><X className="w-4 h-4" /></button>
              </div>
            </div>

            <div className="p-5 space-y-5">
              {focus === 'visits' ? (
                <>
                  {/* Stats */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <StatTile icon={Activity}   label="Total visitas" value={stats.totalVisits} color="indigo" />
                    <StatTile icon={TrendingUp} label="Este mes"      value={stats.monthVisits} color="emerald" />
                    <StatTile icon={Clock}      label="Esta semana"   value={stats.weekVisits}  color="blue" />
                    <StatTile icon={Calendar}   label="Última visita" value={lastVisit ? fmtDate(lastVisit, { day: '2-digit', month: 'short' }) : '—'} color="violet" />
                  </div>

                  {/* Activity graph */}
                  <div className="card p-4">
                    <ActivityGraph memberId={memberId} title="Actividad de visitas" icon={Activity} />
                  </div>

                  {/* Recent visits */}
                  <div className="rounded-xl border border-gray-100 overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-gray-100 flex items-center gap-2 bg-gray-50">
                      <Zap className="w-3.5 h-3.5 text-gray-400" />
                      <h3 className="text-xs font-semibold text-gray-600">Visitas recientes</h3>
                    </div>
                    {recentVisits.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-6">Sin visitas registradas</p>
                    ) : (
                      <ul className="divide-y divide-gray-50">
                        {recentVisits.map(v => (
                          <li key={v.id} className="flex items-center justify-between px-4 py-2.5">
                            <div>
                              <p className="text-sm text-gray-800">{new Date(v.visit_date).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
                              {v.notes && <p className="text-xs text-gray-400">{v.notes}</p>}
                            </div>
                            <span className={`badge ${VISIT_COLOR[v.visit_type] ?? 'badge-gray'}`}>{VISIT_LABEL[v.visit_type] ?? v.visit_type}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </>
              ) : (
                <>
                  {/* Stats */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <StatTile icon={CreditCard}     label="Membresías"    value={memberships.length} color="indigo" />
                    <StatTile icon={ShieldCheck}    label="Estado actual" value={active ? 'Activa' : 'Sin activa'} color={active ? 'emerald' : 'amber'} />
                    <StatTile icon={TrendingUp}     label="Total pagado"  value={`$${totalPaid.toLocaleString('es-MX')}`} color="blue" />
                    <StatTile icon={CalendarCheck2} label="Miembro desde" value={fmtDate(member.created_at, { day: '2-digit', month: 'short', year: 'numeric' })} color="violet" />
                  </div>

                  {/* Current membership */}
                  {active ? (
                    <div className={`rounded-xl border-l-4 p-4 ${
                      daysLeft !== null && daysLeft < 0 ? 'border-l-red-400 bg-red-50/40'
                      : daysLeft !== null && daysLeft <= 7 ? 'border-l-amber-400 bg-amber-50/40'
                      : 'border-l-emerald-400 bg-emerald-50/40'}`}
                    >
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className={PLAN_BADGE[active.type] ?? 'badge-blue'}>{PLAN_LABEL[active.type] ?? active.type}</span>
                          <span className="text-xs text-gray-500">{fmtDate(active.start_date)} → {fmtDate(active.end_date)}</span>
                        </div>
                        <span className={`text-xs font-semibold ${
                          daysLeft !== null && daysLeft < 0 ? 'text-red-600'
                          : daysLeft !== null && daysLeft <= 7 ? 'text-amber-600'
                          : 'text-emerald-600'}`}
                        >
                          {daysLeft === null ? '—' : daysLeft < 0 ? `Vencida hace ${Math.abs(daysLeft)} días` : daysLeft === 0 ? 'Vence hoy' : `${daysLeft} días restantes`}
                        </span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-3">
                        <div
                          className={`h-full rounded-full ${daysLeft !== null && daysLeft < 0 ? 'bg-red-500' : daysLeft !== null && daysLeft <= 7 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-center text-sm text-gray-400">
                      Sin membresía activa
                    </div>
                  )}

                  {/* History */}
                  <div className="rounded-xl border border-gray-100 overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-gray-100 flex items-center gap-2 bg-gray-50">
                      <History className="w-3.5 h-3.5 text-gray-400" />
                      <h3 className="text-xs font-semibold text-gray-600">Historial de membresías</h3>
                      <span className="ml-auto text-xs text-gray-400">{memberships.length}</span>
                    </div>
                    {memberships.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-6">Sin membresías registradas</p>
                    ) : (
                      <ul className="divide-y divide-gray-50">
                        {memberships.map(m => (
                          <li key={m.id} className="flex items-center justify-between px-4 py-2.5">
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className={`${PLAN_BADGE[m.type] ?? 'badge-blue'} text-xs`}>{PLAN_LABEL[m.type] ?? m.type}</span>
                                <span className={`${MEMSTATUS_BADGE[m.status] ?? 'badge-gray'} text-xs`}>{MEMSTATUS_LABEL[m.status] ?? m.status}</span>
                              </div>
                              <p className="text-xs text-gray-500 mt-0.5">
                                {fmtDate(m.start_date, { day: '2-digit', month: 'short' })} → {fmtDate(m.end_date, { day: '2-digit', month: 'short', year: 'numeric' })}
                              </p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="text-sm font-semibold text-gray-800">${parseFloat(m.amount ?? 0).toLocaleString('es-MX')}</p>
                              <p className="text-[10px] text-gray-400">{PAY_LABEL[m.payment_method] ?? m.payment_method}</p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
