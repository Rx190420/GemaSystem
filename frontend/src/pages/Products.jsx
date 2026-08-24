import { useState, useRef } from 'react'
import { Skeleton } from 'boneyard-js/react'
import { LoadingLogoOverlay } from '../components/SkeletonLogoMark'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  Plus, Search, X, Package, Pencil, Trash2, ShoppingCart, Loader2,
  AlertTriangle, DollarSign,
  TrendingUp, Boxes, BarChart3, Tag,
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../api/axios'
import { isSparseTrend, trimLeadingEmpty } from '../utils/charts'
import ConfirmModal from '../components/ConfirmModal'
import SaleCartModal from '../components/SaleCartModal'
import useLockBodyScroll from '../hooks/useLockBodyScroll'
import useSort from '../hooks/useSort'
import SortableTh from '../components/SortableTh'
import Pagination from '../components/Pagination'

const METHOD_LABELS = { cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia' }
const STATUS_LABEL  = { active: 'Activo', inactive: 'Inactivo' }
const STATUS_CLASS  = { active: 'badge-green', inactive: 'badge-gray' }
const MONTH_NAMES   = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

function fmt(val) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(val ?? 0)
}

function marginPercent(p) {
  const price = parseFloat(p?.price) || 0
  const cost  = parseFloat(p?.cost) || 0
  if (price <= 0) return 0
  return Math.round(((price - cost) / price) * 1000) / 10
}

function marginBadgeClass(m) {
  if (m >= 40) return 'badge-green'
  if (m >= 20) return 'badge-yellow'
  return 'badge-red'
}

function buildLast6Months(byMonth) {
  const now = new Date()
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1)
    const y = d.getFullYear(), m = d.getMonth() + 1
    const found = byMonth?.find(r => r.year === y && r.month === m)
    return { name: `${MONTH_NAMES[m - 1]} ${String(y).slice(2)}`, revenue: found?.revenue ?? 0, units: found?.units ?? 0 }
  })
}

// ── Product image with graceful fallback ─────────────────────────
// Falls back to a placeholder icon instead of a broken-image glyph if the
// URL 404s or the backend/static server is unreachable.
function ProductImage({ src, alt, className = '', iconClassName = 'w-8 h-8' }) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) {
    return (
      <div className={`flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 ${className}`}>
        <Package className={`${iconClassName} text-gray-300`} />
      </div>
    )
  }
  return <img src={src} alt={alt} className={className} loading="lazy" onError={() => setFailed(true)} />
}

function MiniStat({ label, value, icon: Icon, color = 'gray' }) {
  const palette = { gray: 'text-gray-800', emerald: 'text-emerald-600', amber: 'text-amber-600', red: 'text-red-600' }
  return (
    <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
      <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
        {Icon && <Icon className="w-3.5 h-3.5" />}
        {label}
      </div>
      <p className={`text-sm font-bold ${palette[color] ?? palette.gray}`}>{value}</p>
    </div>
  )
}

