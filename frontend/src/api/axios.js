import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  withCredentials: true, // envía la cookie gemasystem_token (HttpOnly) en cada request
})

// Sin interceptor de Authorization — el token viaja en cookie HttpOnly automáticamente

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
