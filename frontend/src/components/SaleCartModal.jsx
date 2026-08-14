import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  X, Search, Loader2, ShoppingCart, CheckCircle2, Package, User,
  ChevronDown, Plus, Minus, Trash2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../api/axios'
import PaymentPanel from './PaymentPanel'
import useLockBodyScroll from '../hooks/useLockBodyScroll'

function fmt(val) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(val ?? 0)
}

/**
 * Fast, single-screen multi-product sale body: search adds items to a
 * cart (incrementing quantity on repeat picks), the itemized breakdown
 * stays collapsed by default (toggle to inspect/adjust it), and
 * everything checks out in one API call.
 *
 * Exported standalone so it can be embedded inside another modal's shell
 * (the FAB quick-action tab) as well as wrapped by `SaleCartModal` below
 * (the Products page's "Vender" button) — both use this exact same view.
 */
export function SaleCartBody({ onDone }) {
  const qc = useQueryClient()

  const [q, setQ]                 = useState('')
  const [cart, setCart]           = useState([]) // [{ product, quantity }]
  const [showCart, setShowCart]   = useState(false)
  const [step, setStep]           = useState('cart') // 'cart' | 'payment'
  const [memberSearch, setMemberSearch] = useState('')
  const [selectedMember, setSelectedMember] = useState(null)
  const [submitting, setSub]      = useState(false)

  const { data: productsData, isFetching } = useQuery({
    queryKey: ['quick-sell-products', q],
    queryFn: () => api.get('/products', { params: { search: q || undefined, status: 'active', per_page: 8 } }).then(r => r.data),
  })
  const results = (productsData?.data ?? []).filter(p => p.unlimited_stock || p.stock > 0)

  const { data: members = [] } = useQuery({
    queryKey: ['quick-search', memberSearch],
    queryFn: () => memberSearch.length >= 2
      ? api.get('/members/search', { params: { q: memberSearch } }).then(r => r.data)
      : [],
    enabled: memberSearch.length >= 2,
  })

  function maxQtyFor(product) {
    return product.unlimited_stock ? Infinity : product.stock
  }

  function addToCart(product) {
    setCart(prev => {
      const idx = prev.findIndex(i => i.product.id === product.id)
      if (idx >= 0) {
        const max = maxQtyFor(product)
        if (prev[idx].quantity >= max) {
          toast.error(`Stock máximo alcanzado para "${product.name}"`)
          return prev
        }
        const next = [...prev]
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 }
        return next
      }
      return [...prev, { product, quantity: 1 }]
    })
    setQ('')
  }

  function changeQty(productId, delta) {
    setCart(prev => prev.map(item => {
      if (item.product.id !== productId) return item
      const max = maxQtyFor(item.product)
      const next = Math.min(max, Math.max(1, item.quantity + delta))
      return { ...item, quantity: next }
    }))
  }

  function removeItem(productId) {
    setCart(prev => prev.filter(i => i.product.id !== productId))
  }

  const itemsCount = cart.length
  const unitsCount = cart.reduce((sum, i) => sum + i.quantity, 0)
  const total = cart.reduce((sum, i) => sum + parseFloat(i.product.price) * i.quantity, 0)

  function goToPayment() {
    if (cart.length === 0) return toast.error('Agrega al menos un producto')
    setStep('payment')
  }

  async function handleCheckout({ payment_method, amount_paid }) {
    setSub(true)
    try {
      const { data } = await api.post('/products/checkout', {
        items: cart.map(i => ({ product_id: i.product.id, quantity: i.quantity })),
        payment_method,
        amount_paid,
        member_id: selectedMember?.id ?? null,
      })
      qc.invalidateQueries(['products'])
      qc.invalidateQueries(['products-summary'])
      qc.invalidateQueries(['product-sales'])
      const count = data.items_count
      onDone(`${count} producto${count !== 1 ? 's' : ''} · ${fmt(data.total_amount)}`)
    } catch (err) {
      const msg = err.response?.data?.errors?.quantity?.[0]
        ?? err.response?.data?.errors?.items?.[0]
        ?? err.response?.data?.message
        ?? 'Error al registrar la venta'
      toast.error(msg)
      setStep('cart')
    } finally {
      setSub(false)
    }
  }

  if (step === 'payment') {
    return (
      <div className="flex-1 overflow-y-auto p-6">
        <PaymentPanel
          amount={total}
          title="Cobrar venta"
          subtitle={`${itemsCount} producto${itemsCount !== 1 ? 's' : ''} · ${unitsCount} unidad${unitsCount !== 1 ? 'es' : ''}${selectedMember ? ` · ${selectedMember.first_name} ${selectedMember.last_name}` : ''}`}
          onConfirm={handleCheckout}
          onBack={() => setStep('cart')}
          loading={submitting}
          confirmLabel="Confirmar y registrar venta"
        />
      </div>
    )
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto p-6 space-y-4">

        {/* Fast add-to-cart search */}
        <div>
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={q} onChange={e => setQ(e.target.value)}
              placeholder="Escribe para agregar un producto..."
              className="input pl-10 rounded-full"
              autoFocus
            />
            {isFetching && <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300 animate-spin" />}
          </div>

          <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
            {results.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-3">
                {isFetching ? 'Buscando...' : 'Sin productos disponibles'}
              </p>
            ) : (
              results.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addToCart(p)}
                  className="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-rose-50 border border-transparent hover:border-rose-100 transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-gray-100 overflow-hidden flex items-center justify-center flex-shrink-0">
                    {p.image_url ? <img src={p.image_url} alt="" className="w-full h-full object-cover" /> : <Package className="w-4 h-4 text-gray-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{p.name}</p>
                    <p className="text-xs text-gray-400">{fmt(p.price)} · {p.unlimited_stock ? 'ilimitado' : `${p.stock} disp.`}</p>
                  </div>
                  <Plus className="w-4 h-4 text-rose-400 flex-shrink-0" />
                </button>
              ))
            )}
          </div>
        </div>

        {/* Collapsible cart preview */}
        <div>
          <button
            type="button"
            onClick={() => setShowCart(v => !v)}
            disabled={itemsCount === 0}
            className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-gray-50 border border-gray-100 hover:bg-gray-100 transition-colors disabled:cursor-default disabled:hover:bg-gray-50"
          >
            <span className="text-sm font-medium text-gray-700">
              {itemsCount === 0 ? 'Sin productos agregados' : `${itemsCount} producto${itemsCount !== 1 ? 's' : ''} · ${unitsCount} unidad${unitsCount !== 1 ? 'es' : ''}`}
            </span>
            {itemsCount > 0 && (
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showCart ? 'rotate-180' : ''}`} />
            )}
          </button>

          {showCart && itemsCount > 0 && (
            <div className="space-y-2 mt-2">
              {cart.map(item => (
                <div key={item.product.id} className="flex items-center gap-2.5 p-2 rounded-lg border border-gray-100">
                  <div className="w-8 h-8 rounded-lg bg-gray-100 overflow-hidden flex items-center justify-center flex-shrink-0">
                    {item.product.image_url ? <img src={item.product.image_url} alt="" className="w-full h-full object-cover" /> : <Package className="w-4 h-4 text-gray-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-800 truncate">{item.product.name}</p>
                    <p className="text-[11px] text-gray-400">{fmt(item.product.price)} c/u</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => changeQty(item.product.id, -1)} className="w-6 h-6 rounded-md border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50">
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-6 text-center text-xs font-semibold tabular-nums">{item.quantity}</span>
                    <button onClick={() => changeQty(item.product.id, 1)} className="w-6 h-6 rounded-md border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50">
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  <span className="text-xs font-bold text-gray-900 w-16 text-right flex-shrink-0 tabular-nums">
                    {fmt(item.product.price * item.quantity)}
                  </span>
                  <button onClick={() => removeItem(item.product.id)} className="text-gray-300 hover:text-red-500 flex-shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Member */}
        <div>
          <label className="label">Socio (opcional)</label>
          {selectedMember ? (
            <div className="flex items-center gap-3 p-2.5 rounded-lg bg-indigo-50 border border-indigo-100">
              <div className="w-7 h-7 rounded-full bg-indigo-200 flex items-center justify-center text-indigo-700 text-xs font-bold">
                {selectedMember.first_name[0]}{selectedMember.last_name[0]}
              </div>
              <span className="flex-1 text-sm font-medium">{selectedMember.first_name} {selectedMember.last_name}</span>
              <button type="button" onClick={() => setSelectedMember(null)} className="text-gray-400 hover:text-gray-600"><X className="w-3.5 h-3.5" /></button>
            </div>
          ) : (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input value={memberSearch} onChange={e => setMemberSearch(e.target.value)} placeholder="Buscar socio o dejar en blanco (venta directa)" className="input pl-9 text-sm" />
              {members.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-36 overflow-y-auto">
                  {members.map(m => (
                    <button key={m.id} type="button"
                      onClick={() => { setSelectedMember(m); setMemberSearch('') }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
                    >
                      <User className="w-3.5 h-3.5 text-gray-400" />
                      {m.first_name} {m.last_name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Total */}
        <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-emerald-50">
          <span className="text-sm font-medium text-emerald-800">Total</span>
          <span className="text-xl font-bold text-emerald-700">{fmt(total)}</span>
        </div>
      </div>

      <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
        <button onClick={goToPayment} disabled={itemsCount === 0} className="btn-primary flex-1">
          Continuar al cobro
        </button>
      </div>
    </>
  )
}

// ── Standalone modal wrapper (used by the Products page's "Vender" button) ──
export default function SaleCartModal({ onClose }) {
  useLockBodyScroll()
  const [doneText, setDoneText] = useState(null)

  function handleDone(text) {
    setDoneText(text)
    setTimeout(onClose, 1600)
  }

  if (doneText) {
    return (
      <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 flex flex-col items-center gap-3" onClick={e => e.stopPropagation()}>
          <div className="w-16 h-16 rounded-full bg-rose-50 flex items-center justify-center">
            <CheckCircle2 className="w-9 h-9 text-rose-600" />
          </div>
          <p className="text-lg font-semibold text-gray-900">¡Venta registrada!</p>
          <p className="text-sm text-gray-500">{doneText}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center">
              <ShoppingCart className="w-4 h-4 text-rose-600" />
            </div>
            <h2 className="text-base font-semibold text-gray-900">Vender productos</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <SaleCartBody onDone={handleDone} />
      </div>
    </div>
  )
}
