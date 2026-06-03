import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Plus, Edit2, UserCog } from 'lucide-react'

const ROLES = { socio_admin: 'Socio Administrador', abogado_senior: 'Abogado Senior', abogado: 'Abogado', asistente: 'Asistente' }
const ROL_COLORS = { socio_admin: 'var(--gold)', abogado_senior: 'var(--info)', abogado: 'var(--success)', asistente: 'var(--text-muted)' }

export default function Usuarios() {
  const { perfil: miPerfil } = useAuth()
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [showInvite, setShowInvite] = useState(false)
  const [form, setForm] = useState({ nombre: '', rol: 'abogado', costo_hora: '', activo: true })
  const [inviteForm, setInviteForm] = useState({ email: '', nombre: '', rol: 'abogado', costo_hora: '', password: '' })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => { loadUsuarios() }, [])

  async function loadUsuarios() {
    const { data } = await supabase.from('perfiles').select('*').order('nombre')
    setUsuarios(data || [])
    setLoading(false)
  }

  function openEdit(u) {
    setForm({ nombre: u.nombre, rol: u.rol, costo_hora: u.costo_hora || '', activo: u.activo })
    setEditando(u.id)
    setShowModal(true)
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    await supabase.from('perfiles').update({ nombre: form.nombre, rol: form.rol, costo_hora: parseFloat(form.costo_hora) || 0, activo: form.activo }).eq('id', editando)
    setShowModal(false)
    loadUsuarios()
    setSaving(false)
  }

  async function handleInvite(e) {
    e.preventDefault()
    setSaving(true)
    setMsg('')
    const { data, error } = await supabase.auth.admin ? 
      { data: null, error: { message: 'Usa el panel de Supabase para crear usuarios' } } :
      { data: null, error: null }
    
    // Create user via signUp (will send verification email)
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: inviteForm.email,
      password: inviteForm.password,
      options: { data: { nombre: inviteForm.nombre } }
    })

    if (authError) { setMsg('Error: ' + authError.message); setSaving(false); return }

    if (authData.user) {
      await supabase.from('perfiles').upsert({
        id: authData.user.id,
        nombre: inviteForm.nombre,
        email: inviteForm.email,
        rol: inviteForm.rol,
        costo_hora: parseFloat(inviteForm.costo_hora) || 0
      })
      setMsg('✅ Usuario creado. Se enviará un correo de verificación.')
      setInviteForm({ email: '', nombre: '', rol: 'abogado', costo_hora: '', password: '' })
      loadUsuarios()
    }
    setSaving(false)
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Usuarios del Sistema</div>
          <div className="page-subtitle">Gestiona los miembros del equipo y sus roles</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowInvite(true)}><Plus size={16} />Nuevo Usuario</button>
      </div>

      <div className="card">
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner" style={{ margin: '0 auto' }}></div></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Costo/Hora (S/)</th><th>Estado</th><th></th></tr></thead>
              <tbody>
                {usuarios.length === 0 ? (
                  <tr><td colSpan={6}><div className="empty-state"><UserCog size={36} /><p>No hay usuarios registrados</p></div></td></tr>
                ) : usuarios.map(u => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 600 }}>{u.nombre}{u.id === miPerfil?.id && <span style={{ marginLeft: 8, fontSize: '0.7rem', background: 'var(--gold-pale)', color: 'var(--gold)', padding: '1px 6px', borderRadius: 4 }}>Yo</span>}</td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{u.email}</td>
                    <td><span style={{ fontSize: '0.75rem', fontWeight: 600, color: ROL_COLORS[u.rol], background: 'var(--cream)', padding: '2px 8px', borderRadius: 4 }}>{ROLES[u.rol] || u.rol}</span></td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{u.costo_hora ? `S/ ${parseFloat(u.costo_hora).toFixed(2)}` : '—'}</td>
                    <td><span style={{ fontSize: '0.75rem', background: u.activo ? 'var(--success-bg)' : 'var(--danger-bg)', color: u.activo ? 'var(--success)' : 'var(--danger)', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>{u.activo ? 'Activo' : 'Inactivo'}</span></td>
                    <td><button className="btn-icon" onClick={() => openEdit(u)}><Edit2 size={14} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-title" style={{ marginBottom: 12 }}>Tarifas por Rol</div>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 12 }}>El costo por hora se usa para calcular el valor de los reportes de facturación.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {Object.entries(ROLES).map(([rol, label]) => {
            const uRol = usuarios.filter(u => u.rol === rol)
            const promedio = uRol.length ? uRol.reduce((s, u) => s + (u.costo_hora || 0), 0) / uRol.length : 0
            return (
              <div key={rol} style={{ background: 'var(--cream)', borderRadius: 8, padding: '14px 16px' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: 4 }}>S/ {promedio.toFixed(2)}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>promedio/hora · {uRol.length} persona{uRol.length !== 1 ? 's' : ''}</div>
              </div>
            )
          })}
        </div>
      </div>

      {showModal && editando && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-header"><div className="modal-title">Editar Usuario</div><button className="btn-icon" onClick={() => setShowModal(false)}>✕</button></div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div className="form-group"><label className="form-label">Nombre completo</label><input className="form-input" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} required /></div>
                <div className="form-grid">
                  <div className="form-group"><label className="form-label">Rol</label><select className="form-select" value={form.rol} onChange={e => setForm({ ...form, rol: e.target.value })}>{Object.entries(ROLES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
                  <div className="form-group"><label className="form-label">Costo por Hora (S/)</label><input className="form-input" type="number" step="0.01" min="0" value={form.costo_hora} onChange={e => setForm({ ...form, costo_hora: e.target.value })} placeholder="150.00" /></div>
                </div>
                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.85rem' }}>
                    <input type="checkbox" checked={form.activo} onChange={e => setForm({ ...form, activo: e.target.checked })} style={{ accentColor: 'var(--navy)' }} />
                    Usuario activo
                  </label>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardando...' : 'Guardar Cambios'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showInvite && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowInvite(false)}>
          <div className="modal">
            <div className="modal-header"><div className="modal-title">Crear Nuevo Usuario</div><button className="btn-icon" onClick={() => setShowInvite(false)}>✕</button></div>
            <form onSubmit={handleInvite}>
              <div className="modal-body">
                {msg && <div className={`alert ${msg.includes('✅') ? 'alert-success' : 'alert-error'}`}>{msg}</div>}
                <div className="form-group"><label className="form-label">Nombre completo *</label><input className="form-input" value={inviteForm.nombre} onChange={e => setInviteForm({ ...inviteForm, nombre: e.target.value })} required /></div>
                <div className="form-group"><label className="form-label">Email *</label><input className="form-input" type="email" value={inviteForm.email} onChange={e => setInviteForm({ ...inviteForm, email: e.target.value })} required /></div>
                <div className="form-group"><label className="form-label">Contraseña temporal *</label><input className="form-input" type="password" value={inviteForm.password} onChange={e => setInviteForm({ ...inviteForm, password: e.target.value })} placeholder="Mínimo 6 caracteres" minLength={6} required /></div>
                <div className="form-grid">
                  <div className="form-group"><label className="form-label">Rol</label><select className="form-select" value={inviteForm.rol} onChange={e => setInviteForm({ ...inviteForm, rol: e.target.value })}>{Object.entries(ROLES).map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></div>
                  <div className="form-group"><label className="form-label">Costo por Hora (S/)</label><input className="form-input" type="number" step="0.01" min="0" value={inviteForm.costo_hora} onChange={e => setInviteForm({ ...inviteForm, costo_hora: e.target.value })} placeholder="150.00" /></div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowInvite(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Creando...' : 'Crear Usuario'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
