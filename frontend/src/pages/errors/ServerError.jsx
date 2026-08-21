import ErrorPage, { ErrorAction } from './ErrorPage'

/**
 * Rendered by <ErrorBoundary> when a render-time crash is caught anywhere in
 * the tree — the SPA equivalent of a server 500, since there's no backend
 * response driving this one.
 */
export default function ServerError() {
  return (
    <ErrorPage
      code="500"
      title="Algo salió mal"
      message="Ocurrió un error inesperado. Intenta recargar la página; si el problema sigue, contáctanos por soporte."
      tone="danger"
      actions={
        <>
          <ErrorAction onClick={() => window.location.reload()} primary>Recargar página</ErrorAction>
          <ErrorAction onClick={() => { window.location.href = '/' }}>Volver al inicio</ErrorAction>
        </>
      }
    />
  )
}
