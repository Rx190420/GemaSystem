import { useState } from 'react'
import { Banknote, CreditCard, ArrowRightLeft, ArrowLeft, Loader2, CheckCircle2, AlertTriangle, Wallet } from 'lucide-react'
import { fmtMXN, cashSuggestions } from '../utils/currency'

const METHODS = [
  { id: 'cash',     label: 'Efectivo',      icon: Banknote },
  { id: 'card',     label: 'Tarjeta',       icon: CreditCard },
  { id: 'transfer', label: 'Transferencia', icon: ArrowRightLeft },
]

/**
 * The one "cobro" (checkout) panel used everywhere money changes hands:
 * visits, memberships, product sales. Always rendered *inline*, as a step
 * inside whatever modal is already open — never its own floating overlay —
 * so a checkout step never stacks on top of another modal.
 *
 * Owns its own method/cash-received state and only surfaces the result via
 * onConfirm({ payment_method, amount_paid }), so callers stay simple.
 */
export default function PaymentPanel({
  amount,
  title = 'Cobrar',
  subtitle,
  children,          // optional context block rendered above the total (e.g. member card)
  onConfirm,
  onCancel,
  onBack,
  loading = false,
  confirmLabel = 'Confirmar cobro',
}) {
  const [method, setMethod]     = useState('cash')
  const [received, setReceived] = useState(() => (amount > 0 ? String(amount) : ''))

  const receivedNum   = parseFloat(received || '0') || 0
  const isCash         = method === 'cash'
  const change         = isCash ? Math.max(0, receivedNum - amount) : 0
  const shortfall       = isCash ? Math.max(0, amount - receivedNum) : 0
  const insufficient   = isCash && receivedNum < amount
  const suggestions    = isCash ? cashSuggestions(amount) : []

  function handleConfirm() {
    if (insufficient || loading) return
    onConfirm({
      payment_method: method,
      amount_paid: isCash ? receivedNum : amount,
    })
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        {onBack && (
          <button type="button" onClick={onBack} disabled={loading}
            className="p-1.5 -ml-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors flex-shrink-0 disabled:opacity-40">
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#ECFDF5' }}>
          <Wallet className="w-4.5 h-4.5" style={{ color: '#059669' }} />
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 text-sm">{title}</p>
          {subtitle && <p className="text-xs text-gray-400 truncate">{subtitle}</p>}
        </div>
      </div>

      {children}

      {/* Total due */}
      <div className="text-center py-4 rounded-xl border border-emerald-100" style={{ background: 'linear-gradient(135deg,#ECFDF5,#D1FAE5)' }}>
        <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide mb-1">Total a cobrar</p>
        <p className="text-4xl font-extrabold text-emerald-700 tabular-nums">{fmtMXN(amount)}</p>
      </div>

      {/* Payment method */}
      <div>
        <label className="label">Método de pago</label>
        <div className="grid grid-cols-3 gap-2">
          {METHODS.map(m => {
            const active = method === m.id
            return (
              <button key={m.id} type="button" onClick={() => setMethod(m.id)}
                className={`flex flex-col items-center gap-1.5 py-2.5 rounded-xl border-2 text-xs font-semibold transition-all ${
                  active ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}>
                <m.icon className="w-4 h-4" />
                {m.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Cash received + live change calculation */}
      {isCash && (
        <div className="space-y-2.5">
          <div>
            <label className="label">Efectivo recibido</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">$</span>
              <input
                type="number" min="0" step="0.01"
                value={received}
                onChange={e => setReceived(e.target.value)}
                className="input pl-7 text-lg font-bold tabular-nums"
                placeholder="0.00"
                autoFocus
              />
            </div>
          </div>

          {suggestions.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map(s => (
                <button key={s} type="button" onClick={() => setReceived(String(s))}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors ${
                    receivedNum === s ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600'
                  }`}>
                  {fmtMXN(s)}
                </button>
              ))}
            </div>
          )}

          {insufficient ? (
            <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-red-50 border border-red-100">
              <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-700">
                Faltan <strong>{fmtMXN(shortfall)}</strong> para cubrir el total.
              </p>
            </div>
          ) : change > 0 ? (
            <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-amber-50 border border-amber-100">
              <span className="text-sm font-medium text-amber-700">Cambio a devolver</span>
              <span className="text-xl font-extrabold text-amber-700 tabular-nums">{fmtMXN(change)}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-100">
              <CheckCircle2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span className="text-sm text-gray-500">Pago exacto, sin cambio</span>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="space-y-2 pt-1">
        <button onClick={handleConfirm} disabled={loading || insufficient}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Registrando...</> : <><CheckCircle2 className="w-4 h-4" /> {confirmLabel}</>}
        </button>
        {onCancel && (
          <button onClick={onCancel} disabled={loading}
            className="w-full py-2 text-sm text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-40">
            Cancelar
          </button>
        )}
      </div>
    </div>
  )
}
