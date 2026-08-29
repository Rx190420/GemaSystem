// Drives every Excel/PDF export through the full-screen <ExportOverlay/>
// instead of firing the browser download the instant the file is ready.
//
// `task(signal, setPhase)` must do the real work and return a build result
// from exportUtils.js / financeExportUtils.js (never save it itself):
//   1. fetch the data — pass `signal` into the axios call so Cancel can
//      actually abort the in-flight request
//   2. call setPhase('generating') right before building the file
//   3. return the { kind, filename, blob|doc } descriptor
//
// This function then holds that descriptor and only calls saveExportResult()
// (the actual point of no return — a real download / native save prompt)
// once the animation has played for at least MIN_VISIBLE_MS, so a fast
// export never feels like it "skipped" the animation. There is no upper
// cap: `task()` is always awaited to real completion first, so a slow
// export simply keeps the animation running past MIN_VISIBLE_MS for as
// long as it actually takes — the floor never turns into a ceiling.
import { useExportStore } from '../store/exportStore'
import { saveExportResult } from './exportShared'

const MIN_VISIBLE_MS = 5000
const SAVE_BEAT_MS   = 300   // brief, deliberate "saving…" beat before the browser takes over
const SUCCESS_MS     = 1600
const END_STATE_MS   = 1000  // how long 'cancelled' / 'error' linger before the overlay closes

const wait = ms => new Promise(res => setTimeout(res, ms))

export async function runExport({ label, fileLabel, kind, task }) {
  const store = useExportStore.getState()
  const controller = new AbortController()
  store.start({ label, fileLabel, kind, cancelFn: () => controller.abort() })

  const startedAt = Date.now()
  let result = null
  let failed = false

  try {
    result = await task(controller.signal, phase => useExportStore.getState().setPhase(phase))
  } catch (err) {
    if (controller.signal.aborted || err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED' || err?.name === 'AbortError') {
      // handled below via the aborted check
    } else {
      failed = true
    }
  }

  const elapsed = Date.now() - startedAt
  if (elapsed < MIN_VISIBLE_MS) await wait(MIN_VISIBLE_MS - elapsed)

  if (controller.signal.aborted) {
    useExportStore.getState().setPhase('cancelled')
    await wait(END_STATE_MS)
    useExportStore.getState().reset()
    return
  }

  if (failed || !result) {
    useExportStore.getState().setPhase('error')
    await wait(END_STATE_MS + 600)
    useExportStore.getState().reset()
    return
  }

  useExportStore.getState().setPhase('saving')
  await wait(SAVE_BEAT_MS)
  saveExportResult(result)

  useExportStore.getState().setPhase('success')
  await wait(SUCCESS_MS)
  useExportStore.getState().reset()
}
