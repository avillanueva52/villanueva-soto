import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { hoyEnLima, formatearFecha } from '../lib/dateUtils'
import { useAuth } from '../hooks/useAuth'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, FolderOpen } from 'lucide-react'

const TIPOS = ['civil', 'penal', 'constitucional', 'laboral', 'administrativo', 'consulta']
const ESTADOS = ['activo', 'archivado', 'cerrado', 'suspendido']

export default function Casos() {
  const { perfil } = useAuth()
  const navigate = useNavigate()
  const [casos, setCasos] = useState([])
  const [clientes, setClientes] = useState([])
  const [abogados, setAbogados] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [search, setSearch] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('activo')
  const [filtroAbogado, setFiltroAbogado] = useState('')
  const [form, setForm] = useState({ numero_expediente: '', titulo: '', tipo: 'civil', estado: 'activo', cliente_id: '', abogado_responsable_id: '', juzgado: '', numero_judicial: '', descripcion: '', fecha_inicio: hoyEnLima() })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const [casosRes, clientesRes, abogadosRes] = await Promise.all([
      supabase.from('casos').select('*, clientes(nombre), perfiles(nombre)').order('creado_en', { ascending: false }),
      supabase.from('clientes').select('id, nombre').order('nombre'),
      supabase.from('perfiles').select('id, nombre, rol').eq('activo', true).order('nombre')
    ])
    setCasos(casosRes.data || [])
    setClientes(clientesRes.data || [])
    setAbogados(abogadosRes.data || [])
    setLoading(false)
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const payload = { ...form, cliente_id: form.cliente_id || null, abogado_responsable_id: form.abogado_responsable_id || null }
    const { error } = await supabase.from('casos').insert(payload)
    if (error) { setError(error.message); setSaving(false); return }
    setShowModal(false)
    setForm({ numero_expediente: '', titulo: '', tipo: 'civil', estado: 'activo', cliente_id: '', abogado_responsable_id: '', juzgado: '', numero_judicial: '', descripcion: '', fecha_inicio: hoyEnLima() })
    loadData()
    setSaving(false)
  }

  const filtered = casos.filter(c => {
    const matchSearch = !search || c.titulo.toLowerCase().includes(search.toLowerCase()) || c.numero_expediente.toLowerCase().includes(search.toLowerCase()) || c.clientes?.nombre?.toLowerCase().includes(search.toLowerCase())
    const matchTipo = !filtroTipo || c.tipo === filtroTipo
    const matchEstado = !filtroEstado || c.estado === filtroEstado
    const matchAbogado = !filtroAbogado || c.abogado_responsable_id === filtroAbogado
    return matchSearch && matchTipo && matchEstado && matchAbogado
  })

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Expedientes</div>
          <div className="page-subtitle">{filtered.length} expediente{filtered.length !== 1 ? 's' : ''} encontrado{filtered.length !== 1 ? 's' : ''}</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={16} />Nuevo Expediente</button>
      </div>

      <div className="filter-bar">
        <div className="search-bar" style={{ flex: 1, maxWidth: 360 }}>
          <Search size={15} color="var(--text-muted)" />
          <input placeholder="Buscar por título, expediente o cliente..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="form-select" style={{ width: 'auto' }} value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
          <option value="">Todos los tipos</option>
          {TIPOS.map(t => <option key={t} value={t} style={{ textTransform: 'capitalize' }}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
        </select>
        <select className="form-select" style={{ width: 'auto' }} value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          {ESTADOS.map(e => <option key={e} value={e} style={{ textTransform: 'capitalize' }}>{e.charAt(0).toUpperCase() + e.slice(1)}</option>)}
        </select>
        <select className="form-select" style={{ width: 'auto' }} value={filtroAbogado} onChange={e => setFiltroAbogado(e.target.value)}>
          <option value="">Todos los abogados</option>
          {abogados.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
        </select>
      </div>

      <div className="card">
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner" style={{ margin: '0 auto' }}></div></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>N° Expediente</th>
                  <th>Título</th>
                  <th>Cliente</th>
                  <th>Abogado Responsable</th>
                  <th>Tipo</th>
                  <th>Estado</th>
                  <th>Inicio</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={7}>
                    <div className="empty-state"><FolderOpen size={36} /><p>No se encontraron expedientes</p></div>
                  </td></tr>
                ) : filtered.map(c => (
                  <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/casos/${c.id}`)}>
                    <td style={{ fontWeight: 600, fontFamily: 'monospace', fontSize: '0.82rem', color: 'var(--navy)' }}>{c.numero_expediente}</td>
                    <td style={{ fontWeight: 500, maxWidth: 280 }}><div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.titulo}</div></td>
                    <td style={{ color: 'var(--text-secondary)' }}>{c.clientes?.nombre || <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{c.perfiles?.nombre || <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                    <td><span className={`badge badge-${c.tipo}`} style={{ textTransform: 'capitalize' }}>{c.tipo}</span></td>
                    <td><span className={`badge badge-${c.estado}`} style={{ textTransform: 'capitalize' }}>{c.estado}</span></td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{formatearFecha(c.fecha_inicio)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal modal-lg">
            <div className="modal-header">
              <div className="modal-title">Nuevo Expediente</div>
              <button className="btn-icon" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                {error && <div className="alert alert-error">{error}</div>}
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">N° Expediente *</label>
                    <input className="form-input" value={form.numero_expediente} onChange={e => setForm({ ...form, numero_expediente: e.target.value })} placeholder="Ej: EXP-2024-001" required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Tipo *</label>
                    <select className="form-select" value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}>
                      {TIPOS.map(t => <option key={t} value={t} style={{ textTransform: 'capitalize' }}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Título del caso *</label>
                  <input className="form-input" value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} placeholder="Descripción breve del caso" required />
                </div>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Cliente</label>
                    <select className="form-select" value={form.cliente_id} onChange={e => setForm({ ...form, cliente_id: e.target.value })}>
                      <option value="">Seleccionar cliente...</option>
                      {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Abogado Responsable</label>
                    <select className="form-select" value={form.abogado_responsable_id} onChange={e => setForm({ ...form, abogado_responsable_id: e.target.value })}>
                      <option value="">Seleccionar abogado...</option>
                      {abogados.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Juzgado / Instancia</label>
                    <input className="form-input" value={form.juzgado} onChange={e => setForm({ ...form, juzgado: e.target.value })} placeholder="Ej: 3er Juzgado Civil de Lima" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">N° Judicial</label>
                    <input className="form-input" value={form.numero_judicial} onChange={e => setForm({ ...form, numero_judicial: e.target.value })} placeholder="Número del proceso judicial" />
                  </div>
                </div>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Fecha de Inicio</label>
                    <input className="form-input" type="date" value={form.fecha_inicio} onChange={e => setForm({ ...form, fecha_inicio: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Estado</label>
                    <select className="form-select" value={form.estado} onChange={e => setForm({ ...form, estado: e.target.value })}>
                      {ESTADOS.map(e => <option key={e} value={e} style={{ textTransform: 'capitalize' }}>{e.charAt(0).toUpperCase() + e.slice(1)}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Descripción / Notas</label>
                  <textarea className="form-textarea" value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} placeholder="Detalles adicionales del caso..." />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardando...' : 'Crear Expediente'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
