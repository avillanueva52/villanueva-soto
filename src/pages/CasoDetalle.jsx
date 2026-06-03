import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { ArrowLeft, Upload, Plus, Trash2, FileText, Clock, CheckSquare, Edit2, Save, X, Activity } from 'lucide-react'

const TIPOS_TAREA = ['redaccion', 'investigacion', 'audiencia', 'reunion', 'tramite', 'consulta', 'revision', 'otro']
const TIPOS_TAREA_LABELS = { redaccion: 'Redacción', investigacion: 'Investigación', audiencia: 'Audiencia', reunion: 'Reunión', tramite: 'Trámite', consulta: 'Consulta', revision: 'Revisión', otro: 'Otro' }

export default function CasoDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { perfil } = useAuth()
  const [caso, setCaso] = useState(null)
  const [documentos, setDocumentos] = useState([])
  const [horas, setHoras] = useState([])
  const [tareas, setTareas] = useState([])
  const [estados, setEstados] = useState([])
  const [abogados, setAbogados] = useState([])
  const [clientes, setClientes] = useState([])
  const [tab, setTab] = useState('info')
  const [loading, setLoading] = useState(true)
  const [showHorasModal, setShowHorasModal] = useState(false)
  const [showTareaModal, setShowTareaModal] = useState(false)
  const [showEstadoModal, setShowEstadoModal] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({})
  const [horaForm, setHoraForm] = useState({ tipo_tarea: 'redaccion', horas: '', descripcion: '', fecha: new Date().toISOString().split('T')[0] })
  const [tareaForm, setTareaForm] = useState({ titulo: '', descripcion: '', prioridad: 'media', asignado_a: '', fecha_vencimiento: '' })
  const [estadoForm, setEstadoForm] = useState({ titulo: '', descripcion: '', fecha: new Date().toISOString().split('T')[0] })
  const [saving, setSaving] = useState(false)
  const [uploadingFile, setUploadingFile] = useState(false)
  const fileRef = useRef()

  useEffect(() => { loadAll() }, [id])

  async function loadAll() {
    const [casoRes, docsRes, horasRes, tareasRes, estadosRes, abogadosRes, clientesRes] = await Promise.all([
      supabase.from('casos').select('*, clientes(id,nombre), perfiles(id,nombre)').eq('id', id).single(),
      supabase.from('documentos').select('*, perfiles(nombre)').eq('caso_id', id).order('fecha_documento', { ascending: false }),
      supabase.from('horas_trabajadas').select('*, perfiles(nombre,rol)').eq('caso_id', id).order('fecha', { ascending: false }),
      supabase.from('tareas').select('*, perfiles!tareas_asignado_a_fkey(nombre)').eq('caso_id', id).order('creado_en', { ascending: false }),
      supabase.from('estados_procesales').select('*, perfiles(nombre)').eq('caso_id', id).order('fecha', { ascending: false }),
      supabase.from('perfiles').select('id,nombre,rol').eq('activo', true).order('nombre'),
      supabase.from('clientes').select('id,nombre').order('nombre')
    ])
    setCaso(casoRes.data)
    setEditForm(casoRes.data || {})
    setDocumentos(docsRes.data || [])
    setHoras(horasRes.data || [])
    setTareas(tareasRes.data || [])
    setEstados(estadosRes.data || [])
    setAbogados(abogadosRes.data || [])
    setClientes(clientesRes.data || [])
    setLoading(false)
  }

  async function handleSaveEdit() {
    setSaving(true)
    await supabase.from('casos').update({
      titulo: editForm.titulo, tipo: editForm.tipo, estado: editForm.estado,
      cliente_id: editForm.cliente_id || null, abogado_responsable_id: editForm.abogado_responsable_id || null,
      juzgado: editForm.juzgado, numero_judicial: editForm.numero_judicial,
      descripcion: editForm.descripcion, fecha_inicio: editForm.fecha_inicio, fecha_cierre: editForm.fecha_cierre || null
    }).eq('id', id)
    setEditing(false)
    loadAll()
    setSaving(false)
  }

  async function handleUploadDoc(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploadingFile(true)
    const ext = file.name.split('.').pop()
    const path = `${id}/${Date.now()}.${ext}`
    const { error: uploadError } = await supabase.storage.from('documentos').upload(path, file)
    if (!uploadError) {
      const { data: { publicUrl } } = supabase.storage.from('documentos').getPublicUrl(path)
      await supabase.from('documentos').insert({ caso_id: id, nombre: file.name, url: publicUrl, subido_por: perfil.id, fecha_documento: new Date().toISOString().split('T')[0], tipo_documento: ext.toUpperCase() })
      loadAll()
    }
    setUploadingFile(false)
  }

  async function handleDeleteDoc(docId, url) {
    if (!confirm('¿Eliminar este documento?')) return
    const path = url.split('/documentos/')[1]
    await supabase.storage.from('documentos').remove([path])
    await supabase.from('documentos').delete().eq('id', docId)
    loadAll()
  }

  async function handleSaveHoras(e) {
    e.preventDefault()
    setSaving(true)
    await supabase.from('horas_trabajadas').insert({ ...horaForm, caso_id: id, perfil_id: perfil.id, horas: parseFloat(horaForm.horas) })
    setShowHorasModal(false)
    setHoraForm({ tipo_tarea: 'redaccion', horas: '', descripcion: '', fecha: new Date().toISOString().split('T')[0] })
    loadAll()
    setSaving(false)
  }

  async function handleSaveTarea(e) {
    e.preventDefault()
    setSaving(true)
    await supabase.from('tareas').insert({ ...tareaForm, caso_id: id, creado_por: perfil.id, asignado_a: tareaForm.asignado_a || null, fecha_vencimiento: tareaForm.fecha_vencimiento || null })
    setShowTareaModal(false)
    setTareaForm({ titulo: '', descripcion: '', prioridad: 'media', asignado_a: '', fecha_vencimiento: '' })
    loadAll()
    setSaving(false)
  }

  async function handleSaveEstado(e) {
    e.preventDefault()
    setSaving(true)
    await supabase.from('estados_procesales').insert({ ...estadoForm, caso_id: id, perfil_id: perfil.id })
    setShowEstadoModal(false)
    setEstadoForm({ titulo: '', descripcion: '', fecha: new Date().toISOString().split('T')[0] })
    loadAll()
    setSaving(false)
  }

  async function handleDeleteEstado(estadoId) {
    if (!confirm('¿Eliminar este estado procesal?')) return
    await supabase.from('estados_procesales').delete().eq('id', estadoId)
    loadAll()
  }

  async function toggleTarea(tarea) {
    const nuevoEstado = tarea.estado === 'completada' ? 'pendiente' : 'completada'
    await supabase.from('tareas').update({ estado: nuevoEstado }).eq('id', tarea.id)
    loadAll()
  }

  const totalHoras = horas.reduce((s, h) => s + h.horas, 0)

  if (loading) return <div className="loading-page"><div className="spinner"></div></div>
  if (!caso) return <div style={{ padding: 40, textAlign: 'center' }}>Expediente no encontrado</div>

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn-icon" onClick={() => navigate('/casos')}><ArrowLeft size={16} /></button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="page-title" style={{ fontSize: '1.2rem' }}>{caso.titulo}</div>
              <span className={`badge badge-${caso.tipo}`} style={{ textTransform: 'capitalize' }}>{caso.tipo}</span>
              <span className={`badge badge-${caso.estado}`} style={{ textTransform: 'capitalize' }}>{caso.estado}</span>
            </div>
            <div className="page-subtitle" style={{ fontFamily: 'monospace' }}>{caso.numero_expediente}</div>
          </div>
        </div>
        {!editing ? (
          <button className="btn btn-outline btn-sm" onClick={() => setEditing(true)}><Edit2 size={14} />Editar</button>
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-outline btn-sm" onClick={() => setEditing(false)}><X size={14} />Cancelar</button>
            <button className="btn btn-primary btn-sm" onClick={handleSaveEdit} disabled={saving}><Save size={14} />{saving ? 'Guardando...' : 'Guardar'}</button>
          </div>
        )}
      </div>

      <div className="tabs">
        {[
          ['info', 'Información'],
          ['estado', `Estado Procesal (${estados.length})`],
          ['documentos', `Documentos (${documentos.length})`],
          ['horas', `Horas (${totalHoras.toFixed(1)}h)`],
          ['tareas', `Tareas (${tareas.filter(t=>t.estado!=='completada').length})`]
        ].map(([key, label]) => (
          <div key={key} className={`tab ${tab === key ? 'active' : ''}`} onClick={() => setTab(key)}>{label}</div>
        ))}
      </div>

      {tab === 'info' && (
        <div className="detail-grid">
          <div className="card">
            <div className="card-title" style={{ marginBottom: 16 }}>Datos del Expediente</div>
            {editing ? (
              <div>
                <div className="form-group"><label className="form-label">Título</label><input className="form-input" value={editForm.titulo || ''} onChange={e => setEditForm({ ...editForm, titulo: e.target.value })} /></div>
                <div className="form-grid">
                  <div className="form-group"><label className="form-label">Tipo</label><select className="form-select" value={editForm.tipo || ''} onChange={e => setEditForm({ ...editForm, tipo: e.target.value })}>{['civil','penal','constitucional','laboral','administrativo','consulta'].map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}</select></div>
                  <div className="form-group"><label className="form-label">Estado</label><select className="form-select" value={editForm.estado || ''} onChange={e => setEditForm({ ...editForm, estado: e.target.value })}>{['activo','archivado','cerrado','suspendido'].map(e => <option key={e} value={e}>{e.charAt(0).toUpperCase()+e.slice(1)}</option>)}</select></div>
                </div>
                <div className="form-group"><label className="form-label">Cliente</label><select className="form-select" value={editForm.cliente_id || ''} onChange={e => setEditForm({ ...editForm, cliente_id: e.target.value })}><option value="">Sin cliente</option>{clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></div>
                <div className="form-group"><label className="form-label">Abogado Responsable</label><select className="form-select" value={editForm.abogado_responsable_id || ''} onChange={e => setEditForm({ ...editForm, abogado_responsable_id: e.target.value })}><option value="">Sin asignar</option>{abogados.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}</select></div>
                <div className="form-grid">
                  <div className="form-group"><label className="form-label">Juzgado</label><input className="form-input" value={editForm.juzgado || ''} onChange={e => setEditForm({ ...editForm, juzgado: e.target.value })} /></div>
                  <div className="form-group"><label className="form-label">N° Judicial</label><input className="form-input" value={editForm.numero_judicial || ''} onChange={e => setEditForm({ ...editForm, numero_judicial: e.target.value })} /></div>
                </div>
                <div className="form-grid">
                  <div className="form-group"><label className="form-label">Fecha Inicio</label><input className="form-input" type="date" value={editForm.fecha_inicio || ''} onChange={e => setEditForm({ ...editForm, fecha_inicio: e.target.value })} /></div>
                  <div className="form-group"><label className="form-label">Fecha Cierre</label><input className="form-input" type="date" value={editForm.fecha_cierre || ''} onChange={e => setEditForm({ ...editForm, fecha_cierre: e.target.value })} /></div>
                </div>
                <div className="form-group"><label className="form-label">Descripción</label><textarea className="form-textarea" value={editForm.descripcion || ''} onChange={e => setEditForm({ ...editForm, descripcion: e.target.value })} /></div>
              </div>
            ) : (
              <div>
                {[['Cliente', caso.clientes?.nombre || '—'], ['Abogado Responsable', caso.perfiles?.nombre || '—'], ['Juzgado', caso.juzgado || '—'], ['N° Judicial', caso.numero_judicial || '—'], ['Fecha Inicio', caso.fecha_inicio ? new Date(caso.fecha_inicio).toLocaleDateString('es-PE') : '—'], ['Fecha Cierre', caso.fecha_cierre ? new Date(caso.fecha_cierre).toLocaleDateString('es-PE') : '—']].map(([label, value]) => (
                  <div key={label} className="detail-field">
                    <div className="detail-label">{label}</div>
                    <div className="detail-value">{value}</div>
                  </div>
                ))}
                {caso.descripcion && <div className="detail-field"><div className="detail-label">Descripción</div><div className="detail-value" style={{ whiteSpace: 'pre-wrap' }}>{caso.descripcion}</div></div>}
              </div>
            )}
          </div>
          <div>
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-title" style={{ marginBottom: 12 }}>Resumen</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[['Documentos', documentos.length], ['Horas', totalHoras.toFixed(1) + 'h'], ['Tareas Pend.', tareas.filter(t => t.estado !== 'completada').length], ['Estados', estados.length]].map(([label, val]) => (
                  <div key={label} style={{ background: 'var(--cream)', borderRadius: 8, padding: '12px 14px' }}>
                    <div style={{ fontSize: '1.3rem', fontWeight: 700, fontFamily: 'var(--font-display)' }}>{val}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>
            {estados.length > 0 && (
              <div className="card">
                <div className="card-title" style={{ marginBottom: 12 }}>Último Estado</div>
                <div style={{ background: 'var(--navy)', borderRadius: 8, padding: '12px 14px', color: 'white' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--gold-light)', marginBottom: 4 }}>{new Date(estados[0].fecha).toLocaleDateString('es-PE')}</div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{estados[0].titulo}</div>
                  {estados[0].descripcion && <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>{estados[0].descripcion}</div>}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'estado' && (
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Estado Procesal</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Historial cronológico del avance del caso</div>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => setShowEstadoModal(true)}><Plus size={14} />Nuevo Estado</button>
          </div>

          {estados.length === 0 ? (
            <div className="empty-state"><Activity size={36} /><p>No hay estados registrados aún</p></div>
          ) : (
            <div style={{ position: 'relative', paddingLeft: 28 }}>
              <div style={{ position: 'absolute', left: 10, top: 0, bottom: 0, width: 2, background: 'var(--border)' }}></div>
              {estados.map((e, i) => (
                <div key={e.id} style={{ position: 'relative', marginBottom: 20 }}>
                  <div style={{ position: 'absolute', left: -24, top: 4, width: 12, height: 12, borderRadius: '50%', background: i === 0 ? 'var(--gold)' : 'var(--border)', border: '2px solid white', boxShadow: '0 0 0 2px ' + (i === 0 ? 'var(--gold)' : 'var(--border)') }}></div>
                  <div style={{ background: i === 0 ? 'var(--navy)' : 'var(--cream)', borderRadius: 8, padding: '12px 16px', color: i === 0 ? 'white' : 'var(--text-primary)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.72rem', color: i === 0 ? 'var(--gold-light)' : 'var(--text-muted)', marginBottom: 3 }}>
                          {new Date(e.fecha).toLocaleDateString('es-PE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                          {e.perfiles?.nombre && ` · ${e.perfiles.nombre}`}
                        </div>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{e.titulo}</div>
                        {e.descripcion && <div style={{ fontSize: '0.82rem', marginTop: 4, color: i === 0 ? 'rgba(255,255,255,0.75)' : 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{e.descripcion}</div>}
                      </div>
                      <button className="btn-icon" onClick={() => handleDeleteEstado(e.id)} style={{ border: 'none', color: i === 0 ? 'rgba(255,255,255,0.4)' : 'var(--text-muted)', marginLeft: 8, flexShrink: 0 }}><Trash2 size={13} /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'documentos' && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">Documentos del Expediente</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="file" ref={fileRef} style={{ display: 'none' }} onChange={handleUploadDoc} />
              <button className="btn btn-primary btn-sm" onClick={() => fileRef.current.click()} disabled={uploadingFile}>
                <Upload size={14} />{uploadingFile ? 'Subiendo...' : 'Subir Documento'}
              </button>
            </div>
          </div>
          {documentos.length === 0 ? (
            <div className="empty-state"><FileText size={36} /><p>No hay documentos subidos aún</p></div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Nombre</th><th>Tipo</th><th>Subido por</th><th>Fecha</th><th></th></tr></thead>
                <tbody>
                  {documentos.map(doc => (
                    <tr key={doc.id}>
                      <td><a href={doc.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--navy)', fontWeight: 500, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}><FileText size={14} />{doc.nombre}</a></td>
                      <td><span style={{ background: 'var(--cream)', padding: '2px 8px', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600 }}>{doc.tipo_documento || '—'}</span></td>
                      <td style={{ color: 'var(--text-secondary)' }}>{doc.perfiles?.nombre || '—'}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{new Date(doc.fecha_documento).toLocaleDateString('es-PE')}</td>
                      <td><button className="btn-icon" onClick={() => handleDeleteDoc(doc.id, doc.url)} style={{ color: 'var(--danger)' }}><Trash2 size={14} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'horas' && (
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Registro de Horas</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Total: {totalHoras.toFixed(2)} horas</div>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => setShowHorasModal(true)}><Plus size={14} />Registrar Horas</button>
          </div>
          {horas.length === 0 ? (
            <div className="empty-state"><Clock size={36} /><p>No hay horas registradas aún</p></div>
          ) : horas.map(h => (
            <div key={h.id} className="hours-entry">
              <div className="hours-badge">{h.horas}h</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{TIPOS_TAREA_LABELS[h.tipo_tarea] || h.tipo_tarea}</div>
                {h.descripcion && <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 2 }}>{h.descripcion}</div>}
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 3 }}>{h.perfiles?.nombre} · {new Date(h.fecha).toLocaleDateString('es-PE')}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.72rem', background: h.facturado ? 'var(--success-bg)' : 'var(--cream)', color: h.facturado ? 'var(--success)' : 'var(--text-muted)', padding: '2px 8px', borderRadius: 4 }}>{h.facturado ? 'Facturado' : 'Pendiente'}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'tareas' && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">Tareas del Expediente</div>
            <button className="btn btn-primary btn-sm" onClick={() => setShowTareaModal(true)}><Plus size={14} />Nueva Tarea</button>
          </div>
          {tareas.length === 0 ? (
            <div className="empty-state"><CheckSquare size={36} /><p>No hay tareas asignadas</p></div>
          ) : tareas.map(t => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--border-light)' }}>
              <input type="checkbox" checked={t.estado === 'completada'} onChange={() => toggleTarea(t)} style={{ marginTop: 3, width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--navy)' }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500, fontSize: '0.875rem', textDecoration: t.estado === 'completada' ? 'line-through' : 'none', color: t.estado === 'completada' ? 'var(--text-muted)' : 'var(--text-primary)' }}>{t.titulo}</div>
                {t.descripcion && <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 2 }}>{t.descripcion}</div>}
                <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                  <span className={`badge badge-${t.prioridad}`}>{t.prioridad}</span>
                  {t.perfiles?.nombre && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>→ {t.perfiles.nombre}</span>}
                  {t.fecha_vencimiento && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Vence: {new Date(t.fecha_vencimiento).toLocaleDateString('es-PE')}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL ESTADO PROCESAL */}
      {showEstadoModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowEstadoModal(false)}>
          <div className="modal">
            <div className="modal-header"><div className="modal-title">Nuevo Estado Procesal</div><button className="btn-icon" onClick={() => setShowEstadoModal(false)}>✕</button></div>
            <form onSubmit={handleSaveEstado}>
              <div className="modal-body">
                <div className="form-group"><label className="form-label">Título del estado *</label><input className="form-input" value={estadoForm.titulo} onChange={e => setEstadoForm({ ...estadoForm, titulo: e.target.value })} placeholder="Ej: Se presentó la demanda, Audiencia señalada..." required /></div>
                <div className="form-group"><label className="form-label">Fecha</label><input className="form-input" type="date" value={estadoForm.fecha} onChange={e => setEstadoForm({ ...estadoForm, fecha: e.target.value })} /></div>
                <div className="form-group"><label className="form-label">Descripción / Detalle</label><textarea className="form-textarea" value={estadoForm.descripcion} onChange={e => setEstadoForm({ ...estadoForm, descripcion: e.target.value })} placeholder="Detalles adicionales del estado procesal..." /></div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowEstadoModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardando...' : 'Registrar Estado'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL HORAS */}
      {showHorasModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowHorasModal(false)}>
          <div className="modal">
            <div className="modal-header"><div className="modal-title">Registrar Horas</div><button className="btn-icon" onClick={() => setShowHorasModal(false)}>✕</button></div>
            <form onSubmit={handleSaveHoras}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group"><label className="form-label">Tipo de Tarea *</label><select className="form-select" value={horaForm.tipo_tarea} onChange={e => setHoraForm({ ...horaForm, tipo_tarea: e.target.value })}>{TIPOS_TAREA.map(t => <option key={t} value={t}>{TIPOS_TAREA_LABELS[t]}</option>)}</select></div>
                  <div className="form-group"><label className="form-label">Horas *</label><input className="form-input" type="number" step="0.25" min="0.25" value={horaForm.horas} onChange={e => setHoraForm({ ...horaForm, horas: e.target.value })} placeholder="2.5" required /></div>
                </div>
                <div className="form-group"><label className="form-label">Fecha</label><input className="form-input" type="date" value={horaForm.fecha} onChange={e => setHoraForm({ ...horaForm, fecha: e.target.value })} /></div>
                <div className="form-group"><label className="form-label">Descripción</label><textarea className="form-textarea" value={horaForm.descripcion} onChange={e => setHoraForm({ ...horaForm, descripcion: e.target.value })} placeholder="Detalle de la actividad realizada..." style={{ minHeight: 60 }} /></div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowHorasModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardando...' : 'Registrar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL TAREA */}
      {showTareaModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowTareaModal(false)}>
          <div className="modal">
            <div className="modal-header"><div className="modal-title">Nueva Tarea</div><button className="btn-icon" onClick={() => setShowTareaModal(false)}>✕</button></div>
            <form onSubmit={handleSaveTarea}>
              <div className="modal-body">
                <div className="form-group"><label className="form-label">Título *</label><input className="form-input" value={tareaForm.titulo} onChange={e => setTareaForm({ ...tareaForm, titulo: e.target.value })} placeholder="Descripción de la tarea" required /></div>
                <div className="form-grid">
                  <div className="form-group"><label className="form-label">Prioridad</label><select className="form-select" value={tareaForm.prioridad} onChange={e => setTareaForm({ ...tareaForm, prioridad: e.target.value })}><option value="alta">Alta</option><option value="media">Media</option><option value="baja">Baja</option></select></div>
                  <div className="form-group"><label className="form-label">Asignar a</label><select className="form-select" value={tareaForm.asignado_a} onChange={e => setTareaForm({ ...tareaForm, asignado_a: e.target.value })}><option value="">Sin asignar</option>{abogados.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}</select></div>
                </div>
                <div className="form-group"><label className="form-label">Fecha de Vencimiento</label><input className="form-input" type="date" value={tareaForm.fecha_vencimiento} onChange={e => setTareaForm({ ...tareaForm, fecha_vencimiento: e.target.value })} /></div>
                <div className="form-group"><label className="form-label">Descripción</label><textarea className="form-textarea" value={tareaForm.descripcion} onChange={e => setTareaForm({ ...tareaForm, descripcion: e.target.value })} placeholder="Detalles adicionales..." style={{ minHeight: 60 }} /></div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowTareaModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardando...' : 'Crear Tarea'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
