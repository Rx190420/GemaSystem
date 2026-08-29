import { useEffect, useState } from 'react'
import { FileSpreadsheet, FileText } from 'lucide-react'
import { useExportStore } from '../store/exportStore'
import useLockBodyScroll from '../hooks/useLockBodyScroll'

// Single, deliberate look — always light, regardless of the app's own
// dark-mode setting (same precedent as PageLoader always being black).
const ACCENT = '#4F46E5' // indigo-600 — the one accent color used throughout

const KIND_ICON = { excel: FileSpreadsheet, pdf: FileText }
const KIND_LABEL = { excel: 'Excel', pdf: 'PDF' }

// The phase itself is communicated by the title/description text and the
// ring/stamp animation below — no separate per-phase badge icon, to keep
// this to a single visual idea at a time (the file icon) rather than
// layering a second icon on top of it.
const PHASE_META = {
  idle:       { title: '',                        desc: '',                                          tone: 'idle' },
  preparing:  { title: 'Preparando datos',         desc: 'Consultando la información más reciente',   tone: 'active' },
  generating: { title: 'Generando tu archivo',     desc: 'Dando formato y armando el reporte',         tone: 'active' },
  cancelling: { title: 'Cancelando',               desc: 'Deteniendo la descarga',                     tone: 'active' },
  saving:     { title: 'Guardando',                desc: 'Casi listo',                                 tone: 'active' },
  success:    { title: 'Descarga completada',      desc: '',                                           tone: 'success' },
  cancelled:  { title: 'Descarga cancelada',       desc: 'No se generó ningún archivo',                 tone: 'cancelled' },
  error:      { title: 'Ocurrió un error',         desc: 'Inténtalo de nuevo en unos segundos',         tone: 'error' },
}

// The animation now has a 5s floor, so a single static line under the title
// would just sit there. These rotate underneath it instead — small, honest
// beats of what the export is actually doing during each phase — so the
// wait reads as real work happening, not a stalled spinner.
const PHASE_MESSAGES = {
  preparing: [
    'Consultando la información más reciente',
    'Aplicando los filtros seleccionados',
    'Descargando los registros del servidor',
  ],
  generating: [
    'Dando formato al documento',
    'Aplicando estilos y colores',
    'Armando las tablas y totales',
    'Verificando que todo cuadre',
  ],
  saving: [
    'Empaquetando el archivo',
    'Preparando la descarga',
  ],
}
const MESSAGE_INTERVAL_MS = 1300

const RING_R = 44
const RING_C = 2 * Math.PI * RING_R

