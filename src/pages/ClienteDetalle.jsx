import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { formatearFecha } from '../lib/dateUtils'
import { ArrowLeft, Edit2, Search, RotateCcw, FolderOpen, Activity, CheckSquare, Trash2 } from 'lucide-react'

const TIPOS = ['civil', 'penal', 'constitucional', 'laboral', 'administrativo', 'consulta']
const ESTADOS_CASO = ['activo', 'archivado', 'cerrado', 'suspendido']

export default function ClienteDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { perfil } = useAuth()
  const [cliente, setCliente] = useState(null)
  const [casos, setCasos] = useState([])
  const [estadosRecientes, setEstadosRecientes] = useState([])
  const [tareasRecientes, setTareasRecientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('info')
  const [showEditModal, setShowEditModal] = useState(false)
  const [editForm, setEditForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')

  const esSocioAdmin = perfil?.rol === 'socio_admin'

  useEffect(() => { loadAll() }, [id])

  async function loadAll() {
    setLoading(true)
    const { data: clienteData } = await supabase.from('clientes').select('*').eq('id', id).single()
    setCliente(clienteData)
    setEditForm(clienteData || {})

    const { data: casosData } = await supabase
      .from('casos')
      .select('*, perfiles(nombre), horas_trabajadas(horas, perfiles(costo_hora))')
      .eq('cliente_id', id)
      .order('creado_en', { ascending: false })
    setCasos(casosData || [])

    if (casosData && casosData.length > 0) {
      const casoIds = casosData.map(c => c.id)
      const [estadosRes, tareasRes] = await Promise.all([
        supabase.from('estados_procesales')
          .select('*, casos(id, titulo, numero_expediente), perfiles(nombre)')
          .in('caso_id', casoIds)
          .order('fecha', { ascending: false })
          .limit(8),
        supabase.from('tareas')
          .select('*, casos(id, titulo, numero_expediente), perfiles!tareas_asignado_a_fkey(nombre)')
          .in('caso_id', casoIds)
          .order('creado_en', { ascending: false })
          .limit(8)
      ])
      setEstadosRecientes(estadosRes.data || [])
      setTareasRecientes(tareasRes.data || [])
    } else {
      setEstadosRecientes([])
      setTareasRecientes([])
    }
    setLoading(false)
  }

  async function handleSaveEdit(e) {
    e.preventDefault()
    setSaving(true)
    await supabase.from('clientes').update({
      nombre: editForm.nombre,
      tipo: editForm.tipo,
      documento_identidad: editForm.documento_identidad,
      email: editForm.email,
      telefono: editForm.telefono,
      direccion: editForm.direccion,
      notas: editForm.notas
    }).eq('id', id)
    setShowEditModal(false)
    loadAll()
    setSaving(false)
  }

  async function handleReactivar() {
    if (!confirm('¿Reactivar este cliente?')) return
    await supabase.from('clientes').update({ activo: true }).eq('id', id)
    loadAll()
  }

  async function handleArchivar() {
    if (!confirm('¿Archivar este cliente? Sus casos seguirán visibles, pero el cliente pasará a Archivados.')) return
    await supabase.from('clientes').update({ activo: false }).eq('id', id)
    loadAll()
  }

  async function handleEliminarPermanentemente() {
    // Doble verificación: no permitir si tiene casos asociados
    if (casos.length > 0) {
      alert(
        `No se puede eliminar este cliente.\n\n` +
        `Tiene ${casos.length} caso${casos.length !== 1 ? 's' : ''} asociado${casos.length !== 1 ? 's' : ''}.\n\n` +
        `Para conservar el historial, usa "Archivar" en su lugar. ` +
        `Si realmente quieres eliminar el cliente, primero debes eliminar todos sus casos.`
      )
      return
    }

    // Doble confirmación porque es una acción destructiva irreversible
    const c1 = confirm(
      `⚠️ ELIMINAR PERMANENTEMENTE a "${cliente.nombre}"\n\n` +
      `Esta acción NO se puede deshacer. Todos los datos del cliente se borrarán definitivamente.\n\n` +
      `Si tienes dudas, mejor usa "Archivar" — el cliente se oculta pero se conserva.\n\n` +
      `¿Continuar con la eliminación?`
    )
    if (!c1) return

    const c2 = confirm(`Última confirmación: ¿borrar a "${cliente.nombre}" para siempre?`)
    if (!c2) return

    const { error } = await supabase.from('clientes').delete().eq('id', id)
    if (error) {
      alert('Error al eliminar: ' + error.message)
      return
    }

    navigate('/clientes')
  }

  const casosFiltrados = casos.filter(c => {
    const matchSearch = !search || c.titulo.toLowerCase().includes(search.toLowerCase()) || c.numero_expediente.toLowerCase().includes(search.toLowerCase())
    const matchTipo = !filtroTipo || c.tipo === filtroTipo
    const matchEstado = !filtroEstado || c.estado === filtroEstado
    return matchSearch && matchTipo && matchEstado
  })

  const casosActivos = casos.filter(c => c.estado === 'activo').length
  const casosCerrados = casos.filter(c => c.estado === 'cerrado' || c.estado === 'archivado').length
  const totalHoras = casos.reduce((sum, c) => sum + (c.horas_trabajadas || []).reduce((s, h) => s + (h.horas || 0), 0), 0)
  const valorEstimado = casos.reduce((sum, c) => sum + (c.horas_trabajadas || []).reduce((s, h) => s + ((h.horas || 0) * (h.perfiles?.costo_hora || 0)), 0), 0)
  const sePuedeEliminar = casos.length === 0

  if (loading) return <div className="loading-page"><div className="spinner"></div></div>
  if (!cliente) return <div style={{ padding: 40, textAlign: 'center' }}>Cliente no encontrado</div>

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn-icon" onClick={() => navigate('/clientes')}><ArrowLeft size={16} /></button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div className="page-title" style={{ fontSize: '1.2rem' }}>{cliente.nombre}</div>
              <span style={{ fontSize: '0.75rem', background: cliente.tipo === 'empresa' ? 'var(--info-bg)' : 'var(--cream)', color: cliente.tipo === 'empresa' ? 'var(--info)' : 'var(--text-secondary)', padding: '2px 8px', borderRadius: 4, fontWeight: 500 }}>
                {cliente.tipo === 'empresa' ? 'Empresa' : 'Persona Natural'}
              </span>
              {cliente.activo === false && <span style={{ fontSize: '0.75rem', background: 'var(--cream)', color: 'var(--text-muted)', padding: '2px 8px', borderRadius: 4, fontWeight: 500 }}>Inactivo</span>}
            </div>
            {cliente.documento_identidad && <div className="page-subtitle" style={{ fontFamily: 'monospace' }}>{cliente.documento_identidad}</div>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {esSocioAdmin && (
            <button
              className="btn btn-outline btn-sm"
              onClick={handleEliminarPermanentemente}
              style={{
                color: sePuedeEliminar ? 'var(--danger)' : 'var(--text-muted)',
                borderColor: sePuedeEliminar ? 'var(--danger)' : 'var(--border)'
              }}
              title={sePuedeEliminar ? 'Eliminar permanentemente este cliente' : `Tiene ${casos.length} caso(s) asociado(s). Solo se puede archivar.`}
            >
              <Trash2 size={14} />Eliminar
            </button>
          )}
          {cliente.activo === false ? (
            <button className="btn btn-outline btn-sm" onClick={handleReactivar}><RotateCcw size={14} />Reactivar</button>
          ) : (
            <button className="btn btn-outline btn-sm" onClick={handleArchivar}>Archivar</button>
          )}
          <button className="btn btn-primary btn-sm" onClick={() => setShowEditModal(true)}><Edit2 size={14} />Editar</button>
        </div>
      </div>

      <div className="tabs">
        {[
          ['info', 'Información'],
          ['expedientes', `Expedientes (${casos.length})`],
          ['actividad', 'Actividad Reciente']
        ].map(([key, label]) => (
          <div key={key} className={`tab ${tab === key ? 'active' : ''}`} onClick={() => setTab(key)}>{label}</div>
        ))}
      </div>

      {tab === 'info' && (
        <div className="detail-grid">
          <div className="card">
            <div className="card-title" style={{ marginBottom: 16 }}>Datos del Cliente</div>
            <div>
              {[
                ['Tipo', cliente.tipo === 'empresa' ? 'Empresa' : 'Persona Natural'],
                ['DNI / RUC', cliente.documento_identidad || '—'],
                ['Email', cliente.email || '—'],
                ['Teléfono', cliente.telefono || '—'],
                ['Dirección', cliente.direccion || '—']
              ].map(([label, value]) => (
                <div key={label} className="detail-field">
                  <div className="detail-label">{label}</div>
                  <div className="detail-value">{value}</div>
                </div>
              ))}
              {cliente.notas && (
                <div className="detail-field">
                  <div className="detail-label">Notas</div>
                  <div className="detail-value" style={{ whiteSpace: 'pre-wrap' }}>{cliente.notas}</div>
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-title" style={{ marginBottom: 12 }}>Resumen</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  ['Total Expedientes', casos.length],
                  ['Casos Activos', casosActivos],
                  ['Casos Cerrados', casosCerrados],
                  ['Total Horas', totalHoras.toFixed(1) + 'h']
                ].map(([label, val]) => (
                  <div key={label} style={{ background: 'var(--cream)', borderRadius: 8, padding: '12px 14px' }}>
                    <div style={{ fontSize: '1.3rem', fontWeight: 700, fontFamily: 'var(--font-display)' }}>{val}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>
            {valorEstimado > 0 && (
              <div className="card">
                <div className="card-title" style={{ marginBottom: 12 }}>Valor Estimado Acumulado</div>
                <div style={{ background: 'var(--navy)', borderRadius: 8, padding: '14px 16px', color: 'white' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--gold-light)', marginBottom: 4 }}>Total facturable de todos los casos</div>
                  <div style={{ fontWeight: 700, fontSize: '1.4rem', fontFamily: 'var(--font-display)' }}>S/ {valorEstimado.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'expedientes' && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">Expedientes del Cliente</div>
          </div>

          {casos.length === 0 ? (
            <div className="empty-state"><FolderOpen size={36} /><p>Este cliente aún no tiene expedientes</p></div>
          ) : (
            <>
              <div className="filter-bar" style={{ marginBottom: 16 }}>
                <div className="search-bar" style={{ flex: 1, maxWidth: 360 }}>
                  <Search size={15} color="var(--text-muted)" />
                  <input placeholder="Buscar por título o expediente..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <select className="form-select" style={{ width: 'auto' }} value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
                  <option value="">Todos los tipos</option>
                  {TIPOS.map(t => <option key={t} value={t} style={{ textTransform: 'capitalize' }}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
                <select className="form-select" style={{ width: 'auto' }} value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
                  <option value="">Todos los estados</option>
                  {ESTADOS_CASO.map(e => <option key={e} value={e} style={{ textTransform: 'capitalize' }}>{e.charAt(0).toUpperCase() + e.slice(1)}</option>)}
                </select>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>N° Expediente</th>
                      <th>Título</th>
                      <th>Abogado Responsable</th>
                      <th>Tipo</th>
                      <th>Estado</th>
                      <th>Inicio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {casosFiltrados.length === 0 ? (
                      <tr><td colSpan={6}>
                        <div className="empty-state"><FolderOpen size={32} /><p>No hay expedientes que coincidan con los filtros</p></div>
                      </td></tr>
                    ) : casosFiltrados.map(c => (
                      <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/casos/${c.id}`)}>
                        <td style={{ fontWeight: 600, fontFamily: 'monospace', fontSize: '0.82rem', color: 'var(--navy)' }}>{c.numero_expediente}</td>
                        <td style={{ fontWeight: 500, maxWidth: 280 }}><div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.titulo}</div></td>
                        <td style={{ color: 'var(--text-secondary)' }}>{c.perfiles?.nombre || <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                        <td><span className={`badge badge-${c.tipo}`} style={{ textTransform: 'capitalize' }}>{c.tipo}</span></td>
                        <td><span className={`badge badge-${c.estado}`} style={{ textTransform: 'capitalize' }}>{c.estado}</span></td>
                        <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{formatearFecha(c.fecha_inicio)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'actividad' && (
        <div className="detail-grid">
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title"><Activity size={16} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />Últimos Estados Procesales</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>De todos los expedientes de este cliente</div>
              </div>
            </div>
            {estadosRecientes.length === 0 ? (
              <div className="empty-state"><Activity size={32} /><p>Sin estados procesales registrados</p></div>
            ) : (
              <div>
                {estadosRecientes.map(e => (
                  <Link key={e.id} to={`/casos/${e.casos?.id}`} style={{ display: 'block', padding: '10px 8px', margin: '0 -8px', borderBottom: '1px solid var(--border-light)', textDecoration: 'none', color: 'inherit', borderRadius: 4, transition: 'background 0.15s' }} onMouseEnter={ev => ev.currentTarget.style.background = 'var(--cream)'} onMouseLeave={ev => ev.currentTarget.style.background = 'transparent'}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 3 }}>
                      {formatearFecha(e.fecha, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </div>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{e.titulo}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--navy)', fontFamily: 'monospace', marginTop: 3 }}>{e.casos?.numero_expediente}</div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title"><CheckSquare size={16} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />Tareas Recientes</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Últimas tareas creadas en sus casos</div>
              </div>
            </div>
            {tareasRecientes.length === 0 ? (
              <div className="empty-state"><CheckSquare size={32} /><p>Sin tareas registradas</p></div>
            ) : (
              <div>
                {tareasRecientes.map(t => (
                  <Link key={t.id} to={`/casos/${t.casos?.id}`} style={{ display: 'block', padding: '10px 8px', margin: '0 -8px', borderBottom: '1px solid var(--border-light)', textDecoration: 'none', color: 'inherit', borderRadius: 4, transition: 'background 0.15s' }} onMouseEnter={ev => ev.currentTarget.style.background = 'var(--cream)'} onMouseLeave={ev => ev.currentTarget.style.background = 'transparent'}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div style={{ fontWeight: 500, fontSize: '0.85rem', textDecoration: t.estado === 'completada' ? 'line-through' : 'none', color: t.estado === 'completada' ? 'var(--text-muted)' : 'var(--text-primary)' }}>{t.titulo}</div>
                      <span className={`badge badge-${t.prioridad}`} style={{ fontSize: '0.68rem', flexShrink: 0 }}>{t.prioridad}</span>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 3 }}>
                      <span style={{ color: 'var(--navy)', fontFamily: 'monospace' }}>{t.casos?.numero_expediente}</span>
                      {t.perfiles?.nombre && ` · ${t.perfiles.nombre}`}
                      {t.fecha_vencimiento && ` · Vence: ${formatearFecha(t.fecha_vencimiento)}`}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {showEditModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowEditModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">Editar Cliente</div>
              <button className="btn-icon" onClick={() => setShowEditModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSaveEdit}>
              <div className="modal-body">
                <div className="form-group"><label className="form-label">Nombre completo / Razón social *</label><input className="form-input" value={editForm.nombre || ''} onChange={e => setEditForm({ ...editForm, nombre: e.target.value })} required /></div>
                <div className="form-grid">
                  <div className="form-group"><label className="form-label">Tipo</label><select className="form-select" value={editForm.tipo || 'persona_natural'} onChange={e => setEditForm({ ...editForm, tipo: e.target.value })}><option value="persona_natural">Persona Natural</option><option value="empresa">Empresa</option></select></div>
                  <div className="form-group"><label className="form-label">DNI / RUC</label><input className="form-input" value={editForm.documento_identidad || ''} onChange={e => setEditForm({ ...editForm, documento_identidad: e.target.value })} /></div>
                </div>
                <div className="form-grid">
                  <div className="form-group"><label className="form-label">Email</label><input className="form-input" type="email" value={editForm.email || ''} onChange={e => setEditForm({ ...editForm, email: e.target.value })} /></div>
                  <div className="form-group"><label className="form-label">Teléfono</label><input className="form-input" value={editForm.telefono || ''} onChange={e => setEditForm({ ...editForm, telefono: e.target.value })} /></div>
                </div>
                <div className="form-group"><label className="form-label">Dirección</label><input className="form-input" value={editForm.direccion || ''} onChange={e => setEditForm({ ...editForm, direccion: e.target.value })} /></div>
                <div className="form-group"><label className="form-label">Notas</label><textarea className="form-textarea" value={editForm.notas || ''} onChange={e => setEditForm({ ...editForm, notas: e.target.value })} style={{ minHeight: 60 }} /></div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowEditModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardando...' : 'Guardar Cambios'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
