import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Skeleton } from 'boneyard-js/react'
import { Plus, Search, Edit2, Trash2, Mail, Phone, User } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../api/axios'
import ConfirmModal from '../ConfirmModal'
import TrainerModal from './TrainerModal'
import { LoadingLogoOverlay } from '../SkeletonLogoMark'
import { avatarColor } from '../../utils/avatarColor'
import useSort from '../../hooks/useSort'
import SortableTh from '../SortableTh'
import Pagination from '../Pagination'

export default function TrainerTable() {
  const qc = useQueryClient()
  const [search, setSearch]             = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [modal, setModal]               = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [page, setPage]                 = useState(1)
  const [pageSize, setPageSize]         = useState(12)
  const [sort, onSort]                  = useSort('first_name', 'asc')
  const handleSort = key => { onSort(key); setPage(1) }
  const handlePageSize = n => { setPageSize(n); setPage(1) }

  const { data: trainers = [], isLoading } = useQuery({
    queryKey: ['trainers-all'],
    queryFn: () => api.get('/trainers').then(r => r.data),
  })

  const { data: classes = [] } = useQuery({
    queryKey: ['classes'],
    queryFn: () => api.get('/classes').then(r => r.data),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/trainers/${id}`),
    onSuccess: () => {
      qc.invalidateQueries(['trainers-all'])
      qc.invalidateQueries(['trainers'])
      qc.invalidateQueries(['classes'])
      toast.success('Entrenador eliminado')
    },
    onError: () => toast.error('Error al eliminar'),
  })

  const classesByTrainer = (trainerId) => classes.filter(c => c.trainer_id === trainerId).length

  const filtered = trainers.filter(t => {
    const matchSearch = `${t.first_name} ${t.last_name} ${t.specialty ?? ''}`.toLowerCase().includes(search.toLowerCase())
    const matchStatus = !statusFilter || t.status === statusFilter
    return matchSearch && matchStatus
  })

  // All trainer data is already loaded client-side (no server pagination for
  // this list) — sort and page the array in place instead of round-tripping.
  const sorted = [...filtered].sort((a, b) => {
    if (!sort.by) return 0
    const av = a[sort.by] ?? ''
    const bv = b[sort.by] ?? ''
    const cmp = String(av).localeCompare(String(bv), 'es')
    return sort.dir === 'asc' ? cmp : -cmp
  })
  const lastPage = Math.max(1, Math.ceil(sorted.length / pageSize))
  const paged = sorted.slice((page - 1) * pageSize, page * pageSize)

  return (
    <>
    <LoadingLogoOverlay show={isLoading} />
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-900">Entrenadores</h3>
          <p className="text-sm text-gray-500 mt-0.5">{trainers.length} registrados</p>
        </div>
        <button onClick={() => setModal('create')} className="btn-primary">
          <Plus className="w-4 h-4" /> Nuevo entrenador
        </button>
      </div>

      <div className="card p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Buscar por nombre o especialidad…"
            className="input pl-9"
          />
        </div>
        <div className="flex rounded-xl border border-gray-200 bg-gray-50 p-1 gap-1 flex-shrink-0">
          {[{ id: '', label: 'Todos' }, { id: 'active', label: 'Activos' }, { id: 'inactive', label: 'Inactivos' }].map(f => (
            <button
              key={f.id}
              onClick={() => { setStatusFilter(f.id); setPage(1) }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                ${statusFilter === f.id ? 'bg-white shadow text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <Skeleton name="trainers-table" loading={isLoading}>
      <div className="card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <User className="w-10 h-10 mb-2 opacity-30" />
            <p className="text-sm">No se encontraron entrenadores</p>
          </div>
        ) : (
          <>
            {/* Desktop/tablet — full table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs text-gray-400 uppercase tracking-wide">
                    <SortableTh sortKey="first_name" sort={sort} onSort={handleSort} className="px-4 py-3 font-medium">Nombre</SortableTh>
                    <SortableTh sortKey="specialty" sort={sort} onSort={handleSort} className="px-4 py-3 font-medium">Especialidad</SortableTh>
                    <th className="px-4 py-3 font-medium">Contacto</th>
                    <th className="px-4 py-3 font-medium">Clases</th>
                    <SortableTh sortKey="status" sort={sort} onSort={handleSort} className="px-4 py-3 font-medium">Estado</SortableTh>
                    <th className="px-4 py-3 font-medium text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {paged.map(t => (
                    <tr key={t.id} className="hover:bg-gray-50/60">
                      <td className="px-4 py-3 align-top w-full max-w-0">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${avatarColor(t.id)} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                            {t.first_name?.[0]}{t.last_name?.[0]}
                          </div>
                          <span className="font-medium text-gray-900 truncate">{t.first_name} {t.last_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top text-gray-600">{t.specialty || <span className="text-gray-300">—</span>}</td>
                      <td className="px-4 py-3 align-top text-gray-600">
                        <div className="flex flex-col gap-0.5 text-xs">
                          {t.email && <span className="flex items-center gap-1 whitespace-nowrap"><Mail className="w-3 h-3 text-gray-400 flex-shrink-0" />{t.email}</span>}
                          {t.phone && <span className="flex items-center gap-1 whitespace-nowrap"><Phone className="w-3 h-3 text-gray-400 flex-shrink-0" />{t.phone}</span>}
                          {!t.email && !t.phone && <span className="text-gray-300">—</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span className="badge badge-indigo">{classesByTrainer(t.id)}</span>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span className={`badge ${t.status === 'active' ? 'badge-green' : 'badge-gray'}`}>
                          {t.status === 'active' ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => setModal(t)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setDeleteTarget(t)} className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile — stacked cards, no horizontal scroll */}
            <div className="lg:hidden divide-y divide-gray-50">
              {paged.map(t => (
                <div key={t.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${avatarColor(t.id)} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                        {t.first_name?.[0]}{t.last_name?.[0]}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 truncate">{t.first_name} {t.last_name}</p>
                        {t.specialty && <p className="text-xs text-gray-500 truncate">{t.specialty}</p>}
                      </div>
                    </div>
                    <span className={`badge flex-shrink-0 ${t.status === 'active' ? 'badge-green' : 'badge-gray'}`}>
                      {t.status === 'active' ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>

                  {(t.email || t.phone) && (
                    <div className="flex flex-col gap-0.5 text-xs text-gray-600 mt-2">
                      {t.email && <span className="flex items-center gap-1.5"><Mail className="w-3 h-3 text-gray-400 flex-shrink-0" />{t.email}</span>}
                      {t.phone && <span className="flex items-center gap-1.5"><Phone className="w-3 h-3 text-gray-400 flex-shrink-0" />{t.phone}</span>}
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-gray-50">
                    <span className="badge badge-indigo">{classesByTrainer(t.id)} clase{classesByTrainer(t.id) !== 1 ? 's' : ''}</span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setModal(t)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setDeleteTarget(t)} className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <Pagination page={page} lastPage={lastPage} total={sorted.length} onPageChange={setPage} itemLabel="entrenadores" pageSize={pageSize} onPageSizeChange={handlePageSize} />
          </>
        )}
      </div>
      </Skeleton>

      {modal && <TrainerModal trainer={modal === 'create' ? null : modal} onClose={() => setModal(null)} />}
      {deleteTarget && (
        <ConfirmModal
          title={`¿Eliminar a ${deleteTarget.first_name} ${deleteTarget.last_name}?`}
          message={classesByTrainer(deleteTarget.id) > 0
            ? `Sus ${classesByTrainer(deleteTarget.id)} clase(s) asignada(s) quedarán sin entrenador.`
            : 'Esta acción eliminará al entrenador permanentemente.'}
          onConfirm={() => { deleteMutation.mutate(deleteTarget.id); setDeleteTarget(null) }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
    </>
  )
}
