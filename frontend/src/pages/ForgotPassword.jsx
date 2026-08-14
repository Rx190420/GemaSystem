import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Dumbbell, Loader2, Mail, KeyRound, Eye, EyeOff, ArrowLeft, CheckCircle2, ShieldCheck } from 'lucide-react'
import api from '../api/axios'
import toast from 'react-hot-toast'

const PASSWORD_RULES = [
  { re: /.{8,}/,         label: 'Mínimo 8 caracteres' },
  { re: /[A-Z]/,         label: 'Una letra mayúscula' },
  { re: /[a-z]/,         label: 'Una letra minúscula' },
  { re: /[0-9]/,         label: 'Un número' },
  { re: /[^A-Za-z0-9]/, label: 'Un símbolo (ej. @, #, !)' },
]

function PasswordStrength({ password }) {
  if (!password) return null
  return (
    <ul className="mt-2 space-y-1">
      {PASSWORD_RULES.map(rule => {
        const ok = rule.re.test(password)
        return (
          <li key={rule.label} className={`flex items-center gap-2 text-xs transition-colors ${ok ? 'text-emerald-600' : 'text-gray-400'}`}>
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${ok ? 'bg-emerald-500' : 'bg-gray-300'}`} />
            {rule.label}
          </li>
        )
      })}
    </ul>
  )
}

export default function ForgotPassword() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1) // 1: email, 2: code+password, 3: success
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [showConf, setShowConf] = useState(false)
  const [loading, setLoading] = useState(false)

  const passwordValid = PASSWORD_RULES.every(r => r.re.test(password))

  const handleSendCode = async (e) => {
    e.preventDefault()
    if (!email) return
    setLoading(true)
    try {
      await api.post('/auth/password/send-code', { email })
      toast.success('Código enviado — revisa tu correo')
      setStep(2)
    } catch (err) {
      // Backend always responds 200 to prevent enumeration, so real errors are network issues
      toast.error(err.response?.data?.message ?? 'Error al enviar. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const handleReset = async (e) => {
    e.preventDefault()
    if (!passwordValid) return toast.error('La contraseña no cumple los requisitos de seguridad.')
    if (password !== confirm) return toast.error('Las contraseñas no coinciden.')
    if (code.length !== 6) return toast.error('El código debe tener 6 dígitos.')
    setLoading(true)
    try {
      await api.post('/auth/password/reset', {
        email,
        code,
        password,
        password_confirmation: confirm,
      })
      setStep(3)
    } catch (err) {
      const msg = err.response?.data?.message ?? 'Código inválido o expirado.'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const inp = 'w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all'

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-2xl shadow-indigo-500/30 mb-4">
            <Dumbbell className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">GemaSystem</h1>
          <p className="text-slate-400 text-sm mt-1">Recuperación de contraseña</p>
        </div>

        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl">

          {/* Step 1: Enter email */}
          {step === 1 && (
            <>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                  <Mail className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">¿Olvidaste tu contraseña?</h2>
                  <p className="text-xs text-slate-400">Te enviaremos un código de verificación</p>
                </div>
              </div>

              <form onSubmit={handleSendCode} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Correo electrónico de tu cuenta
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="correo@ejemplo.com"
                    required
                    className={inp}
                    autoFocus
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !email}
                  className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold text-sm transition-all duration-200 shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</> : 'Enviar código'}
                </button>
              </form>
            </>
          )}

          {/* Step 2: Enter code + new password */}
          {step === 2 && (
            <>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Verificar y cambiar</h2>
                  <p className="text-xs text-slate-400">Código enviado a <span className="text-indigo-400">{email}</span></p>
                </div>
              </div>

              <form onSubmit={handleReset} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Código de verificación (6 dígitos)
                  </label>
                  <input
                    type="text"
                    value={code}
                    onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    maxLength={6}
                    className={`${inp} text-center text-xl tracking-[0.5em] font-mono`}
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Nueva contraseña
                  </label>
                  <div className="relative">
                    <input
                      type={showPass ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className={`${inp} pr-12`}
                    />
                    <button type="button" onClick={() => setShowPass(s => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors p-1">
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <PasswordStrength password={password} />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Confirmar contraseña
                  </label>
                  <div className="relative">
                    <input
                      type={showConf ? 'text' : 'password'}
                      value={confirm}
                      onChange={e => setConfirm(e.target.value)}
                      placeholder="••••••••"
                      className={`${inp} pr-12`}
                    />
                    <button type="button" onClick={() => setShowConf(s => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors p-1">
                      {showConf ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {confirm && password !== confirm && (
                    <p className="mt-1 text-xs text-red-400">Las contraseñas no coinciden</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading || !passwordValid || password !== confirm || code.length !== 6}
                  className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold text-sm transition-all duration-200 shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</> : 'Cambiar contraseña'}
                </button>

                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="w-full text-center text-xs text-slate-500 hover:text-slate-300 transition-colors"
                >
                  ¿No recibiste el código? Volver a intentar
                </button>
              </form>
            </>
          )}

          {/* Step 3: Success */}
          {step === 3 && (
            <div className="text-center py-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/20 mb-4">
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              </div>
              <h2 className="text-lg font-semibold text-white mb-2">¡Contraseña actualizada!</h2>
              <p className="text-sm text-slate-400 mb-6">
                Tu contraseña se cambió correctamente. Ya puedes iniciar sesión con tu nueva contraseña.
              </p>
              <button
                onClick={() => navigate('/')}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold text-sm transition-all duration-200"
              >
                Ir a iniciar sesión
              </button>
            </div>
          )}

          {step !== 3 && (
            <div className="mt-5 pt-4 border-t border-white/10 text-center">
              <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors">
                <ArrowLeft className="w-3.5 h-3.5" /> Volver al inicio de sesión
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
