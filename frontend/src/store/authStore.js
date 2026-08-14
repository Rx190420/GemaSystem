import { create } from 'zustand'
import api from '../api/axios'
import { queryClient } from '../lib/queryClient'
import { useSettingsStore } from './settingsStore'

function generateSessionHash() {
  const arr = new Uint8Array(16)
  crypto.getRandomValues(arr)
  return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('')
}

// Limpieza de restos de implementaciones anteriores
localStorage.removeItem('gemasystem_token')
localStorage.removeItem('gemasystem_user')
localStorage.removeItem('gemasystem_operator')

// Estado inicial desde sessionStorage (no incluye token — está en la cookie HttpOnly)
const stored = {
  user:         JSON.parse(sessionStorage.getItem('gemasystem_user') || 'null'),
  isOperator:   sessionStorage.getItem('gemasystem_operator') === '1',
  sessionHash:  sessionStorage.getItem('gemasystem_hash')    || null,
  operatorHash: sessionStorage.getItem('gemasystem_op_hash') || null,
}

// El token viaja solo en la cookie HttpOnly. Si hay datos de usuario en
// sessionStorage asumimos que la sesión está activa (la cookie persiste mientras
// no se cierre el navegador). Si no hay datos, el usuario no está autenticado.
const isAuthenticated = !!stored.user

// Si hay sesión activa pero falta el hash de navegación (recarga), regenerarlo
if (isAuthenticated && !stored.isOperator && !stored.sessionHash) {
  stored.sessionHash = generateSessionHash()
  sessionStorage.setItem('gemasystem_hash', stored.sessionHash)
}
if (isAuthenticated && stored.isOperator && !stored.operatorHash) {
  stored.operatorHash = generateSessionHash()
  sessionStorage.setItem('gemasystem_op_hash', stored.operatorHash)
}

export const useAuthStore = create((set, get) => ({
  user:            stored.user,
  isLoading:       false,
  error:           null,
  isAuthenticated,
  isOperator:      stored.isOperator,
  sessionHash:     stored.sessionHash,
  operatorHash:    stored.operatorHash,

  login: async (loginData) => {
    set({ isLoading: true, error: null })
    try {
      // El servidor setea la cookie HttpOnly; solo devuelve datos del usuario
      const { data } = await api.post('/auth/login', loginData)

      if (data.requires_pin)  { set({ isLoading: false }); return { requiresPin:  true } }
      if (data.requires_code) { set({ isLoading: false }); return { requiresCode: true } }

      const isOp         = !!data.is_operator
      const sessionHash  = isOp ? null : generateSessionHash()
      const operatorHash = isOp ? generateSessionHash() : null

      queryClient.clear()
      useSettingsStore.getState().resetGymData()

      sessionStorage.setItem('gemasystem_user',     JSON.stringify(data.user))
      sessionStorage.setItem('gemasystem_operator', isOp ? '1' : '0')
      if (sessionHash)  sessionStorage.setItem('gemasystem_hash',    sessionHash)
      if (operatorHash) sessionStorage.setItem('gemasystem_op_hash', operatorHash)

      set({
        user: data.user,
        isAuthenticated: true, isLoading: false,
        isOperator: isOp, sessionHash, operatorHash,
      })
      return { ...data.user, isOperator: isOp, sessionHash, operatorHash }
    } catch (err) {
      const msg = err.response?.data?.message || 'Error al iniciar sesión'
      set({ error: msg, isLoading: false })
      throw err
    }
  },

  logout: async () => {
    try { await api.post('/auth/logout') } catch { /* el server limpia la cookie de todas formas */ }
    queryClient.clear()
    useSettingsStore.getState().resetGymData()
    sessionStorage.clear()
    set({ user: null, isAuthenticated: false, isOperator: false, sessionHash: null, operatorHash: null })
  },

  operatorLogin: async (loginData) => {
    set({ isLoading: true, error: null })
    try {
      const { data } = await api.post('/auth/operator-login', loginData)
      const operatorHash = generateSessionHash()

      queryClient.clear()
      useSettingsStore.getState().resetGymData()

      sessionStorage.setItem('gemasystem_user',     JSON.stringify(data.user))
      sessionStorage.setItem('gemasystem_operator', '1')
      sessionStorage.setItem('gemasystem_op_hash',  operatorHash)

      set({
        user: data.user,
        isAuthenticated: true, isLoading: false,
        isOperator: true, operatorHash,
      })
      return { operatorHash }
    } catch (err) {
      const msg = err.response?.data?.message || 'Acceso denegado'
      set({ error: msg, isLoading: false })
      throw err
    }
  },

  // Usado en CheckoutSuccess después de pago exitoso
  // El token ya llegó en la cookie HttpOnly; aquí solo guardamos el usuario
  loginFromCookie: (user) => {
    const hash = generateSessionHash()
    sessionStorage.setItem('gemasystem_user',     JSON.stringify(user))
    sessionStorage.setItem('gemasystem_operator', '0')
    sessionStorage.setItem('gemasystem_hash',     hash)
    set({ user, isAuthenticated: true, sessionHash: hash })
    return hash
  },

  completeOnboarding: () => {
    const user = get().user
    if (!user) return
    const updated = { ...user, onboarding_completed: true }
    sessionStorage.setItem('gemasystem_user', JSON.stringify(updated))
    set({ user: updated })
  },

  clearError: () => set({ error: null }),
}))
