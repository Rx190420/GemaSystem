import { useEffect, useLayoutEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import gsap from 'gsap'
import { X, ArrowRight, LogIn, Gift } from 'lucide-react'
import useLockBodyScroll from '../hooks/useLockBodyScroll'

// Primary nav — mirrors the "Explorar" column of the desktop CardNav dropdown.
const LINKS = [
  { label: 'Características',      href: '#características' },
  { label: 'Automatizaciones',     href: '#automatizaciones' },
  { label: 'Precios',              href: '#precios' },
  { label: 'Prueba gratis',        href: '#prueba-gratis' },
]

const SECONDARY = [
  { label: 'Centro de soporte', to: '/support' },
  { label: 'Proyectos',         to: '/proyectos' },
]

// reactbits.dev's own StaggeredMenu defaults (colors=['#B497CF','#5227FF'],
// accentColor='#5227FF', bg-white panel) — kept as-is rather than the earlier
// dark-navy reskin, per "los colores como están predeterminados en el diseño
// que te pasé".
const LAYER_COLORS = ['#B497CF', '#5227FF']
const ACCENT = '#5227FF'

// Panel/layers are full-width below lg (reactbits' own breakpoint — its CSS
// forces width:100% under max-width:1024px) and a clamped side panel at
// lg and up, same as the component's default @1024px+ behavior — "en la
// vista de pc no quiero que se vea en toda la pantalla".
const PANEL_WIDTH_CLASS = 'w-full lg:w-[clamp(260px,38vw,420px)]'

/**
 * Full-screen animated nav panel, adapted from reactbits.dev's
 * "Staggered Menu" (https://reactbits.dev/components/staggered-menu): a
 * panel slides in from the right behind a couple of colored layers, then
 * nav items stagger up into place. This is now the ONLY nav — it used to
 * be mobile-only (Landing kept a separate CardNav dropdown for desktop),
 * but that's gone; a lightweight fixed header (logo + toggle) triggers this
 * at every screen size now, same as reactbits' own header+panel pattern.
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
      className="fixed inset-0 z-[60]"
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
          className={`absolute inset-y-0 right-0 ${PANEL_WIDTH_CLASS}`}
          style={{ background: c }}
        />
      ))}

      <div
        ref={panelRef}
        className={`absolute inset-y-0 right-0 ${PANEL_WIDTH_CLASS} bg-white flex flex-col`}
      >
        <div className="flex items-center justify-between px-6 pt-6 flex-shrink-0">
          <span className="text-gray-400 text-xs font-bold uppercase tracking-widest">Menú</span>
          <button
            onClick={onClose}
            aria-label="Cerrar menú"
            className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* min-h-0 overrides the flex item's default min-height:auto — without
            it this flex-1 child grows to fit all 8 links instead of scrolling,
            pushing the footer (login/trial buttons) off the bottom of the
            screen on shorter phones. */}
        <nav className="flex-1 min-h-0 overflow-y-auto px-6 sm:px-10 pt-8 sm:pt-10 pb-4">
          <ul className="space-y-1 sm:space-y-2">
            {LINKS.map((l, i) => (
              <li key={l.label} className="overflow-hidden">
                <a
                  ref={(el) => { itemRefs.current[i] = el }}
                  href={l.href}
                  onClick={onClose}
                  className="flex items-baseline gap-3 sm:gap-4 py-3 text-black group"
                >
                  <span className="text-xs sm:text-sm font-bold tabular-nums" style={{ color: ACCENT }}>{String(i + 1).padStart(2, '0')}</span>
                  <span className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight transition-colors group-hover:text-[#5227FF]">{l.label}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div ref={footerRef} className="px-6 sm:px-10 pb-8 pt-4 border-t border-gray-200 space-y-3 flex-shrink-0">
          <div className="flex gap-2">
            {SECONDARY.map((s) => (
              <Link
                key={s.label}
                to={s.to}
                onClick={onClose}
                className="flex-1 flex items-center justify-center gap-1.5 text-center text-sm font-semibold text-gray-700 bg-gray-100 rounded-lg py-2.5 hover:bg-gray-200 transition-colors"
              >
                {s.label}
                <ArrowRight className="w-3.5 h-3.5 opacity-60" />
              </Link>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => go(onLogin)}
              className="flex-1 flex items-center justify-center gap-2 text-sm font-semibold text-gray-700 border border-gray-300 rounded-lg py-2.5 hover:bg-gray-50 transition-colors"
            >
              <LogIn className="w-4 h-4" /> Iniciar sesión
            </button>
            <button
              onClick={() => go(onTrial)}
              className="flex-1 flex items-center justify-center gap-2 text-sm font-bold text-white rounded-lg py-2.5"
              style={{ background: ACCENT }}
            >
              <Gift className="w-4 h-4" /> Prueba gratis
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
