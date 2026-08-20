import useMembershipTypeColors from '../hooks/useMembershipTypeColors'

// Legacy fallback for members still carrying the old fixed basic/premium/vip
// values with no matching row (or no color set) in membership_types.
const LEGACY_BADGE = { basic: 'badge-blue', premium: 'badge-purple', vip: 'badge-yellow' }
const LEGACY_LABEL = { basic: 'Básica', premium: 'Premium', vip: 'VIP' }

/** Colored pill for a member's membership type — same look as the Etiquetas pills. */
export default function MembershipTypeBadge({ type, className = '' }) {
  const colors = useMembershipTypeColors()

  if (!type) return <span className="text-gray-300 text-xs">Sin tipo</span>

  const color = colors[type]
  if (color) {
    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${className}`}
        style={{
          background: `color-mix(in srgb, ${color} 14%, transparent)`,
          color,
          border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
        }}
      >
        {type}
      </span>
    )
  }

  return (
    <span className={`${LEGACY_BADGE[type?.toLowerCase()] ?? 'badge-indigo'} ${className}`}>
      {LEGACY_LABEL[type] ?? type}
    </span>
  )
}
