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
    return Promise.reject(err)
  }
)

export default api
