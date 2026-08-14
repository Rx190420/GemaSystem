import { useForm } from 'react-hook-form'
import { useQueryClient } from '@tanstack/react-query'
import { X, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../api/axios'
import useLockBodyScroll from '../../hooks/useLockBodyScroll'

export default function TrainerModal({ trainer, onClose }) {
  const qc     = useQueryClient()
  const isEdit = !!trainer

  useLockBodyScroll()

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    defaultValues: {
      first_name:     trainer?.first_name ?? '',
      last_name:      trainer?.last_name  ?? '',
      email:          trainer?.email      ?? '',
      phone:          trainer?.phone      ?? '',
      specialty:      trainer?.specialty  ?? '',
      certifications: trainer?.certifications ?? '',
      bio:            trainer?.bio        ?? '',
      hire_date:      trainer?.hire_date  ?? '',
      status:         trainer?.status     ?? 'active',
    },
  })

  const onSubmit = async (data) => {
    try {
      if (isEdit) {
        await api.put(`/trainers/${trainer.id}`, data)
        toast.success('Entrenador actualizado')
      } else {
        await api.post('/trainers', data)
        toast.success('Entrenador creado')
      }
      qc.invalidateQueries(['trainers-all'])
      qc.invalidateQueries(['trainers'])
      onClose()
    } catch (err) {
      const msg = Object.values(err.response?.data?.errors ?? {}).flat()[0] ?? 'Error al guardar'
      toast.error(msg)
    }
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEdit ? 'Editar entrenador' : 'Nuevo entrenador'}
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Nombre *</label>
              <input {...register('first_name', { required: true })} className="input" placeholder="Carlos" />
              {errors.first_name && <p className="mt-1 text-xs text-red-500">Obligatorio</p>}
            </div>
            <div>
              <label className="label">Apellido *</label>
              <input {...register('last_name', { required: true })} className="input" placeholder="López" />
              {errors.last_name && <p className="mt-1 text-xs text-red-500">Obligatorio</p>}
            </div>
          </div>

          <div>
            <label className="label">Correo electrónico</label>
            <input {...register('email')} type="email" className="input" placeholder="carlos@gym.com" />
          </div>
          <div>
            <label className="label">Teléfono</label>
            <input {...register('phone')} className="input" placeholder="+52 55 1234 5678" />
          </div>

          <div>
            <label className="label">Especialidad</label>
            <input {...register('specialty')} className="input" placeholder="Crossfit, Yoga, Musculación…" />
          </div>
          <div>
            <label className="label">Certificaciones</label>
            <input {...register('certifications')} className="input" placeholder="NSCA, CrossFit L2, ACE…" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Fecha de contratación</label>
              <input {...register('hire_date')} type="date" className="input" />
            </div>
            <div>
              <label className="label">Estado</label>
              <select {...register('status')} className="input">
                <option value="active">Activo</option>
                <option value="inactive">Inactivo</option>
              </select>
            </div>
          </div>

          <div>
            <label className="label">Biografía / Descripción</label>
            <textarea
              {...register('bio')}
              rows={3}
              className="input resize-none"
              placeholder="Experiencia, logros y estilo de entrenamiento…"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
            <button type="submit" disabled={isSubmitting} className="btn-primary flex-1">
              {isSubmitting
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando…</>
                : isEdit ? 'Actualizar' : 'Crear entrenador'
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
