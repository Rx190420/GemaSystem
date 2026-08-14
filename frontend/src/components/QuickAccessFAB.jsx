import { useState } from 'react'
import { Plus, Footprints, CreditCard, Package } from 'lucide-react'

const ACTIONS = [
  {
    id: 'visit',
    label: 'Registrar visita',
    icon: Footprints,
    bg: 'bg-emerald-500 hover:bg-emerald-600',
    shadow: 'shadow-emerald-200',
  },
  {
    id: 'membership',
    label: 'Nueva membresía',
    icon: CreditCard,
    bg: 'bg-indigo-500 hover:bg-indigo-600',
    shadow: 'shadow-indigo-200',
  },
  {
    id: 'product',
    label: 'Productos',
    icon: Package,
    bg: 'bg-orange-500 hover:bg-orange-600',
    shadow: 'shadow-orange-200',
  },
]

export default function QuickAccessFAB({ onOpen }) {
  const [open, setOpen] = useState(false)

  function handleAction(id) {
    setOpen(false)
    onOpen(id)
  }

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
      )}

      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
        {open && ACTIONS.map((action, i) => (
          <div
            key={action.id}
            className="flex items-center gap-3"
            style={{
              animation: `fabSlideIn 180ms ease both`,
              animationDelay: `${i * 40}ms`,
            }}
          >
            <span className="bg-white text-gray-700 text-sm font-medium px-3 py-1.5 rounded-xl shadow-md border border-gray-100 whitespace-nowrap select-none">
              {action.label}
            </span>
            <button
              onClick={() => handleAction(action.id)}
              className={`w-11 h-11 rounded-full text-white shadow-lg ${action.shadow} ${action.bg}
                flex items-center justify-center transition-transform hover:scale-110 active:scale-95`}
            >
              <action.icon className="w-5 h-5" />
            </button>
          </div>
        ))}

        <button
          onClick={() => setOpen(o => !o)}
          title="Acciones rápidas"
          className={`w-14 h-14 rounded-full text-white shadow-xl ring-4 ring-white
            flex items-center justify-center transition-all duration-200
            ${open
              ? 'bg-gray-800 hover:bg-gray-900 rotate-45'
              : 'bg-gradient-to-br from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700'
            }`}
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      <style>{`
        @keyframes fabSlideIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  )
}
