import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Loader2, ShieldCheck, Lock } from 'lucide-react'
import { useAuthStore } from '../store/authStore'

export default function OperatorLogin() {
  const navigate                  = useNavigate()
  const { operatorLogin, isOperator, operatorHash } = useAuthStore()

  const [form, setForm]       = useState({ login: '', password: '', pin: '' })
  const [showPwd, setShowPwd] = useState(false)
  const [showPin, setShowPin] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  // Already logged in as operator
  if (isOperator && operatorHash) {
    navigate(`/sys/${operatorHash}`, { replace: true })
    return null
  }

  const set_ = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.login || !form.password || !form.pin) {
      setError('Todos los campos son requeridos.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const { operatorHash } = await operatorLogin(form)
      navigate(`/sys/${operatorHash}`, { replace: true })
    } catch (err) {
      const data = err.response?.data
      if (data?.errors?.pin)   setError(data.errors.pin[0])
      else if (data?.errors?.login) setError(data.errors.login[0])
      else setError('Acceso denegado. Verifica tus credenciales.')
    } finally {
      setLoading(false)
    }
  }

  const inp = 'w-full px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-white placeholder-slate-600 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all'

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#020817' }}>
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-10">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <ShieldCheck className="w-4.5 h-4.5 text-white" />
          </div>
          <span className="text-lg font-extrabold text-white tracking-tight">GemaSystem Console</span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Login */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Usuario o correo
            </label>
            <input
              value={form.login}
              onChange={e => set_('login', e.target.value)}
              placeholder="operador"
              autoComplete="username"
              className={inp}
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Contraseña
            </label>
            <div className="relative">
              <input
                type={showPwd ? 'text' : 'password'}
                value={form.password}
                onChange={e => set_('password', e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className={`${inp} pr-10`}
              />
              <button type="button" tabIndex={-1}
                onClick={() => setShowPwd(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400 transition-colors">
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* PIN */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              PIN de acceso
            </label>
            <div className="relative">
              <input
                type={showPin ? 'text' : 'password'}
                value={form.pin}
                onChange={e => set_('pin', e.target.value)}
                placeholder="••••••••"
                autoComplete="off"
                className={`${inp} pr-10`}
              />
              <button type="button" tabIndex={-1}
                onClick={() => setShowPin(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400 transition-colors">
                {showPin ? <EyeOff className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm text-white transition-all disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg,#4F46E5,#7C3AED)', boxShadow: '0 8px 24px rgba(99,102,241,0.3)' }}>
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Verificando…</>
              : <><ShieldCheck className="w-4 h-4" /> Acceder al panel</>}
          </button>
        </form>

        <p className="mt-8 text-center text-slate-700 text-xs">
          Acceso restringido · Solo personal autorizado
        </p>
      </div>
    </div>
  )
}
