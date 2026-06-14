import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { formatearFecha, hoyEnLima } from '../lib/dateUtils'
import { ArrowLeft, Edit2, Save, X, Trash2, Plus, Phone, Mail, Activity, Bell, UserPlus, Check, AlertCircle, Users } from 'lucide-react'

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
const TIPOS_ACTIVIDAD = { llamada: 'Llamada', reunion: 'Reunión', email: 'Email', whatsapp: 'WhatsApp', otro: 'Otro' }

export default function ProspectoDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { perfil } = useAuth()
  const [prospecto, setProspecto] = useState(null)
  const [actividades, setActividades] = useState([])
  const [recordatorios, setRecordatorios] = useState([])
  const [equipo, setEquipo] = useState([])
  const [abogados, setAbogados] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('info')
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({})
  const [equipoEditando, setEquipoEditando] = useState([])
  const [saving, setSaving] = useState(false)

  const [actForm, setActForm] = useState({ tipo: 'llamada', fecha: hoyEnLima(), notas: '' })
  const [recForm, setRecForm] = useState({ fecha: hoyEnLima(), nota: '' })
  const [showConvertirCliente, setShowConvertirCliente] = useState(false)
  const [clienteForm, setClienteForm] = useState({})
  const [convirtiendo, setConvirtiendo] = useState(false)

  useEffect(() => { loadAll() }, [id])

  async function loadAll() {
    setLoading(true)
    const [prospectoRes, actRes, recRes, equipoRes, abogadosRes] = await Promise.all([
      supabase.from('prospectos').select('*, perfiles(id, nombre), clientes(id, nombre)').eq('id', id).single(),
      supabase.from('prospecto_actividades').select('*, perfiles(nombre)').eq('prospecto_id', id).order('fecha', { ascending: false }),
      supabase.from('prospecto_recordatorios').select('*, perfiles(nombre)').eq('prospecto_id', id).order('fecha'),
      supabase.from('prospecto_equipo').select('*, perfiles(id, nombre)').eq('prospecto_id', id),
      supabase.from('perfiles').select('id, nombre').eq('activo', true).order('nombre')
    ])
    setProspecto(prospectoRes.data)
    setEditForm(prospectoRes.data || {})
    setActividades(actRes.data || [])
    setRecordatorios(recRes.data || [])
    setEquipo(equipoRes.data || [])
    setEquipoEditando((equipoRes.data || []).map(e => e.perfil_id))
    setAbogados(abogadosRes.data || [])
    setLoading(false)
  }

  function puedeEliminar() {
    return perfil?.rol === 'socio_admin'
  }

  async function handleSaveEdit() {
    setSaving(true)
    const estadoAnterior = prospecto.estado
    const cambiaAGanado = editForm.estado === 'ganado' && estadoAnterior !== 'ganado'

    await supabase.from('prospectos').update({
      nombre: editForm.nombre,
      telefono: editForm.telefono || null,
      email: editForm.email || null,
      como_contacto: editForm.como_contacto || null,
      tipo_asunto: editForm.tipo_asunto || null,
      descripcion: editForm.descripcion || null,
      estado: editForm.estado,
      abogado_responsable_id: editForm.abogado_responsable_id || null,
      notas: editForm.notas || null,
      actualizado_en: new Date().toISOString()
    }).eq('id', id)

    // Actualizar equipo: eliminar todos y reinsertar (más simple)
    await supabase.from('prospecto_equipo').delete().eq('prospecto_id', id)
    if (equipoEditando.length > 0) {
      const inserts = equipoEditando.map(perfil_id => ({ prospecto_id: id, perfil_id }))
      await supabase.from('prospecto_equipo').insert(inserts)
    }

    setEditing(false)
    await loadAll()
    setSaving(false)

    // Si pasó a Ganado y aún no hay cliente asociado, preguntar
    if (cambiaAGanado && !prospecto.cliente_id) {
      setTimeout(() => abrirConvertirCliente(), 300)
    }
  }

  function cancelarEdicion() {
    setEditForm(prospecto || {})
    setEquipoEditando(equipo.map(e => e.perfil_id))
    setEditing(false)
  }

  async function handleEliminar() {
    if (!confirm(`¿Eliminar el prospecto "${prospecto.nombre}"? Esta acción no se puede deshacer.`)) return
    await supabase.from('prospectos').delete().eq('id', id)
    navigate('/crm')
  }

  // ACTIVIDADES
  async function handleAgregarActividad(e) {
    e.preventDefault()
    if (!actForm.fecha) return
    await supabase.from('prospecto_actividades').insert({
      prospecto_id: id,
      tipo: actForm.tipo,
      fecha: actForm.fecha,
      notas: actForm.notas || null,
      registrado_por: perfil.id
    })
    setActForm({ tipo: 'llamada', fecha: hoyEnLima(), notas: '' })
    loadAll()
  }

  async function handleEliminarActividad(actId) {
    if (!confirm('¿Eliminar esta actividad?')) return
    await supabase.from('prospecto_actividades').delete().eq('id', actId)
    loadAll()
  }

  // RECORDATORIOS
  async function handleAgregarRecordatorio(e) {
    e.preventDefault()
    if (!recForm.fecha) return
    await supabase.from('prospecto_recordatorios').insert({
      prospecto_id: id,
      fecha: recForm.fecha,
      nota: recForm.nota || null,
      creado_por: perfil.id
    })
    setRecForm({ fecha: hoyEnLima(), nota: '' })
    loadAll()
  }

  async function toggleRecordatorio(rec) {
    await supabase.from('prospecto_recordatorios').update({ completado: !rec.completado }).eq('id', rec.id)
    loadAll()
  }

  async function handleEliminarRecordatorio(recId) {
    if (!confirm('¿Eliminar este recordatorio?')) return
    await supabase.from('prospecto_recordatorios').delete().eq('id', recId)
    loadAll()
  }

  // CONVERSIÓN A CLIENTE
  function abrirConvertirCliente() {
    setClienteForm({
      nombre: prospecto.nombre,
      tipo: 'persona_natural',
      documento_identidad: '',
      email: prospecto.email || '',
      telefono: prospecto.telefono || '',
      direccion: '',
      notas: prospecto.notas ? `Convertido desde CRM. Notas previas: ${prospecto.notas}` : 'Convertido desde CRM.'
    })
    setShowConvertirCliente(true)
  }

  async function handleConvertirCliente(e) {
    e.preventDefault()
    setConvirtiendo(true)
    const { data: nuevoCliente, error } = await supabase.from('clientes').insert({
      nombre: clienteForm.nombre,
      tipo: clienteForm.tipo,
      documento_identidad: clienteForm.documento_identidad || null,
      email: clienteForm.email || null,
      telefono: clienteForm.telefono || null,
      direccion: clienteForm.direccion || null,
      notas: clienteForm.notas || null
    }).select().single()

    if (error) {
      alert('Error al crear el cliente: ' + error.message)
      setConvirtiendo(false)
      return
    }

    // Asociar el cliente al prospecto
    await supabase.from('prospectos').update({ cliente_id: nuevoCliente.id, actualizado_en: new Date().toISOString() }).eq('id', id)

    setShowConvertirCliente(false)
    setConvirtiendo(false)
    await loadAll()
    alert(`Cliente "${nuevoCliente.nombre}" creado correctamente. Puedes verlo en la sección Clientes.`)
  }

  function toggleAbogadoEquipo(abogadoId) {
    setEquipoEditando(prev => prev.includes(abogadoId) ? prev.filter(x => x !== abogadoId) : [...prev, abogadoId])
  }

  if (loading) return <div className="loading-page"><div className="spinner"></div></div>
  if (!prospecto) return <div style={{ padding: 40, textAlign: 'center' }}>Prospecto no encontrado</div>

  const estadoInfo = ESTADOS.find(e => e.key === prospecto.estado)
  const hoy = hoyEnLima()
  const recordatoriosPendientes = recordatorios.filter(r => !r.completado)
  const recordatoriosVencidos = recordatoriosPendientes.filter(r => r.fecha <= hoy)

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn-icon" onClick={() => navigate('/crm')}><ArrowLeft size={16} /></button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div className="page-title" style={{ fontSize: '1.2rem' }}>{prospecto.nombre}</div>
              <span style={{ fontSize: '0.72rem', background: estadoInfo?.color, color: 'white', padding: '3px 10px', borderRadius: 4, fontWeight: 600 }}>
                {estadoInfo?.label}
              </span>
              {prospecto.tipo_asunto && <span className={`badge badge-${prospecto.tipo_asunto}`} style={{ textTransform: 'capitalize' }}>{prospecto.tipo_asunto}</span>}
              {prospecto.cliente_id && (
                <span style={{ fontSize: '0.72rem', background: 'var(--success-bg)', color: 'var(--success)', padding: '3px 10px', borderRadius: 4, fontWeight: 600 }}>
                  ✓ Cliente creado
                </span>
              )}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {prospecto.estado === 'ganado' && !prospecto.cliente_id && (
            <button className="btn btn-primary btn-sm" onClick={abrirConvertirCliente}><UserPlus size={14} />Convertir a Cliente</button>
          )}
          {prospecto.cliente_id && prospecto.clientes && (
            <button className="btn btn-outline btn-sm" onClick={() => navigate(`/clientes/${prospecto.cliente_id}`)}>
              Ver Cliente →
            </button>
          )}
          {!editing ? (
            <button className="btn btn-outline btn-sm" onClick={() => setEditing(true)}><Edit2 size={14} />Editar</button>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-outline btn-sm" onClick={cancelarEdicion}><X size={14} />Cancelar</button>
              <button className="btn btn-primary btn-sm" onClick={handleSaveEdit} disabled={saving}><Save size={14} />{saving ? 'Guardando...' : 'Guardar'}</button>
            </div>
          )}
          {puedeEliminar() && !editing && (
            <button className="btn-icon" onClick={handleEliminar} style={{ color: 'var(--danger)' }} title="Eliminar prospecto"><Trash2 size={14} /></button>
          )}
        </div>
      </div>

      {recordatoriosVencidos.length > 0 && (
        <div className="card" style={{ marginBottom: 16, background: '#fef2f2', borderLeft: '4px solid var(--danger)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <AlertCircle size={20} color="var(--danger)" />
            <div style={{ fontSize: '0.88rem' }}>
              <strong style={{ color: 'var(--danger)' }}>{recordatoriosVencidos.length} recordatorio{recordatoriosVencidos.length !== 1 ? 's' : ''} vencido{recordatoriosVencidos.length !== 1 ? 's' : ''}.</strong>
              {' '}Revisa la pestaña Recordatorios.
            </div>
          </div>
        </div>
      )}

      <div className="tabs">
        {[
          ['info', 'Información'],
          ['actividades', `Actividades (${actividades.length})`],
          ['recordatorios', `Recordatorios (${recordatoriosPendientes.length} pendientes)`]
        ].map(([key, label]) => (
          <div key={key} className={`tab ${tab === key ? 'active' : ''}`} onClick={() => setTab(key)}>{label}</div>
        ))}
      </div>

      {/* TAB INFORMACIÓN */}
      {tab === 'info' && (
        <div className="detail-grid">
          <div className="card">
            <div className="card-title" style={{ marginBottom: 16 }}>Datos del Prospecto</div>
            {editing ? (
              <div>
                <div className="form-group"><label className="form-label">Nombre *</label><input className="form-input" value={editForm.nombre || ''} onChange={e => setEditForm({ ...editForm, nombre: e.target.value })} required /></div>
                <div className="form-grid">
                  <div className="form-group"><label className="form-label">Teléfono</label><input className="form-input" value={editForm.telefono || ''} onChange={e => setEditForm({ ...editForm, telefono: e.target.value })} /></div>
                  <div className="form-group"><label className="form-label">Email</label><input className="form-input" type="email" value={editForm.email || ''} onChange={e => setEditForm({ ...editForm, email: e.target.value })} /></div>
                </div>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">¿Cómo nos contactó?</label>
                    <select className="form-select" value={editForm.como_contacto || ''} onChange={e => setEditForm({ ...editForm, como_contacto: e.target.value })}>
                      <option value="">Sin especificar</option>
                      {Object.entries(COMO_CONTACTO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Tipo de asunto</label>
                    <select className="form-select" value={editForm.tipo_asunto || ''} onChange={e => setEditForm({ ...editForm, tipo_asunto: e.target.value })}>
                      <option value="">Sin especificar</option>
                      {TIPOS_ASUNTO.map(t => <option key={t} value={t} style={{ textTransform: 'capitalize' }}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Estado del pipeline</label>
                  <select className="form-select" value={editForm.estado || 'nuevo'} onChange={e => setEditForm({ ...editForm, estado: e.target.value })}>
                    {ESTADOS.map(e => <option key={e.key} value={e.key}>{e.label}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Abogado responsable</label>
                  <select className="form-select" value={editForm.abogado_responsable_id || ''} onChange={e => setEditForm({ ...editForm, abogado_responsable_id: e.target.value })}>
                    <option value="">Sin asignar</option>
                    {abogados.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                  </select>
                </div>
                <div className="form-group"><label className="form-label">Descripción del asunto</label><textarea className="form-textarea" value={editForm.descripcion || ''} onChange={e => setEditForm({ ...editForm, descripcion: e.target.value })} style={{ minHeight: 60 }} /></div>
                <div className="form-group"><label className="form-label">Notas internas</label><textarea className="form-textarea" value={editForm.notas || ''} onChange={e => setEditForm({ ...editForm, notas: e.target.value })} style={{ minHeight: 60 }} /></div>
              </div>
            ) : (
              <div>
                {[
                  ['Teléfono', prospecto.telefono],
                  ['Email', prospecto.email],
                  ['Cómo nos contactó', COMO_CONTACTO_LABELS[prospecto.como_contacto]],
                  ['Tipo de asunto', prospecto.tipo_asunto && prospecto.tipo_asunto.charAt(0).toUpperCase() + prospecto.tipo_asunto.slice(1)],
                  ['Abogado responsable', prospecto.perfiles?.nombre],
                  ['Registrado el', formatearFecha(prospecto.creado_en?.split('T')[0])]
                ].map(([label, value]) => (
                  <div key={label} className="detail-field">
                    <div className="detail-label">{label}</div>
                    <div className="detail-value">{value || '—'}</div>
                  </div>
                ))}
                {prospecto.descripcion && (
                  <div className="detail-field">
                    <div className="detail-label">Descripción del asunto</div>
                    <div className="detail-value" style={{ whiteSpace: 'pre-wrap' }}>{prospecto.descripcion}</div>
                  </div>
                )}
                {prospecto.notas && (
                  <div className="detail-field">
                    <div className="detail-label">Notas internas</div>
                    <div className="detail-value" style={{ whiteSpace: 'pre-wrap' }}>{prospecto.notas}</div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-title" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}><Users size={16} />Equipo Asignado</div>
            {editing ? (
              <div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 10 }}>
                  Marca los abogados que forman parte del equipo de este prospecto (además del responsable principal).
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 280, overflowY: 'auto', padding: 8, border: '1px solid var(--border)', borderRadius: 6 }}>
                  {abogados.map(a => (
                    <label key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.85rem', padding: '4px 6px', borderRadius: 4 }}>
                      <input type="checkbox" checked={equipoEditando.includes(a.id)} onChange={() => toggleAbogadoEquipo(a.id)} style={{ accentColor: 'var(--navy)' }} />
                      {a.nombre}
                    </label>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                {prospecto.perfiles && (
                  <div style={{ padding: '8px 12px', background: 'var(--cream)', borderRadius: 6, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{prospecto.perfiles.nombre}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--gold)', fontWeight: 600 }}>Responsable principal</div>
                    </div>
                  </div>
                )}
                {equipo.length === 0 && !prospecto.perfiles ? (
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', padding: 16 }}>Sin equipo asignado</div>
                ) : equipo.map(e => (
                  <div key={e.id} style={{ padding: '8px 12px', background: 'var(--cream)', borderRadius: 6, marginBottom: 6, fontSize: '0.88rem' }}>
                    {e.perfiles?.nombre}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB ACTIVIDADES */}
      {tab === 'actividades' && (
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-title" style={{ marginBottom: 12 }}>Registrar nueva actividad</div>
            <form onSubmit={handleAgregarActividad}>
              <div className="form-grid">
                <div className="form-group" style={{ marginBottom: 8 }}>
                  <label className="form-label">Tipo</label>
                  <select className="form-select" value={actForm.tipo} onChange={e => setActForm({ ...actForm, tipo: e.target.value })}>
                    {Object.entries(TIPOS_ACTIVIDAD).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 8 }}>
                  <label className="form-label">Fecha</label>
                  <input className="form-input" type="date" value={actForm.fecha} onChange={e => setActForm({ ...actForm, fecha: e.target.value })} required />
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 8 }}>
                <label className="form-label">Notas</label>
                <textarea className="form-textarea" value={actForm.notas} onChange={e => setActForm({ ...actForm, notas: e.target.value })} placeholder="¿Qué se conversó? ¿Cuál fue el resultado?" style={{ minHeight: 60 }} />
              </div>
              <button type="submit" className="btn btn-primary btn-sm"><Plus size={14} />Registrar</button>
            </form>
          </div>

          <div className="card">
            <div className="card-title" style={{ marginBottom: 12 }}>Historial</div>
            {actividades.length === 0 ? (
              <div className="empty-state"><Activity size={36} /><p>Aún no hay actividades registradas</p></div>
            ) : (
              <div style={{ position: 'relative', paddingLeft: 28 }}>
                <div style={{ position: 'absolute', left: 10, top: 0, bottom: 0, width: 2, background: 'var(--border)' }}></div>
                {actividades.map((a, i) => (
                  <div key={a.id} style={{ position: 'relative', marginBottom: 16 }}>
                    <div style={{ position: 'absolute', left: -24, top: 6, width: 12, height: 12, borderRadius: '50%', background: i === 0 ? 'var(--gold)' : 'var(--border)', border: '2px solid white' }}></div>
                    <div style={{ background: 'var(--cream)', borderRadius: 8, padding: '10px 14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                        <div>
                          <span style={{ fontSize: '0.72rem', background: 'white', padding: '2px 8px', borderRadius: 4, fontWeight: 600, marginRight: 6 }}>{TIPOS_ACTIVIDAD[a.tipo] || a.tipo}</span>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{formatearFecha(a.fecha)}{a.perfiles?.nombre && ` · ${a.perfiles.nombre}`}</span>
                        </div>
                        <button className="btn-icon" onClick={() => handleEliminarActividad(a.id)} style={{ color: 'var(--text-muted)' }}><Trash2 size={13} /></button>
                      </div>
                      {a.notas && <div style={{ fontSize: '0.85rem', whiteSpace: 'pre-wrap', marginTop: 4 }}>{a.notas}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB RECORDATORIOS */}
      {tab === 'recordatorios' && (
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-title" style={{ marginBottom: 12 }}>Nuevo recordatorio</div>
            <form onSubmit={handleAgregarRecordatorio}>
              <div className="form-grid">
                <div className="form-group" style={{ marginBottom: 8 }}>
                  <label className="form-label">Fecha de recordatorio</label>
                  <input className="form-input" type="date" value={recForm.fecha} onChange={e => setRecForm({ ...recForm, fecha: e.target.value })} required />
                </div>
                <div className="form-group" style={{ marginBottom: 8 }}>
                  <label className="form-label">Nota / Próxima acción</label>
                  <input className="form-input" value={recForm.nota} onChange={e => setRecForm({ ...recForm, nota: e.target.value })} placeholder="Ej: Llamar para confirmar reunión" />
                </div>
              </div>
              <button type="submit" className="btn btn-primary btn-sm"><Plus size={14} />Agregar Recordatorio</button>
            </form>
          </div>

          <div className="card">
            <div className="card-title" style={{ marginBottom: 12 }}>Pendientes</div>
            {recordatoriosPendientes.length === 0 ? (
              <div className="empty-state"><Bell size={36} /><p>No hay recordatorios pendientes</p></div>
            ) : (
              recordatoriosPendientes.map(r => {
                const vencido = r.fecha <= hoy
                return (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderBottom: '1px solid var(--border-light)' }}>
                    <button className="btn-icon" onClick={() => toggleRecordatorio(r)} style={{ flexShrink: 0, color: vencido ? 'var(--danger)' : 'var(--text-muted)' }} title="Marcar como completado"><Check size={16} /></button>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: vencido ? 600 : 500, color: vencido ? 'var(--danger)' : 'var(--text-primary)' }}>{r.nota || '(Sin descripción)'}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
                        {vencido && '⚠️ '}
                        {formatearFecha(r.fecha)}
                        {r.perfiles?.nombre && ` · Creado por ${r.perfiles.nombre}`}
                      </div>
                    </div>
                    <button className="btn-icon" onClick={() => handleEliminarRecordatorio(r.id)} style={{ color: 'var(--text-muted)' }}><Trash2 size={13} /></button>
                  </div>
                )
              })
            )}
          </div>

          {recordatorios.filter(r => r.completado).length > 0 && (
            <div className="card" style={{ marginTop: 16 }}>
              <div className="card-title" style={{ marginBottom: 12, color: 'var(--text-muted)' }}>Completados</div>
              {recordatorios.filter(r => r.completado).map(r => (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderBottom: '1px solid var(--border-light)', opacity: 0.6 }}>
                  <button className="btn-icon" onClick={() => toggleRecordatorio(r)} style={{ flexShrink: 0, color: 'var(--success)' }} title="Reabrir"><Check size={16} /></button>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.85rem', textDecoration: 'line-through' }}>{r.nota || '(Sin descripción)'}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{formatearFecha(r.fecha)}</div>
                  </div>
                  <button className="btn-icon" onClick={() => handleEliminarRecordatorio(r.id)} style={{ color: 'var(--text-muted)' }}><Trash2 size={13} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL CONVERTIR A CLIENTE */}
      {showConvertirCliente && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowConvertirCliente(false)}>
          <div className="modal modal-lg">
            <div className="modal-header">
              <div className="modal-title"><UserPlus size={18} style={{ display: 'inline', marginRight: 8, verticalAlign: 'middle' }} />Convertir Prospecto en Cliente</div>
              <button className="btn-icon" onClick={() => setShowConvertirCliente(false)}>✕</button>
            </div>
            <form onSubmit={handleConvertirCliente}>
              <div className="modal-body">
                <div style={{ background: 'var(--cream)', padding: '10px 14px', borderRadius: 6, marginBottom: 16, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  Se creará un nuevo cliente con los datos del prospecto. Revisa y completa la información antes de confirmar.
                </div>
                <div className="form-group"><label className="form-label">Nombre / Razón social *</label><input className="form-input" value={clienteForm.nombre} onChange={e => setClienteForm({ ...clienteForm, nombre: e.target.value })} required /></div>
                <div className="form-grid">
                  <div className="form-group"><label className="form-label">Tipo</label><select className="form-select" value={clienteForm.tipo} onChange={e => setClienteForm({ ...clienteForm, tipo: e.target.value })}><option value="persona_natural">Persona Natural</option><option value="empresa">Empresa</option></select></div>
                  <div className="form-group"><label className="form-label">DNI / RUC</label><input className="form-input" value={clienteForm.documento_identidad} onChange={e => setClienteForm({ ...clienteForm, documento_identidad: e.target.value })} placeholder="Completar con el documento" /></div>
                </div>
                <div className="form-grid">
                  <div className="form-group"><label className="form-label">Email</label><input className="form-input" type="email" value={clienteForm.email} onChange={e => setClienteForm({ ...clienteForm, email: e.target.value })} /></div>
                  <div className="form-group"><label className="form-label">Teléfono</label><input className="form-input" value={clienteForm.telefono} onChange={e => setClienteForm({ ...clienteForm, telefono: e.target.value })} /></div>
                </div>
                <div className="form-group"><label className="form-label">Dirección</label><input className="form-input" value={clienteForm.direccion} onChange={e => setClienteForm({ ...clienteForm, direccion: e.target.value })} /></div>
                <div className="form-group"><label className="form-label">Notas</label><textarea className="form-textarea" value={clienteForm.notas} onChange={e => setClienteForm({ ...clienteForm, notas: e.target.value })} style={{ minHeight: 60 }} /></div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowConvertirCliente(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={convirtiendo}>{convirtiendo ? 'Creando...' : 'Crear Cliente'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
