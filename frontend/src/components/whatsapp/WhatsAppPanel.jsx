import { useState, useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  X, MessageCircle, Wifi, WifiOff, ScanLine, Unlink,
  Loader2, CheckCircle2, Store, Info, Trash2, Eye, RotateCcw,
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../api/axios'
import useLockBodyScroll from '../../hooks/useLockBodyScroll'
import useSort from '../../hooks/useSort'
import SortableTh from '../SortableTh'
import Pagination from '../Pagination'

function LogDetailModal({ log, onClose }) {
  useLockBodyScroll()

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <p className="font-semibold text-gray-900 text-sm">{log.message_type}</p>
            <p className="text-xs text-gray-400 mt-0.5">{log.recipient_name ? `${log.recipient_name} · ` : ''}{log.recipient_phone}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-4">
          <p className="text-xs font-medium text-gray-500 mb-2">Mensaje enviado</p>
          <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans bg-gray-50 rounded-xl p-3 border border-gray-100 max-h-52 overflow-y-auto">
            {log.message_preview || '(sin vista previa)'}
          </pre>
          <p className="text-xs text-gray-400 mt-3">
            {new Date(log.sent_at).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}
          </p>
        </div>
      </div>
    </div>
  )
}

export default function WhatsAppPanel({ onClose }) {
  useLockBodyScroll()
  const qc = useQueryClient()
  const [initiating, setInitiating] = useState(false)
  const [detailLog, setDetailLog] = useState(null)
  const [autoReconnecting, setAutoReconnecting] = useState(false)
  const autoInitDone = useRef(false)

  useEffect(() => {
    const fn = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
  }, [onClose])

  const { data: status = {}, isLoading, refetch } = useQuery({
    queryKey: ['whatsapp-status'],
    queryFn: () => api.get('/whatsapp/status').then(r => r.data),
    refetchInterval: d => d?.ready ? 15_000 : 2_500,
  })

  // Auto-reconnect on panel open when session was previously active
  useEffect(() => {
    if (!status || !status.enabled) return
    if (autoInitDone.current) return
    if (status.started || status.ready) { autoInitDone.current = true; return }
    if (!status.was_connected) return

    autoInitDone.current = true
    setAutoReconnecting(true)
    api.post('/whatsapp/init')
      .catch(() => {})
      .finally(() => setAutoReconnecting(false))
  }, [status])

  const [logsPage, setLogsPage] = useState(1)
  const [logsPageSize, setLogsPageSize] = useState(12)
  const [logsSort, onLogsSort] = useSort('sent_at', 'desc')
  const handleLogsSort = key => { onLogsSort(key); setLogsPage(1) }
  const handleLogsPageSize = n => { setLogsPageSize(n); setLogsPage(1) }

  const { data: logsData, isLoading: logsLoading } = useQuery({
    queryKey: ['whatsapp-logs', logsPage, logsPageSize, logsSort],
    queryFn: () => api.get('/whatsapp/logs', { params: { page: logsPage, per_page: logsPageSize, sort_by: logsSort.by, sort_dir: logsSort.dir } }).then(r => r.data),
    refetchInterval: 30_000,
  })

  const logs = logsData?.data ?? []
  const logsPagination = logsData ? { current: logsData.current_page, last: logsData.last_page, total: logsData.total } : null

  async function handleInit() {
    setInitiating(true)
    try { await api.post('/whatsapp/init'); refetch() }
    catch { toast.error('No se pudo iniciar la sesión') }
    finally { setInitiating(false) }
  }

  async function handleDisconnect() {
    try { await api.delete('/whatsapp/disconnect'); refetch(); toast.success('Sesión desconectada') }
    catch { toast.error('No se pudo desconectar') }
  }

  async function handleDeleteLog(id) {
    try {
      await api.delete(`/whatsapp/logs/${id}`)
      qc.invalidateQueries(['whatsapp-logs'])
    } catch { toast.error('No se pudo eliminar') }
  }

  return (
    <div className="fixed inset-0 z-[310] flex items-end sm:items-center justify-center p-0 sm:p-6">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div
        className="relative flex flex-col w-full sm:max-w-2xl bg-white rounded-t-3xl sm:rounded-2xl overflow-hidden"
        style={{ maxHeight: '92dvh', boxShadow: '0 25px 80px rgba(0,0,0,0.4)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: '#25D366' }}>
              <MessageCircle className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">WhatsApp</p>
              <p className="text-xs text-gray-400">Notificaciones automáticas</p>
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : (
            <>
              {/* Setup guide */}
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Store className="w-4 h-4 text-green-600 flex-shrink-0" />
                  <p className="text-sm font-semibold text-gray-800">
                    WhatsApp Business
                    <span className="text-xs font-normal text-green-700 bg-green-100 px-1.5 py-0.5 rounded-full ml-1.5">Recomendado</span>
                  </p>
                </div>
                <ol className="space-y-2">
                  {[
                    'Descarga WhatsApp Business (gratis) en tu teléfono.',
                    'Regístrate con el número que usará tu gimnasio.',
                    'Configura el nombre del negocio y foto de perfil.',
                    'Pulsa "Iniciar conexión" y escanea el QR desde WhatsApp Business → Dispositivos vinculados.',
                  ].map((step, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                      <span className="flex-shrink-0 w-4 h-4 rounded-full bg-green-600 text-white text-[10px] font-bold flex items-center justify-center mt-0.5">
                        {i + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>
                <div className="flex items-start gap-2 pt-2 border-t border-gray-200">
                  <Info className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-gray-500">
                    También puedes usar tu número personal: los mensajes se verán como si los enviaras tú directamente.
                  </p>
                </div>
              </div>

              {/* Connection */}
              {!status.enabled ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  El bot está desactivado. Actívalo en <code className="font-mono bg-amber-100 px-1 rounded">.env</code> con{' '}
                  <code className="font-mono bg-amber-100 px-1 rounded">WHATSAPP_ENABLED=true</code>.
                </div>
              ) : (
                <>
                  <div className={`rounded-xl border p-4 flex items-center gap-3 ${
                    status.ready       ? 'border-green-200 bg-green-50'
                    : status.started   ? 'border-amber-200 bg-amber-50'
                    : autoReconnecting ? 'border-blue-200 bg-blue-50'
                    : 'border-gray-200 bg-gray-50'
                  }`}>
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      status.ready       ? 'bg-green-100'
                      : status.started   ? 'bg-amber-100'
                      : autoReconnecting ? 'bg-blue-100'
                      : 'bg-gray-100'
                    }`}>
                      {status.ready       ? <Wifi className="w-4.5 h-4.5 text-green-600" />
                        : status.started  ? <ScanLine className="w-4.5 h-4.5 text-amber-600" />
                        : autoReconnecting ? <Loader2 className="w-4.5 h-4.5 text-blue-500 animate-spin" />
                        : <WifiOff className="w-4.5 h-4.5 text-gray-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold ${
                        status.ready       ? 'text-green-800'
                        : status.started   ? 'text-amber-800'
                        : autoReconnecting ? 'text-blue-700'
                        : 'text-gray-600'
                      }`}>
                        {status.ready ? 'Conectado'
                          : status.started ? (status.has_qr ? 'Escanea el QR con WhatsApp' : 'Iniciando…')
                          : autoReconnecting ? 'Reconectando…'
                          : 'Sin conexión'}
                      </p>
                      {status.ready && status.phone && (
                        <p className="text-xs text-green-700 mt-0.5">+{status.phone}{status.name ? ` · ${status.name}` : ''}</p>
                      )}
                      {autoReconnecting && (
                        <p className="text-xs text-blue-500 mt-0.5">Restaurando sesión anterior…</p>
                      )}
                      {!status.started && !initiating && !autoReconnecting && (
                        <p className="text-xs text-gray-400 mt-0.5">Conecta un número para empezar</p>
                      )}
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      {status.ready && (
                        <button onClick={handleDisconnect}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-red-200 text-red-600 hover:bg-red-50 transition-colors">
                          <Unlink className="w-3.5 h-3.5" /> Desconectar
                        </button>
                      )}
                      {!status.started && !autoReconnecting && (
                        <button onClick={handleInit} disabled={initiating}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-60 transition-colors"
                          style={{ background: '#25D366' }}
                          onMouseEnter={e => { if (!initiating) e.currentTarget.style.background = '#1ebe5d' }}
                          onMouseLeave={e => { e.currentTarget.style.background = '#25D366' }}
                        >
                          {initiating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageCircle className="w-3.5 h-3.5" />}
                          {initiating ? 'Iniciando…' : 'Iniciar conexión'}
                        </button>
                      )}
                    </div>
                  </div>

                  {status.started && !status.ready && (
                    <div className="flex flex-col items-center gap-3 py-2">
                      {!status.qr ? (
                        <div className="w-48 h-48 rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-2 text-gray-400">
                          <Loader2 className="w-6 h-6 animate-spin" />
                          <span className="text-xs">Generando QR…</span>
                        </div>
                      ) : (
                        <div className="p-3 bg-white border-2 border-gray-100 rounded-2xl shadow-sm">
                          <img src={status.qr} alt="WhatsApp QR" className="w-48 h-48 rounded" />
                        </div>
                      )}
                      <p className="text-xs text-gray-500 text-center max-w-xs">
                        Abre WhatsApp → <strong>Dispositivos vinculados</strong> → <strong>Vincular dispositivo</strong>
                      </p>
                    </div>
                  )}

                  {status.ready && (
                    <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 space-y-1.5">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Envía automáticamente</p>
                      {[
                        'Bienvenida + código QR al registrar un socio',
                        'Recordatorio de membresía próxima a vencer',
                        'Código de verificación al restablecer contraseña',
                      ].map(item => (
                        <div key={item} className="flex items-center gap-2 text-sm text-gray-600">
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                          {item}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Message log */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-gray-800">Mensajes enviados</p>
                  {logsLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />}
                </div>
                {logs.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-gray-200 py-8 text-center text-sm text-gray-400">
                    Aún no se han enviado mensajes
                  </div>
                ) : (
                  <div className="rounded-xl border border-gray-100 overflow-hidden">
                    {/* Desktop/tablet — full table */}
                    <table className="w-full text-sm hidden sm:table">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                          <SortableTh sortKey="recipient_name" sort={logsSort} onSort={handleLogsSort} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Destinatario</SortableTh>
                          <SortableTh sortKey="message_type" sort={logsSort} onSort={handleLogsSort} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Tipo</SortableTh>
                          <SortableTh sortKey="sent_at" sort={logsSort} onSort={handleLogsSort} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 hidden md:table-cell">Fecha</SortableTh>
                          <th className="px-4 py-2.5 w-16"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {logs.map(log => (
                          <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3">
                              <p className="font-medium text-gray-800 truncate max-w-[130px]">{log.recipient_name || '—'}</p>
                              <p className="text-xs text-gray-400">{log.recipient_phone}</p>
                            </td>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">
                                {log.message_type}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-500 hidden md:table-cell whitespace-nowrap">
                              {new Date(log.sent_at).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1 justify-end">
                                <button onClick={() => setDetailLog(log)}
                                  className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="Ver detalle">
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => handleDeleteLog(log.id)}
                                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Eliminar">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* Mobile — stacked cards, no horizontal scroll */}
                    <div className="sm:hidden divide-y divide-gray-50">
                      {logs.map(log => (
                        <div key={log.id} className="p-3 flex items-center gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-800 truncate">{log.recipient_name || '—'}</p>
                            <p className="text-xs text-gray-400">{log.recipient_phone}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">
                                {log.message_type}
                              </span>
                              <span className="text-xs text-gray-400 whitespace-nowrap">
                                {new Date(log.sent_at).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button onClick={() => setDetailLog(log)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="Ver detalle">
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => handleDeleteLog(log.id)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Eliminar">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {logsPagination && (
                      <Pagination page={logsPagination.current} lastPage={logsPagination.last} total={logsPagination.total} onPageChange={setLogsPage} itemLabel="mensajes" pageSize={logsPageSize} onPageSizeChange={handleLogsPageSize} />
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {detailLog && <LogDetailModal log={detailLog} onClose={() => setDetailLog(null)} />}
      </div>
    </div>
  )
}
