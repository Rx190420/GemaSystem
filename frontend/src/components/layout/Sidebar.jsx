import { NavLink, useParams } from 'react-router-dom'
import {
  LayoutDashboard, Users, Calendar,
  CreditCard, Clock, TrendingUp, Settings, LifeBuoy, MessageCircle,
  ChevronLeft, ChevronRight, Package, X,
} from 'lucide-react'
import { useSettingsStore } from '../../store/settingsStore'
import GemaSystemLogo from '../GemaSystemLogo'

// `onClose`/`mobile`/`open` are only passed by the mobile drawer instance in
// Layout — when present, this renders as a slide-in overlay panel (closed by
// its own X button) instead of the desktop collapsible rail.
//
// The slide animation lives on THIS <aside> itself (not on a wrapping div in
// Layout) very deliberately: Tailwind v4's translate-x utilities animate via
// the CSS `translate` property, and its percentage is resolved against the
// element's OWN box. A wrapping <div> here would have zero width (its only
// child, this <aside>, is itself `position:fixed` and so contributes no size
// to a parent's shrink-to-fit box) — translating a 0px-wide box by "-100%"
// moves it 0px, so it silently never leaves the screen. Confirmed live: the
// wrapper's computed `translate` was correctly "-100%", but its rect was
// 0×height, so the actual fixed-position <aside> inside always rendered
// pinned to the top-left corner regardless of open/closed state, blocking
// the hamburger button underneath it. Putting the translate on this <aside>
// (which has a real, explicit w-16/w-64) fixes that at the source.
export default function Sidebar({ collapsed, onToggle, onClose, mobile = false, open = true }) {
  const { systemSettings } = useSettingsStore()
  const gymName = systemSettings?.gym_name || 'GemaSystem'
  const { hash } = useParams()
  const base = `/g/${hash}`

  const navItems = [
    { to: `${base}/panel`,        icon: LayoutDashboard, label: 'Dashboard' },
    { to: `${base}/socios`,       icon: Users,           label: 'Miembros' },
    { to: `${base}/clases`,       icon: Calendar,        label: 'Clases' },
    { to: `${base}/membresias`,   icon: CreditCard,      label: 'Membresías' },
    { to: `${base}/visitas`,      icon: Clock,           label: 'Visitas' },
    { to: `${base}/productos`,    icon: Package,         label: 'Productos' },
    { to: `${base}/finanzas`,     icon: TrendingUp,      label: 'Finanzas' },
  ]

  const bottomItems = [
    { to: `${base}/soporte`, icon: LifeBuoy, label: 'Soporte' },
    { to: `${base}/ajustes`, icon: Settings, label: 'Configuración' },
  ]

  return (
    // The *entire* drawer scrolls as one unit — not just a narrow inner strip.
    // Earlier attempts (flex-1 + min-h-0 on just the <nav>) were layout-correct
    // (verified: scrollTop moved fine in a live DOM test) but gave a small,
    // fiddly ~20-40px band as the only place a finger could grab to scroll.
    // Making the whole <aside> the scroll container means any swipe anywhere on
    // it works, and it's a far bigger, more forgiving touch target. mt-auto on
    // the bottom section (below) still pins it to the bottom when everything
    // fits (desktop / tall screens) via the standard flex "sticky footer" trick;
    // it only stops helping once content genuinely needs to scroll, which is
    // exactly when we want the whole-drawer scroll to take over instead.
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex flex-col overflow-y-auto overscroll-contain
        [-webkit-overflow-scrolling:touch] [touch-action:pan-y]
        transition-all duration-300 ease-in-out ${collapsed ? 'w-16' : 'w-64'}
        ${mobile ? `lg:hidden ${open ? 'translate-x-0' : '-translate-x-full'}` : ''}`}
      style={{
        background: 'linear-gradient(180deg, #0D1117 0%, #0A0E18 100%)',
        borderRight: '1px solid rgba(255,255,255,0.05)',
      }}
    >
      {/* Logo */}
      <div className={`flex items-center gap-3 px-4 py-5 flex-shrink-0 ${collapsed ? 'justify-center' : 'justify-between'}`}
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #8B5CF6, #6366F1)',
              boxShadow: '0 0 20px rgba(139,92,246,0.4)',
            }}
          >
            <GemaSystemLogo className="w-4 h-4 text-white" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <span className="text-white font-bold text-base tracking-tight leading-none truncate block">{gymName}</span>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" style={{ boxShadow: '0 0 6px #34D399' }} />
                <span style={{ fontSize: '10px', color: '#64748B', fontWeight: 500 }}>Sistema activo</span>
              </div>
            </div>
          )}
        </div>

        {/* Close button — mobile drawer only (see comment on the component). */}
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Cerrar menú"
            title="Cerrar menú"
            className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white transition-colors [touch-action:manipulation]"
          >
            <X className="w-4.5 h-4.5" style={{ width: '18px', height: '18px' }} />
          </button>
        )}
      </div>

      {/* Navigation — no longer its own scroll container; the <aside> above scrolls
          as a whole now (see comment there), so this just flows naturally. */}
      <nav className="px-2.5 py-4 space-y-0.5 flex-shrink-0">
        {!collapsed && (
          <p style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.12em', color: '#334155', textTransform: 'uppercase', padding: '0 10px 8px' }}>
            Menú principal
          </p>
        )}
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            title={collapsed ? label : undefined}
            className={({ isActive }) =>
              `group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
              [touch-action:manipulation]
              ${isActive ? 'nav-active text-white' : ''}
              ${collapsed ? 'justify-center' : ''}`
            }
            style={({ isActive }) => isActive ? {} : {
              color: '#64748B',
            }}
            onMouseEnter={e => {
              if (!e.currentTarget.classList.contains('nav-active')) {
                e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                e.currentTarget.style.color = '#CBD5E1'
              }
            }}
            onMouseLeave={e => {
              if (!e.currentTarget.classList.contains('nav-active')) {
                e.currentTarget.style.background = ''
                e.currentTarget.style.color = '#64748B'
              }
            }}
          >
            <Icon className="w-4.5 h-4.5 flex-shrink-0" style={{ width: '18px', height: '18px' }} />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Bottom section — mt-auto pins it to the bottom when the drawer has spare
          room (see the <aside> comment above); flex-shrink-0 keeps it at its
          natural size instead of getting squeezed when the drawer scrolls. */}
      <div className="px-2.5 py-3 space-y-0.5 flex-shrink-0 mt-auto" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <NavLink
          to={`${base}/whatsapp`}
          title={collapsed ? 'WhatsApp' : undefined}
          className={({ isActive }) =>
            `group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
            [touch-action:manipulation]
            ${isActive ? 'nav-active text-white' : ''}
            ${collapsed ? 'justify-center' : ''}`
          }
          style={({ isActive }) => isActive ? {} : { color: '#64748B' }}
          onMouseEnter={e => {
            if (!e.currentTarget.classList.contains('nav-active')) {
              e.currentTarget.style.background = 'rgba(37,211,102,0.08)'
              e.currentTarget.style.color = '#25D366'
            }
          }}
          onMouseLeave={e => {
            if (!e.currentTarget.classList.contains('nav-active')) {
              e.currentTarget.style.background = ''
              e.currentTarget.style.color = '#64748B'
            }
          }}
        >
          <MessageCircle style={{ width: '18px', height: '18px', flexShrink: 0 }} />
          {!collapsed && <span>WhatsApp</span>}
        </NavLink>

        {bottomItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            title={collapsed ? label : undefined}
            className={({ isActive }) =>
              `group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
              [touch-action:manipulation]
              ${isActive ? 'nav-active text-white' : ''}
              ${collapsed ? 'justify-center' : ''}`
            }
            style={({ isActive }) => isActive ? {} : { color: '#64748B' }}
            onMouseEnter={e => {
              if (!e.currentTarget.classList.contains('nav-active')) {
                e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                e.currentTarget.style.color = '#CBD5E1'
              }
            }}
            onMouseLeave={e => {
              if (!e.currentTarget.classList.contains('nav-active')) {
                e.currentTarget.style.background = ''
                e.currentTarget.style.color = '#64748B'
              }
            }}
          >
            <Icon style={{ width: '18px', height: '18px', flexShrink: 0 }} />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}

        {/* Collapse toggle — desktop rail only; the mobile drawer closes via
            the X button in the header above instead (see onClose above). */}
        {!onClose && (
          <button
            onClick={onToggle}
            className={`w-full flex items-center py-2 rounded-xl transition-all duration-200 mt-1 [touch-action:manipulation] ${collapsed ? 'justify-center' : 'justify-between px-3'}`}
            style={{ color: '#334155' }}
            title={collapsed ? 'Expandir' : 'Colapsar'}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.color = '#64748B' }}
            onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = '#334155' }}
          >
            {!collapsed && <span style={{ fontSize: '12px' }}>Colapsar menú</span>}
            {collapsed
              ? <ChevronRight style={{ width: '16px', height: '16px' }} />
              : <ChevronLeft  style={{ width: '16px', height: '16px' }} />
            }
          </button>
        )}
      </div>
    </aside>
  )
}
