import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle2, XCircle, ArrowRight } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import GemaSystemLogo from '../components/GemaSystemLogo'
import api from '../api/axios'

// ── Paths del logo ─────────────────────────────────────────────────────────────
const P1 = 'M 586.691406 616.171875 L 449.171875 616.171875 C 445.800781 616.171875 443.070312 613.4375 443.070312 610.066406 L 443.070312 294.570312 C 443.070312 161.789062 560.171875 53.761719 704.113281 53.761719 L 852.492188 53.761719 C 855.855469 53.761719 858.585938 56.496094 858.585938 59.867188 L 858.585938 185.777344 C 858.585938 189.144531 855.855469 191.878906 852.492188 191.878906 L 704.113281 191.878906 C 642.726562 191.878906 592.789062 237.945312 592.789062 294.570312 L 592.789062 610.066406 C 592.789062 613.4375 590.058594 616.171875 586.691406 616.171875'
const P2 = 'M 735.875 750.011719 L 735.875 624.019531 C 735.875 620.746094 738.460938 618.09375 741.738281 617.933594 C 800.40625 615.113281 847.203125 570.195312 847.203125 515.378906 L 847.203125 469.914062 C 847.203125 466.546875 844.464844 463.8125 841.101562 463.8125 L 741.980469 463.8125 C 738.613281 463.8125 735.875 461.082031 735.875 457.710938 L 735.875 331.800781 C 735.875 328.429688 738.613281 325.703125 741.980469 325.703125 L 990.816406 325.703125 C 994.1875 325.703125 996.921875 328.429688 996.921875 331.800781 L 996.921875 515.378906 C 996.921875 646.234375 883.1875 753.046875 742.121094 756.121094 C 738.699219 756.195312 735.875 753.4375 735.875 750.011719'

const VERIFY_LABELS = [
  'Verificando tu pago…',
  'Conectando con Stripe…',
  'Confirmando suscripción…',
  'Activando tu cuenta…',
  'Preparando tu panel…',
]

function VerifyingAnimation() {
  const [labelIdx, setLabelIdx] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setLabelIdx(i => (i + 1) % VERIFY_LABELS.length), 2600)
    return () => clearInterval(t)
  }, [])

  return (
    <>
      <style>{`
        #cs-clip-rect {
          transform-box: fill-box;
          transform-origin: 50% 100%;
          animation: cs-rise 2.6s cubic-bezier(.45,.05,.55,.95) infinite;
        }
        @keyframes cs-rise {
          0%       { transform: scaleY(0); }
          60%      { transform: scaleY(1); }
          78%,86%  { transform: scaleY(1); }
          100%     { transform: scaleY(0); }
        }
        #cs-filled {
          animation: cs-glow 2.6s cubic-bezier(.45,.05,.55,.95) infinite;
        }
        @keyframes cs-glow {
          0%        { filter: none; }
          60%,78%   { filter: drop-shadow(0 0 10px #a78bfa) drop-shadow(0 0 28px #6366f155); }
          88%,100%  { filter: none; }
        }
        #cs-flash {
          animation: cs-flash 2.6s ease infinite;
        }
        @keyframes cs-flash {
          0%,59%,88%,100% { opacity:0; }
          72%             { opacity:.12; }
          79%             { opacity:0; }
        }
        .cs-label {
          animation: cs-lbl .4s ease both;
        }
        @keyframes cs-lbl {
          from { opacity:0; transform:translateY(6px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes cs-dot {
          0%,80%,100% { transform:translateY(0); }
          40%         { transform:translateY(-5px); }
        }
      `}</style>

      {/* G fill animation */}
      <svg
        viewBox="443 53 554 703"
        width="96"
        height="122"
        style={{ overflow: 'visible', display: 'block', margin: '0 auto' }}
      >
        <defs>
          <linearGradient id="csGrad" x1="720" y1="756" x2="720" y2="53" gradientUnits="userSpaceOnUse">
            <stop offset="0%"   stopColor="#4f46e5" />
            <stop offset="50%"  stopColor="#8b5cf6" />
            <stop offset="85%"  stopColor="#c4b5fd" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity=".9" />
          </linearGradient>
          <clipPath id="csClip">
            <rect id="cs-clip-rect" x="443" y="53" width="554" height="703" />
          </clipPath>
        </defs>

        {/* Silueta tenue */}
        <path d={P1} fill="white" opacity="0.07" />
        <path d={P2} fill="white" opacity="0.07" />

        {/* Relleno animado */}
        <g id="cs-filled" clipPath="url(#csClip)">
          <path d={P1} fill="url(#csGrad)" />
          <path d={P2} fill="url(#csGrad)" />
        </g>

        {/* Flash pico */}
        <g id="cs-flash" clipPath="url(#csClip)">
          <path d={P1} fill="white" />
          <path d={P2} fill="white" />
        </g>
      </svg>

      {/* Texto rotativo */}
      <p
        key={labelIdx}
        className="cs-label"
        style={{
          marginTop: 28,
          color: '#fff',
          fontWeight: 800,
          fontSize: 18,
          letterSpacing: '-.01em',
          fontFamily: 'system-ui,sans-serif',
        }}
      >
        {VERIFY_LABELS[labelIdx]}
      </p>
      <p style={{ marginTop: 8, color: '#64748b', fontSize: 13, fontFamily: 'system-ui,sans-serif' }}>
        Esto solo toma un momento
      </p>

      {/* Puntos rebotando */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 20 }}>
        {[0, 160, 320].map((delay, i) => (
          <div key={i} style={{
            width: 7, height: 7, borderRadius: '50%',
            background: '#7c3aed',
            animation: `cs-dot 1.2s ease-in-out infinite ${delay}ms`,
          }} />
        ))}
      </div>
    </>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

