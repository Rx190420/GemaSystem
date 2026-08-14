import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { LogOut, ChevronDown, Menu, Moon, Sun, UserCircle } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { useSettingsStore } from '../../store/settingsStore'
import toast from 'react-hot-toast'

export default function Topbar({ onMobileToggle, title }) {
  const { user, logout, sessionHash } = useAuthStore()
  const { darkMode, toggleDarkMode } = useSettingsStore()
  const navigate = useNavigate()
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const handleLogout = async () => {
    try {
      await logout()
      navigate('/')
    } catch {
      toast.error('Error al cerrar sesión')
    }
  }

  const initials = user
    ? (user.username?.slice(0, 2) ?? user.email?.slice(0, 2) ?? 'U').toUpperCase()
    : 'U'

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-6 bg-white border-b border-gray-100 shadow-sm">
      <div className="flex items-center gap-4">
        <button
          onClick={onMobileToggle}
          className="lg:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100"
        >
          <Menu className="w-5 h-5" />
        </button>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold tracking-wide bg-indigo-50 text-indigo-600 border border-indigo-200 select-none">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
          Beta
        </span>
      </div>

      {/* Right side controls */}
      <div className="flex items-center gap-2">

        {/* Dark mode toggle */}
        <button
          onClick={toggleDarkMode}
          title={darkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          className={`group relative flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold
            border transition-all duration-300 overflow-hidden
            ${darkMode
              ? 'bg-slate-800 border-slate-600 text-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.25)]'
              : 'bg-white border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600 shadow-sm'
            }`}
        >
          {/* Animated background glow in dark mode */}
          {darkMode && (
            <span className="absolute inset-0 bg-gradient-to-r from-slate-800 via-indigo-950 to-slate-800 opacity-80" />
          )}
          <span className="relative flex items-center gap-1.5">
            <span className={`transition-all duration-500 ${darkMode ? 'rotate-0 scale-110' : 'rotate-[-20deg] scale-100'}`}>
              {darkMode
                ? <Sun className="w-3.5 h-3.5 text-amber-300" />
                : <Moon className="w-3.5 h-3.5" />
              }
            </span>
            <span className="hidden sm:block tracking-wide">
              {darkMode ? 'Claro' : 'Oscuro'}
            </span>
          </span>
        </button>

        {/* User menu */}
        <div className="relative">
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center gap-2.5 p-1.5 pr-3 rounded-full hover:bg-gray-50 transition-colors"
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-xs font-bold">
            {initials}
          </div>
          <span className="text-sm font-medium text-gray-700 hidden sm:block">{user?.username}</span>
          <ChevronDown className="w-4 h-4 text-gray-400" />
        </button>

        {dropdownOpen && (
          <>
            <div className="fixed inset-0" onClick={() => setDropdownOpen(false)} />
            <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-lg border border-gray-100 py-1.5 z-50">
              <div className="px-4 py-2 border-b border-gray-100">
                <p className="text-sm font-medium text-gray-900">{user?.username}</p>
                <p className="text-xs text-gray-500">{user?.email}</p>
              </div>
              <Link
                to={`/g/${sessionHash}/perfil`}
                onClick={() => setDropdownOpen(false)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <UserCircle className="w-4 h-4 text-indigo-500" />
                Ver perfil
              </Link>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Cerrar sesión
              </button>
            </div>
          </>
        )}
        </div>

      </div>
    </header>
  )
}
