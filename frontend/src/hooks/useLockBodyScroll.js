import { useEffect } from 'react'

let lockCount = 0

/**
 * Locks page scroll while active. Pass no argument when the calling component
 * only ever renders while its modal is open (the common case). Pass an explicit
 * boolean when the modal is rendered inline behind a condition inside a component
 * that stays mounted either way (e.g. `{open && <div className="fixed inset-0">}`),
 * so the lock can track `open` instead of the host component's own mount lifecycle.
 *
 * Uses a shared counter so stacked/nested modals (e.g. a confirm dialog opened on
 * top of another modal) don't unlock scroll until the last one closes.
 */
export default function useLockBodyScroll(active = true) {
  useEffect(() => {
    if (!active) return undefined

    if (lockCount === 0) {
      document.body.style.overflow = 'hidden'
    }
    lockCount++

    return () => {
      lockCount--
      if (lockCount === 0) {
        document.body.style.overflow = ''
      }
    }
  }, [active])
}
