import { AlertTriangle, Trash2 } from 'lucide-react'
import useLockBodyScroll from '../hooks/useLockBodyScroll'

export default function ConfirmModal({
  title      = '¿Estás seguro?',
  message    = 'Esta acción no se puede deshacer.',
  confirmLabel = 'Eliminar',
  cancelLabel  = 'Cancelar',
  danger     = true,
  onConfirm,
  onCancel,
}) {
  useLockBodyScroll()

  return (
    <div className="fixed inset-0 z-[310] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onCancel}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
        style={{ animation: 'confirmPop 150ms cubic-bezier(0.34,1.56,0.64,1) both' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Top bar */}
        <div className={`h-1.5 w-full ${danger ? 'bg-red-500' : 'bg-indigo-500'}`} />

        <div className="p-6">
          {/* Icon */}
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4
            ${danger ? 'bg-red-50' : 'bg-indigo-50'}`}>
            {danger
              ? <Trash2 className="w-6 h-6 text-red-500" />
              : <AlertTriangle className="w-6 h-6 text-indigo-500" />
            }
          </div>

          {/* Text */}
          <h3 className="text-base font-semibold text-gray-900 mb-1">{title}</h3>
          <p className="text-sm text-gray-500 leading-relaxed">{message}</p>

          {/* Actions */}
          <div className="flex gap-3 mt-6">
            <button
              onClick={onCancel}
              className="btn-secondary flex-1"
            >
              {cancelLabel}
            </button>
            <button
              onClick={onConfirm}
              className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg
                font-medium text-sm transition-all duration-150 text-white shadow-sm
                ${danger
                  ? 'bg-red-600 hover:bg-red-700 active:bg-red-800'
                  : 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800'
                }`}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes confirmPop {
          from { opacity: 0; transform: scale(0.92) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  )
}
