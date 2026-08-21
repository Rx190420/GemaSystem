import { useAuthStore } from '../../store/authStore'
import ErrorPage, { ErrorAction } from './ErrorPage'

export default function NotFound() {
  const { isAuthenticated, isOperator, sessionHash, operatorHash } = useAuthStore()

  const homeTo = !isAuthenticated
    ? '/'
    : isOperator
      ? `/sys/${operatorHash}`
      : `/g/${sessionHash}/panel`

  return (
    <ErrorPage
      code="404"
      title="Página no encontrada"
      message="La página que buscas no existe, se movió o la dirección tiene un error."
      actions={
        <>
          <ErrorAction to={homeTo} primary>
            {isAuthenticated ? 'Ir a mi panel' : 'Volver al inicio'}
          </ErrorAction>
          <ErrorAction onClick={() => window.history.back()}>Volver atrás</ErrorAction>
        </>
      }
    />
  )
}