function StatCard({ icon: Icon, title, value, color }) {
  const palette = {
    indigo:  { bg: 'bg-indigo-50', text: 'text-indigo-700', icon: 'text-indigo-600' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', icon: 'text-emerald-600' },
    orange:  { bg: 'bg-orange-50', text: 'text-orange-700', icon: 'text-orange-600' },
    red:     { bg: 'bg-red-50', text: 'text-red-700', icon: 'text-red-600' },
  }
  const p = palette[color] ?? palette.indigo
  return (
    <div className="card p-4 flex items-center gap-3">
      <div className={`p-2.5 rounded-xl ${p.bg} flex-shrink-0`}>
        <Icon className={`w-5 h-5 ${p.icon}`} />
      </div>
      <div>
        <p className="text-xs text-gray-500">{title}</p>
        <p className={`text-xl font-bold ${p.text}`}>{value}</p>
      </div>
    </div>
  )
}

function stockBadge(p) {
  if (p.unlimited_stock) return <span className="badge-green">Ilimitado</span>
  if (p.stock <= 0) return <span className="badge-red">Agotado</span>
  if (p.stock <= p.low_stock_threshold) return <span className="badge-yellow">Bajo stock · {p.stock}</span>
  return <span className="badge-gray">{p.stock} u.</span>
}

// ── Product Modal (create / edit) ────────────────────────────────
function ProductModal({ product, onClose }) {
  const qc = useQueryClient()
  useLockBodyScroll()
  const isEdit = !!product?.id
  const fileRef = useRef(null)
  const [preview, setPreview] = useState(product?.image_url ?? null)
  const [imageFile, setImageFile] = useState(null)
  const [imageError, setImageError] = useState('')

  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm({
    defaultValues: {
      name:                product?.name ?? '',
      description:         product?.description ?? '',
      sku:                 product?.sku ?? '',
      category:            product?.category ?? '',
      price:               product?.price ?? '',
      cost:                product?.cost ?? '',
      stock:               product?.stock ?? '',
      unlimited_stock:     product?.unlimited_stock ?? false,
      low_stock_threshold: product?.low_stock_threshold ?? 5,
      status:              product?.status ?? 'active',
    },
  })

  const unlimited = watch('unlimited_stock')

  function pickImage(file) {
    setImageError('')
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setImageError('Selecciona un archivo de imagen.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setImageError('La imagen no debe superar 5MB.')
      return
    }
    setImageFile(file)
    setPreview(URL.createObjectURL(file))
  }

  const onSubmit = async (data) => {
    try {
      const payload = {
        name: data.name,
        description: data.description || '',
        sku: data.sku || '',
        category: data.category || '',
        price: data.price,
        cost: data.cost || 0,
        unlimited_stock: !!data.unlimited_stock,
        stock: data.unlimited_stock ? '' : (data.stock || 0),
        low_stock_threshold: data.low_stock_threshold || 5,
        status: data.status,
      }

      if (imageFile) {
        const fd = new FormData()
        Object.entries(payload).forEach(([k, v]) => fd.append(k, v === true ? 'true' : v === false ? 'false' : v))
        fd.append('image', imageFile)
        if (isEdit) {
          fd.append('_method', 'PUT')
          await api.post(`/products/${product.id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
        } else {
          await api.post('/products', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
        }
      } else if (isEdit) {
        await api.put(`/products/${product.id}`, payload)
      } else {
        await api.post('/products', payload)
      }

      toast.success(isEdit ? 'Producto actualizado' : 'Producto creado')
      qc.invalidateQueries(['products'])
      qc.invalidateQueries(['products-summary'])
      onClose()
    } catch (err) {
      const msg = err.response?.data?.message
        ?? Object.values(err.response?.data?.errors ?? {}).flat()[0]
        ?? 'Error al guardar el producto'
      toast.error(msg)
    }
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">{isEdit ? 'Editar producto' : 'Nuevo producto'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

            {/* Imagen */}
            <div>
              <label className="label">Imagen del producto</label>
              <div className="flex items-center gap-4">
                <div
                  onClick={() => fileRef.current?.click()}
                  className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-200 overflow-hidden cursor-pointer hover:border-indigo-300 transition-colors flex-shrink-0 bg-gray-50"
                >
                  <ProductImage src={preview} alt="" className="w-full h-full object-cover" iconClassName="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <button type="button" onClick={() => fileRef.current?.click()} className="btn-secondary text-xs py-1.5 px-3">
                    Seleccionar imagen
                  </button>
                  <p className="text-xs text-gray-400 mt-1">JPG, PNG, GIF o WEBP · máx. 5MB · se convierte a WEBP</p>
                  {imageError && <p className="text-xs text-red-500 mt-1">{imageError}</p>}
                </div>
                <input ref={fileRef} type="file" accept="image/*" className="hidden"
                  onChange={e => pickImage(e.target.files?.[0])} />
              </div>
            </div>

            <div>
              <label className="label">Nombre *</label>
              <input {...register('name', { required: true })} className={`input ${errors.name ? 'border-red-400' : ''}`} placeholder="Ej. Proteína Whey 1kg" />
            </div>

            <div>
              <label className="label">Descripción</label>
              <textarea {...register('description')} rows={2} className="input resize-none" placeholder="Detalles del producto..." />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">SKU</label>
                <input {...register('sku')} className="input font-mono" placeholder="Auto-generado" />
                <p className="text-xs text-gray-400 mt-1">Se genera automáticamente si se deja en blanco</p>
              </div>
              <div>
                <label className="label">Categoría</label>
                <input {...register('category')} className="input" placeholder="Ej. Suplementos" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Precio de venta *</label>
                <input {...register('price', { required: true, min: 0 })} type="number" step="0.01" min="0" className="input" placeholder="0.00" />
              </div>
              <div>
                <label className="label">Costo</label>
                <input {...register('cost')} type="number" step="0.01" min="0" className="input" placeholder="0.00" />
              </div>
            </div>

            <div className="flex items-center gap-2 py-1">
              <input id="unlimited_stock" type="checkbox" {...register('unlimited_stock')} className="w-4 h-4 rounded border-gray-300" />
              <label htmlFor="unlimited_stock" className="text-sm text-gray-700 cursor-pointer">Stock ilimitado (no se controla inventario)</label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Stock disponible {!unlimited && '*'}</label>
                <input {...register('stock')} type="number" min="0" disabled={unlimited}
                  className={`input ${unlimited ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : ''}`} placeholder="0" />
              </div>
              <div>
                <label className="label">Alerta de bajo stock</label>
                <input {...register('low_stock_threshold')} type="number" min="0" disabled={unlimited}
                  className={`input ${unlimited ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : ''}`} placeholder="5" />
              </div>
            </div>

            <div>
              <label className="label">Estado</label>
              <select {...register('status')} className="input">
                <option value="active">Activo</option>
                <option value="inactive">Inactivo</option>
              </select>
            </div>

          </div>
          <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
            <button type="submit" disabled={isSubmitting} className="btn-primary flex-1">
              {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</> : (isEdit ? 'Guardar cambios' : 'Crear producto')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Product Detail Modal (stats + charts + sales history) ────────
function ProductDetailModal({ product, onClose, onEdit }) {
  useLockBodyScroll()

  const { data: stats, isLoading } = useQuery({
    queryKey: ['product-stats', product.id],
    queryFn: () => api.get(`/products/${product.id}/stats`).then(r => r.data),
  })

  const monthly = trimLeadingEmpty(buildLast6Months(stats?.by_month), 'revenue', 3)
  // Zero non-zero months (never sold) and exactly one (all revenue crammed
  // into the current month) both get the empty state — a single bar
  // stranded at the right edge of an otherwise-blank 6-month chart reads as
  // broken, not just "quiet".
  const hasRevenue = !isSparseTrend(monthly, 'revenue')
  const margin = stats?.margin_percent ?? marginPercent(product)
  const marginColor = margin >= 40 ? 'emerald' : margin >= 20 ? 'amber' : 'red'

  return (
    <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-start gap-4 px-6 py-5 border-b border-gray-100">
          <div className="w-20 h-20 rounded-xl overflow-hidden border border-gray-100 flex-shrink-0">
            <ProductImage src={product.image_url} alt={product.name} className="w-full h-full object-cover" iconClassName="w-8 h-8" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold text-gray-900">{product.name}</h2>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  <span className="badge-gray font-mono flex items-center gap-1"><Tag className="w-3 h-3" />{product.sku}</span>
                  {product.category && <span className="badge-indigo">{product.category}</span>}
                  <span className={STATUS_CLASS[product.status]}>{STATUS_LABEL[product.status]}</span>
                </div>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors flex-shrink-0"><X className="w-4 h-4" /></button>
            </div>
            {product.description && <p className="text-xs text-gray-500 mt-2 line-clamp-2">{product.description}</p>}
          </div>
        </div>

        <Skeleton name="product-detail-modal" loading={isLoading}>
        <div className={`flex-1 overflow-y-auto px-6 py-5 space-y-5 ${isLoading ? 'min-h-[280px]' : ''}`}>
          <LoadingLogoOverlay show={isLoading} />
          {stats && (
            <>
              {/* Pricing tiles */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <MiniStat label="Precio" value={fmt(product.price)} />
                <MiniStat label="Costo" value={fmt(product.cost)} />
                <MiniStat label="Margen" value={`${margin}%`} color={marginColor} />
                <MiniStat label="Stock" value={product.unlimited_stock ? 'Ilimitado' : product.stock} />
              </div>

              {/* Sales tiles */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <MiniStat label="Unidades vendidas" value={stats?.units_sold ?? 0} icon={ShoppingCart} />
                <MiniStat label="Ingresos totales"  value={fmt(stats?.total_revenue)} icon={DollarSign} />
                <MiniStat label="Ganancia total"    value={fmt(stats?.total_profit)} icon={TrendingUp} color="emerald" />
                <MiniStat label="Venta promedio"    value={fmt(stats?.avg_sale_amount)} icon={BarChart3} />
              </div>

              {/* Monthly revenue chart */}
              <div className="card p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Ingresos — últimos 6 meses</h3>
                {!hasRevenue ? (
                  <div className="flex items-center justify-center h-32 text-gray-300 text-sm">Aún no hay suficiente historial para ver una tendencia</div>
                ) : (
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={monthly} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94A3B8' }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '12px' }} formatter={v => [fmt(v), 'Ingresos']} />
                      <Bar dataKey="revenue" fill="#F97316" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Recent sales table */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Ventas recientes</h3>
                {stats.recent_sales.length === 0 ? (
                  <div className="text-center text-gray-400 text-sm py-6">Aún no hay ventas de este producto</div>
                ) : (
                  <>
                    {/* Desktop/tablet — full table */}
                    <div className="hidden sm:block overflow-x-auto rounded-xl border border-gray-100">
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-100">
                            <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Fecha</th>
                            <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Socio</th>
                            <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Cant.</th>
                            <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</th>
                            <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Ganancia</th>
                            <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Método</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stats.recent_sales.map((s, idx) => (
                            <tr key={s.id} className={`border-b border-gray-50 ${idx % 2 === 1 ? 'bg-gray-50/40' : ''}`}>
                              <td className="px-3 py-2.5 align-top text-gray-500 text-xs tabular-nums">{new Date(s.date + 'T12:00').toLocaleDateString('es-MX')}</td>
                              <td className="px-3 py-2.5 align-top text-gray-700">{s.member ?? 'Venta directa'}</td>
                              <td className="px-3 py-2.5 align-top tabular-nums">{s.quantity}</td>
                              <td className="px-3 py-2.5 align-top font-semibold text-gray-800 tabular-nums">{fmt(s.total_amount)}</td>
                              <td className="px-3 py-2.5 align-top text-emerald-600 tabular-nums">{fmt(s.profit)}</td>
                              <td className="px-3 py-2.5 align-top text-gray-500 text-xs hidden md:table-cell">{METHOD_LABELS[s.payment_method] ?? s.payment_method}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile — stacked cards, no horizontal scroll */}
                    <div className="sm:hidden divide-y divide-gray-100 rounded-xl border border-gray-100">
                      {stats.recent_sales.map(s => (
                        <div key={s.id} className="p-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-gray-700 text-sm truncate">{s.member ?? 'Venta directa'}</p>
                            <span className="font-semibold text-gray-800 tabular-nums text-sm flex-shrink-0">{fmt(s.total_amount)}</span>
                          </div>
                          <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 mt-1 text-xs text-gray-500">
                            <span className="tabular-nums">{new Date(s.date + 'T12:00').toLocaleDateString('es-MX')}</span>
                            <span>· Cant. {s.quantity}</span>
                            <span className="text-emerald-600 tabular-nums">· Ganancia {fmt(s.profit)}</span>
                            <span>· {METHOD_LABELS[s.payment_method] ?? s.payment_method}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>
        </Skeleton>

        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cerrar</button>
          <button onClick={() => { onClose(); onEdit(product) }} className="btn-primary flex-1 flex items-center justify-center gap-1.5">
            <Pencil className="w-3.5 h-3.5" /> Editar
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ───────────────────────────────────────────────────
export default function Products() {
  const qc = useQueryClient()
  const [view, setView]                 = useState('inventory') // 'inventory' | 'sales'
  const [page, setPage]                 = useState(1)
  const [pageSize, setPageSize]         = useState(12)
  const [search, setSearch]             = useState('')
  const [categoryFilter, setCategory]   = useState('')
  const [statusFilter, setStatus]       = useState('')
  const [lowStockOnly, setLowStockOnly] = useState(false)
  const [outOfStockOnly, setOutOfStockOnly] = useState(false)
  const [modalProduct, setModalProduct] = useState(undefined) // undefined = closed, null = new, obj = edit
  const [showSaleCart, setShowSaleCart] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [detailTarget, setDetailTarget] = useState(null)
  const [salesPage, setSalesPage]       = useState(1)
  const [salesPageSize, setSalesPageSize] = useState(12)
  const [salesSort, onSalesSort]        = useSort('date', 'desc')
  const handleSalesSort = key => { onSalesSort(key); setSalesPage(1) }
  const handlePageSize = n => { setPageSize(n); setPage(1) }
  const handleSalesPageSize = n => { setSalesPageSize(n); setSalesPage(1) }

  const params = {
    page, per_page: pageSize,
    ...(search.trim() && { search: search.trim() }),
    ...(categoryFilter && { category: categoryFilter }),
    ...(statusFilter && { status: statusFilter }),
    ...(lowStockOnly && { low_stock: 1 }),
    ...(outOfStockOnly && { out_of_stock: 1 }),
  }

  const { data, isLoading } = useQuery({
    queryKey: ['products', params],
    queryFn: () => api.get('/products', { params }).then(r => r.data),
    keepPreviousData: true,
    enabled: view === 'inventory',
  })

  const { data: summary, isLoading: loadingProductsSummary } = useQuery({
    queryKey: ['products-summary'],
    queryFn: () => api.get('/products/summary').then(r => r.data),
  })

  const { data: salesData, isLoading: loadingSales } = useQuery({
    queryKey: ['product-sales', salesPage, salesPageSize, salesSort],
    queryFn: () => api.get('/product-sales', { params: { page: salesPage, per_page: salesPageSize, sort_by: salesSort.by, sort_dir: salesSort.dir } }).then(r => r.data),
    keepPreviousData: true,
    enabled: view === 'sales',
  })

  const deleteMutation = useMutation({
    mutationFn: id => api.delete(`/products/${id}`),
    onSuccess: () => {
      qc.invalidateQueries(['products'])
      qc.invalidateQueries(['products-summary'])
      toast.success('Producto eliminado')
    },
    onError: (err) => toast.error(err.response?.data?.message ?? 'No se pudo eliminar el producto'),
  })

  const products   = data?.data ?? []
  const pagination = data ? { current: data.current_page, last: data.last_page, total: data.total } : null
  const sales      = salesData?.data ?? []
  const salesPagination = salesData ? { current: salesData.current_page, last: salesData.last_page, total: salesData.total } : null

  return (
    <>
    <LoadingLogoOverlay show={isLoading || loadingProductsSummary || loadingSales} />
    <div className="space-y-8">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Productos</h2>
          <p className="text-sm text-gray-500 mt-0.5">{pagination?.total ?? 0} en catálogo</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowSaleCart(true)} className="btn-secondary">
            <ShoppingCart className="w-4 h-4" /> Vender
          </button>
          <button onClick={() => setModalProduct(null)} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Nuevo producto
          </button>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <Skeleton name="products-summary" loading={loadingProductsSummary}>
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Boxes}      title="Productos activos" value={summary.active_products} color="indigo" />
          <StatCard icon={DollarSign} title="Valor de inventario" value={fmt(summary.inventory_value)} color="emerald" />
          <StatCard icon={TrendingUp} title="Ganancia total"    value={fmt(summary.total_profit)} color="orange" />
          <StatCard icon={AlertTriangle} title="Bajo stock / Agotados"
            value={`${summary.low_stock_count} / ${summary.out_of_stock_count}`} color="red" />
        </div>
      )}
      </Skeleton>

      {/* ── View toggle ── */}
      <div className="flex rounded-xl border border-gray-200 bg-gray-50 p-1 gap-1 w-fit">
        <button onClick={() => setView('inventory')}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${view === 'inventory' ? 'bg-white shadow text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}>
          Inventario
        </button>
        <button onClick={() => setView('sales')}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${view === 'sales' ? 'bg-white shadow text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}>
          Ventas
        </button>
      </div>

      {view === 'inventory' ? (
        <>
          {/* ── Filters ── */}
          <div className="card p-4 flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
                placeholder="Buscar por nombre o SKU..." className="input pl-9" />
            </div>
            {summary?.by_category?.length > 0 && (
              <select value={categoryFilter} onChange={e => { setCategory(e.target.value); setPage(1) }} className="input sm:w-44">
                <option value="">Todas las categorías</option>
                {summary.by_category.map(c => <option key={c.category} value={c.category}>{c.category}</option>)}
              </select>
            )}
            <select value={statusFilter} onChange={e => { setStatus(e.target.value); setPage(1) }} className="input sm:w-40">
              <option value="">Todos los estados</option>
              <option value="active">Activo</option>
              <option value="inactive">Inactivo</option>
            </select>
            <button onClick={() => { setLowStockOnly(v => !v); setPage(1) }}
              className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${lowStockOnly ? 'bg-amber-50 border-amber-300 text-amber-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
              Bajo stock
            </button>
            <button onClick={() => { setOutOfStockOnly(v => !v); setPage(1) }}
              className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${outOfStockOnly ? 'bg-red-50 border-red-300 text-red-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
              Agotados
            </button>
            {(search || categoryFilter || statusFilter || lowStockOnly || outOfStockOnly) && (
              <button onClick={() => { setSearch(''); setCategory(''); setStatus(''); setLowStockOnly(false); setOutOfStockOnly(false); setPage(1) }}
                className="btn-ghost text-xs flex items-center gap-1">
                <X className="w-3 h-3" /> Limpiar
              </button>
            )}
          </div>

          {/* ── Grid ── */}
          <Skeleton name="products-grid" loading={isLoading}>
          {products.length === 0 ? (
            <div className="card flex flex-col items-center justify-center h-40 text-gray-400">
              <Package className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-sm">Sin productos registrados</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {products.map(p => {
                const margin = marginPercent(p)
                const soldCount = p.units_sold ?? 0
                const outOfStock = !p.unlimited_stock && p.stock <= 0
                return (
                  <div key={p.id} className="card p-4 flex flex-col gap-3 group hover:shadow-lg transition-shadow duration-200">
                    <div
                      onClick={() => setDetailTarget(p)}
                      className="relative w-full aspect-[4/3] rounded-xl overflow-hidden border border-gray-100 cursor-pointer"
                    >
                      <ProductImage
                        src={p.image_url} alt={p.name} iconClassName="w-9 h-9"
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      {outOfStock && (
                        <div className="absolute inset-0 bg-black/45 flex items-center justify-center">
                          <span className="px-2.5 py-1 rounded-full bg-white/95 text-red-600 text-xs font-bold">Agotado</span>
                        </div>
                      )}
                      {soldCount > 0 && (
                        <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-full bg-black/60 backdrop-blur-sm text-white text-[10px] font-semibold">
                          <ShoppingCart className="w-3 h-3" /> {soldCount} vendidos
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setDetailTarget(p)}>
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-gray-800 text-sm truncate">{p.name}</p>
                        <span className={STATUS_CLASS[p.status]}>{STATUS_LABEL[p.status]}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {p.category && <span className="badge-indigo">{p.category}</span>}
                        <span className="badge-gray font-mono">{p.sku}</span>
                        <span className={marginBadgeClass(margin)}>{margin}% margen</span>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <div>
                          <p className="text-base font-bold text-gray-900">{fmt(p.price)}</p>
                          {Number(p.cost) > 0 && <p className="text-xs text-gray-400">costo {fmt(p.cost)}</p>}
                        </div>
                        {stockBadge(p)}
                      </div>
                    </div>
                    <div className="flex gap-2 pt-2 border-t border-gray-50">
                      <button onClick={() => setDetailTarget(p)}
                        className="btn-primary flex-1 text-xs py-1.5 flex items-center justify-center gap-1.5">
                        <BarChart3 className="w-3.5 h-3.5" /> Ver detalles
                      </button>
                      <button onClick={() => setModalProduct(p)} className="btn-secondary text-xs py-1.5 px-2.5">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setDeleteTarget(p)} className="btn-secondary text-xs py-1.5 px-2.5 text-red-500 hover:text-red-700">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {pagination && (
            <Pagination page={pagination.current} lastPage={pagination.last} total={pagination.total} onPageChange={setPage} itemLabel="productos" pageSize={pageSize} onPageSizeChange={handlePageSize} />
          )}
          </Skeleton>
        </>
      ) : (
        <Skeleton name="products-sales-table" loading={loadingSales}>
        <div className="card overflow-hidden">
          {sales.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400">
              <ShoppingCart className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-sm">Sin ventas registradas</p>
            </div>
          ) : (
            <>
              {/* Desktop/tablet — full table */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b-2 border-gray-100">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Producto</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Socio</th>
                      <SortableTh sortKey="quantity" sort={salesSort} onSort={handleSalesSort} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Cant.</SortableTh>
                      <SortableTh sortKey="total_amount" sort={salesSort} onSort={handleSalesSort} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</SortableTh>
                      <SortableTh sortKey="profit" sort={salesSort} onSort={handleSalesSort} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Ganancia</SortableTh>
                      <SortableTh sortKey="payment_method" sort={salesSort} onSort={handleSalesSort} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Método</SortableTh>
                      <SortableTh sortKey="date" sort={salesSort} onSort={handleSalesSort} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Fecha</SortableTh>
                    </tr>
                  </thead>
                  <tbody>
                    {sales.map((s, idx) => (
                      <tr key={s.id} className={`border-b border-gray-50 ${idx % 2 === 1 ? 'bg-gray-50/40' : ''}`}>
                        <td className="px-4 py-3.5 align-top">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg overflow-hidden border border-gray-100 flex-shrink-0">
                              <ProductImage src={s.product?.image_url} alt="" className="w-full h-full object-cover" iconClassName="w-4 h-4" />
                            </div>
                            <span className="font-medium text-gray-800">{s.product?.name ?? '—'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 align-top text-gray-500">
                          {s.member ? `${s.member.first_name} ${s.member.last_name}` : 'Venta directa'}
                        </td>
                        <td className="px-4 py-3.5 align-top tabular-nums">{s.quantity}</td>
                        <td className="px-4 py-3.5 align-top font-semibold text-gray-800 tabular-nums">{fmt(s.total_amount)}</td>
                        <td className="px-4 py-3.5 align-top text-emerald-600 tabular-nums">{fmt(s.profit)}</td>
                        <td className="px-4 py-3.5 align-top text-gray-500 text-xs hidden lg:table-cell">{METHOD_LABELS[s.payment_method] ?? s.payment_method}</td>
                        <td className="px-4 py-3.5 align-top text-gray-500 text-xs tabular-nums">{new Date(s.date + 'T12:00').toLocaleDateString('es-MX')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile — stacked cards, no horizontal scroll */}
              <div className="lg:hidden divide-y divide-gray-100">
                {sales.map(s => (
                  <div key={s.id} className="p-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-lg overflow-hidden border border-gray-100 flex-shrink-0">
                        <ProductImage src={s.product?.image_url} alt="" className="w-full h-full object-cover" iconClassName="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-800 truncate">{s.product?.name ?? '—'}</p>
                        <p className="text-xs text-gray-500 truncate">
                          {s.member ? `${s.member.first_name} ${s.member.last_name}` : 'Venta directa'}
                        </p>
                      </div>
                      <span className="font-semibold text-gray-800 tabular-nums flex-shrink-0">{fmt(s.total_amount)}</span>
                    </div>
                    <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 mt-2 text-xs text-gray-500">
                      <span>Cant. {s.quantity}</span>
                      <span className="text-emerald-600 tabular-nums">· Ganancia {fmt(s.profit)}</span>
                      <span>· {METHOD_LABELS[s.payment_method] ?? s.payment_method}</span>
                      <span className="tabular-nums">· {new Date(s.date + 'T12:00').toLocaleDateString('es-MX')}</span>
                    </div>
                  </div>
                ))}
              </div>

              {salesPagination && (
                <Pagination page={salesPagination.current} lastPage={salesPagination.last} total={salesPagination.total} onPageChange={setSalesPage} itemLabel="ventas" pageSize={salesPageSize} onPageSizeChange={handleSalesPageSize} />
              )}
            </>
          )}
        </div>
        </Skeleton>
      )}

      {modalProduct !== undefined && <ProductModal product={modalProduct} onClose={() => setModalProduct(undefined)} />}
      {showSaleCart && <SaleCartModal onClose={() => setShowSaleCart(false)} />}
      {detailTarget && (
        <ProductDetailModal
          product={detailTarget}
          onClose={() => setDetailTarget(null)}
          onEdit={setModalProduct}
        />
      )}
      {deleteTarget && (
        <ConfirmModal
          title="¿Eliminar producto?"
          message={`"${deleteTarget.name}" se eliminará permanentemente. Si tiene ventas registradas, no podrá eliminarse.`}
          confirmLabel="Eliminar"
          onConfirm={() => { deleteMutation.mutate(deleteTarget.id); setDeleteTarget(null) }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
    </>
  )
}
