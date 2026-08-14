import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { X, Loader2, Users } from 'lucide-react'
import api from '../../api/axios'
import useLockBodyScroll from '../../hooks/useLockBodyScroll'

export default function ClassAttendancePanel({ gymClass, onClose }) {
  useLockBodyScroll()

  const { data: visits = [], isLoading } = useQuery({
    queryKey: ['class-visits', gymClass.id],
    queryFn: () => api.get('/visits', { params: { class_id: gymClass.id, per_page: 500 } }).then(r => r.data.data ?? []),
  })

  const attendance = useMemo(() => {
    const map = new Map()
    visits.forEach(v => {
      if (!v.member) return
      const entry = map.get(v.member.id) ?? { member: v.member, count: 0 }
      entry.count += 1
      map.set(v.member.id, entry)
    })
    return [...map.values()].sort((a, b) => b.count - a.count)
  }, [visits])

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{gymClass.name}</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {attendance.length} miembros distintos · {visits.length} asistencias · Capacidad {gymClass.capacity}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-4">
          {isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-indigo-600" /></div>
          ) : attendance.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <Users className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-sm">Aún no hay asistencias registradas</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {attendance.map(({ member, count }) => (
                <div key={member.id} className="flex items-center justify-between px-2 py-2.5">
                  <span className="text-sm text-gray-800">{member.first_name} {member.last_name}</span>
                  <span className="badge badge-indigo">{count} visita{count !== 1 ? 's' : ''}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
