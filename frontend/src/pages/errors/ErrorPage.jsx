import { Link } from 'react-router-dom'
import GemaSystemLogo from '../../components/GemaSystemLogo'

/**
 * Shared shell for every error screen (404 / 403 / 500) — styled after the
 * dashboard itself (same surface/text tokens, dot-grid background, Sora
 * type, .btn-primary/.btn-secondary) rather than the dark Landing page,
 * since these are reached from inside — or trying to get into — the app.
 *
 * Editorial layout: content sits left/center, with the GemaSystem mark
 * rendered huge and faded as a watermark bleeding off the right edge —
 * vertically centered, monochrome, gradient-masked so it fades rather than
 * sitting there as a flat block.
 */
export default function ErrorPage({ code, icon: Icon, title, message, actions, tone = 'primary', badge = 'ERROR' }) {
  const toneColors = {
    primary: { from: '#8B5CF6', to: '#6366F1', glow: 'rgba(139,92,246,0.4)' },
    danger:  { from: '#F87171', to: '#DC2626', glow: 'rgba(239,68,68,0.35)' },
    warning: { from: '#FBBF24', to: '#F59E0B', glow: 'rgba(245,158,11,0.35)' },
  }[tone]

  return (
    <div
      className="relative min-h-screen overflow-hidden flex items-center"
      style={{
        background: 'var(--surface-base)',
        backgroundImage: 'radial-gradient(circle, rgba(127,127,127,0.06) 1px, transparent 1px)',
        backgroundSize: '28px 28px',
      }}
    >
      {/* Watermark — huge, faded GemaSystem mark bleeding off the right edge */}
      <div
        aria-hidden="true"
        className="hidden md:block absolute top-1/2 -translate-y-1/2 pointer-events-none select-none"
        style={{
          right: '-8%',
          width: 'clamp(420px, 46vw, 820px)',
          WebkitMaskImage: 'linear-gradient(135deg, black 15%, transparent 82%)',
          maskImage: 'linear-gradient(135deg, black 15%, transparent 82%)',
        }}
      >
        <GemaSystemLogo className="w-full h-auto" color="var(--text-muted)" />
      </div>

      <div className="relative z-10 w-full max-w-xl px-6 sm:px-10 lg:px-6 py-16 mx-auto md:mx-0 md:ml-[8vw]">
        <div className="flex items-center gap-3 mb-8">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              background: `linear-gradient(135deg, ${toneColors.from}, ${toneColors.to})`,
              boxShadow: `0 0 32px ${toneColors.glow}`,
            }}
          >
            <GemaSystemLogo className="w-5 h-5" />
          </div>
          <p
            className="font-extrabold"
            style={{ fontSize: '13px', letterSpacing: '0.2em', color: 'var(--text-muted)' }}
          >
            {badge}
          </p>
        </div>

        {/* Either a huge HTTP-style code (404/403/500) or, when there's no
            status code to show (e.g. offline), a big icon in its place —
            same slot, same proportions, so the page still reads as part of
            the same family. */}
        {Icon ? (
          <div className="mb-5" style={{ color: toneColors.to }}>
            <Icon style={{ width: 'clamp(4rem, 10vw, 6.5rem)', height: 'clamp(4rem, 10vw, 6.5rem)' }} strokeWidth={1.75} />
          </div>
        ) : (
          <h1
            className="font-extrabold leading-[0.95] tracking-tight mb-5"
            style={{
              fontSize: 'clamp(4rem, 12vw, 8rem)',
              background: `linear-gradient(135deg, var(--text-primary), ${toneColors.to})`,
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            {code}
          </h1>
        )}

        <h2 className="text-2xl font-extrabold tracking-tight mb-3" style={{ color: 'var(--text-primary)' }}>
          {title}
        </h2>
        <p className="text-base leading-relaxed mb-10 max-w-md" style={{ color: 'var(--text-secondary)' }}>
          {message}
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          {actions}
        </div>

        <p
          className="mt-14 flex items-center gap-1.5 text-xs font-semibold"
          style={{ color: 'var(--text-muted)' }}
        >
          <GemaSystemLogo className="w-3 h-3" color="currentColor" />
          GemaSystem
        </p>
      </div>
    </div>
  )
}

// Small helper so each concrete page doesn't repeat the Link+className boilerplate.
export function ErrorAction({ to, onClick, primary, children }) {
  const cls = primary ? 'btn-primary' : 'btn-secondary'
  if (to) return <Link to={to} className={cls}>{children}</Link>
  return <button onClick={onClick} className={cls}>{children}</button>
}
