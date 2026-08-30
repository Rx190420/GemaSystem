import { useId, useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'

// ─── StrokeText ─────────────────────────────────────────────────────────────
// Draws the outline of `text` letter-by-letter with an animated stroke, then
// fades in a solid-filled copy on top — inspired by reactbits.dev's "Stroke
// Text" animation.
//
// `stroke-dasharray`/`stroke-dashoffset` apply PER GLYPH on an SVG <text>
// node (each character gets its own outline, not one continuous path), so
// animating the whole word as a single dash value doesn't draw correctly —
// every character is measured and animated individually via its own <tspan>,
// staggered with GSAP for a proper letter-by-letter draw.
//
// Measures real glyph widths once fonts have finished loading (Font Loading
// API) instead of forcing a fixed length, so letterforms stay undistorted.
//
// Sized via an explicit `heightPx` (+ a pixel width computed from it below),
// not a CSS height + width:auto. That relied on the browser deriving width
// from the SVG's intrinsic viewBox aspect ratio, which turned out to be
// unreliable on real phones — the rendered width didn't track the clamped
// height at all, badly overflowing the screen (see the comment in
// Landing.jsx where heroHeight is computed). Explicit width = heightPx *
// (viewBox aspect ratio) can't drift the way that auto-resolution did.

const FONT_SIZE = 180
const VB_H = FONT_SIZE * 1.32

export default function StrokeText({
  text = '',
  as: Tag = 'span',
  heightPx,
  className = '',
  fillColor = '#ffffff',
  strokeColor = '#a78bfa',
  strokeWidth = 2,
  duration = 1.3, // total draw duration across the whole word
  delay = 0.1,
}) {
  const chars = Array.from(text)
  const strokeTextRef = useRef(null)
  const strokeCharRefs = useRef(new Map())
  const fillCharRefs = useRef(new Map())
  const [boxW, setBoxW] = useState(FONT_SIZE * chars.length * 0.62)
  const filterId = `st-glow-${useId()}`

  useLayoutEffect(() => {
    const strokeEls = chars.map((_, i) => strokeCharRefs.current.get(i)).filter(Boolean)
    const fillEls = chars.map((_, i) => fillCharRefs.current.get(i)).filter(Boolean)
    if (strokeEls.length === 0) return
    let cancelled = false

    const run = () => {
      if (cancelled) return

      const totalW = strokeTextRef.current?.getComputedTextLength?.()
      if (totalW) setBoxW(totalW)

      const reduceMotion = typeof window !== 'undefined'
        && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

      if (reduceMotion) {
        gsap.set(strokeEls, { opacity: 0 })
        gsap.set(fillEls, { opacity: 1 })
        return
      }

      strokeEls.forEach(el => {
        let len = FONT_SIZE * 0.7
        try { len = el.getComputedTextLength() || len } catch { /* keep estimate */ }
        gsap.set(el, { strokeDasharray: len, strokeDashoffset: len })
      })
      gsap.set(fillEls, { opacity: 0 })

      const n = strokeEls.length
      const stagger = n > 1 ? duration / (n + 1) : 0
      const charDuration = Math.max(duration - stagger * (n - 1), 0.3)

      const tl = gsap.timeline({ delay })
      tl.to(strokeEls, { strokeDashoffset: 0, duration: charDuration, stagger, ease: 'power2.inOut' })
        .to(fillEls, { opacity: 1, duration: 0.45, stagger: stagger * 0.6, ease: 'power1.out' },
          `-=${Math.min(charDuration + stagger * (n - 1), duration) * 0.5}`)
        // Once filled, the outline has done its job — fade it out so the
        // letters settle into clean solid white, not a permanent purple rim.
        .to(strokeEls, { opacity: 0, duration: 0.5, ease: 'power1.out' }, '+=0.1')
    }

    // Re-measures the box width only — doesn't touch the draw animation.
    // Needed because `document.fonts.ready` can resolve before a
    // `font-display: swap` webfont (Sora 800, here) actually finishes
    // swapping in: the first measurement then reflects the narrower
    // fallback font's metrics, boxW/the SVG's viewBox get sized from that,
    // and the real font — wider — renders past that box once it swaps in.
    // Since the SVG has overflow:visible (for the glow filter), that shows
    // up as the text visibly spilling past its container instead of being
    // safely clipped. `loadingdone` fires for every such late swap, so this
    // just keeps the box honest whenever one happens.
    const remeasure = () => {
      const totalW = strokeTextRef.current?.getComputedTextLength?.()
      if (totalW) setBoxW(totalW)
    }

    if (typeof document !== 'undefined' && document.fonts?.ready) {
      document.fonts.ready.then(run)
      document.fonts.addEventListener?.('loadingdone', remeasure)
    } else {
      run()
    }

    return () => {
      cancelled = true
      document.fonts?.removeEventListener?.('loadingdone', remeasure)
    }
    // `chars` is derived fresh from `text` every render (already a dep) — listing
    // it too would re-run this effect every render, since arrays are never `===`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, duration, delay])

  const padX = strokeWidth * 3
  // getComputedTextLength() can undershoot the glyphs' true rendered width
  // (a font-display:swap webfont swapping in after the measurement is the
  // main way that happens — see the `loadingdone` listener above) — a small
  // safety margin on the box itself, plus `overflow:hidden` below instead
  // of `visible`, means a stale/undershooting measurement makes the text
  // render very slightly smaller than it could, never past its container.
  const boxWSafe = boxW * 1.08
  const totalW = boxWSafe + padX * 2

  return (
    <Tag className="inline-flex align-middle leading-none">
      <svg
        viewBox={`0 0 ${totalW} ${VB_H}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={text}
        className={className}
        style={{
          display: 'block',
          overflow: 'hidden',
          height: heightPx,
          width: heightPx * (totalW / VB_H),
        }}
      >
        <defs>
          <filter id={filterId} x="-20%" y="-40%" width="140%" height="180%">
            <feDropShadow dx="0" dy="0" stdDeviation={FONT_SIZE * 0.045} floodColor={strokeColor} floodOpacity="0.45" />
          </filter>
        </defs>
        <text
          x={padX} y={VB_H / 2}
          dominantBaseline="central"
          fontSize={FONT_SIZE} fontWeight={800}
          fill={fillColor}
          filter={`url(#${filterId})`}
          xmlSpace="preserve"
          style={{ fontFamily: 'inherit' }}
        >
          {chars.map((c, i) => (
            <tspan key={i} ref={el => { if (el) fillCharRefs.current.set(i, el); else fillCharRefs.current.delete(i) }}>{c}</tspan>
          ))}
        </text>
        <text
          ref={strokeTextRef}
          x={padX} y={VB_H / 2}
          dominantBaseline="central"
          fontSize={FONT_SIZE} fontWeight={800}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
          xmlSpace="preserve"
          style={{ fontFamily: 'inherit' }}
        >
          {chars.map((c, i) => (
            <tspan key={i} ref={el => { if (el) strokeCharRefs.current.set(i, el); else strokeCharRefs.current.delete(i) }}>{c}</tspan>
          ))}
        </text>
      </svg>
    </Tag>
  )
}
