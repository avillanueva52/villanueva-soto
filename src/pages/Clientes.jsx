import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Plus, Search, Users, Edit2 } from 'lucide-react'

export default function Clientes() {
  const navigate = useNavigate()
  const [clientes, setClientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({ nombre: '', tipo: 'persona_natural', documento_identidad: '', email: '', telefono: '', direccion: '', notas: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadClientes() }, [])

  async function loadClientes() {
    const { data } = await supabase.from('clientes').select('*, casos(id)').order('nombre')
    setClientes(data || [])
    setLoading(false)
  }

  function openNew() { setForm({ nombre: '', tipo: 'persona_natural', documento_identidad: '', email: '', telefono: '', direccion: '', notas: '' }); setEditando(null); setShowModal(true) }
  function openEdit(e, c) {
    e.stopPropagation()
    setForm({ nombre: c.nombre, tipo: c.tipo, documento_identidad: c.documento_identidad || '', email: c.email || '', telefono: c.telefono || '', direccion: c.direccion || '', notas: c.notas || '' })
    setEditando(c.id)
    setShowModal(true)
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    if (editando) await supabase.from('clientes').update(form).eq('id', editando)
    else await supabase.from('clientes').insert(form)
    setShowModal(false)
    loadClientes()
    setSaving(false)
  }

  const filtered = clientes.filter(c => !search || c.nombre.toLowerCase().includes(search.toLowerCase()) || c.email?.toLowerCase().includes(search.toLowerCase()) || c.documento_identidad?.includes(search))

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Clientes</div>
          <div className="page-subtitle">{filtered.length} cliente{filtered.length !== 1 ? 's' : ''} registrado{filtered.length !== 1 ? 's' : ''}</div>
        </div>
        <button className="btn btn-primary" onClick={openNew}><Plus size={16} />Nuevo Cliente</button>
      </div>

      <div className="filter-bar">
        <div className="search-bar" style={{ flex: 1, maxWidth: 360 }}>
          <Search size={15} color="var(--text-muted)" />
          <input placeholder="Buscar por nombre, email o documento..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner" style={{ margin: '0 auto' }}></div></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Nombre</th><th>Tipo</th><th>Documento</th><th>Email</th><th>Teléfono</th><th>Casos</th><th></th></tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={7}><div className="empty-state"><Users size={36} /><p>No se encontraron clientes</p></div></td></tr>
                ) : filtered.map(c => (
                  <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/clientes/${c.id}`)}>
                    <td style={{ fontWeight: 600, color: 'var(--navy)' }}>{c.nombre}</td>
                    <td><span style={{ fontSize: '0.75rem', background: c.tipo === 'empresa' ? 'var(--info-bg)' : 'var(--cream)', color: c.tipo === 'empresa' ? 'var(--info)' : 'var(--text-secondary)', padding: '2px 8px', borderRadius: 4, fontWeight: 500 }}>{c.tipo === 'empresa' ? 'Empresa' : 'Persona Natural'}</span></td>
                    <td style={{ color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: '0.82rem' }}>{c.documento_identidad || '—'}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{c.email || '—'}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{c.telefono || '—'}</td>
                    <td><span style={{ background: 'var(--navy)', color: 'white', borderRadius: 20, padding: '2px 10px', fontSize: '0.75rem', fontWeight: 700 }}>{c.casos?.length || 0}</span></td>
                    <td><button className="btn-icon" onClick={(e) => openEdit(e, c)} title="Editar cliente"><Edit2 size={14} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">{editando ? 'Editar Cliente' : 'Nuevo Cliente'}</div>
              <button className="btn-icon" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div className="form-group"><label className="form-label">Nombre completo / Razón social *</label><input className="form-input" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Nombre del cliente" required /></div>
                <div className="form-grid">
                  <div className="form-group"><label className="form-label">Tipo</label><select className="form-select" value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}><option value="persona_natural">Persona Natural</option><option value="empresa">Empresa</option></select></div>
                  <div className="form-group"><label className="form-label">DNI / RUC</label><input className="form-input" value={form.documento_identidad} onChange={e => setForm({ ...form, documento_identidad: e.target.value })} placeholder="Número de documento" /></div>
                </div>
                <div className="form-grid">
                  <div className="form-group"><label className="form-label">Email</label><input className="form-input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="correo@ejemplo.com" /></div>
                  <div className="form-group"><label className="form-label">Teléfono</label><input className="form-input" value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} placeholder="+51 999 999 999" /></div>
                </div>
                <div className="form-group"><label className="form-label">Dirección</label><input className="form-input" value={form.direccion} onChange={e => setForm({ ...form, direccion: e.target.value })} placeholder="Dirección completa" /></div>
                <div className="form-group"><label className="form-label">Notas</label><textarea className="form-textarea" value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })} placeholder="Información adicional del cliente..." style={{ minHeight: 60 }} /></div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardando...' : editando ? 'Guardar Cambios' : 'Crear Cliente'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
