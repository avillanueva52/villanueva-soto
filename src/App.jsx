import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import Layout from './components/Layout'
import PermisoRoute from './components/PermisoRoute'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Casos from './pages/Casos'
import CasoDetalle from './pages/CasoDetalle'
import Clientes from './pages/Clientes'
import ClienteDetalle from './pages/ClienteDetalle'
import Calendario from './pages/Calendario'
import Tareas from './pages/Tareas'
import Horas from './pages/Horas'
import Reportes from './pages/Reportes'
import Usuarios from './pages/Usuarios'
import Permisos from './pages/Permisos'
import Archivados from './pages/Archivados'
import CRM from './pages/CRM'
import ProspectoDetalle from './pages/ProspectoDetalle'
import RRHH from './pages/RRHH'

function ProtectedRoute({ children, adminOnly = false }) {
  const { user, perfil, loading } = useAuth()
  if (loading) return <div className="loading-page"><div className="spinner"></div></div>
  if (!user) return <Navigate to="/login" replace />
  if (adminOnly && perfil?.rol !== 'socio_admin') return <Navigate to="/dashboard" replace />
  return children
}

function AppRoutes() {
  const { user, loading } = useAuth()
  if (loading) return <div className="loading-page"><div className="spinner"></div></div>
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/casos" element={<Casos />} />
        <Route path="/casos/:id" element={<CasoDetalle />} />
        <Route path="/clientes" element={<Clientes />} />
        <Route path="/clientes/:id" element={<ClienteDetalle />} />
        <Route path="/calendario" element={<Calendario />} />
        <Route path="/tareas" element={<Tareas />} />
        <Route path="/horas" element={<Horas />} />
        <Route path="/reportes" element={<Reportes />} />
        <Route path="/archivados" element={<Archivados />} />
        <Route path="/crm" element={<PermisoRoute permiso="acceso_crm"><CRM /></PermisoRoute>} />
        <Route path="/crm/:id" element={<PermisoRoute permiso="acceso_crm"><ProspectoDetalle /></PermisoRoute>} />
        <Route path="/rrhh" element={<PermisoRoute permiso="acceso_rrhh"><RRHH /></PermisoRoute>} />
        <Route path="/usuarios" element={<ProtectedRoute adminOnly><Usuarios /></ProtectedRoute>} />
        <Route path="/permisos" element={<ProtectedRoute adminOnly><Permisos /></ProtectedRoute>} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
