import { useState } from 'react'
import { X, Mail, MessageCircle, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../api/axios'
import useLockBodyScroll from '../hooks/useLockBodyScroll'

export default function WelcomeNotifyModal({ member, onClose }) {
  useLockBodyScroll()
  const [sending, setSending] = useState(false)
  const canEmail = !!member.email
  const canWa    = !!member.phone

  async function send(channel) {
    setSending(true)
    try {
      await api.post(`/members/${member.id}/notify`, { type: 'qr', channel })
      toast.success(channel === 'email' ? 'QR enviado al correo' : 'QR enviado por WhatsApp')
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'No se pudo enviar')
    } finally {
      setSending(false)
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-[320] flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={sending ? undefined : onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">¿Enviar bienvenida?</h2>
          <button onClick={onClose} disabled={sending} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-3">
          <p className="text-sm text-gray-500">
            Envía a <span className="font-semibold text-gray-800">{member.first_name}</span> su código QR de acceso y datos de membresía.
          </p>
          <div className="flex flex-col gap-2">
            <button onClick={() => send('email')} disabled={!canEmail || sending}
              className="flex items-center gap-3 p-3 rounded-xl border-2 border-gray-100 hover:border-indigo-200 hover:bg-indigo-50 transition-all disabled:opacity-40 disabled:cursor-not-allowed text-left">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                <Mail className="w-4 h-4 text-indigo-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">Correo electrónico</p>
                <p className="text-xs text-gray-400">{canEmail ? member.email : 'Sin correo registrado'}</p>
              </div>
            </button>
            <button onClick={() => send('whatsapp')} disabled={!canWa || sending}
              className="flex items-center gap-3 p-3 rounded-xl border-2 border-gray-100 hover:border-green-200 hover:bg-green-50 transition-all disabled:opacity-40 disabled:cursor-not-allowed text-left">
              <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                <MessageCircle className="w-4 h-4 text-green-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">WhatsApp</p>
                <p className="text-xs text-gray-400">{canWa ? member.phone : 'Sin teléfono registrado'}</p>
              </div>
            </button>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} disabled={sending} className="btn-secondary w-full">
            {sending ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</> : 'No enviar por ahora'}
          </button>
        </div>
      </div>
    </div>
  )
}
