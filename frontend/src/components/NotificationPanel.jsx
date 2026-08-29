import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bell, X, CheckCheck, Trash2, RefreshCw,
  UserPlus, CreditCard, Trophy, Clock, AlertTriangle, Sparkles,
} from 'lucide-react'
import { useNotificationStore } from '../store/notificationStore'
import { useAuthStore } from '../store/authStore'

// ── Type configuration ────────────────────────────────────────────────────────

const TYPE_CFG = {
  member_registered:   { Icon: UserPlus,       color: '#22c55e', bg: 'rgba(34,197,94,0.13)' },
  payment_received:    { Icon: CreditCard,      color: '#3b82f6', bg: 'rgba(59,130,246,0.13)' },
  visit_milestone:     { Icon: Trophy,          color: '#a855f7', bg: 'rgba(168,85,247,0.13)' },
  membership_expiring: { Icon: Clock,           color: '#f59e0b', bg: 'rgba(245,158,11,0.13)' },
  membership_expired:  { Icon: AlertTriangle,   color: '#ef4444', bg: 'rgba(239,68,68,0.13)' },
  plan_changed:        { Icon: Sparkles,        color: '#6366f1', bg: 'rgba(99,102,241,0.13)' },
}
const DEFAULT_CFG = { Icon: Bell, color: '#6366f1', bg: 'rgba(99,102,241,0.13)' }

// ── Helpers ───────────────────────────────────────────────────────────────────

function relativeTime(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(diff / 3_600_000)
  const d = Math.floor(diff / 86_400_000)
  if (m < 1)   return 'Ahora mismo'
  if (m < 60)  return `hace ${m} min`
  if (h < 24)  return `hace ${h} h`
  if (d === 1) return 'Ayer'
  if (d < 7)   return `hace ${d} días`
  return new Date(dateStr).toLocaleDateString('es', { day: 'numeric', month: 'short' })
}

function navTarget(notif, hash) {
  const d = notif.data || {}
  switch (notif.type) {
    case 'member_registered':
    case 'visit_milestone':
    case 'membership_expiring':
    case 'membership_expired':
      return d.member_id ? `/g/${hash}/socio/${d.member_id}` : null
    case 'payment_received':
      return `/g/${hash}/finanzas`
    case 'plan_changed':
      return `/g/${hash}/perfil`
    default:
      return null
  }
}

// ── NotificationPanel ─────────────────────────────────────────────────────────

