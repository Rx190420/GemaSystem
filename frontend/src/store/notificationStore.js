import { create } from 'zustand'
import api from '../api/axios'

export const useNotificationStore = create((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,
  lastFetched: null,

  fetch: async () => {
    set({ loading: true })
    try {
      const { data } = await api.get('/notifications')
      set({
        notifications: data.notifications,
        unreadCount: data.unread_count,
        lastFetched: Date.now(),
      })
    } catch {
      // silent — user may not be authenticated yet
    } finally {
      set({ loading: false })
    }
  },

  // Lightweight poll — skips if called within 30 s of last fetch
  poll: async () => {
    if (Date.now() - (get().lastFetched ?? 0) < 30_000) return
    try {
      const { data } = await api.get('/notifications')
      set({
        notifications: data.notifications,
        unreadCount: data.unread_count,
        lastFetched: Date.now(),
      })
    } catch {}
  },

  markRead: async (id) => {
    const notif = get().notifications.find(n => n.id === id)
    if (!notif || notif.read_at) return
    const now = new Date().toISOString()
    set(s => ({
      notifications: s.notifications.map(n => n.id === id ? { ...n, read_at: now } : n),
      unreadCount: Math.max(0, s.unreadCount - 1),
    }))
    try { await api.patch(`/notifications/${id}/read`) } catch {}
  },

  markAllRead: async () => {
    const now = new Date().toISOString()
    set(s => ({
      notifications: s.notifications.map(n => ({ ...n, read_at: n.read_at || now })),
      unreadCount: 0,
    }))
    try { await api.patch('/notifications/read-all') } catch {}
  },

  dismiss: async (id) => {
    const notif = get().notifications.find(n => n.id === id)
    set(s => ({
      notifications: s.notifications.filter(n => n.id !== id),
      unreadCount: notif && !notif.read_at ? Math.max(0, s.unreadCount - 1) : s.unreadCount,
    }))
    try { await api.delete(`/notifications/${id}`) } catch {}
  },

  clearRead: async () => {
    set(s => ({ notifications: s.notifications.filter(n => !n.read_at) }))
    try { await api.delete('/notifications/read') } catch {}
  },
}))
