import { useEffect, useState } from 'react'

/**
 * Tracks *real* connectivity, not just navigator.onLine — that flag only
 * means "attached to a network", it stays `true` when connected to a router
 * whose internet uplink is actually down. Two signals feed this:
 *
 *   1. The browser's online/offline events (network interface up/down).
 *   2. A custom 'app:network-error' window event, dispatched by the axios
 *      instance whenever a request never got a response at all (a real
 *      network failure, as opposed to a 4xx/5xx the server did answer with)
 *      — the stronger, more accurate signal of the two.
 *
 * While offline it also polls in the background so recovery is picked up
 * automatically, instead of leaving the visitor stuck until they reload.
 */
export default function useOnlineStatus() {
  const [online, setOnline] = useState(navigator.onLine)

  useEffect(() => {
    const goOnline  = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    window.addEventListener('app:network-error', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('app:network-error', goOffline)
    }
  }, [])

  useEffect(() => {
    if (online) return undefined
    const probe = async () => {
      try {
        // no-cors: any response (even opaque) means the network path works —
        // we only care whether the request could complete, not what it says.
        await fetch(window.location.origin + '/favicon.ico', { method: 'HEAD', cache: 'no-store', mode: 'no-cors' })
        setOnline(true)
      } catch {
        // still offline — try again on the next tick
      }
    }
    const id = setInterval(probe, 4000)
    return () => clearInterval(id)
  }, [online])

  return online
}
