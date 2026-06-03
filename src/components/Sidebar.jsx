import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { LayoutDashboard, FolderOpen, Users, Clock, BarChart2, CheckSquare, UserCog, LogOut, Scale, Archive } from 'lucide-react'

const ROLES = { socio_admin: 'Socio Administrador', abogado_senior: 'Abogado Senior', abogado: 'Abogado', asistente: 'Asistente' }

export default function Sidebar() {
  const { perfil, signOut } = useAuth()
  const location = useLocation()
  const isActive = (path) => location.pathname.startsWith(path)

  const initials = perfil?.nombre?.split(' ').map(n => n[0]).slice(0, 2).join('') || 'US'

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <Scale size={18} color="var(--gold)" />
          <div>
            <div className="firm-name">Villanueva & Soto</div>
            <div className="firm-sub">Sistema de Gestión Legal</div>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section-title">Principal</div>
        <Link to="/dashboard" className={`nav-item ${isActive('/dashboard') ? 'active' : ''}`}>
          <LayoutDashboard size={16} /> Dashboard
        </Link>
        <Link to="/casos" className={`nav-item ${isActive('/casos') ? 'active' : ''}`}>
          <FolderOpen size={16} /> Expedientes
        </Link>
        <Link to="/clientes" className={`nav-item ${isActive('/clientes') ? 'active' : ''}`}>
          <Users size={16} /> Clientes
        </Link>
        <Link to="/tareas" className={`nav-item ${isActive('/tareas') ? 'active' : ''}`}>
          <CheckSquare size={16} /> Tareas
        </Link>
        <Link to="/horas" className={`nav-item ${isActive('/horas') ? 'active' : ''}`}>
          <Clock size={16} /> Horas Trabajadas
        </Link>
        <Link to="/archivados" className={`nav-item ${isActive('/archivados') ? 'active' : ''}`}>
          <Archive size={16} /> Archivados
        </Link>

        <div className="nav-section-title">Reportes</div>
        <Link to="/reportes" className={`nav-item ${isActive('/reportes') ? 'active' : ''}`}>
          <BarChart2 size={16} /> Reportes
        </Link>

        {perfil?.rol === 'socio_admin' && (
          <>
            <div className="nav-section-title">Administración</div>
            <Link to="/usuarios" className={`nav-item ${isActive('/usuarios') ? 'active' : ''}`}>
              <UserCog size={16} /> Usuarios
            </Link>
          </>
        )}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="user-avatar">{initials}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="user-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{perfil?.nombre || 'Usuario'}</div>
            <div className="user-role">{ROLES[perfil?.rol] || perfil?.rol}</div>
          </div>
          <button onClick={signOut} className="btn-icon" style={{ border: 'none', color: 'rgba(255,255,255,0.5)' }} title="Cerrar sesión">
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  )
}
