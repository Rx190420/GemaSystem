import { useEffect, useLayoutEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import gsap from 'gsap'
import { X, ArrowRight, LogIn, Gift } from 'lucide-react'
import useLockBodyScroll from '../hooks/useLockBodyScroll'

// Primary nav — mirrors the "Explorar" column of the desktop CardNav dropdown.
const LINKS = [
  { label: 'Características',      href: '#características' },
  { label: 'Correos automáticos',  href: '#correos' },
  { label: 'WhatsApp',             href: '#whatsapp' },
  { label: 'Precios',              href: '#precios' },
  { label: 'Prueba gratis',        href: '#prueba-gratis' },
  { label: 'Reseñas',              href: '#reseñas' },
  { label: 'Comparativa',          href: '#comparativa' },
  { label: 'Preguntas',            href: '#faq' },
]

const SECONDARY = [
  { label: 'Centro de soporte', to: '/support' },
  { label: 'Proyectos',         to: '/proyectos' },
]

// Layer strips reveal in sequence just ahead of the main panel — same
// depth trick as reactbits' StaggeredMenu — before settling on the last,
// darkest shade that the panel itself is painted with.
const LAYER_COLORS = ['#22314F', '#131B2E', '#050608']

/**
 * Full-screen animated mobile nav, styled after reactbits.dev's
 * "Staggered Menu": a purple panel slides in from the right behind a
 * couple of colored layers, then nav items stagger up into place.
 * Desktop/tablet keeps the existing CardNav dropdown — this only
 * ever renders (via `sm:hidden` on the root) below the `sm` breakpoint.
 */
export default function MobileStaggeredMenu({ open, onClose, onLogin, onTrial }) {
  const rootRef   = useRef(null)
  const panelRef  = useRef(null)
  const layerRefs = useRef([])
  const itemRefs  = useRef([])
  const footerRef = useRef(null)
  const tlRef     = useRef(null)

  useLockBodyScroll(open)

  // Seed GSAP's internal transform cache to match the off-screen resting
  // position *before* the tweens below ever run. Without this, the JSX's
  // plain `translateX(100%)` inline style and GSAP's `xPercent` tweens
  // disagree about the starting position — GSAP defaults its own xPercent
  // cache to 0, so a later `to(el, { xPercent: 0 })` looks like a no-op and
  // the panel never actually moves.
  useLayoutEffect(() => {
    const layers = layerRefs.current.filter(Boolean)
    const panel  = panelRef.current
    gsap.set([...layers, panel], { xPercent: 100 })
  }, [])

  useEffect(() => {
    const panel  = panelRef.current
    const layers = layerRefs.current.filter(Boolean)
    const items  = itemRefs.current.filter(Boolean)
    const footer = footerRef.current
    if (!panel) return undefined

    tlRef.current?.kill()

    if (open) {
      gsap.set(rootRef.current, { pointerEvents: 'auto' })
      const tl = gsap.timeline()
      tl.set(items,  { yPercent: 140, rotate: 6, opacity: 0 })
        .set(footer, { opacity: 0, y: 16 })
        .to(layers, { xPercent: 0, duration: 0.5, ease: 'power4.out', stagger: 0.07 }, 0)
        .to(panel,  { xPercent: 0, duration: 0.6, ease: 'power4.out' }, 0.08)
        .to(items,  { yPercent: 0, rotate: 0, opacity: 1, duration: 0.65, ease: 'power4.out', stagger: 0.06 }, 0.32)
        .to(footer, { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out' }, '-=0.25')
      tlRef.current = tl
    } else {
      const tl = gsap.timeline({
        onComplete: () => gsap.set(rootRef.current, { pointerEvents: 'none' }),
      })
      tl.to(items,  { yPercent: -60, opacity: 0, duration: 0.3, ease: 'power2.in', stagger: 0.03 }, 0)
        .to(footer, { opacity: 0, duration: 0.2 }, 0)
        .to(panel,  { xPercent: 100, duration: 0.45, ease: 'power3.in' }, 0.05)
        .to(layers, { xPercent: 100, duration: 0.4, ease: 'power3.in', stagger: 0.05 }, 0.1)
      tlRef.current = tl
    }

    return () => tlRef.current?.kill()
  }, [open])

  const go = (fn) => { onClose(); fn?.() }

  return (
    <div
      ref={rootRef}
      className="sm:hidden fixed inset-0 z-[60]"
      style={{ pointerEvents: 'none' }}
      role="dialog"
      aria-modal="true"
      aria-label="Menú"
      aria-hidden={!open}
    >
      {LAYER_COLORS.map((c, i) => (
        <div
          key={c}
          ref={(el) => { layerRefs.current[i] = el }}
          className="absolute inset-0"
          style={{ background: c }}
        />
      ))}

      <div
        ref={panelRef}
        className="absolute inset-0 flex flex-col"
        style={{
          background: 'linear-gradient(160deg, #16233F 0%, #0B1120 55%, #020204 100%)',
        }}
      >
        <div className="flex items-center justify-between px-6 pt-6 flex-shrink-0">
          <span className="text-white/60 text-xs font-bold uppercase tracking-widest">Menú</span>
          <button
            onClick={onClose}
            aria-label="Cerrar menú"
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* min-h-0 overrides the flex item's default min-height:auto — without
            it this flex-1 child grows to fit all 8 links instead of scrolling,
            pushing the footer (login/trial buttons) off the bottom of the
            screen on shorter phones. */}
        <nav className="flex-1 min-h-0 overflow-y-auto px-6 pt-8 pb-4">
          <ul className="space-y-1">
            {LINKS.map((l, i) => (
              <li key={l.label} className="overflow-hidden">
                <a
                  ref={(el) => { itemRefs.current[i] = el }}
                  href={l.href}
                  onClick={onClose}
                  className="flex items-baseline gap-3 py-3 text-white"
                >
                  <span className="text-xs font-bold text-white/40 tabular-nums">{String(i + 1).padStart(2, '0')}</span>
                  <span className="text-2xl font-extrabold tracking-tight">{l.label}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div ref={footerRef} className="px-6 pb-8 pt-4 border-t border-white/15 space-y-3 flex-shrink-0">
          <div className="flex gap-2">
            {SECONDARY.map((s) => (
              <Link
                key={s.label}
                to={s.to}
                onClick={onClose}
                className="flex-1 flex items-center justify-center gap-1.5 text-center text-sm font-semibold text-white/80 bg-white/10 rounded-lg py-2.5 hover:bg-white/15 transition-colors"
              >
                {s.label}
                <ArrowRight className="w-3.5 h-3.5 opacity-60" />
              </Link>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => go(onLogin)}
              className="flex-1 flex items-center justify-center gap-2 text-sm font-semibold text-white border border-white/25 rounded-lg py-2.5"
            >
              <LogIn className="w-4 h-4" /> Iniciar sesión
            </button>
            <button
              onClick={() => go(onTrial)}
              className="flex-1 flex items-center justify-center gap-2 text-sm font-bold text-blue-700 bg-white rounded-lg py-2.5"
            >
              <Gift className="w-4 h-4" /> Prueba gratis
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