// Both of these are "authenticated user already had a session, this Stripe
// payment just changed something about their account" flows — same polling
// shape, same need to refresh the cached session afterward, different
// backend endpoint. New registration (the plain `else` branch below) is
// its own thing: no prior session exists yet to refresh.
const ACCOUNT_UPDATE_TYPES = {
  plan_change:    { verifyPath: 'verify-plan-change',    successTitle: '¡Plan actualizado!',   successBody: 'Tu plan ha sido cambiado correctamente.' },
  extra_purchase: { verifyPath: 'verify-extra-purchase', successTitle: '¡Extra activado!',      successBody: 'Tu compra se procesó y el extra ya está activo en tu cuenta.' },
}

export default function CheckoutSuccess() {
  const [params]                = useSearchParams()
  const sessionId               = params.get('session_id')
  const accountUpdateType       = ACCOUNT_UPDATE_TYPES[params.get('type')] ?? null
  // Paying off a trial→paid conversion (SuperAdminController::convertTrialToPaid,
  // charge=true) isn't "an already-logged-in user changed something" like the
  // two above — the gym was sitting on the blocked-login screen with no
  // session at all. Handled like a brand-new signup (the plain `else` branch
  // below): verify-trial-upgrade logs them in fresh instead of refreshing a
  // session that never existed.
  const isTrialUpgrade          = params.get('type') === 'trial_upgrade'
  const [status, setStatus]     = useState('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const { loginFromCookie, sessionHash } = useAuthStore()
  const navigate                = useNavigate()

  useEffect(() => {
    if (!sessionId) {
      setStatus('error')
      setErrorMsg('No se encontró la sesión de pago.')
      return
    }

    let attempts = 0

    const check = async () => {
      try {
        if (accountUpdateType) {
          // Authenticated user changing plan / buying an extra — poll the
          // matching verify endpoint.
          const { data } = await api.get(`/stripe/${accountUpdateType.verifyPath}?session_id=${sessionId}`)

          if (data.status === 'success') {
            // The backend just updated gym.plan/plan_features, but the
            // session cached in sessionStorage (read by every gated page)
            // is still the pre-upgrade snapshot — without this, the panel
            // looks like "nothing happened" until a manual logout/login,
            // which is exactly the confusing symptom this was fixing.
            try {
              const { data: freshUser } = await api.get('/auth/me')
              loginFromCookie(freshUser)
            } catch { /* non-fatal — the plan_changed notification covers this case */ }
            setStatus('success')
            const dest = sessionHash ? `/g/${sessionHash}/perfil` : '/'
            setTimeout(() => navigate(dest), 2500)
          } else if (data.status === 'pending' && attempts < 8) {
            attempts++
            setTimeout(check, 2000)
          } else {
            setStatus('error')
            setErrorMsg('El pago aún no ha sido confirmado. Intenta recargar la página en unos segundos.')
          }
        } else if (isTrialUpgrade) {
          const { data } = await api.get(`/stripe/verify-trial-upgrade?session_id=${sessionId}`)

          if (data.status === 'success') {
            if (data.user && data.token) {
              const hash = loginFromCookie(data.user, data.token)
              setStatus('success')
              setTimeout(() => navigate(`/g/${hash}/panel`), 2500)
            } else {
              // Payment/provisioning succeeded but there was no admin user to
              // hand back a session for — send them to log in normally.
              setStatus('success')
              setTimeout(() => navigate('/'), 2500)
            }
          } else if (data.status === 'pending' && attempts < 8) {
            attempts++
            setTimeout(check, 2000)
          } else {
            setStatus('error')
            setErrorMsg('El pago aún no ha sido confirmado. Intenta recargar la página en unos segundos.')
          }
        } else {
          // New registration / resubscription flow
          const { data } = await api.get(`/stripe/verify-session?session_id=${sessionId}`)

          if (data.status === 'success') {
            const hash = loginFromCookie(data.user, data.token)
            setStatus('success')
            setTimeout(() => navigate(`/g/${hash}/panel`), 2500)
          } else if (data.status === 'pending' && attempts < 6) {
            attempts++
            setTimeout(check, 2000)
          } else {
            setStatus('error')
            setErrorMsg('El pago aún no ha sido confirmado. Intenta recargar la página en unos segundos.')
          }
        }
      } catch (err) {
        setStatus('error')
        setErrorMsg(err.response?.data?.error ?? 'Ocurrió un error al verificar el pago.')
      }
    }

    check()
  }, [sessionId, accountUpdateType, isTrialUpgrade])

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#020817' }}>
      <style>{`
        @keyframes kf-progress {
          from { transform: scaleX(0); transform-origin: left; }
          to   { transform: scaleX(1); transform-origin: left; }
        }
      `}</style>

      <div className="w-full max-w-sm text-center">

        {/* Logo header */}
        <div className="flex items-center justify-center gap-3 mb-12">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <GemaSystemLogo className="w-5 h-5" />
          </div>
          <span className="text-xl font-extrabold text-white tracking-tight">GemaSystem</span>
        </div>

        {/* Verificando */}
        {status === 'loading' && <VerifyingAnimation />}

        {/* Éxito */}
        {status === 'success' && (
          <div>
            <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
              style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)' }}>
              <CheckCircle2 className="w-10 h-10 text-emerald-400" />
            </div>
            <h2 className="text-2xl font-extrabold text-white mb-2">
              {accountUpdateType ? accountUpdateType.successTitle : '¡Pago exitoso!'}
            </h2>
            <p className="text-slate-500 text-sm mb-8">
              {accountUpdateType
                ? <>{accountUpdateType.successBody}<br />Regresando a tu perfil…</>
                : <>Tu cuenta ha sido activada.<br />Te estamos llevando al panel…</>}
            </p>
            <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
              <div className="h-full rounded-full"
                style={{ background: 'linear-gradient(90deg,#4F46E5,#7C3AED)', animation: 'kf-progress 2.5s linear forwards' }} />
            </div>
          </div>
        )}

        {/* Error */}
        {status === 'error' && (
          <div>
            <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
              style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.20)' }}>
              <XCircle className="w-10 h-10 text-red-400" />
            </div>
            <h2 className="text-2xl font-extrabold text-white mb-2">Algo salió mal</h2>
            <p className="text-slate-500 text-sm mb-8 leading-relaxed">{errorMsg}</p>
            <a href="/"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm text-white transition-all hover:-translate-y-0.5 duration-200"
              style={{ background: 'linear-gradient(135deg,#4F46E5,#7C3AED)', boxShadow: '0 8px 24px rgba(99,102,241,0.35)' }}>
              Volver al inicio <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        )}

      </div>
    </div>
  )
}
