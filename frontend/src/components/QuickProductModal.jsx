import { useState, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { X, ShoppingCart, CheckCircle2, Package, PackagePlus, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../api/axios'
import useLockBodyScroll from '../hooks/useLockBodyScroll'
import { SaleCartBody } from './SaleCartModal'

// ── New product tab ────────────────────────────────────────────────
function NewProductTab({ onDone }) {
  const qc = useQueryClient()
  const fileRef = useRef(null)

  const [name, setName]           = useState('')
  const [sku, setSku]             = useState('')
  const [category, setCategory]   = useState('')
  const [price, setPrice]         = useState('')
  const [cost, setCost]           = useState('')
  const [unlimited, setUnlimited] = useState(false)
  const [stock, setStock]         = useState('')
  const [imageFile, setImageFile] = useState(null)
  const [preview, setPreview]     = useState(null)
  const [imageError, setImageError] = useState('')
  const [submitting, setSub]      = useState(false)

  function pickImage(file) {
    setImageError('')
    if (!file) return
    if (!file.type.startsWith('image/')) return setImageError('Selecciona un archivo de imagen.')
    if (file.size > 5 * 1024 * 1024) return setImageError('La imagen no debe superar 5MB.')
    setImageFile(file)
    setPreview(URL.createObjectURL(file))
  }

  async function handleSubmit() {
    if (!name.trim()) return toast.error('El nombre es obligatorio')
    if (!price || isNaN(price) || Number(price) < 0) return toast.error('Ingresa un precio válido')
    if (!unlimited && (stock === '' || isNaN(stock) || Number(stock) < 0)) return toast.error('Ingresa el stock disponible')

    setSub(true)
    try {
      const payload = {
        name: name.trim(),
        sku: sku.trim(),
        category: category.trim(),
        price,
        cost: cost || 0,
        unlimited_stock: unlimited,
        stock: unlimited ? '' : stock,
      }

      if (imageFile) {
        const fd = new FormData()
        Object.entries(payload).forEach(([k, v]) => fd.append(k, v === true ? 'true' : v === false ? 'false' : v))
        fd.append('image', imageFile)
        await api.post('/products', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      } else {
        await api.post('/products', payload)
      }

      qc.invalidateQueries(['products'])
      qc.invalidateQueries(['products-summary'])
      onDone(name.trim())
    } catch (err) {
      const msg = err.response?.data?.message
        ?? Object.values(err.response?.data?.errors ?? {}).flat()[0]
        ?? 'Error al crear el producto'
      toast.error(msg)
    } finally {
      setSub(false)
    }
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        <div className="flex items-center gap-4">
          <div
            onClick={() => fileRef.current?.click()}
            className="w-16 h-16 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden cursor-pointer hover:border-orange-300 transition-colors flex-shrink-0 bg-gray-50"
          >
            {preview
              ? <img src={preview} alt="" className="w-full h-full object-cover" />
              : <Package className="w-6 h-6 text-gray-300" />}
          </div>
          <div className="flex-1">
            <button type="button" onClick={() => fileRef.current?.click()} className="btn-secondary text-xs py-1.5 px-3">
              Seleccionar imagen
            </button>
            <p className="text-xs text-gray-400 mt-1">Opcional · se convierte a WEBP</p>
            {imageError && <p className="text-xs text-red-500 mt-1">{imageError}</p>}
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => pickImage(e.target.files?.[0])} />
        </div>

        <div>
          <label className="label">Nombre *</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Ej. Proteína Whey 1kg" className="input" autoFocus />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">SKU</label>
            <input value={sku} onChange={e => setSku(e.target.value)} placeholder="Auto-generado" className="input font-mono" />
          </div>
          <div>
            <label className="label">Categoría</label>
            <input value={category} onChange={e => setCategory(e.target.value)} placeholder="Ej. Suplementos" className="input" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Precio de venta *</label>
            <input type="number" step="0.01" min="0" value={price} onChange={e => setPrice(e.target.value)} placeholder="0.00" className="input" />
          </div>
          <div>
            <label className="label">Costo</label>
            <input type="number" step="0.01" min="0" value={cost} onChange={e => setCost(e.target.value)} placeholder="0.00" className="input" />
          </div>
        </div>

        <div className="flex items-center gap-2 py-1">
          <input id="qp-unlimited" type="checkbox" checked={unlimited} onChange={e => setUnlimited(e.target.checked)} className="w-4 h-4 rounded border-gray-300" />
          <label htmlFor="qp-unlimited" className="text-sm text-gray-700 cursor-pointer">Stock ilimitado</label>
        </div>

        {!unlimited && (
          <div>
            <label className="label">Stock disponible *</label>
            <input type="number" min="0" value={stock} onChange={e => setStock(e.target.value)} placeholder="0" className="input" />
          </div>
        )}
      </div>

      <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
        <button onClick={handleSubmit} disabled={submitting} className="btn-primary flex-1">
          {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</> : 'Crear producto'}
        </button>
      </div>
    </>
  )
}

// ── Combined modal ───────────────────────────────────────────────
export default function QuickProductModal({ onClose, initialTab = 'sell' }) {
  useLockBodyScroll()
  const [tab, setTab]   = useState(initialTab) // 'sell' | 'new'
  const [done, setDone] = useState(null)       // null | { type, detail }

  function handleDone(type, detail) {
    setDone({ type, detail })
    setTimeout(onClose, 1400)
  }

  if (done) {
    const isSell = done.type === 'sell'
    return (
      <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 flex flex-col items-center gap-3" onClick={e => e.stopPropagation()}>
          <div className={`w-16 h-16 rounded-full flex items-center justify-center ${isSell ? 'bg-rose-50' : 'bg-orange-50'}`}>
            <CheckCircle2 className={`w-9 h-9 ${isSell ? 'text-rose-600' : 'text-orange-600'}`} />
          </div>
          <p className="text-lg font-semibold text-gray-900">{isSell ? '¡Venta registrada!' : '¡Producto creado!'}</p>
          <p className="text-sm text-gray-500">{done.detail}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${tab === 'sell' ? 'bg-rose-100' : 'bg-orange-100'}`}>
              {tab === 'sell' ? <ShoppingCart className="w-4 h-4 text-rose-600" /> : <PackagePlus className="w-4 h-4 text-orange-600" />}
            </div>
            <h2 className="text-base font-semibold text-gray-900">Productos</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="px-6 pt-4">
          <div className="flex rounded-xl border border-gray-200 bg-gray-50 p-1 gap-1">
            <button
              type="button"
              onClick={() => setTab('sell')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all
                ${tab === 'sell' ? 'bg-white shadow text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <ShoppingCart className="w-4 h-4" /> Vender
            </button>
            <button
              type="button"
              onClick={() => setTab('new')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all
                ${tab === 'new' ? 'bg-white shadow text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <PackagePlus className="w-4 h-4" /> Nuevo producto
            </button>
          </div>
        </div>

        {tab === 'sell'
          ? <SaleCartBody onDone={detail => handleDone('sell', detail)} />
          : <NewProductTab onDone={detail => handleDone('new', detail)} />}
      </div>
    </div>
  )
}
