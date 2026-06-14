import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

// Componente que protege una ruta validando un permiso específico del perfil.
// Los socio_admin tienen acceso automático a todo.
// Si el usuario no tiene el permiso, lo redirige al Dashboard.
export default function PermisoRoute({ children, permiso }) {
  const { user, perfil, loading } = useAuth()

  if (loading) return <div className="loading-page"><div className="spinner"></div></div>
  if (!user) return <Navigate to="/login" replace />

  const tienePermiso = perfil?.rol === 'socio_admin' || perfil?.[permiso] === true
  if (!tienePermiso) return <Navigate to="/dashboard" replace />

  return children
}
