import { NavLink, useParams } from 'react-router-dom'
import {
  LayoutDashboard, Users, Dumbbell, Calendar,
  CreditCard, Clock, ChevronLeft, ChevronRight, TrendingUp, Settings, LifeBuoy, Bot,
} from 'lucide-react'
import { useSettingsStore } from '../../store/settingsStore'
import GemaSystemLogo from '../GemaSystemLogo'

export default function Sidebar({ collapsed, onToggle, onOpenChat }) {
  const { systemSettings } = useSettingsStore()
  const gymName = systemSettings?.gym_name || 'GemaSystem'
  const { hash } = useParams()

  const base = `/g/${hash}`

  const navItems = [
    { to: `${base}/panel`,        icon: LayoutDashboard, label: 'Dashboard' },
    { to: `${base}/socios`,       icon: Users,           label: 'Miembros' },
    { to: `${base}/entrenadores`, icon: Dumbbell,        label: 'Entrenadores' },
    { to: `${base}/clases`,       icon: Calendar,        label: 'Clases' },
    { to: `${base}/membresias`,   icon: CreditCard,      label: 'Membresías' },
    { to: `${base}/visitas`,      icon: Clock,           label: 'Visitas' },
    { to: `${base}/finanzas`,     icon: TrendingUp,      label: 'Finanzas' },
  ]

  const bottomItems = [
    { to: `${base}/soporte`,   icon: LifeBuoy, label: 'Soporte' },
    { to: `${base}/ajustes`,   icon: Settings, label: 'Configuración' },
  ]

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex flex-col transition-all duration-300 ease-in-out
        ${collapsed ? 'w-16' : 'w-64'}`}
      style={{ background: '#0F172A' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-800">
        <div
          className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: 'var(--color-primary-600)' }}
        >
          <GemaSystemLogo className="w-4 h-4" />
        </div>
        {!collapsed && (
          <span className="text-white font-bold text-lg tracking-tight">{gymName}</span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        {!collapsed && (
          <p className="px-3 mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
            Menú principal
          </p>
        )}
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150
              ${isActive
                ? 'nav-active text-white'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }
              ${collapsed ? 'justify-center' : ''}`
            }
            title={collapsed ? label : undefined}
          >
            <Icon className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}

      </nav>

      {/* Bottom section */}
      <div className="px-2 py-3 space-y-1">
        <button
          onClick={onOpenChat}
          title={collapsed ? 'Asistente IA' : undefined}
          className={`w-full group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150
            text-slate-400 hover:bg-slate-800 hover:text-white
            ${collapsed ? 'justify-center' : ''}`}
        >
          <Bot className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span>Asistente IA</span>}
        </button>

        <div className="border-t border-slate-800 my-1" />

        {bottomItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150
              ${isActive
                ? 'nav-active text-white'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }
              ${collapsed ? 'justify-center' : ''}`
            }
            title={collapsed ? label : undefined}
          >
            <Icon className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}

        <button
          onClick={onToggle}
          className="w-full flex items-center justify-center py-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-all duration-150"
          title={collapsed ? 'Expandir' : 'Colapsar'}
        >
          {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </button>
      </div>
    </aside>
  )
}
