import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { ShieldCheck, Users, Check } from 'lucide-react'

const ROLES_LABELS = {
  socio_admin: 'Socio Administrador',
  abogado_senior: 'Abogado Senior',
  abogado: 'Abogado',
  asistente: 'Asistente'
}

const MODULOS = [
  { key: 'acceso_honorarios', label: 'Honorarios y Cobranzas', desc: 'Facturación, pagos y cuentas por cobrar' },
  { key: 'acceso_rrhh', label: 'RRHH', desc: 'Sueldos, bonos, permisos y vacaciones' },
  { key: 'acceso_crm', label: 'CRM', desc: 'Captación y seguimiento de prospectos' }
]

export default function Permisos() {
  const { perfil: perfilActual } = useAuth()
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [guardandoId, setGuardandoId] = useState(null)

  useEffect(() => { loadUsuarios() }, [])

  async function loadUsuarios() {
    const { data } = await supabase
      .from('perfiles')
      .select('id, nombre, rol, activo, acceso_honorarios, acceso_rrhh, acceso_crm')
      .eq('activo', true)
      .order('nombre')
    setUsuarios(data || [])
    setLoading(false)
  }

  async function togglePermiso(usuario, campo) {
    // Los socio_admin tienen acceso automático a todo, no se les cambia desde aquí
    if (usuario.rol === 'socio_admin') return

    const nuevoValor = !usuario[campo]
    setGuardandoId(usuario.id + campo)

    // Optimistic update
    setUsuarios(prev => prev.map(u => u.id === usuario.id ? { ...u, [campo]: nuevoValor } : u))

    const { error } = await supabase.from('perfiles').update({ [campo]: nuevoValor }).eq('id', usuario.id)

    if (error) {
      // Si falla, revertimos
      setUsuarios(prev => prev.map(u => u.id === usuario.id ? { ...u, [campo]: !nuevoValor } : u))
      alert('Error al actualizar el permiso: ' + error.message)
    }

    setGuardandoId(null)
  }

  if (loading) return <div className="loading-page"><div className="spinner"></div></div>

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title"><ShieldCheck size={22} style={{ display: 'inline', marginRight: 8, verticalAlign: 'middle' }} />Permisos Administrativos</div>
          <div className="page-subtitle">Define qué usuarios tienen acceso a los módulos administrativos</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16, background: 'var(--cream)', borderLeft: '4px solid var(--gold)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <ShieldCheck size={20} color="var(--gold)" style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            <strong style={{ color: 'var(--text-primary)' }}>Cómo funciona:</strong> los usuarios con la casilla marcada podrán ver y usar el módulo correspondiente. El resto del equipo no verá esos módulos en el menú lateral. Los <strong>Socios Administradores</strong> tienen acceso automático a todos los módulos.
          </div>
        </div>
      </div>

      <div className="card">
        {usuarios.length === 0 ? (
          <div className="empty-state"><Users size={36} /><p>No hay usuarios activos</p></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Rol</th>
                  {MODULOS.map(m => (
                    <th key={m.key} style={{ textAlign: 'center', minWidth: 120 }}>
                      <div>{m.label}</div>
                      <div style={{ fontSize: '0.68rem', fontWeight: 400, color: 'var(--text-muted)', marginTop: 2 }}>{m.desc}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {usuarios.map(u => {
                  const esSocioAdmin = u.rol === 'socio_admin'
                  return (
                    <tr key={u.id}>
                      <td style={{ fontWeight: 600 }}>
                        {u.nombre}
                        {u.id === perfilActual?.id && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: 6 }}>(tú)</span>}
                      </td>
                      <td>
                        <span style={{ fontSize: '0.75rem', background: esSocioAdmin ? 'var(--gold-light)' : 'var(--cream)', color: esSocioAdmin ? 'var(--navy)' : 'var(--text-secondary)', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>
                          {ROLES_LABELS[u.rol] || u.rol}
                        </span>
                      </td>
                      {MODULOS.map(m => {
                        const guardando = guardandoId === u.id + m.key
                        const tieneAcceso = esSocioAdmin || u[m.key]
                        return (
                          <td key={m.key} style={{ textAlign: 'center' }}>
                            {esSocioAdmin ? (
                              <div title="Los Socios Administradores tienen acceso automático a todos los módulos" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', color: 'var(--gold)', fontWeight: 600 }}>
                                <Check size={14} />
                                Acceso total
                              </div>
                            ) : (
                              <label style={{ display: 'inline-flex', alignItems: 'center', cursor: guardando ? 'wait' : 'pointer', padding: 4 }}>
                                <input
                                  type="checkbox"
                                  checked={!!u[m.key]}
                                  onChange={() => togglePermiso(u, m.key)}
                                  disabled={guardando}
                                  style={{ width: 18, height: 18, cursor: guardando ? 'wait' : 'pointer', accentColor: 'var(--navy)' }}
                                />
                              </label>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ marginTop: 16, fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center' }}>
        Los cambios se guardan automáticamente al marcar o desmarcar una casilla.
      </div>
    </div>
  )
}
