import { useState, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import QuickAccessFAB from '../QuickAccessFAB'
import QuickVisitModal from '../QuickVisitModal'
import QuickMembershipModal from '../QuickMembershipModal'
import QuickClassModal from '../QuickClassModal'
import ChatbotModal from '../chatbot/ChatbotModal'
import { useSettingsStore } from '../../store/settingsStore'

const pageTitles = {
  '/dashboard':   'Dashboard',
  '/members':     'Miembros',
  '/trainers':    'Entrenadores',
  '/classes':     'Clases',
  '/memberships': 'Membresías',
  '/visits':      'Visitas',
  '/finances':    'Finanzas',
  '/settings':    'Configuración',
}

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [activeModal, setModal] = useState(null)
  const [chatOpen, setChatOpen] = useState(false)
  const { pathname } = useLocation()
  const { loadSettings } = useSettingsStore()

  const title = pageTitles[pathname] ?? 'GemaSystem'

  useEffect(() => { loadSettings() }, [])

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <div className="hidden lg:block">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} onOpenChat={() => setChatOpen(true)} />
      </div>

      <div className={`fixed inset-y-0 left-0 z-40 lg:hidden transition-transform duration-300
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <Sidebar collapsed={false} onToggle={() => setMobileOpen(false)} onOpenChat={() => setChatOpen(true)} />
      </div>

      <div className={`flex-1 flex flex-col min-h-screen transition-all duration-300
        ${collapsed ? 'lg:ml-16' : 'lg:ml-64'}`}>
        <Topbar onMobileToggle={() => setMobileOpen(o => !o)} title={title} />
        <main className="flex-1 p-6 pb-24">
          <Outlet />
        </main>
      </div>

      <QuickAccessFAB onOpen={setModal} />

      {activeModal === 'visit'      && <QuickVisitModal      onClose={() => setModal(null)} />}
      {activeModal === 'membership' && <QuickMembershipModal onClose={() => setModal(null)} />}
      {activeModal === 'class'      && <QuickClassModal      onClose={() => setModal(null)} />}

      {chatOpen && <ChatbotModal onClose={() => setChatOpen(false)} />}
    </div>
  )
}
