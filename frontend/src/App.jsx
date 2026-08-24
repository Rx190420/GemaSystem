import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom'
import { useEffect, useState, useRef, lazy, Suspense } from 'react'
import { Loader2 } from 'lucide-react'
import { useAuthStore } from './store/authStore'
import Layout from './components/layout/Layout'
import PageLoader from './components/PageLoader'
import { markPageLoaderDone } from './lib/pageLoaderSignal'
import OnboardingWizard from './components/OnboardingWizard'
import ErrorBoundary from './components/ErrorBoundary'
import NotFound from './pages/errors/NotFound'
import Forbidden from './pages/errors/Forbidden'
import Offline from './pages/errors/Offline'
import useOnlineStatus from './hooks/useOnlineStatus'

// ── Route-level code splitting ──────────────────────────────────────────────
// Previously every page (Landing's three.js/WebGL background, PDF/Excel
// export libs, recharts, jspdf, qrcode.react, all ~20 pages) was imported
// eagerly here, so Vite bundled the *entire app* into one ~3.8MB (~1MB
// gzipped) chunk — a landing-page visitor downloaded the whole authenticated
// dashboard before seeing a single word. lazy() + Suspense splits each page
// into its own chunk, fetched only when that route is actually visited.
const Landing         = lazy(() => import('./pages/Landing'))
const Dashboard       = lazy(() => import('./pages/Dashboard'))
const Members         = lazy(() => import('./pages/Members'))
const MemberDetail    = lazy(() => import('./pages/MemberDetail'))
const Classes         = lazy(() => import('./pages/Classes'))
const Visits          = lazy(() => import('./pages/Visits'))
const Memberships     = lazy(() => import('./pages/Memberships'))
const Products        = lazy(() => import('./pages/Products'))
const Finances        = lazy(() => import('./pages/Finances'))
const Settings        = lazy(() => import('./pages/Settings'))
const WhatsAppPage    = lazy(() => import('./pages/WhatsApp'))
const Support         = lazy(() => import('./pages/Support'))
const SupportPanel    = lazy(() => import('./pages/SupportPanel'))
const Projects        = lazy(() => import('./pages/Projects'))
const SuperAdmin      = lazy(() => import('./pages/SuperAdmin'))
const CheckoutSuccess = lazy(() => import('./pages/CheckoutSuccess'))
const ForgotPassword  = lazy(() => import('./pages/ForgotPassword'))
const Profile         = lazy(() => import('./pages/Profile'))
const Terminos        = lazy(() => import('./pages/Terminos'))
const Privacidad      = lazy(() => import('./pages/Privacidad'))

// Only shows up on slow connections navigating between already-mounted
// routes — the very first page load stays covered by <PageLoader>'s splash
// (2.6s, plenty of time for that first chunk to arrive).
function RouteFallback() {
  return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--color-primary-500, #6366F1)' }} />
    </div>
  )
}

// ── Route Guards ──────────────────────────────────────────────────────────────

function GuestRoute({ children }) {
  const { isAuthenticated, isOperator, sessionHash, operatorHash } = useAuthStore()
  if (!isAuthenticated) return children
  if (isOperator)       return <Navigate to={`/sys/${operatorHash}`} replace />
  return <Navigate to={`/g/${sessionHash}/panel`} replace />
}

// Unauthenticated visitors still bounce to "/" (that's a login prompt, not an
// error). An authenticated user hitting the wrong tenant/role, though, gets a
// real 403 instead of a silent redirect — they're logged in, just not
// allowed *here*.
function HashGuard({ children }) {
  const { isAuthenticated, isOperator, sessionHash } = useAuthStore()
  const { hash } = useParams()
  if (!isAuthenticated)      return <Navigate to="/" replace />
  if (isOperator)            return <Forbidden />
  if (hash !== sessionHash)  return <Forbidden />
  return children
}

// Blocks direct URL access to a plan-gated page — Sidebar already hides the
// nav link, but that alone doesn't stop someone from typing the URL by hand.
// `plan_features` comes from AuthController::userPayload() (Gym::featureMap());
// undefined (still loading, or a legacy/full gym with no map at all) fails
// open on purpose so a slow first load or a legacy gym never gets wrongly
// blocked — only an explicit `false` for this key denies access.
function FeatureGuard({ feature, children }) {
  const { user } = useAuthStore()
  if (user?.plan_features?.[feature] === false) return <Forbidden />
  return children
}

function OperatorHashGuard({ children }) {
  const { isAuthenticated, isOperator, operatorHash } = useAuthStore()
  const { hash } = useParams()
  if (!isAuthenticated)      return <Navigate to="/" replace />
  if (!isOperator)           return <Forbidden />
  if (hash !== operatorHash) return <Forbidden />
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
    const t2 = setTimeout(() => { setVisible(false); markPageLoaderDone() }, delay + 450)
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

// Full takeover the moment connectivity drops — takes priority over
// everything else (a crashed render, a stale route) since none of that
// matters if the device has no network path to reach the app at all.
// Resolves itself: useOnlineStatus() keeps probing in the background and
// this just re-renders the real app once it reports back online.
function OfflineGate({ children }) {
  const online = useOnlineStatus()
  if (!online) return <Offline />
  return children
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const { visible, hiding, show } = usePageLoader()

  return (
    <>
      <BrowserRouter>
        <AuthLoader show={show} />

        <OfflineGate>
        <ErrorBoundary>
          <Suspense fallback={<RouteFallback />}>
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
              <Route path="clases"       element={<FeatureGuard feature="classes"><Classes /></FeatureGuard>} />
              <Route path="visitas"      element={<Visits />} />
              <Route path="membresias"   element={<Memberships />} />
              <Route path="productos"    element={<FeatureGuard feature="products"><Products /></FeatureGuard>} />
              <Route path="finanzas"     element={<Finances />} />
              <Route path="ajustes"      element={<Settings />} />
              <Route path="whatsapp"     element={<FeatureGuard feature="whatsapp"><WhatsAppPage /></FeatureGuard>} />
              <Route path="soporte"      element={<SupportPanel />} />
              <Route path="perfil"       element={<Profile />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
        </ErrorBoundary>
        </OfflineGate>

        <OnboardingGate />
      </BrowserRouter>

      {/* Overlay — siempre encima, nunca desmonta el Router */}
      {visible && <PageLoader hiding={hiding} />}
    </>
  )
}
