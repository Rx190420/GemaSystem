// Same "G" mark + fill animation as PageLoader.jsx's splash screen, but
// recolored to a muted gray so it can sit centered on top of skeleton
// screens while a page's data loads — a quieter, on-brand echo of the splash
// instead of a generic spinner.
const P1 = 'M 586.691406 616.171875 L 449.171875 616.171875 C 445.800781 616.171875 443.070312 613.4375 443.070312 610.066406 L 443.070312 294.570312 C 443.070312 161.789062 560.171875 53.761719 704.113281 53.761719 L 852.492188 53.761719 C 855.855469 53.761719 858.585938 56.496094 858.585938 59.867188 L 858.585938 185.777344 C 858.585938 189.144531 855.855469 191.878906 852.492188 191.878906 L 704.113281 191.878906 C 642.726562 191.878906 592.789062 237.945312 592.789062 294.570312 L 592.789062 610.066406 C 592.789062 613.4375 590.058594 616.171875 586.691406 616.171875'
const P2 = 'M 735.875 750.011719 L 735.875 624.019531 C 735.875 620.746094 738.460938 618.09375 741.738281 617.933594 C 800.40625 615.113281 847.203125 570.195312 847.203125 515.378906 L 847.203125 469.914062 C 847.203125 466.546875 844.464844 463.8125 841.101562 463.8125 L 741.980469 463.8125 C 738.613281 463.8125 735.875 461.082031 735.875 457.710938 L 735.875 331.800781 C 735.875 328.429688 738.613281 325.703125 741.980469 325.703125 L 990.816406 325.703125 C 994.1875 325.703125 996.921875 328.429688 996.921875 331.800781 L 996.921875 515.378906 C 996.921875 646.234375 883.1875 753.046875 742.121094 756.121094 C 738.699219 756.195312 735.875 753.4375 735.875 750.011719'

let injected = false
function injectKeyframesOnce() {
  if (injected || typeof document === 'undefined') return
  injected = true
  const style = document.createElement('style')
  style.textContent = `
    @keyframes skm-rise {
      0%          { transform: scaleY(0); }
      60%         { transform: scaleY(1); }
      78%, 86%    { transform: scaleY(1); }
      100%        { transform: scaleY(0); }
    }
    #skm-clip-rect {
      transform-box: fill-box;
      transform-origin: 50% 100%;
      animation: skm-rise 2.6s cubic-bezier(.45,.05,.55,.95) infinite;
    }
  `
  document.head.appendChild(style)
}

/**
 * Centered, low-opacity gray logo mark with the same "fill" animation as the
 * splash screen. Meant to float over a <Skeleton> region while it's loading —
 * render it centered (e.g. via a sticky wrapper) alongside the skeleton, not
 * instead of it.
 */
export default function SkeletonLogoMark({ size = 72 }) {
  injectKeyframesOnce()
  return (
    <svg
      viewBox="443 53 554 703"
      width={size}
      height={Math.round(size * (703 / 554))}
      style={{ overflow: 'visible' }}
    >
      <defs>
        <clipPath id="skmClip">
          <rect id="skm-clip-rect" x="443" y="53" width="554" height="703" />
        </clipPath>
      </defs>
      {/* Faint silhouette, always visible */}
      <path d={P1} fill="#9CA3AF" opacity="0.18" />
      <path d={P2} fill="#9CA3AF" opacity="0.18" />
      {/* Filled part, revealed bottom-up by the rising clip */}
      <g clipPath="url(#skmClip)">
        <path d={P1} fill="#9CA3AF" opacity="0.45" />
        <path d={P2} fill="#9CA3AF" opacity="0.45" />
      </g>
    </svg>
  )
}

/**
 * Drop this once per loading region (page, or a group of widgets that load
 * together) — `position: sticky` keeps it centered in the visible viewport
 * as the page scrolls, without needing to know the sidebar's width/collapsed
 * state like a `position: fixed` overlay would. Renders nothing when
 * `show` is false, so it's safe to leave mounted unconditionally.
 */
export function LoadingLogoOverlay({ show, size = 72 }) {
  if (!show) return null
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'sticky',
        top: '38vh',
        height: 0,
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none',
        zIndex: 30,
      }}
    >
      <SkeletonLogoMark size={size} />
    </div>
  )
}
