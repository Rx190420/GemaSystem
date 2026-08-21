import { useEffect, useRef, useState } from 'react'

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/**
 * Hides its children until they scroll into view, then fades/rises them in —
 * and unlike a typical "animate once" scroll-reveal, it keeps observing:
 * scrolling the element back out of view resets it, so scrolling back down
 * (or up) plays the same entrance again every time. Used on the "Módulos"
 * feature cards and preview panels so re-visiting that section on scroll
 * always replays the reveal.
 */
export default function Reveal({ children, className = '', style, delay = 0, threshold = 0.2, as: Tag = 'div' }) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(prefersReducedMotion())

  useEffect(() => {
    if (prefersReducedMotion()) return undefined
    const el = ref.current
    if (!el) return undefined
    const io = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold, rootMargin: '0px 0px -8% 0px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [threshold])

  return (
    <Tag
      ref={ref}
      className={className}
      style={{
        ...style,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(28px)',
        transition: `opacity 0.6s ease ${delay}s, transform 0.6s cubic-bezier(0.22,1,0.36,1) ${delay}s`,
        willChange: 'opacity, transform',
      }}
    >
      {children}
    </Tag>
  )
}
