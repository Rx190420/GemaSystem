import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  withCredentials: true, // envía la cookie gemasystem_token (HttpOnly) en cada request
})

// ── Bearer-token fallback ────────────────────────────────────────────────────
// The HttpOnly cookie is the primary auth carrier and works for most
// browsers. But frontend and API live on different domains, so it's a
// cross-site cookie — mobile Safari/Chrome increasingly block those outright,
// which meant the cookie's Set-Cookie header arrived fine at login but the
// browser never persisted/resent it, so every request right after 401'd and
// the SPA bounced straight back to the login screen. authStore stores the
// token login() also returns and calls setAuthToken() with it; attaching it
// here as a plain header sidesteps cookie policy entirely, since it isn't a
// cookie. Kept as a module-level variable (not read from authStore) to avoid
// a circular import — authStore already imports this module.
let authToken = null
export function setAuthToken(token) { authToken = token }
export function clearAuthToken()    { authToken = null }

api.interceptors.request.use((config) => {
  if (authToken) config.headers.Authorization = `Bearer ${authToken}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      sessionStorage.clear()
      if (window.location.pathname !== '/') window.location.href = '/'
    }
    // err.response is only set once a server actually answered — its
    // absence (paired with axios' own network-failure code) means the
    // request never got anywhere, which is a stronger "we're offline"
    // signal than navigator.onLine alone. useOnlineStatus() listens for
    // this to show the offline takeover even when the browser still
    // thinks the network interface is up.
    if (!err.response && (err.code === 'ERR_NETWORK' || err.message === 'Network Error')) {
      window.dispatchEvent(new Event('app:network-error'))
    }
    return Promise.reject(err)
  }
)

export default api
