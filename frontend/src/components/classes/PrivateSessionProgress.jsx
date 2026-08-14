import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { X, Loader2, Check, Circle, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../api/axios'
import useLockBodyScroll from '../../hooks/useLockBodyScroll'

const STATUS_META = {
  pending:   { label: 'Pendiente',  icon: Circle,  tile: 'bg-white border-gray-200 text-gray-400 hover:border-violet-300' },
  completed: { label: 'Completada', icon: Check,   tile: 'bg-violet-500 border-violet-500 text-white' },
  missed:    { label: 'Faltó',      icon: XCircle, tile: 'bg-red-500 border-red-500 text-white' },
}

export default function PrivateSessionProgress({ gymClass: initialGymClass, onClose }) {
  const qc = useQueryClient()
  useLockBodyScroll()
  const [editingId, setEditingId]   = useState(null)
  const [draftStatus, setDraftStatus] = useState('pending')
  const [draftDate, setDraftDate]     = useState('')
  const [draftNotes, setDraftNotes]   = useState('')

  // Read the live class from the shared cache so status/notes edits below show up
  // immediately without closing and reopening this modal.
  const { data: classes = [] } = useQuery({
    queryKey: ['classes'],
    queryFn: () => api.get('/classes').then(r => r.data),
  })
  const gymClass = classes.find(c => c.id === initialGymClass.id) ?? initialGymClass

  const sessions  = gymClass.sessions ?? []
  const total     = gymClass.total_sessions ?? 0
  const completed = sessions.filter(s => s.status === 'completed').length
  const pct       = total > 0 ? Math.round((completed / total) * 100) : 0

  const saveMutation = useMutation({
    mutationFn: ({ sessionId, payload }) => api.patch(`/classes/${gymClass.id}/sessions/${sessionId}`, payload),
    onSuccess: () => {
      qc.invalidateQueries(['classes'])
      setEditingId(null)
      toast.success('Sesión actualizada')
    },
    onError: () => toast.error('Error al actualizar la sesión'),
  })

  function openEditor(s) {
    setEditingId(s.id)
    setDraftStatus(s.status)
    setDraftDate(s.scheduled_date?.slice(0, 10) ?? '')
    setDraftNotes(s.notes ?? '')
  }

  function saveEditor() {
    saveMutation.mutate({
      sessionId: editingId,
      payload: { status: draftStatus, scheduled_date: draftDate || null, notes: draftNotes || null },
    })
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{gymClass.name}</h2>
            {gymClass.member && (
              <p className="text-sm text-gray-500 mt-0.5">{gymClass.member.first_name} {gymClass.member.last_name}</p>
            )}
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <div className="flex items-center justify-between text-sm mb-1.5">
              <span className="font-medium text-gray-700">Progreso del paquete</span>
              <span className="text-violet-600 font-semibold">{completed}/{total} · {pct}%</span>
            </div>
            <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #a78bfa, #7c3aed)' }}
              />
            </div>
          </div>

          <div className="grid grid-cols-5 gap-2">
            {sessions.map(s => {
              const meta = STATUS_META[s.status] ?? STATUS_META.pending
              const Icon = meta.icon
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => openEditor(s)}
                  className={`aspect-square rounded-xl flex flex-col items-center justify-center gap-0.5 text-xs font-semibold border-2 transition-colors ${meta.tile}`}
                  title={`Sesión ${s.session_number} — ${meta.label}`}
                >
                  <Icon className="w-4 h-4" />
                  {s.session_number}
                </button>
              )
            })}
          </div>

          {editingId != null && (
            <div className="p-4 rounded-xl border border-violet-200 bg-violet-50/50 space-y-3">
              <p className="text-sm font-semibold text-gray-800">
                Sesión {sessions.find(s => s.id === editingId)?.session_number}
              </p>

              <div className="grid grid-cols-3 gap-2">
                {Object.entries(STATUS_META).map(([value, meta]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setDraftStatus(value)}
                    className={`py-1.5 rounded-lg text-xs font-medium border transition-colors
                      ${draftStatus === value
                        ? value === 'completed' ? 'bg-violet-500 border-violet-500 text-white'
                        : value === 'missed'    ? 'bg-red-500 border-red-500 text-white'
                        : 'bg-gray-600 border-gray-600 text-white'
                        : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'}`}
                  >
                    {meta.label}
                  </button>
                ))}
              </div>

              <div>
                <label className="label text-xs">Fecha</label>
                <input
                  type="date"
                  value={draftDate}
                  onChange={e => setDraftDate(e.target.value)}
                  className="input text-sm"
                />
              </div>

              <div>
                <label className="label text-xs">Notas</label>
                <textarea
                  value={draftNotes}
                  onChange={e => setDraftNotes(e.target.value)}
                  rows={2}
                  className="input text-sm resize-none"
                  placeholder="Observaciones sobre esta sesión…"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setEditingId(null)} className="btn-secondary text-xs flex-1 py-1.5">
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={saveEditor}
                  disabled={saveMutation.isLoading}
                  className="btn-primary text-xs flex-1 py-1.5"
                >
                  {saveMutation.isLoading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Guardando…</> : 'Guardar'}
                </button>
              </div>
            </div>
          )}

          <p className="text-xs text-gray-400 text-center">Toca una sesión para marcar su estado, fecha y notas.</p>
        </div>
      </div>
    </div>
  )
}
