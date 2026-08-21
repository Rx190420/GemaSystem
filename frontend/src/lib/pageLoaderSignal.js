// ─── pageLoaderSignal ───────────────────────────────────────────────────────
// App's full-screen <PageLoader> (z-index 9999) covers the whole page for a
// few seconds on first load. Anything that plays an entrance animation on
// mount underneath it (e.g. the hero's stroke-draw title) finishes before
// the loader ever fades — so it's never actually seen. Components that want
// their entrance animation to be visible should wait for this signal instead
// of firing immediately on mount.

let done = false
const listeners = new Set()

/** Call once, when the splash loader has fully faded out. Idempotent — safe
 *  to call again on later (shorter) loader cycles, e.g. auth transitions. */
export function markPageLoaderDone() {
  if (done) return
  done = true
  listeners.forEach(fn => fn())
  listeners.clear()
}

/** Subscribe to the "loader is gone" moment. Fires immediately if it has
 *  already happened. Returns an unsubscribe function. */
export function onPageLoaderDone(cb) {
  if (done) { cb(); return () => {} }
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export function isPageLoaderDone() {
  return done
}
