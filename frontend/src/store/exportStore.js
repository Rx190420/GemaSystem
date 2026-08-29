import { create } from 'zustand'

// Drives the full-screen <ExportOverlay/> shown for every Excel/PDF export
// (see utils/runExport.js, the only place that should call these actions).
//
// phase: 'preparing' (fetching data — cancellable) → 'generating' (building
// the file in memory — cancellable up until it finishes) → 'saving' (handing
// the finished file to the browser — the point of no return, no longer
// cancellable) → 'success' | 'cancelled' | 'error', then back to 'idle'.
export const useExportStore = create((set, get) => ({
  visible: false,
  phase: 'idle',
  label: '',
  fileLabel: '',
  kind: 'excel', // 'excel' | 'pdf' — drives the overlay's icon/accent color
  cancelFn: null,

  start({ label, fileLabel, kind, cancelFn }) {
    set({ visible: true, phase: 'preparing', label, fileLabel, kind, cancelFn })
  },
  setPhase(phase) { set({ phase }) },
  requestCancel() {
    const { phase, cancelFn } = get()
    if (phase !== 'preparing' && phase !== 'generating') return
    cancelFn?.()
    set({ phase: 'cancelling' })
  },
  reset() { set({ visible: false, phase: 'idle', label: '', fileLabel: '', cancelFn: null }) },
}))