export default function NotificationPanel({ onClose }) {
  const { notifications, unreadCount, loading, fetch, markRead, markAllRead, dismiss, clearRead } =
    useNotificationStore()
  const { sessionHash } = useAuthStore()
  const navigate = useNavigate()
  const [filter, setFilter]   = useState('all')
  const [exiting, setExiting] = useState(false)

  useEffect(() => { fetch() }, [])

  const handleClose = () => {
    setExiting(true)
    setTimeout(onClose, 160)
  }

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') handleClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const filtered = filter === 'unread'
    ? notifications.filter(n => !n.read_at)
    : notifications

  const hasRead = notifications.some(n => n.read_at)

  const handleClick = async (notif) => {
    if (!notif.read_at) markRead(notif.id)
    const target = navTarget(notif, sessionHash)
    if (target) { navigate(target); handleClose() }
  }

  return (
    <>
      {/* Slide-in keyframe injected once */}
      <style>{`
        @keyframes notifIn  { from { opacity:0; transform:translateY(-8px) scale(0.97) } to { opacity:1; transform:translateY(0) scale(1) } }
        @keyframes notifOut { from { opacity:1; transform:translateY(0) scale(1) } to { opacity:0; transform:translateY(-6px) scale(0.97) } }
        .notif-row:hover .notif-x { opacity:1 !important; }
        .notif-row:hover { background: var(--notif-hover, rgba(0,0,0,0.04)) !important; }
      `}</style>

      <div
        style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          right: 0,
          width: 384,
          maxHeight: 540,
          background: 'var(--color-surface, #fff)',
          border: '1px solid rgba(0,0,0,0.09)',
          borderRadius: 16,
          boxShadow: '0 24px 64px rgba(0,0,0,0.16), 0 4px 16px rgba(0,0,0,0.08)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          zIndex: 200,
          animation: `${exiting ? 'notifOut' : 'notifIn'} 0.18s ease both`,
        }}
      >
        {/* ── Header ── */}
        <div style={{ padding: '14px 16px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--color-text, #111827)' }}>
                Notificaciones
              </span>
              {unreadCount > 0 && (
                <span style={{
                  background: 'var(--color-primary-500, #6366f1)',
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 700,
                  borderRadius: 20,
                  padding: '1px 7px',
                  minWidth: 20,
                  textAlign: 'center',
                }}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', gap: 2 }}>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  title="Marcar todas como leídas"
                  style={iconBtn}
                >
                  <CheckCheck size={15} style={{ color: 'var(--color-primary-500, #6366f1)' }} />
                </button>
              )}
              <button
                onClick={fetch}
                title="Actualizar"
                style={iconBtn}
              >
                <RefreshCw size={13} style={{ color: '#9ca3af', ...(loading ? { animation: 'spin 1s linear infinite' } : {}) }} />
              </button>
              <button onClick={handleClose} style={iconBtn}>
                <X size={14} style={{ color: '#9ca3af' }} />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
            {[
              { key: 'all',    label: 'Todas' },
              { key: 'unread', label: unreadCount > 0 ? `No leídas (${unreadCount})` : 'No leídas' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                style={{
                  padding: '6px 14px',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: filter === key ? 700 : 400,
                  color: filter === key ? 'var(--color-primary-600, #4f46e5)' : '#9ca3af',
                  borderBottom: filter === key ? '2px solid var(--color-primary-500, #6366f1)' : '2px solid transparent',
                  marginBottom: -1,
                  transition: 'color 0.15s',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── List ── */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading && filtered.length === 0 ? (
            <EmptyState message="Cargando…" sub="" />
          ) : filtered.length === 0 ? (
            <EmptyState
              message={filter === 'unread' ? '¡Estás al día!' : 'Sin notificaciones'}
              sub={filter === 'unread' ? 'No tienes notificaciones pendientes.' : 'Las notificaciones aparecerán aquí automáticamente.'}
            />
          ) : (
            filtered.map(notif => (
              <NotifRow
                key={notif.id}
                notif={notif}
                onClick={() => handleClick(notif)}
                onDismiss={() => dismiss(notif.id)}
                hasLink={!!navTarget(notif, sessionHash)}
              />
            ))
          )}
        </div>

        {/* ── Footer ── */}
        {hasRead && (
          <div style={{
            padding: '8px 16px',
            borderTop: '1px solid rgba(0,0,0,0.06)',
            display: 'flex',
            justifyContent: 'flex-end',
          }}>
            <button
              onClick={clearRead}
              style={{
                fontSize: 11,
                cursor: 'pointer',
                border: 'none',
                background: 'transparent',
                color: '#9ca3af',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 0',
              }}
            >
              <Trash2 size={11} />
              Limpiar leídas
            </button>
          </div>
        )}
      </div>
    </>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function NotifRow({ notif, onClick, onDismiss, hasLink }) {
  const { Icon, color, bg } = TYPE_CFG[notif.type] || DEFAULT_CFG
  const isUnread = !notif.read_at

  return (
    <div
      className="notif-row"
      onClick={onClick}
      style={{
        display: 'flex',
        gap: 11,
        padding: '11px 16px',
        cursor: hasLink ? 'pointer' : 'default',
        background: isUnread ? 'rgba(99,102,241,0.035)' : 'transparent',
        borderBottom: '1px solid rgba(0,0,0,0.05)',
        position: 'relative',
        transition: 'background 0.12s',
        '--notif-hover': isUnread ? 'rgba(99,102,241,0.07)' : 'rgba(0,0,0,0.03)',
      }}
    >
      {/* Icon */}
      <div style={{
        width: 34, height: 34, borderRadius: 10, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: bg, color, marginTop: 1,
      }}>
        <Icon size={16} />
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0, paddingRight: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          {isUnread && (
            <span style={{
              width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
              background: 'var(--color-primary-500, #6366f1)',
            }} />
          )}
          <p style={{
            fontSize: 12.5,
            fontWeight: isUnread ? 650 : 500,
            color: 'var(--color-text, #111827)',
            lineHeight: 1.35,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {notif.title}
          </p>
        </div>
        <p style={{
          fontSize: 11.5,
          color: '#6b7280',
          lineHeight: 1.45,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {notif.body}
        </p>
        <p style={{ fontSize: 10.5, color: '#9ca3af', marginTop: 3 }}>
          {relativeTime(notif.created_at)}
        </p>
      </div>

      {/* Dismiss X */}
      <button
        className="notif-x"
        onClick={e => { e.stopPropagation(); onDismiss() }}
        title="Descartar"
        style={{
          position: 'absolute', top: 10, right: 12,
          width: 20, height: 20, borderRadius: 6,
          border: 'none',
          background: 'rgba(0,0,0,0.07)',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#9ca3af',
          opacity: 0,
          transition: 'opacity 0.12s',
        }}
      >
        <X size={10} />
      </button>
    </div>
  )
}

function EmptyState({ message, sub }) {
  return (
    <div style={{ padding: '40px 24px', textAlign: 'center' }}>
      <div style={{
        width: 48, height: 48, borderRadius: 14, margin: '0 auto 12px',
        background: 'rgba(99,102,241,0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Bell size={22} style={{ color: '#818cf8' }} />
      </div>
      <p style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--color-text, #374151)', marginBottom: 4 }}>
        {message}
      </p>
      {sub && <p style={{ fontSize: 12, color: '#9ca3af', lineHeight: 1.5 }}>{sub}</p>}
    </div>
  )
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const iconBtn = {
  width: 28, height: 28, borderRadius: 7,
  border: 'none', background: 'transparent',
  cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  transition: 'background 0.12s',
}