export default function ExportOverlay() {
  const { visible, phase, label, fileLabel, kind, requestCancel } = useExportStore()
  useLockBodyScroll(visible)

  const KindIcon = KIND_ICON[kind] ?? FileSpreadsheet
  const meta = PHASE_META[phase] ?? PHASE_META.idle
  const cancellable = phase === 'preparing' || phase === 'generating'
  const cancelling  = phase === 'cancelling'
  const active      = meta.tone === 'active'
  const stampColor  = meta.tone === 'error' ? '#DC2626' : meta.tone === 'cancelled' ? '#94A3B8' : ACCENT
  const messages    = PHASE_MESSAGES[phase]

  return (
    <div
      aria-hidden={!visible}
      className="fixed inset-0 z-[9998] flex items-center justify-center"
      style={{
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
        transition: 'opacity .3s ease',
        // Transparent glass, not a solid backdrop — the app stays visible
        // (blurred, dimmed) behind it rather than being hidden by a flat fill.
        background: 'radial-gradient(circle at 50% 45%, rgba(255,255,255,.42) 0%, rgba(255,255,255,.22) 55%, rgba(255,255,255,.10) 100%)',
        backdropFilter: 'blur(22px) saturate(140%)',
        WebkitBackdropFilter: 'blur(22px) saturate(140%)',
      }}
    >
      {/*
        Everything below only mounts while an export is actually in flight.
        Idle used to stay `tone: 'active'` so the spinning ring, breathing
        icon, and sliding progress line kept animating in the background on
        every page, forever, even fully invisible (opacity:0) — three
        infinite CSS animations nobody ever saw, burning paint/composite
        work app-wide. Gating the whole dialog on `visible` means idle
        renders nothing at all.
      */}
      {visible && (
      <div
        role="dialog"
        aria-modal="true"
        aria-live="polite"
        className="relative flex flex-col items-center px-10 py-12 text-center"
        style={{
          width: 'min(90vw, 360px)',
          borderRadius: 40,
          // A soft, edgeless glass panel behind the text — the outer screen
          // stays genuinely see-through, but the words stay legible no
          // matter what's showing through behind them (a busy table, a
          // colorful chart). No border/shadow, so it still reads as "open
          // air" rather than a boxed card.
          background: 'rgba(255,255,255,.5)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          animation: 'eo-in .3s cubic-bezier(.2,.8,.2,1) both',
        }}
      >
        {/* ── Icon stage ─────────────────────────────────────────────── */}
        <div className="relative mb-8" style={{ width: 112, height: 112 }}>
          {active && (
            <svg width={112} height={112} viewBox="0 0 112 112" className="absolute inset-0" style={{ animation: 'eo-ring-spin .85s linear infinite' }}>
              <circle
                cx={56} cy={56} r={RING_R}
                fill="none" stroke={ACCENT} strokeWidth={1.5} strokeLinecap="round"
                strokeDasharray={`${RING_C * 0.22} ${RING_C}`}
                opacity={0.9}
              />
            </svg>
          )}

          {active && (
            <div className="absolute inset-0 flex items-center justify-center">
              <KindIcon
                key={kind}
                size={34}
                color="#1E293B"
                strokeWidth={1.25}
                style={{ animation: 'eo-breathe 1.1s ease-in-out infinite' }}
              />
            </div>
          )}

          {meta.tone !== 'active' && (
            <svg width={112} height={112} viewBox="0 0 112 112" className="absolute inset-0">
              <circle
                cx={56} cy={56} r={RING_R}
                fill="none" stroke={stampColor} strokeWidth={2} strokeLinecap="round"
                strokeDasharray={RING_C} strokeDashoffset={0}
                transform="rotate(-90 56 56)"
                style={{ animation: 'eo-circle-draw .4s cubic-bezier(.2,.8,.2,1) both' }}
              />
              {meta.tone === 'success' && (
                <path
                  d="M38 58 L50 70 L76 42"
                  fill="none" stroke={stampColor} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"
                  pathLength={1} strokeDasharray={1} strokeDashoffset={1}
                  style={{ animation: 'eo-check-draw .28s ease .3s both' }}
                />
              )}
              {meta.tone === 'cancelled' && (
                <g style={{ animation: 'eo-mark-in .22s ease .3s both', opacity: 0 }}>
                  <path d="M42 42 L70 70" stroke={stampColor} strokeWidth={3} strokeLinecap="round" />
                  <path d="M70 42 L42 70" stroke={stampColor} strokeWidth={3} strokeLinecap="round" />
                </g>
              )}
              {meta.tone === 'error' && (
                <g style={{ animation: 'eo-mark-in .22s ease .3s both', opacity: 0 }}>
                  <path d="M56 36 L56 60" stroke={stampColor} strokeWidth={3} strokeLinecap="round" />
                  <circle cx={56} cy={74} r={2.4} fill={stampColor} />
                </g>
              )}
            </svg>
          )}
        </div>

        {/* ── Text ───────────────────────────────────────────────────── */}
        <h2
          key={`t-${phase}`}
          className="text-[19px] font-medium tracking-tight mb-1.5"
          style={{ color: '#0F172A', animation: 'eo-text-in .22s ease both' }}
        >
          {meta.title}
        </h2>
        <CyclingMessage key={phase} messages={messages} fallback={meta.desc} />
        {label && (
          <p className="text-[12px] mt-2" style={{ color: '#B4B9C2' }}>
            {label}{fileLabel ? ` · ${KIND_LABEL[kind] ?? ''}` : ''}
          </p>
        )}

        {/* ── Progress line ──────────────────────────────────────────── */}
        {active && (
          <div className="mt-7 w-full max-w-[180px] h-px overflow-hidden" style={{ background: '#E7E7EA' }}>
            <div
              className="h-full"
              style={{ width: '38%', background: ACCENT, animation: 'eo-track .8s ease-in-out infinite' }}
            />
          </div>
        )}

        {/* ── Cancel ─────────────────────────────────────────────────── */}
        {cancellable && (
          <button
            onClick={requestCancel}
            className="mt-8 text-[13px] font-medium underline-offset-4 hover:underline transition-colors"
            style={{ color: '#64748B' }}
          >
            Cancelar descarga
          </button>
        )}
        {cancelling && (
          <p className="mt-8 text-[12px]" style={{ color: '#B4B9C2' }}>Terminando de forma segura…</p>
        )}
      </div>
      )}

      <style>{`
        @keyframes eo-in {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes eo-ring-spin { to { transform: rotate(360deg); } }
        @keyframes eo-breathe {
          0%, 100% { opacity: .78; }
          50%      { opacity: 1; }
        }
        @keyframes eo-text-in {
          from { opacity: 0; transform: translateY(3px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes eo-track {
          0%   { transform: translateX(-140%); }
          100% { transform: translateX(360%); }
        }
        @keyframes eo-circle-draw {
          from { stroke-dashoffset: ${RING_C}; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes eo-check-draw {
          from { stroke-dashoffset: 1; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes eo-mark-in {
          from { opacity: 0; transform: scale(.7); transform-origin: 56px 56px; }
          to   { opacity: 1; transform: scale(1); transform-origin: 56px 56px; }
        }
      `}</style>
    </div>
  )
}

// Rotates through `messages` every MESSAGE_INTERVAL_MS; falls back to a
// single static line when the current phase has no message list of its own
// (success/cancelled/error are one-shot states, not multi-second waits).
// Mounted with `key={phase}` by the caller so switching phases remounts
// this fresh — state starts at 0 for the new phase with no reset effect.
function CyclingMessage({ messages, fallback }) {
  const [i, setI] = useState(0)
  useEffect(() => {
    if (!messages || messages.length < 2) return undefined
    const id = setInterval(() => setI(v => (v + 1) % messages.length), MESSAGE_INTERVAL_MS)
    return () => clearInterval(id)
  }, [messages])

  const text = messages ? messages[i] : fallback
  if (!text) return null

  return (
    <p
      key={i}
      className="text-[13.5px] mb-1"
      style={{ color: '#94A3B8', animation: 'eo-text-in .22s ease both' }}
    >
      {text}
    </p>
  )
}
