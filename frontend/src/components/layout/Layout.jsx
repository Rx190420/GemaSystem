import { useState, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import QuickAccessFAB from '../QuickAccessFAB'
import QuickVisitModal from '../QuickVisitModal'
import QuickMembershipModal from '../QuickMembershipModal'
import QuickProductModal from '../QuickProductModal'
import { useSettingsStore } from '../../store/settingsStore'

export default function Layout() {
  const [collapsed, setCollapsed]   = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [activeModal, setModal]     = useState(null)
  const { pathname } = useLocation()
  const { loadSettings } = useSettingsStore()

  useEffect(() => { loadSettings() }, [])

  /* Close mobile drawer on route change */
  useEffect(() => { setMobileOpen(false) }, [pathname])

  return (
    <div
      className="min-h-screen flex overflow-x-hidden"
      style={{ background: 'var(--surface-base)' }}
    >
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 lg:hidden"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Desktop sidebar */}
      <div className="hidden lg:block">
        <Sidebar
          collapsed={collapsed}
          onToggle={() => setCollapsed(c => !c)}
        />
      </div>

      {/* Mobile sidebar — `mobile`/`open` drive its own slide transform
          directly (see the comment in Sidebar.jsx for why that can't live on
          a wrapping div here). */}
      <Sidebar
        collapsed={false}
        onClose={() => setMobileOpen(false)}
        mobile
        open={mobileOpen}
      />

      {/* Main content area */}
      <div
        className={`flex-1 flex flex-col min-h-screen min-w-0 transition-all duration-300 ${collapsed ? 'lg:ml-16' : 'lg:ml-64'}`}
      >
        {/* `fixed`, not `sticky` — the outer shell needs `overflow-x-hidden`
            to prevent horizontal scroll, which forces overflow-y:auto on it
            too (browsers can't leave one axis at its default once the other
            is set), turning it into its own ambiguous scroll container.
            Sticky's behavior inside that got inconsistent depending on page
            content height; fixed sidesteps the whole question the same way
            Sidebar.jsx already does. `collapsed` shifts its left edge to
            clear the desktop sidebar — mirrors this wrapper's own ml-16/64. */}
        <Topbar onMobileToggle={() => setMobileOpen(o => !o)} collapsed={collapsed} />

        <main
          className="flex-1 min-w-0 overflow-x-hidden p-4 sm:p-6 pb-24 sm:pb-28"
          style={{
            // Inline, not a pt-* class: sm:p-6 (a same-specificity utility
            // scoped to its own later-in-cascade @media block) was winning
            // over an unprefixed pt-[4.5rem] class on desktop, silently
            // erasing the clearance and hiding each page's own title/buttons
            // behind the now-fixed Topbar. An inline style can't lose that
            // fight — always wins the cascade regardless of breakpoint.
            paddingTop: '4.5rem',
            background: 'var(--surface-base)',
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.025) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
            backgroundAttachment: 'fixed',
          }}
        >
          <Outlet />
        </main>
      </div>

      <QuickAccessFAB onOpen={setModal} />

      {activeModal === 'visit'      && <QuickVisitModal      onClose={() => setModal(null)} />}
      {activeModal === 'membership' && <QuickMembershipModal onClose={() => setModal(null)} />}
      {activeModal === 'product'    && <QuickProductModal    onClose={() => setModal(null)} />}
    </div>
  )
}
