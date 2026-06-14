import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { formatearFecha, hoyEnLima } from '../lib/dateUtils'
import { Plus, Search, Users, LayoutGrid, List, Phone, Mail, AlertCircle } from 'lucide-react'

const ESTADOS = [
  { key: 'nuevo', label: 'Nuevo', color: '#6b7280' },
  { key: 'contactado', label: 'Contactado', color: '#1a56db' },
  { key: 'reunion_agendada', label: 'Reunión Agendada', color: '#d97706' },
  { key: 'propuesta_enviada', label: 'Propuesta Enviada', color: '#7e3af2' },
  { key: 'ganado', label: 'Ganado', color: '#057a55' },
  { key: 'perdido', label: 'Perdido', color: '#c81e1e' }
]

const TIPOS_ASUNTO = ['civil', 'penal', 'laboral', 'constitucional', 'administrativo', 'consulta', 'otro']
const COMO_CONTACTO_LABELS = { referido: 'Referido', web: 'Web', llamada: 'Llamada', presencial: 'Presencial', redes_sociales: 'Redes Sociales', otro: 'Otro' }

function formInicial() {
  return {
    nombre: '',
    telefono: '',
    email: '',
    como_contacto: '',
    tipo_asunto: '',
    descripcion: '',
    abogado_responsable_id: '',
    notas: ''
  }
}

