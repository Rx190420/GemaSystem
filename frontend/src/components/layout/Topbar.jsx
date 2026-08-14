import { useEffect, useRef, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { LogOut, ChevronDown, Menu, Moon, Sun, UserCircle, Bell } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { useSettingsStore } from '../../store/settingsStore'
import { useNotificationStore } from '../../store/notificationStore'
import NotificationPanel from '../NotificationPanel'
import toast from 'react-hot-toast'

export default function Topbar({ onMobileToggle }) {
  const { user, logout, sessionHash } = useAuthStore()
  const { darkMode, toggleDarkMode } = useSettingsStore()
  const { unreadCount, poll, fetch } = useNotificationStore()
  const navigate = useNavigate()

  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [notifOpen,    setNotifOpen]    = useState(false)
  const [prevUnread,   setPrevUnread]   = useState(0)
  const [bellPulse,    setBellPulse]    = useState(false)

  const bellWrapRef = useRef(null)

  // Initial fetch + 30 s poll
  useEffect(() => {
    fetch()
    const id = setInterval(() => poll(), 30_000)
    return () => clearInterval(id)
  }, [])

  // Bell wiggle when new notification arrives
  useEffect(() => {
    if (unreadCount > prevUnread && prevUnread !== null) {
      setBellPulse(true)
      setTimeout(() => setBellPulse(false), 800)
    }
    setPrevUnread(unreadCount)
  }, [unreadCount])

  // Close panel on outside click
  useEffect(() => {
    if (!notifOpen) return
    const handler = (e) => {
      if (bellWrapRef.current && !bellWrapRef.current.contains(e.target)) {
        setNotifOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [notifOpen])

  const handleLogout = async () => {
    try { await logout(); navigate('/') }
    catch { toast.error('Error al cerrar sesión') }
  }

  const initials = user
    ? (user.username?.slice(0, 2) ?? user.email?.slice(0, 2) ?? 'U').toUpperCase()
    : 'U'

  return (
    <>
      <style>{`
        @keyframes bellWiggle {
          0%,100%{ transform:rotate(0) }
          20%    { transform:rotate(-18deg) }
          40%    { transform:rotate(16deg) }
          60%    { transform:rotate(-10deg) }
          80%    { transform:rotate(7deg) }
        }
        @keyframes badgePop {
          0%  { transform:scale(0.4) }
          70% { transform:scale(1.25) }
          100%{ transform:scale(1) }
        }
      `}</style>

      <header
        className="sticky top-0 z-30 flex items-center justify-between h-14 px-5 bg-white border-b border-gray-100"
        style={{ backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}
      >
        {/* Left */}
        <div className="flex items-center gap-3">
          <button
            onClick={onMobileToggle}
            className="lg:hidden p-2 rounded-lg btn-ghost"
          >
            <Menu className="w-5 h-5" />
          </button>

          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full select-none"
            style={{
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '0.06em',
              background: 'color-mix(in srgb, var(--color-primary-500) 10%, transparent)',
              color: 'var(--color-primary-600)',
              border: '1px solid color-mix(in srgb, var(--color-primary-500) 25%, transparent)',
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ background: 'var(--color-primary-500)' }}
            />
            BETA
          </span>
        </div>

        {/* Right */}
        <div className="flex items-center gap-2">

          {/* Dark/Light toggle */}
          <button
            onClick={toggleDarkMode}
            title={darkMode ? 'Modo claro' : 'Modo oscuro'}
            className="btn-secondary flex items-center gap-1.5 px-3 py-1.5 text-xs"
          >
            {darkMode
              ? <Sun  className="w-3.5 h-3.5 text-amber-400" />
              : <Moon className="w-3.5 h-3.5" />
            }
            <span className="hidden sm:block">{darkMode ? 'Claro' : 'Oscuro'}</span>
          </button>

          {/* Notifications */}
          <div ref={bellWrapRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setNotifOpen(v => !v)}
              title="Notificaciones"
              className="btn-ghost"
              style={{ padding: 8, borderRadius: 8, position: 'relative' }}
            >
              <Bell
                className="w-4 h-4"
                style={bellPulse ? { animation: 'bellWiggle 0.7s ease' } : undefined}
              />
              {unreadCount > 0 && (
                <span
                  key={unreadCount}
                  style={{
                    position: 'absolute',
                    top: 3, right: 3,
                    minWidth: 16, height: 16,
                    borderRadius: 8,
                    background: '#ef4444',
                    color: '#fff',
                    fontSize: 9,
                    fontWeight: 800,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '0 3px',
                    border: '1.5px solid #fff',
                    animation: 'badgePop 0.22s ease',
                    pointerEvents: 'none',
                  }}
                >
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <NotificationPanel onClose={() => setNotifOpen(false)} />
            )}
          </div>

          {/* User menu */}
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl transition-all duration-150 hover:bg-gray-50"
            >
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, var(--color-primary-500), var(--color-primary-700))' }}
              >
                {initials}
              </div>
              <span className="text-sm font-medium text-gray-700 hidden sm:block">
                {user?.username}
              </span>
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </button>

            {dropdownOpen && (
              <>
                <div className="fixed inset-0" onClick={() => setDropdownOpen(false)} />
                <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-lg border border-gray-100 py-1.5 z-50">
                  <div className="px-4 py-2.5 border-b border-gray-100">
                    <p className="text-sm font-semibold text-gray-900">{user?.username}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{user?.email}</p>
                  </div>
                  <Link
                    to={`/g/${sessionHash}/perfil`}
                    onClick={() => setDropdownOpen(false)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <UserCircle className="w-4 h-4" style={{ color: 'var(--color-primary-600)' }} />
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
    </>
  )
}
