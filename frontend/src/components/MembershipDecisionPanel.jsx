import { CalendarX, DollarSign, RefreshCw, CheckCircle2, Ban } from 'lucide-react'

const PLAN_LABELS = {
  weekly: 'Semana', biweekly: 'Quincena', monthly: 'Mensual',
  quarterly: 'Trimestral', biannual: 'Semestral', annual: 'Anual',
}

/**
 * Compact inline status banner for forms that keep their own fields visible
 * (e.g. the "Buscar miembro" tab, which also needs visit type/trainer/notes) —
 * unlike MembershipDecisionPanel below, this doesn't take over the whole step,
 * it just makes the member's membership situation impossible to miss before
 * the front desk charges anything. Same wording/thresholds as that panel so
 * the message never disagrees between the QR-scan flow and the search flow.
 */
export function MembershipStatusBanner({ memberStatus, hasMembership, lastMembership }) {
  if (memberStatus === 'suspended') {
    return (
      <div className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl bg-red-50 border border-red-200">
        <Ban className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-bold text-red-800">Membresía suspendida</p>
          <p className="text-xs text-red-600 mt-0.5 leading-relaxed">
            Este socio tiene el acceso suspendido — confírmalo antes de registrar o cobrar la visita.
          </p>
        </div>
      </div>
    )
  }

  if (hasMembership) return null

  const expired = !!lastMembership
  return (
    <div className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl bg-amber-50 border border-amber-200">
      <CalendarX className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-xs font-bold text-amber-900">
          {expired ? 'Su membresía ya se venció' : 'No cuenta con una membresía'}
        </p>
        <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
          {expired
            ? `Venció el ${new Date(lastMembership.end_date).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })} — se le debe cobrar la visita.`
            : 'Nunca ha tenido una membresía registrada — se le debe cobrar la visita.'}
        </p>
      </div>
    </div>
  )
}

/**
 * Shown inline (never a stacked modal) right after a QR scan finds a member
 * with no active membership — makes the reason unmistakable (expired vs.
 * never had one) and lets the front desk either renew/register a membership
 * or fall through to charging a walk-in visit. Shared by every "scan QR"
 * flow (Visits.jsx and the quick-actions QuickVisitModal.jsx) so the message
 * and options never drift apart between them.
 */
export default function MembershipDecisionPanel({ member, lastMembership, price = 0, onRenew, onPayVisit, onCancel }) {
  const expired = !!lastMembership
  const priceLabel = price > 0
    ? price.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
    : null

  return (
    <div className="space-y-4">

      {/* 1. Estado — qué le pasa a la membresía, en una sola línea clara */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
            <CalendarX className="w-4.5 h-4.5 text-amber-600" />
          </div>
          <div>
            <p className="font-bold text-amber-900 text-sm">
              {expired ? 'Su membresía ya se venció' : 'No cuenta con una membresía'}
            </p>
            <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
              {expired
                ? `Venció el ${new Date(lastMembership.end_date).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })} — se le debe cobrar la visita.`
                : 'Nunca ha tenido una membresía registrada — se le debe cobrar la visita.'}
            </p>
          </div>
        </div>
      </div>

      {/* 2. Quién es */}
      <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
        <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm flex-shrink-0">
          {member.first_name[0]}{member.last_name[0]}
        </div>
        <div>
          <p className="font-semibold text-gray-900 text-sm">{member.first_name} {member.last_name}</p>
          <p className="text-xs text-gray-400">
            {member.member_code && <span className="font-mono mr-2">{member.member_code}</span>}
            {expired ? `Último plan: ${PLAN_LABELS[lastMembership.type] ?? lastMembership.type}` : 'Socio sin plan asignado'}
          </p>
        </div>
      </div>

      {/* 3. Qué se le va a cobrar si no se renueva */}
      {priceLabel && (
        <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
          <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5" /> Costo de la visita
          </span>
          <span className="text-sm font-extrabold text-emerald-700">{priceLabel}</span>
        </div>
      )}

      <p className="text-sm text-gray-600 leading-relaxed">
        {expired
          ? '¿Quieres renovarle la membresía ahora, o cobrarle esta visita como pase individual?'
          : '¿Quieres registrarle una membresía ahora, o cobrarle esta visita como pase individual?'}
      </p>

      {/* 4. Acciones */}
      <button onClick={onRenew}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm transition-colors">
        <RefreshCw className="w-4 h-4" /> {expired ? 'Renovar membresía' : 'Registrar membresía'}
      </button>

      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-gray-100" />
        <span className="text-xs text-gray-400 font-medium">o</span>
        <div className="flex-1 h-px bg-gray-100" />
      </div>

      <button onClick={onPayVisit}
        className="w-full py-3 rounded-xl border-2 border-emerald-200 hover:bg-emerald-50 text-emerald-700 font-bold text-sm flex items-center justify-center gap-2 transition-colors">
        <CheckCircle2 className="w-4 h-4" /> {priceLabel ? `Cobrar visita — ${priceLabel}` : 'Registrar visita de todas formas'}
      </button>

      <button onClick={onCancel} className="w-full py-2 text-sm text-gray-400 hover:text-gray-600 transition-colors">
        Cancelar
      </button>
    </div>
  )
}