export default function CRM() {
  const { perfil } = useAuth()
  const navigate = useNavigate()
  const [prospectos, setProspectos] = useState([])
  const [abogados, setAbogados] = useState([])
  const [recordatoriosVencidos, setRecordatoriosVencidos] = useState({})
  const [loading, setLoading] = useState(true)
  const [vista, setVista] = useState('kanban') // kanban | lista
  const [search, setSearch] = useState('')
  const [filtroResponsable, setFiltroResponsable] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(formInicial())
  const [saving, setSaving] = useState(false)
  const [draggedId, setDraggedId] = useState(null)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const hoy = hoyEnLima()
    const [prospectosRes, abogadosRes, recordatoriosRes] = await Promise.all([
      supabase.from('prospectos').select('*, perfiles(id, nombre)').order('creado_en', { ascending: false }),
      supabase.from('perfiles').select('id, nombre').eq('activo', true).order('nombre'),
      supabase.from('prospecto_recordatorios').select('prospecto_id, fecha').eq('completado', false).lte('fecha', hoy)
    ])

    // Mapeamos los recordatorios vencidos por prospecto para mostrar el indicador en las tarjetas
    const recordsMap = {}
    ;(recordatoriosRes.data || []).forEach(r => {
      recordsMap[r.prospecto_id] = (recordsMap[r.prospecto_id] || 0) + 1
    })

    setProspectos(prospectosRes.data || [])
    setAbogados(abogadosRes.data || [])
    setRecordatoriosVencidos(recordsMap)
    setLoading(false)
  }

  const filtrados = prospectos.filter(p => {
    if (search) {
      const s = search.toLowerCase()
      const matchSearch = p.nombre?.toLowerCase().includes(s) || p.email?.toLowerCase().includes(s) || p.telefono?.includes(search) || p.descripcion?.toLowerCase().includes(s)
      if (!matchSearch) return false
    }
    if (filtroResponsable && p.abogado_responsable_id !== filtroResponsable) return false
    if (filtroTipo && p.tipo_asunto !== filtroTipo) return false
    return true
  })

  async function handleSave(e) {
    e.preventDefault()
    if (!form.nombre.trim()) return
    setSaving(true)
    const { error } = await supabase.from('prospectos').insert({
      nombre: form.nombre.trim(),
      telefono: form.telefono || null,
      email: form.email || null,
      como_contacto: form.como_contacto || null,
      tipo_asunto: form.tipo_asunto || null,
      descripcion: form.descripcion || null,
      abogado_responsable_id: form.abogado_responsable_id || null,
      notas: form.notas || null,
      creado_por: perfil.id,
      estado: 'nuevo'
    })
    if (error) {
      alert('Error al crear prospecto: ' + error.message)
      setSaving(false)
      return
    }
    setShowModal(false)
    setForm(formInicial())
    loadAll()
    setSaving(false)
  }

  // DRAG & DROP nativo HTML5
  function onDragStart(e, prospectoId) {
    setDraggedId(prospectoId)
    e.dataTransfer.effectAllowed = 'move'
  }

  function onDragOver(e) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  async function onDrop(e, nuevoEstado) {
    e.preventDefault()
    if (!draggedId) return
    const prospecto = prospectos.find(p => p.id === draggedId)
    if (!prospecto || prospecto.estado === nuevoEstado) {
      setDraggedId(null)
      return
    }

    // Optimistic update
    setProspectos(prev => prev.map(p => p.id === draggedId ? { ...p, estado: nuevoEstado } : p))
    setDraggedId(null)

    const { error } = await supabase.from('prospectos').update({
      estado: nuevoEstado,
      actualizado_en: new Date().toISOString()
    }).eq('id', draggedId)

    if (error) {
      alert('Error al actualizar estado: ' + error.message)
      loadAll() // recarga para revertir
    }
  }

  function TarjetaProspecto({ p, modoLista = false }) {
    const tieneVencidos = recordatoriosVencidos[p.id] > 0
    if (modoLista) {
      return (
        <tr style={{ cursor: 'pointer' }} onClick={() => navigate(`/crm/${p.id}`)}>
          <td style={{ fontWeight: 600 }}>
            {p.nombre}
            {tieneVencidos && <AlertCircle size={13} style={{ color: 'var(--danger)', marginLeft: 6, verticalAlign: 'middle' }} />}
          </td>
          <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{p.email || p.telefono || '—'}</td>
          <td>{p.tipo_asunto && <span className={`badge badge-${p.tipo_asunto}`} style={{ textTransform: 'capitalize' }}>{p.tipo_asunto}</span>}</td>
          <td>
            <span style={{ fontSize: '0.72rem', background: ESTADOS.find(e => e.key === p.estado)?.color || '#666', color: 'white', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>
              {ESTADOS.find(e => e.key === p.estado)?.label || p.estado}
            </span>
          </td>
          <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{p.perfiles?.nombre || '—'}</td>
          <td style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{formatearFecha(p.creado_en?.split('T')[0])}</td>
        </tr>
      )
    }

    return (
      <div
        draggable
        onDragStart={(e) => onDragStart(e, p.id)}
        onClick={() => navigate(`/crm/${p.id}`)}
        style={{
          background: 'white',
          border: '1px solid var(--border)',
          borderLeft: `3px solid ${ESTADOS.find(e => e.key === p.estado)?.color}`,
          borderRadius: 6,
          padding: 10,
          marginBottom: 8,
          cursor: 'grab',
          fontSize: '0.85rem',
          transition: 'box-shadow 0.15s',
          opacity: draggedId === p.id ? 0.5 : 1
        }}
        onMouseEnter={e => e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.08)'}
        onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4, gap: 6 }}>
          <div style={{ fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nombre}</div>
          {tieneVencidos && <AlertCircle size={13} style={{ color: 'var(--danger)', flexShrink: 0 }} title={`${recordatoriosVencidos[p.id]} recordatorio(s) pendiente(s)`} />}
        </div>
        {p.tipo_asunto && (
          <div style={{ marginBottom: 4 }}>
            <span className={`badge badge-${p.tipo_asunto}`} style={{ fontSize: '0.65rem', textTransform: 'capitalize' }}>{p.tipo_asunto}</span>
          </div>
        )}
        {(p.telefono || p.email) && (
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {p.telefono && <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Phone size={10} />{p.telefono}</div>}
            {p.email && <div style={{ display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><Mail size={10} />{p.email}</div>}
          </div>
        )}
        {p.perfiles?.nombre && (
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4 }}>→ {p.perfiles.nombre}</div>
        )}
      </div>
    )
  }

  if (loading) return <div className="loading-page"><div className="spinner"></div></div>

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">CRM — Captación de Clientes</div>
          <div className="page-subtitle">{filtrados.length} prospecto{filtrados.length !== 1 ? 's' : ''}</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={16} />Nuevo Prospecto</button>
      </div>

      <div className="filter-bar">
        <div className="search-bar" style={{ flex: 1, maxWidth: 360 }}>
          <Search size={15} color="var(--text-muted)" />
          <input placeholder="Buscar por nombre, email, teléfono..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="form-select" style={{ width: 'auto' }} value={filtroResponsable} onChange={e => setFiltroResponsable(e.target.value)}>
          <option value="">Todos los abogados</option>
          {abogados.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
        </select>
        <select className="form-select" style={{ width: 'auto' }} value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
          <option value="">Todos los tipos</option>
          {TIPOS_ASUNTO.map(t => <option key={t} value={t} style={{ textTransform: 'capitalize' }}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
        </select>
        <div style={{ flex: 1 }}></div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button className={`btn btn-sm ${vista === 'kanban' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setVista('kanban')} title="Vista Kanban">
            <LayoutGrid size={14} />Kanban
          </button>
          <button className={`btn btn-sm ${vista === 'lista' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setVista('lista')} title="Vista Lista">
            <List size={14} />Lista
          </button>
        </div>
      </div>

      {vista === 'kanban' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10, overflowX: 'auto', minHeight: 400 }}>
          {ESTADOS.map(est => {
            const items = filtrados.filter(p => p.estado === est.key)
            return (
              <div
                key={est.key}
                onDragOver={onDragOver}
                onDrop={(e) => onDrop(e, est.key)}
                style={{ background: 'var(--cream)', borderRadius: 8, padding: 10, minWidth: 180 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, paddingBottom: 6, borderBottom: `2px solid ${est.color}` }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: est.color, textTransform: 'uppercase', letterSpacing: '0.3px' }}>{est.label}</div>
                  <span style={{ background: est.color, color: 'white', borderRadius: 10, padding: '1px 8px', fontSize: '0.72rem', fontWeight: 700 }}>{items.length}</span>
                </div>
                {items.length === 0 ? (
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>Sin prospectos</div>
                ) : (
                  items.map(p => <TarjetaProspecto key={p.id} p={p} />)
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="card">
          {filtrados.length === 0 ? (
            <div className="empty-state"><Users size={36} /><p>No hay prospectos que coincidan con los filtros</p></div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Contacto</th>
                    <th>Tipo</th>
                    <th>Estado</th>
                    <th>Responsable</th>
                    <th>Registrado</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map(p => <TarjetaProspecto key={p.id} p={p} modoLista />)}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal modal-lg">
            <div className="modal-header">
              <div className="modal-title">Nuevo Prospecto</div>
              <button className="btn-icon" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Nombre completo *</label>
                  <input className="form-input" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Nombre del prospecto" required />
                </div>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Teléfono</label>
                    <input className="form-input" value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} placeholder="+51 999 999 999" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input className="form-input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="correo@ejemplo.com" />
                  </div>
                </div>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">¿Cómo nos contactó?</label>
                    <select className="form-select" value={form.como_contacto} onChange={e => setForm({ ...form, como_contacto: e.target.value })}>
                      <option value="">Sin especificar</option>
                      {Object.entries(COMO_CONTACTO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Tipo de asunto</label>
                    <select className="form-select" value={form.tipo_asunto} onChange={e => setForm({ ...form, tipo_asunto: e.target.value })}>
                      <option value="">Sin especificar</option>
                      {TIPOS_ASUNTO.map(t => <option key={t} value={t} style={{ textTransform: 'capitalize' }}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Abogado responsable</label>
                  <select className="form-select" value={form.abogado_responsable_id} onChange={e => setForm({ ...form, abogado_responsable_id: e.target.value })}>
                    <option value="">Sin asignar</option>
                    {abogados.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Descripción breve del asunto</label>
                  <textarea className="form-textarea" value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} placeholder="¿En qué consiste el caso?" style={{ minHeight: 60 }} />
                </div>
                <div className="form-group">
                  <label className="form-label">Notas internas</label>
                  <textarea className="form-textarea" value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })} placeholder="Notas adicionales..." style={{ minHeight: 50 }} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardando...' : 'Crear Prospecto'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
