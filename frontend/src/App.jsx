import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom'
import { useEffect, useState, useRef } from 'react'
import { useAuthStore } from './store/authStore'
import Layout from './components/layout/Layout'
import PageLoader from './components/PageLoader'
import Landing from './pages/Landing'
import Dashboard from './pages/Dashboard'
import Members from './pages/Members'
import MemberDetail from './pages/MemberDetail'
import Classes from './pages/Classes'
import Visits from './pages/Visits'
import Memberships from './pages/Memberships'
import Products from './pages/Products'
import Finances from './pages/Finances'
import Settings from './pages/Settings'
import WhatsAppPage from './pages/WhatsApp'
import Support from './pages/Support'
import SupportPanel from './pages/SupportPanel'
import Projects from './pages/Projects'
import SuperAdmin from './pages/SuperAdmin'
import CheckoutSuccess from './pages/CheckoutSuccess'
import ForgotPassword from './pages/ForgotPassword'
import Profile from './pages/Profile'
import Terminos from './pages/Terminos'
import Privacidad from './pages/Privacidad'
import OnboardingWizard from './components/OnboardingWizard'

// ── Route Guards ──────────────────────────────────────────────────────────────

function GuestRoute({ children }) {
  const { isAuthenticated, isOperator, sessionHash, operatorHash } = useAuthStore()
  if (!isAuthenticated) return children
  if (isOperator)       return <Navigate to={`/sys/${operatorHash}`} replace />
  return <Navigate to={`/g/${sessionHash}/panel`} replace />
}

function HashGuard({ children }) {
  const { isAuthenticated, isOperator, sessionHash } = useAuthStore()
  const { hash } = useParams()
  if (!isAuthenticated)      return <Navigate to="/" replace />
  if (isOperator)            return <Navigate to="/" replace />
  if (hash !== sessionHash)  return <Navigate to="/" replace />
  return children
}

function OperatorHashGuard({ children }) {
  const { isAuthenticated, isOperator, operatorHash } = useAuthStore()
  const { hash } = useParams()
  if (!isAuthenticated)      return <Navigate to="/" replace />
  if (!isOperator)           return <Navigate to="/" replace />
  if (hash !== operatorHash) return <Navigate to="/" replace />
  return children
}

function OnboardingGate() {
  const { isAuthenticated, isOperator, user } = useAuthStore()
  if (!isAuthenticated || isOperator) return null
  if (user?.onboarding_completed === false) return <OnboardingWizard />
  return null
}

// ── Loader hook ───────────────────────────────────────────────────────────────
// Devuelve { visible, hiding } para el PageLoader.
// visible: si debe mostrarse. hiding: si está en fase de fade-out.
function usePageLoader() {
  const [visible, setVisible] = useState(true)   // arranca visible (splash)
  const [hiding,  setHiding]  = useState(false)

  const show = (delay = 2600) => {
    setVisible(true)
    setHiding(false)
    const t1 = setTimeout(() => setHiding(true),        delay)
    const t2 = setTimeout(() => setVisible(false), delay + 450)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }

  // Splash inicial — un ciclo de animación completo (2600ms) + fade
  useEffect(() => show(2600), [])

  return { visible, hiding, show }
}

// Detecta logout y login para mostrar el loader en esas transiciones
function AuthLoader({ show }) {
  const { isAuthenticated } = useAuthStore()
  const prev = useRef(isAuthenticated)

  useEffect(() => {
    const changed = prev.current !== isAuthenticated
    prev.current  = isAuthenticated
    if (changed) show(1800)   // ciclo más corto para transiciones de auth
  }, [isAuthenticated])

  return null
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const { visible, hiding, show } = usePageLoader()

  return (
    <>
      <BrowserRouter>
        <AuthLoader show={show} />

        <Routes>
          {/* Public */}
          <Route path="/"                element={<GuestRoute><Landing /></GuestRoute>} />
          <Route path="/register"        element={<GuestRoute><Landing /></GuestRoute>} />
          <Route path="/forgot-password" element={<GuestRoute><ForgotPassword /></GuestRoute>} />
          <Route path="/checkout/success" element={<CheckoutSuccess />} />
          <Route path="/support"         element={<Support />} />
          <Route path="/proyectos"       element={<Projects />} />
          <Route path="/terminos"        element={<Terminos />} />
          <Route path="/privacidad"      element={<Privacidad />} />

          <Route path="/console" element={<Navigate to="/" replace />} />

          {/* Operator console */}
          <Route path="/sys/:hash" element={<OperatorHashGuard><SuperAdmin /></OperatorHashGuard>} />

          {/* Private gym routes */}
          <Route path="/g/:hash" element={<HashGuard><Layout /></HashGuard>}>
            <Route path="panel"        element={<Dashboard />} />
            <Route path="socios"       element={<Members />} />
            <Route path="socio/:id"    element={<MemberDetail />} />
            <Route path="clases"       element={<Classes />} />
            <Route path="visitas"      element={<Visits />} />
            <Route path="membresias"   element={<Memberships />} />
            <Route path="productos"    element={<Products />} />
            <Route path="finanzas"     element={<Finances />} />
            <Route path="ajustes"      element={<Settings />} />
            <Route path="whatsapp"     element={<WhatsAppPage />} />
            <Route path="soporte"      element={<SupportPanel />} />
            <Route path="perfil"       element={<Profile />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

        <OnboardingGate />
      </BrowserRouter>

      {/* Overlay — siempre encima, nunca desmonta el Router */}
      {visible && <PageLoader hiding={hiding} />}
    </>
  )
}
