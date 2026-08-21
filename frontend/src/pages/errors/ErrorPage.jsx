import { Link } from 'react-router-dom'
import GemaSystemLogo from '../../components/GemaSystemLogo'

/**
 * Shared shell for every error screen (404 / 403 / 500) — styled after the
 * dashboard itself (same surface/text tokens, dot-grid background, Sora
 * type, .btn-primary/.btn-secondary) rather than the dark Landing page,
 * since these are reached from inside — or trying to get into — the app.
 */
export default function ErrorPage({ code, title, message, actions, tone = 'primary' }) {
  const toneColors = {
    primary: { from: '#8B5CF6', to: '#6366F1', glow: 'rgba(139,92,246,0.4)' },
    danger:  { from: '#F87171', to: '#DC2626', glow: 'rgba(239,68,68,0.35)' },
  }[tone]

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{
        background: 'var(--surface-base)',
        backgroundImage: 'radial-gradient(circle, rgba(127,127,127,0.06) 1px, transparent 1px)',
        backgroundSize: '28px 28px',
      }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-8 text-center"
        style={{
          background: 'var(--surface-1)',
          border: '1px solid var(--surface-border)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.12)',
        }}
      >
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
          style={{
            background: `linear-gradient(135deg, ${toneColors.from}, ${toneColors.to})`,
            boxShadow: `0 0 32px ${toneColors.glow}`,
          }}
        >
          <GemaSystemLogo className="w-7 h-7" />
        </div>

        <p
          className="font-extrabold tracking-tight mb-1"
          style={{ fontSize: '13px', letterSpacing: '0.18em', color: 'var(--text-muted)' }}
        >
          ERROR {code}
        </p>
        <h1 className="text-2xl font-extrabold tracking-tight mb-2" style={{ color: 'var(--text-primary)' }}>
          {title}
        </h1>
        <p className="text-sm leading-relaxed mb-8" style={{ color: 'var(--text-secondary)' }}>
          {message}
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {actions}
        </div>

        <p
          className="mt-8 flex items-center justify-center gap-1.5 text-xs font-semibold"
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
