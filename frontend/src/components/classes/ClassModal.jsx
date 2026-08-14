import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm, useFieldArray } from 'react-hook-form'
import {
  X, Calendar, Loader2, ChevronDown, ChevronUp, PlusCircle,
  UserPlus, Users, UserCheck,
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../api/axios'
import MemberPicker from './MemberPicker'
import useLockBodyScroll from '../../hooks/useLockBodyScroll'

const DAYS    = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
const DAYS_ES = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo']

// ── Schedule row ──────────────────────────────────────────────────────────────
function ScheduleRow({ index, register, remove }) {
  return (
    <div className="grid grid-cols-[minmax(90px,1fr)_minmax(90px,1fr)_minmax(90px,1fr)_minmax(110px,1fr)_auto] gap-2 items-end min-w-[480px] sm:min-w-0">
      <div>
        {index === 0 && <label className="label text-xs">Día</label>}
        <select {...register(`schedules.${index}.day_of_week`)} className="input text-xs py-2">
          {DAYS.map((d, i) => <option key={d} value={d}>{DAYS_ES[i]}</option>)}
        </select>
      </div>
      <div>
        {index === 0 && <label className="label text-xs">Inicio</label>}
        <input {...register(`schedules.${index}.start_time`)} type="time" className="input text-xs py-2" />
      </div>
      <div>
        {index === 0 && <label className="label text-xs">Fin</label>}
        <input {...register(`schedules.${index}.end_time`)} type="time" className="input text-xs py-2" />
      </div>
      <div>
        {index === 0 && <label className="label text-xs">Sala (opcional)</label>}
        <input {...register(`schedules.${index}.room`)} className="input text-xs py-2" placeholder="Sala A…" />
      </div>
      <button
        type="button"
        onClick={() => remove(index)}
        className={`p-2 rounded-lg text-red-400 hover:bg-red-50 transition-colors ${index === 0 ? 'mt-5' : ''}`}
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

// ── Class modal ───────────────────────────────────────────────────────────────
export default function ClassModal({ gymClass, onClose }) {
  const qc      = useQueryClient()
  const isEdit  = !!gymClass
  const [schedOpen, setSchedOpen] = useState(!!(gymClass?.schedules?.length))

  useLockBodyScroll()

  const { data: trainers = [] } = useQuery({
    queryKey: ['trainers'],
    queryFn: () => api.get('/trainers', { params: { active_only: 1 } }).then(r => r.data),
  })

  const [addingTrainer, setAddingTrainer] = useState(false)
  const [newFirst, setNewFirst]           = useState('')
  const [newLast, setNewLast]             = useState('')
  const [savingTrainer, setSavingTrainer] = useState(false)
  const [selectedMember, setSelectedMember] = useState(gymClass?.member ?? null)

  const defaultSchedules = (gymClass?.schedules ?? []).map(s => ({
    day_of_week: s.day_of_week,
    start_time:  s.start_time?.slice(0, 5) ?? '',
    end_time:    s.end_time?.slice(0, 5)   ?? '',
    room:        s.room ?? '',
  }))

  const { register, handleSubmit, control, watch, setValue, formState: { errors, isSubmitting } } = useForm({
    defaultValues: {
      name:        gymClass?.name        ?? '',
      description: gymClass?.description ?? '',
      trainer_id:  gymClass?.trainer_id  ?? '',
      capacity:    gymClass?.capacity    ?? 20,
      duration:    gymClass?.duration    ?? 60,
      start_date:  gymClass?.start_date?.slice(0, 10) ?? '',
      difficulty:  gymClass?.difficulty  ?? 'beginner',
      type:            gymClass?.type ?? 'group',
      member_id:       gymClass?.member_id ?? null,
      total_sessions:  gymClass?.total_sessions ?? 10,
      schedules:   defaultSchedules,
    },
  })

  const type = watch('type')
  const completedCount = (gymClass?.sessions ?? []).filter(s => s.status === 'completed').length

  useEffect(() => {
    if (type === 'private') setValue('capacity', 1)
  }, [type, setValue])

  const { fields, append, remove } = useFieldArray({ control, name: 'schedules' })

  const onSubmit = async (data) => {
    if (!isEdit && data.type === 'private' && !selectedMember) {
      toast.error('Selecciona el socio para la sesión privada')
      return
    }

    const payload = {
      ...data,
      schedules: data.schedules?.length ? data.schedules : [],
    }

    if (data.type !== 'private') {
      delete payload.member_id
      delete payload.total_sessions
    }
    if (isEdit) {
      delete payload.type
    }

    try {
      if (isEdit) {
        await api.put(`/classes/${gymClass.id}`, payload)
        toast.success('Clase actualizada')
      } else {
        await api.post('/classes', payload)
        toast.success('Clase creada')
      }
      qc.invalidateQueries(['classes'])
      onClose()
    } catch (err) {
      const msg = Object.values(err.response?.data?.errors ?? {}).flat()[0] ?? err.response?.data?.message ?? 'Error al guardar'
      toast.error(msg)
    }
  }

  async function handleAddTrainer() {
    if (!newFirst.trim() || !newLast.trim()) {
      toast.error('Nombre y apellido del entrenador son obligatorios')
      return
    }
    setSavingTrainer(true)
    try {
      const { data: created } = await api.post('/trainers', {
        first_name: newFirst.trim(),
        last_name:  newLast.trim(),
      })
      await qc.invalidateQueries(['trainers'])
      qc.invalidateQueries(['trainers-all'])
      setValue('trainer_id', String(created.id), { shouldValidate: true })
      setNewFirst('')
      setNewLast('')
      setAddingTrainer(false)
      toast.success('Entrenador agregado')
    } catch (err) {
      const msg = Object.values(err.response?.data?.errors ?? {}).flat()[0] ?? 'Error al agregar entrenador'
      toast.error(msg)
    } finally {
      setSavingTrainer(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-semibold text-gray-900">{isEdit ? 'Editar clase' : 'Nueva clase'}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          {/* Tipo de clase */}
          {!isEdit ? (
            <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-gray-100">
              <button
                type="button"
                onClick={() => setValue('type', 'group')}
                className={`py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1.5
                  ${type === 'group' ? 'bg-white shadow text-indigo-600' : 'text-gray-500'}`}
              >
                <Users className="w-4 h-4" /> Clase conjunta
              </button>
              <button
                type="button"
                onClick={() => setValue('type', 'private')}
                className={`py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1.5
                  ${type === 'private' ? 'bg-white shadow text-violet-600' : 'text-gray-500'}`}
              >
                <UserCheck className="w-4 h-4" /> Sesión privada
              </button>
            </div>
          ) : (
            <span className={`badge ${type === 'private' ? 'badge-purple' : 'badge-blue'}`}>
              {type === 'private' ? 'Sesión privada' : 'Clase conjunta'} · no se puede cambiar
            </span>
          )}

          {/* Nombre + dificultad */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="label">Nombre *</label>
              <input {...register('name', { required: true })} className="input" placeholder="Yoga, Crossfit, Zumba…" />
            </div>
            <div>
              <label className="label">Dificultad</label>
              <select {...register('difficulty')} className="input">
                <option value="beginner">Principiante</option>
                <option value="intermediate">Intermedio</option>
                <option value="advanced">Avanzado</option>
              </select>
            </div>
          </div>

          {/* Descripción */}
          <div>
            <label className="label">Descripción</label>
            <textarea {...register('description')} rows={2} className="input resize-none" placeholder="Breve descripción de la clase…" />
          </div>

          {/* Socio + paquete de sesiones (solo privada) */}
          {type === 'private' && (
            <div className="space-y-3 p-3 rounded-xl bg-violet-50/50 border border-violet-100">
              <div>
                <label className="label">Socio *</label>
                <MemberPicker
                  value={selectedMember}
                  onChange={m => { setSelectedMember(m); setValue('member_id', m?.id ?? null) }}
                />
              </div>
              <div>
                <label className="label">Total de sesiones del paquete *</label>
                <input {...register('total_sessions')} type="number" min={1} max={200} className="input" />
                {isEdit && completedCount > 0 && (
                  <p className="mt-1 text-xs text-gray-500">
                    {completedCount} de {gymClass.total_sessions} ya completadas — no puedes bajar de {completedCount}.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Capacidad + duración + fecha de inicio */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="label">Capacidad</label>
              <input {...register('capacity')} type="number" min={1} max={500} className="input" disabled={type === 'private'} />
            </div>
            <div>
              <label className="label">Duración (min)</label>
              <input {...register('duration')} type="number" min={15} max={480} className="input" />
            </div>
            <div>
              <label className="label">Fecha de inicio</label>
              <input {...register('start_date')} type="date" className="input" />
            </div>
          </div>

          {/* Entrenador */}
          <div>
            <div className="flex items-center justify-between">
              <label className="label">Entrenador asignado *</label>
              <button
                type="button"
                onClick={() => setAddingTrainer(o => !o)}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
              >
                <UserPlus className="w-3.5 h-3.5" /> {addingTrainer ? 'Cancelar' : 'Nuevo entrenador'}
              </button>
            </div>

            {!addingTrainer && (
              <>
                <select {...register('trainer_id', { required: true })} className="input">
                  <option value="">{trainers.length ? 'Selecciona un entrenador…' : 'No hay entrenadores aún'}</option>
                  {trainers.map(t => (
                    <option key={t.id} value={t.id}>{t.first_name} {t.last_name}{t.specialty ? ` — ${t.specialty}` : ''}</option>
                  ))}
                </select>
                {errors.trainer_id && (
                  <p className="mt-1 text-xs text-red-500">Selecciona quién impartirá la clase</p>
                )}
              </>
            )}

            {addingTrainer && (
              <div className="p-3 rounded-xl border border-dashed border-indigo-300 bg-indigo-50/50 space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    value={newFirst}
                    onChange={e => setNewFirst(e.target.value)}
                    className="input text-sm"
                    placeholder="Nombre"
                    autoFocus
                  />
                  <input
                    value={newLast}
                    onChange={e => setNewLast(e.target.value)}
                    className="input text-sm"
                    placeholder="Apellido"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddTrainer}
                  disabled={savingTrainer}
                  className="btn-primary w-full text-xs py-1.5"
                >
                  {savingTrainer ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Guardando…</> : 'Guardar entrenador'}
                </button>
              </div>
            )}
          </div>

          {/* Horarios */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setSchedOpen(o => !o)}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-sm font-medium text-gray-700"
            >
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-500" />
                Horarios
                {fields.length > 0 && (
                  <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-semibold">
                    {fields.length}
                  </span>
                )}
              </div>
              {schedOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>

            {schedOpen && (
              <div className="p-4 space-y-3">
                {fields.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-2">No hay horarios. Agrega uno.</p>
                )}
                <div className="overflow-x-auto -mx-1 px-1 space-y-3">
                  {fields.map((field, index) => (
                    <ScheduleRow key={field.id} index={index} register={register} remove={remove} />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => append({ day_of_week: 'Monday', start_time: '08:00', end_time: '09:00', room: '' })}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-dashed border-indigo-300 text-indigo-600 text-xs font-medium hover:bg-indigo-50 transition-colors"
                >
                  <PlusCircle className="w-4 h-4" /> Agregar horario
                </button>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
            <button type="submit" disabled={isSubmitting} className="btn-primary flex-1">
              {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando…</> : isEdit ? 'Actualizar' : 'Crear clase'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
