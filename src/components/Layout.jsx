import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import { useAuth } from '../hooks/useAuth'
import { Bell } from 'lucide-react'

const PAGE_TITLES = {
  '/dashboard': 'Dashboard',
  '/casos': 'Expedientes',
  '/clientes': 'Clientes',
  '/tareas': 'Tareas Pendientes',
  '/horas': 'Horas Trabajadas',
  '/reportes': 'Reportes',
  '/usuarios': 'Gestión de Usuarios',
}

export default function Layout() {
  const location = useLocation()
  const { perfil } = useAuth()
  const title = Object.entries(PAGE_TITLES).find(([path]) => location.pathname.startsWith(path))?.[1] || ''

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <header className="topbar">
          <div>
            <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>{title}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              {new Date().toLocaleDateString('es-PE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="btn-icon"><Bell size={16} /></button>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{perfil?.nombre}</div>
          </div>
        </header>
        <main className="page-body">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
