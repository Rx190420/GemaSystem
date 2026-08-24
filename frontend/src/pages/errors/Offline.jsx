import { WifiOff } from 'lucide-react'
import ErrorPage from './ErrorPage'

/**
 * Full-page takeover rendered by <OfflineGate> (see App.jsx) whenever
 * useOnlineStatus() reports no connectivity — same family as the 404/403/500
 * screens (shares <ErrorPage>'s shell, watermark, type), but deliberately
 * distinct: no HTTP code (there isn't one — the request never reached
 * anything to answer), amber tone instead of violet/red, an icon in the
 * hero slot instead of digits, and a live "buscando conexión" indicator
 * since this one resolves itself instead of needing a click.
 */
export default function Offline() {
  return (
    <ErrorPage
      icon={WifiOff}
      badge="SIN CONEXIÓN"
      tone="warning"
      title="No hay conexión a internet"
      message="Perdimos la conexión con la red. Revisa tu WiFi o datos móviles — en cuanto vuelva, esta página continúa sola."
      actions={
        <div className="flex items-center gap-2.5 text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60" style={{ background: '#F59E0B' }} />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ background: '#F59E0B' }} />
          </span>
          Buscando conexión…
        </div>
      }
    />
  )
}
