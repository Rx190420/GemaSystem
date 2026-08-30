import { useId, useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'

// ─── StrokeLogoMark ─────────────────────────────────────────────────────────
// The GemaSystem "G" mark, drawn with the same stroke-then-fill technique as
// <StrokeText> so it reads as the leading letter of the wordmark. Unlike
// text, these are real <path> elements, so getTotalLength()/dasharray draw
// correctly as one continuous stroke per path (no per-glyph quirk).
// No box, no background — just the mark. Size it via `heightPx` (matching
// <StrokeText>'s sizing contract so both line up) — an explicit pixel
// height/width pair computed here from the fixed 554:703 viewBox ratio,
// rather than a CSS height + width:auto letting the browser derive width
// from the intrinsic aspect ratio. That auto-width resolution turned out to
// be unreliable for this SVG on real phones (see the comment in Landing.jsx
// where heroHeight is computed) — plain arithmetic against a known ratio
// can't drift the way browser-side intrinsic sizing did.
const VIEWBOX_W = 554
const VIEWBOX_H = 703

const PATHS = [
  'M 586.691406 616.171875 L 449.171875 616.171875 C 445.800781 616.171875 443.070312 613.4375 443.070312 610.066406 L 443.070312 294.570312 C 443.070312 161.789062 560.171875 53.761719 704.113281 53.761719 L 852.492188 53.761719 C 855.855469 53.761719 858.585938 56.496094 858.585938 59.867188 L 858.585938 185.777344 C 858.585938 189.144531 855.855469 191.878906 852.492188 191.878906 L 704.113281 191.878906 C 642.726562 191.878906 592.789062 237.945312 592.789062 294.570312 L 592.789062 610.066406 C 592.789062 613.4375 590.058594 616.171875 586.691406 616.171875',
  'M 735.875 750.011719 L 735.875 624.019531 C 735.875 620.746094 738.460938 618.09375 741.738281 617.933594 C 800.40625 615.113281 847.203125 570.195312 847.203125 515.378906 L 847.203125 469.914062 C 847.203125 466.546875 844.464844 463.8125 841.101562 463.8125 L 741.980469 463.8125 C 738.613281 463.8125 735.875 461.082031 735.875 457.710938 L 735.875 331.800781 C 735.875 328.429688 738.613281 325.703125 741.980469 325.703125 L 990.816406 325.703125 C 994.1875 325.703125 996.921875 328.429688 996.921875 331.800781 L 996.921875 515.378906 C 996.921875 646.234375 883.1875 753.046875 742.121094 756.121094 C 738.699219 756.195312 735.875 753.4375 735.875 750.011719',
]

export default function StrokeLogoMark({
  heightPx,
  className = '',
  fillColor = '#ffffff',
  strokeColor = '#a78bfa',
  strokeWidth = 5,
  duration = 0.9,
  delay = 0,
}) {
  const pathRefs = useRef(new Map())
  const fillGroupRef = useRef(null)
  const filterId = `slm-glow-${useId()}`

  useLayoutEffect(() => {
    const paths = PATHS.map((_, i) => pathRefs.current.get(i)).filter(Boolean)
    const fillGroup = fillGroupRef.current
    if (paths.length === 0 || !fillGroup) return

    const reduceMotion = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

    if (reduceMotion) {
      gsap.set(paths, { opacity: 0 })
      gsap.set(fillGroup, { opacity: 1 })
      return
    }

    paths.forEach(p => {
      const len = p.getTotalLength()
      gsap.set(p, { strokeDasharray: len, strokeDashoffset: len })
    })
    gsap.set(fillGroup, { opacity: 0 })

    const n = paths.length
    const stagger = n > 1 ? duration / (n + 1) : 0
    const pathDuration = Math.max(duration - stagger * (n - 1), 0.3)

    const tl = gsap.timeline({ delay })
    tl.to(paths, { strokeDashoffset: 0, duration: pathDuration, stagger, ease: 'power2.inOut' })
      .to(fillGroup, { opacity: 1, duration: 0.4, ease: 'power1.out' }, '-=0.2')
      // Once filled, fade the outline out — clean solid mark, no lingering
      // purple rim.
      .to(paths, { opacity: 0, duration: 0.5, ease: 'power1.out' }, '+=0.1')

    return () => tl.kill()
  }, [duration, delay])

  return (
    <svg
      viewBox="443 53 554 703"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="G"
      className={className}
      style={{
        display: 'block',
        overflow: 'visible',
        height: heightPx,
        width: heightPx * (VIEWBOX_W / VIEWBOX_H),
      }}
    >
      <defs>
        <filter id={filterId} x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="0" stdDeviation="16" floodColor={strokeColor} floodOpacity="0.45" />
        </filter>
      </defs>
      <g ref={fillGroupRef} fill={fillColor} filter={`url(#${filterId})`}>
        {PATHS.map((d, i) => <path key={i} d={d} />)}
      </g>
      {PATHS.map((d, i) => (
        <path
          key={i}
          ref={el => { if (el) pathRefs.current.set(i, el); else pathRefs.current.delete(i) }}
          d={d}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
        />
      ))}
    </svg>
  )
}
