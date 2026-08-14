import { useState } from 'react'
import AgendaTab from '../components/classes/AgendaTab'
import ClassesTab from '../components/classes/ClassesTab'
import TrainerTable from '../components/classes/TrainerTable'
import PrivateSessionProgress from '../components/classes/PrivateSessionProgress'
import ClassAttendancePanel from '../components/classes/ClassAttendancePanel'

const TABS = [
  ['agenda', 'Agenda'],
  ['clases', 'Clases'],
  ['entrenadores', 'Entrenadores'],
]

export default function Classes() {
  const [tab, setTab] = useState('agenda')
  const [progressTarget, setProgressTarget]     = useState(null)
  const [attendanceTarget, setAttendanceTarget] = useState(null)

  return (
    <div className="space-y-5">
      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors
              ${tab === id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'agenda' && (
        <AgendaTab onOpenProgress={setProgressTarget} onOpenAttendance={setAttendanceTarget} />
      )}
      {tab === 'clases' && (
        <ClassesTab onOpenProgress={setProgressTarget} onOpenAttendance={setAttendanceTarget} />
      )}
      {tab === 'entrenadores' && <TrainerTable />}

      {progressTarget && (
        <PrivateSessionProgress gymClass={progressTarget} onClose={() => setProgressTarget(null)} />
      )}
      {attendanceTarget && (
        <ClassAttendancePanel gymClass={attendanceTarget} onClose={() => setAttendanceTarget(null)} />
      )}
    </div>
  )
}
