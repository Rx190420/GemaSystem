// Shared "widget" building blocks used across pages (Dashboard, Members, etc.)
// to keep cards in the same row visually consistent in size.

/** Plain card, sized to its content — for standalone/full-width widgets. */
export function Panel({ children, className = '' }) {
  return <div className={`card p-5 ${className}`}>{children}</div>
}

export function PanelHeader({ title, badge, action }) {
  return (
    <div className="flex items-center justify-between mb-4 flex-shrink-0">
      <p className="text-sm font-semibold text-gray-700">{title}</p>
      <div className="flex items-center gap-2">
        {badge}
        {action}
      </div>
    </div>
  )
}

// A panel with a genuinely fixed height (not just a cap) so panels sharing a
// row always match — even when one has data and another is empty — and
// content that overflows scrolls internally instead of growing the card.
// `height` (px) lets different paired rows share their own consistent size.
export function FixedPanel({ children, className = '', height = 236 }) {
  return <div className={`card p-5 flex flex-col ${className}`} style={{ height }}>{children}</div>
}

export function EmptyState({ icon: Icon, text }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-2">
      <Icon className="w-8 h-8 opacity-30" />
      <p className="text-xs">{text}</p>
    </div>
  )
}
