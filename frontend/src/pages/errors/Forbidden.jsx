import { useAuthStore } from '../../store/authStore'
import ErrorPage, { ErrorAction } from './ErrorPage'

/**
 * Shown in place of the previous silent redirect-home whenever a HashGuard /
 * OperatorHashGuard rejects a route for an already-authenticated user (wrong
 * tenant hash, wrong role) — someone genuinely logged in, just not allowed
 * *here*. An unauthenticated visitor still gets redirected to "/" instead of
 * this, since for them it's a login prompt, not an access-denied moment.
 */
export default function Forbidden() {
  const { isOperator, sessionHash, operatorHash, logout } = useAuthStore()

  const homeTo = isOperator ? `/sys/${operatorHash}` : `/g/${sessionHash}/panel`

  return (
    <ErrorPage
      code="403"
      title="Acceso denegado"
      message="No tienes permiso para ver esta página, o el enlace pertenece a otra cuenta."
      tone="danger"
      actions={
        <>
          <ErrorAction to={homeTo} primary>Ir a mi panel</ErrorAction>
          <ErrorAction onClick={() => logout()}>Cerrar sesión</ErrorAction>
        </>
      }
    />
  )
}
