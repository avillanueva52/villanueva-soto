import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { hoyEnLima, formatearFecha } from '../lib/dateUtils'
import { DollarSign, Award, Calendar, Plane, Plus, Edit2, Trash2, X, Save, History, Users } from 'lucide-react'

const TIPOS_BONO = { desempeno: 'Desempeño', gratificacion: 'Gratificación', fin_de_anio: 'Fin de Año', otro: 'Otro' }
const ROLES_LABELS = { socio_admin: 'Socio Admin', abogado_senior: 'Abogado Senior', abogado: 'Abogado', asistente: 'Asistente' }

function formatearMonto(monto, moneda = 'PEN') {
  if (monto == null) return '—'
  const simbolo = moneda === 'USD' ? '$' : 'S/'
  return `${simbolo} ${Number(monto).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function RRHH() {
  const { perfil } = useAuth()
  const [tab, setTab] = useState('sueldos')
  const [loading, setLoading] = useState(true)
  const [personas, setPersonas] = useState([])
  const [sueldos, setSueldos] = useState([])
  const [bonos, setBonos] = useState([])
  const [permisos, setPermisos] = useState([])
  const [vacaciones, setVacaciones] = useState([])

  // Modales
  const [showSueldoModal, setShowSueldoModal] = useState(false)
  const [showBonoModal, setShowBonoModal] = useState(false)
  const [showPermisoModal, setShowPermisoModal] = useState(false)
  const [showVacacionModal, setShowVacacionModal] = useState(false)
  const [showHistorialModal, setShowHistorialModal] = useState(null) // perfil_id

  const [editandoBono, setEditandoBono] = useState(null)
  const [editandoPermiso, setEditandoPermiso] = useState(null)
  const [editandoVacacion, setEditandoVacacion] = useState(null)
  const [saving, setSaving] = useState(false)

  const [sueldoForm, setSueldoForm] = useState({ perfil_id: '', monto: '', moneda: 'PEN', fecha_vigencia: hoyEnLima(), motivo: '', notas: '' })
  const [bonoForm, setBonoForm] = useState({ perfil_id: '', fecha: hoyEnLima(), tipo: 'desempeno', monto: '', moneda: 'PEN', motivo: '', notas: '' })
  const [permisoForm, setPermisoForm] = useState({ perfil_id: '', fecha: hoyEnLima(), dia_completo: true, hora_inicio: '', hora_fin: '', notas: '' })
  const [vacacionForm, setVacacionForm] = useState({ perfil_id: '', fecha_inicio: hoyEnLima(), fecha_fin: hoyEnLima(), notas: '' })

  const esSocioAdmin = perfil?.rol === 'socio_admin'

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [personasRes, sueldosRes, bonosRes, permisosRes, vacacionesRes] = await Promise.all([
      supabase.from('perfiles').select('id, nombre, rol, fecha_ingreso, activo').eq('activo', true).order('nombre'),
      supabase.from('sueldos_historial').select('*, persona:perfiles!sueldos_historial_perfil_id_fkey(id, nombre)').order('fecha_vigencia', { ascending: false }),
      supabase.from('bonos').select('*, persona:perfiles!bonos_perfil_id_fkey(id, nombre)').order('fecha', { ascending: false }),
      supabase.from('permisos').select('*, persona:perfiles!permisos_perfil_id_fkey(id, nombre)').order('fecha', { ascending: false }),
      supabase.from('vacaciones').select('*, persona:perfiles!vacaciones_perfil_id_fkey(id, nombre)').order('fecha_inicio', { ascending: false })
    ])
    setPersonas(personasRes.data || [])
    setSueldos(sueldosRes.data || [])
    setBonos(bonosRes.data || [])
    setPermisos(permisosRes.data || [])
    setVacaciones(vacacionesRes.data || [])
    setLoading(false)
  }

  // Calcula el sueldo actual de cada persona como el registro más reciente de sueldos_historial
  function sueldoActualDe(perfilId) {
    return sueldos.find(s => s.perfil_id === perfilId) // ya vienen ordenados por fecha desc
  }

  // ============ SUELDOS ============
  async function handleSaveSueldo(e) {
    e.preventDefault()
    if (!sueldoForm.perfil_id || !sueldoForm.monto) return
    setSaving(true)
    const { error } = await supabase.from('sueldos_historial').insert({
      perfil_id: sueldoForm.perfil_id,
      monto: parseFloat(sueldoForm.monto),
      moneda: sueldoForm.moneda,
      fecha_vigencia: sueldoForm.fecha_vigencia,
      motivo: sueldoForm.motivo || null,
      notas: sueldoForm.notas || null,
      registrado_por: perfil.id
    })
    if (error) { alert('Error: ' + error.message); setSaving(false); return }
    setShowSueldoModal(false)
    setSueldoForm({ perfil_id: '', monto: '', moneda: 'PEN', fecha_vigencia: hoyEnLima(), motivo: '', notas: '' })
    loadAll()
    setSaving(false)
  }

  async function handleEliminarSueldo(id) {
    if (!confirm('¿Eliminar este registro de sueldo?')) return
    await supabase.from('sueldos_historial').delete().eq('id', id)
    loadAll()
  }

  // ============ BONOS ============
  function abrirNuevoBono() {
    setEditandoBono(null)
    setBonoForm({ perfil_id: '', fecha: hoyEnLima(), tipo: 'desempeno', monto: '', moneda: 'PEN', motivo: '', notas: '' })
    setShowBonoModal(true)
  }

  function abrirEditarBono(b) {
    setEditandoBono(b.id)
    setBonoForm({ perfil_id: b.perfil_id, fecha: b.fecha, tipo: b.tipo, monto: b.monto, moneda: b.moneda, motivo: b.motivo || '', notas: b.notas || '' })
    setShowBonoModal(true)
  }

  async function handleSaveBono(e) {
    e.preventDefault()
    if (!bonoForm.perfil_id || !bonoForm.monto) return
    setSaving(true)
    const payload = {
      perfil_id: bonoForm.perfil_id,
      fecha: bonoForm.fecha,
      tipo: bonoForm.tipo,
      monto: parseFloat(bonoForm.monto),
      moneda: bonoForm.moneda,
      motivo: bonoForm.motivo || null,
      notas: bonoForm.notas || null
    }
    const { error } = editandoBono
      ? await supabase.from('bonos').update(payload).eq('id', editandoBono)
      : await supabase.from('bonos').insert({ ...payload, registrado_por: perfil.id })
    if (error) { alert('Error: ' + error.message); setSaving(false); return }
    setShowBonoModal(false)
    setEditandoBono(null)
    loadAll()
    setSaving(false)
  }

  async function handleEliminarBono(id) {
    if (!confirm('¿Eliminar este bono?')) return
    await supabase.from('bonos').delete().eq('id', id)
    loadAll()
  }

  // ============ PERMISOS ============
  function abrirNuevoPermiso() {
    setEditandoPermiso(null)
    setPermisoForm({ perfil_id: '', fecha: hoyEnLima(), dia_completo: true, hora_inicio: '', hora_fin: '', notas: '' })
    setShowPermisoModal(true)
  }

  function abrirEditarPermiso(p) {
    setEditandoPermiso(p.id)
    setPermisoForm({ perfil_id: p.perfil_id, fecha: p.fecha, dia_completo: p.dia_completo, hora_inicio: p.hora_inicio || '', hora_fin: p.hora_fin || '', notas: p.notas || '' })
    setShowPermisoModal(true)
  }

  async function handleSavePermiso(e) {
    e.preventDefault()
    if (!permisoForm.perfil_id) return
    setSaving(true)
    const payload = {
      perfil_id: permisoForm.perfil_id,
      fecha: permisoForm.fecha,
      dia_completo: permisoForm.dia_completo,
      hora_inicio: permisoForm.dia_completo ? null : (permisoForm.hora_inicio || null),
      hora_fin: permisoForm.dia_completo ? null : (permisoForm.hora_fin || null),
      notas: permisoForm.notas || null
    }
    const { error } = editandoPermiso
      ? await supabase.from('permisos').update(payload).eq('id', editandoPermiso)
      : await supabase.from('permisos').insert({ ...payload, registrado_por: perfil.id })
    if (error) { alert('Error: ' + error.message); setSaving(false); return }
    setShowPermisoModal(false)
    setEditandoPermiso(null)
    loadAll()
    setSaving(false)
  }

  async function handleEliminarPermiso(id) {
    if (!confirm('¿Eliminar este permiso?')) return
    await supabase.from('permisos').delete().eq('id', id)
    loadAll()
  }

  // ============ VACACIONES ============
  function abrirNuevaVacacion() {
    setEditandoVacacion(null)
    setVacacionForm({ perfil_id: '', fecha_inicio: hoyEnLima(), fecha_fin: hoyEnLima(), notas: '' })
    setShowVacacionModal(true)
  }

  function abrirEditarVacacion(v) {
    setEditandoVacacion(v.id)
    setVacacionForm({ perfil_id: v.perfil_id, fecha_inicio: v.fecha_inicio, fecha_fin: v.fecha_fin, notas: v.notas || '' })
    setShowVacacionModal(true)
  }

  async function handleSaveVacacion(e) {
    e.preventDefault()
    if (!vacacionForm.perfil_id) return
    if (vacacionForm.fecha_fin < vacacionForm.fecha_inicio) { alert('La fecha fin no puede ser anterior a la fecha inicio'); return }
    setSaving(true)
    const payload = {
      perfil_id: vacacionForm.perfil_id,
      fecha_inicio: vacacionForm.fecha_inicio,
      fecha_fin: vacacionForm.fecha_fin,
      notas: vacacionForm.notas || null
    }
    const { error } = editandoVacacion
      ? await supabase.from('vacaciones').update(payload).eq('id', editandoVacacion)
      : await supabase.from('vacaciones').insert({ ...payload, registrado_por: perfil.id })
    if (error) { alert('Error: ' + error.message); setSaving(false); return }
    setShowVacacionModal(false)
    setEditandoVacacion(null)
    loadAll()
    setSaving(false)
  }

  async function handleEliminarVacacion(id) {
    if (!confirm('¿Eliminar este registro de vacaciones?')) return
    await supabase.from('vacaciones').delete().eq('id', id)
    loadAll()
  }

  function diasVacacion(inicio, fin) {
    const d1 = new Date(inicio)
    const d2 = new Date(fin)
    return Math.floor((d2 - d1) / (1000 * 60 * 60 * 24)) + 1
  }

  if (loading) return <div className="loading-page"><div className="spinner"></div></div>

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Recursos Humanos</div>
          <div className="page-subtitle">Gestión interna de sueldos, bonos, permisos y vacaciones del estudio</div>
        </div>
      </div>

      <div className="tabs">
        <div className={`tab ${tab === 'sueldos' ? 'active' : ''}`} onClick={() => setTab('sueldos')}><DollarSign size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />Sueldos</div>
        <div className={`tab ${tab === 'bonos' ? 'active' : ''}`} onClick={() => setTab('bonos')}><Award size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />Bonos ({bonos.length})</div>
        <div className={`tab ${tab === 'permisos' ? 'active' : ''}`} onClick={() => setTab('permisos')}><Calendar size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />Permisos ({permisos.length})</div>
        <div className={`tab ${tab === 'vacaciones' ? 'active' : ''}`} onClick={() => setTab('vacaciones')}><Plane size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />Vacaciones ({vacaciones.length})</div>
      </div>

      {/* ===== TAB SUELDOS ===== */}
      {tab === 'sueldos' && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">Sueldos del Personal</div>
            <button className="btn btn-primary btn-sm" onClick={() => setShowSueldoModal(true)}><Plus size={14} />Registrar / Actualizar Sueldo</button>
          </div>
          {personas.length === 0 ? (
            <div className="empty-state"><Users size={36} /><p>No hay personas activas en el sistema</p></div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Persona</th>
                    <th>Rol</th>
                    <th>Sueldo Actual</th>
                    <th>Última Actualización</th>
                    <th>Fecha de Ingreso</th>
                    <th style={{ width: 100 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {personas.map(p => {
                    const sueldoActual = sueldoActualDe(p.id)
                    return (
                      <tr key={p.id}>
                        <td style={{ fontWeight: 600 }}>{p.nombre}</td>
                        <td><span style={{ fontSize: '0.72rem', background: 'var(--cream)', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>{ROLES_LABELS[p.rol] || p.rol}</span></td>
                        <td style={{ fontWeight: 600, color: sueldoActual ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                          {sueldoActual ? formatearMonto(sueldoActual.monto, sueldoActual.moneda) : 'Sin registro'}
                        </td>
                        <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{sueldoActual ? formatearFecha(sueldoActual.fecha_vigencia) : '—'}</td>
                        <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{p.fecha_ingreso ? formatearFecha(p.fecha_ingreso) : '—'}</td>
                        <td>
                          <button className="btn-icon" onClick={() => setShowHistorialModal(p.id)} title="Ver historial de sueldos"><History size={14} /></button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ===== TAB BONOS ===== */}
      {tab === 'bonos' && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">Bonos Registrados</div>
            <button className="btn btn-primary btn-sm" onClick={abrirNuevoBono}><Plus size={14} />Nuevo Bono</button>
          </div>
          {bonos.length === 0 ? (
            <div className="empty-state"><Award size={36} /><p>No hay bonos registrados</p></div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Fecha</th><th>Persona</th><th>Tipo</th><th>Monto</th><th>Motivo</th><th style={{ width: 80 }}></th></tr></thead>
                <tbody>
                  {bonos.map(b => (
                    <tr key={b.id}>
                      <td style={{ fontSize: '0.85rem' }}>{formatearFecha(b.fecha)}</td>
                      <td style={{ fontWeight: 600 }}>{b.persona?.nombre}</td>
                      <td><span style={{ fontSize: '0.72rem', background: 'var(--gold-light)', color: 'var(--navy)', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>{TIPOS_BONO[b.tipo]}</span></td>
                      <td style={{ fontWeight: 600 }}>{formatearMonto(b.monto, b.moneda)}</td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{b.motivo || '—'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                          <button className="btn-icon" onClick={() => abrirEditarBono(b)} title="Editar"><Edit2 size={13} /></button>
                          {esSocioAdmin && <button className="btn-icon" onClick={() => handleEliminarBono(b.id)} style={{ color: 'var(--danger)' }} title="Eliminar"><Trash2 size={13} /></button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ===== TAB PERMISOS ===== */}
      {tab === 'permisos' && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">Permisos Registrados</div>
            <button className="btn btn-primary btn-sm" onClick={abrirNuevoPermiso}><Plus size={14} />Nuevo Permiso</button>
          </div>
          {permisos.length === 0 ? (
            <div className="empty-state"><Calendar size={36} /><p>No hay permisos registrados</p></div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Fecha</th><th>Persona</th><th>Tipo</th><th>Horario</th><th>Notas</th><th style={{ width: 80 }}></th></tr></thead>
                <tbody>
                  {permisos.map(p => (
                    <tr key={p.id}>
                      <td style={{ fontSize: '0.85rem' }}>{formatearFecha(p.fecha)}</td>
                      <td style={{ fontWeight: 600 }}>{p.persona?.nombre}</td>
                      <td><span style={{ fontSize: '0.72rem', background: 'var(--cream)', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>{p.dia_completo ? 'Día completo' : 'Por horas'}</span></td>
                      <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{p.dia_completo ? 'Todo el día' : `${p.hora_inicio?.slice(0, 5) || '?'} - ${p.hora_fin?.slice(0, 5) || '?'}`}</td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.notas || '—'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                          <button className="btn-icon" onClick={() => abrirEditarPermiso(p)} title="Editar"><Edit2 size={13} /></button>
                          {esSocioAdmin && <button className="btn-icon" onClick={() => handleEliminarPermiso(p.id)} style={{ color: 'var(--danger)' }} title="Eliminar"><Trash2 size={13} /></button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ===== TAB VACACIONES ===== */}
      {tab === 'vacaciones' && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">Vacaciones Registradas</div>
            <button className="btn btn-primary btn-sm" onClick={abrirNuevaVacacion}><Plus size={14} />Nuevas Vacaciones</button>
          </div>
          {vacaciones.length === 0 ? (
            <div className="empty-state"><Plane size={36} /><p>No hay vacaciones registradas</p></div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Persona</th><th>Inicio</th><th>Fin</th><th>Días</th><th>Notas</th><th style={{ width: 80 }}></th></tr></thead>
                <tbody>
                  {vacaciones.map(v => (
                    <tr key={v.id}>
                      <td style={{ fontWeight: 600 }}>{v.persona?.nombre}</td>
                      <td style={{ fontSize: '0.85rem' }}>{formatearFecha(v.fecha_inicio)}</td>
                      <td style={{ fontSize: '0.85rem' }}>{formatearFecha(v.fecha_fin)}</td>
                      <td><span style={{ fontSize: '0.75rem', background: 'var(--gold-light)', color: 'var(--navy)', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>{diasVacacion(v.fecha_inicio, v.fecha_fin)} días</span></td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.notas || '—'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                          <button className="btn-icon" onClick={() => abrirEditarVacacion(v)} title="Editar"><Edit2 size={13} /></button>
                          {esSocioAdmin && <button className="btn-icon" onClick={() => handleEliminarVacacion(v.id)} style={{ color: 'var(--danger)' }} title="Eliminar"><Trash2 size={13} /></button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ===== MODAL SUELDO ===== */}
      {showSueldoModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowSueldoModal(false)}>
          <div className="modal">
            <div className="modal-header"><div className="modal-title">Registrar / Actualizar Sueldo</div><button className="btn-icon" onClick={() => setShowSueldoModal(false)}>✕</button></div>
            <form onSubmit={handleSaveSueldo}>
              <div className="modal-body">
                <div style={{ background: 'var(--cream)', padding: '8px 12px', borderRadius: 6, marginBottom: 14, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Esto registra un nuevo monto vigente desde la fecha indicada. El historial se conserva.
                </div>
                <div className="form-group">
                  <label className="form-label">Persona *</label>
                  <select className="form-select" value={sueldoForm.perfil_id} onChange={e => setSueldoForm({ ...sueldoForm, perfil_id: e.target.value })} required>
                    <option value="">Selecciona...</option>
                    {personas.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </div>
                <div className="form-grid">
                  <div className="form-group"><label className="form-label">Monto *</label><input className="form-input" type="number" step="0.01" min="0" value={sueldoForm.monto} onChange={e => setSueldoForm({ ...sueldoForm, monto: e.target.value })} required /></div>
                  <div className="form-group"><label className="form-label">Moneda *</label><select className="form-select" value={sueldoForm.moneda} onChange={e => setSueldoForm({ ...sueldoForm, moneda: e.target.value })}><option value="PEN">PEN (S/)</option><option value="USD">USD ($)</option></select></div>
                  <div className="form-group"><label className="form-label">Fecha de Vigencia *</label><input className="form-input" type="date" value={sueldoForm.fecha_vigencia} onChange={e => setSueldoForm({ ...sueldoForm, fecha_vigencia: e.target.value })} required /></div>
                </div>
                <div className="form-group"><label className="form-label">Motivo</label><input className="form-input" value={sueldoForm.motivo} onChange={e => setSueldoForm({ ...sueldoForm, motivo: e.target.value })} placeholder="Ej: aumento anual, ajuste, ingreso..." /></div>
                <div className="form-group"><label className="form-label">Notas</label><textarea className="form-textarea" value={sueldoForm.notas} onChange={e => setSueldoForm({ ...sueldoForm, notas: e.target.value })} style={{ minHeight: 50 }} /></div>
              </div>
              <div className="modal-footer"><button type="button" className="btn btn-outline" onClick={() => setShowSueldoModal(false)}>Cancelar</button><button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button></div>
            </form>
          </div>
        </div>
      )}

      {/* ===== MODAL HISTORIAL DE SUELDOS ===== */}
      {showHistorialModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowHistorialModal(null)}>
          <div className="modal modal-lg">
            <div className="modal-header"><div className="modal-title">Historial de Sueldos — {personas.find(p => p.id === showHistorialModal)?.nombre}</div><button className="btn-icon" onClick={() => setShowHistorialModal(null)}>✕</button></div>
            <div className="modal-body">
              {sueldos.filter(s => s.perfil_id === showHistorialModal).length === 0 ? (
                <div className="empty-state"><History size={36} /><p>Sin registros de sueldo</p></div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Fecha Vigencia</th><th>Monto</th><th>Motivo</th><th>Notas</th>{esSocioAdmin && <th style={{ width: 50 }}></th>}</tr></thead>
                    <tbody>
                      {sueldos.filter(s => s.perfil_id === showHistorialModal).map(s => (
                        <tr key={s.id}>
                          <td style={{ fontSize: '0.85rem' }}>{formatearFecha(s.fecha_vigencia)}</td>
                          <td style={{ fontWeight: 600 }}>{formatearMonto(s.monto, s.moneda)}</td>
                          <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{s.motivo || '—'}</td>
                          <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{s.notas || '—'}</td>
                          {esSocioAdmin && <td><button className="btn-icon" onClick={() => handleEliminarSueldo(s.id)} style={{ color: 'var(--danger)' }} title="Eliminar"><Trash2 size={13} /></button></td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="modal-footer"><button type="button" className="btn btn-outline" onClick={() => setShowHistorialModal(null)}>Cerrar</button></div>
          </div>
        </div>
      )}

      {/* ===== MODAL BONO ===== */}
      {showBonoModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowBonoModal(false)}>
          <div className="modal">
            <div className="modal-header"><div className="modal-title">{editandoBono ? 'Editar Bono' : 'Nuevo Bono'}</div><button className="btn-icon" onClick={() => setShowBonoModal(false)}>✕</button></div>
            <form onSubmit={handleSaveBono}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Persona *</label>
                    <select className="form-select" value={bonoForm.perfil_id} onChange={e => setBonoForm({ ...bonoForm, perfil_id: e.target.value })} required>
                      <option value="">Selecciona...</option>
                      {personas.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </select>
                  </div>
                  <div className="form-group"><label className="form-label">Fecha *</label><input className="form-input" type="date" value={bonoForm.fecha} onChange={e => setBonoForm({ ...bonoForm, fecha: e.target.value })} required /></div>
                </div>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Tipo *</label>
                    <select className="form-select" value={bonoForm.tipo} onChange={e => setBonoForm({ ...bonoForm, tipo: e.target.value })}>
                      {Object.entries(TIPOS_BONO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div className="form-group"><label className="form-label">Monto *</label><input className="form-input" type="number" step="0.01" min="0" value={bonoForm.monto} onChange={e => setBonoForm({ ...bonoForm, monto: e.target.value })} required /></div>
                  <div className="form-group"><label className="form-label">Moneda *</label><select className="form-select" value={bonoForm.moneda} onChange={e => setBonoForm({ ...bonoForm, moneda: e.target.value })}><option value="PEN">PEN (S/)</option><option value="USD">USD ($)</option></select></div>
                </div>
                <div className="form-group"><label className="form-label">Motivo</label><input className="form-input" value={bonoForm.motivo} onChange={e => setBonoForm({ ...bonoForm, motivo: e.target.value })} placeholder="Detalle del bono" /></div>
                <div className="form-group"><label className="form-label">Notas</label><textarea className="form-textarea" value={bonoForm.notas} onChange={e => setBonoForm({ ...bonoForm, notas: e.target.value })} style={{ minHeight: 50 }} /></div>
              </div>
              <div className="modal-footer"><button type="button" className="btn btn-outline" onClick={() => setShowBonoModal(false)}>Cancelar</button><button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button></div>
            </form>
          </div>
        </div>
      )}

      {/* ===== MODAL PERMISO ===== */}
      {showPermisoModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowPermisoModal(false)}>
          <div className="modal">
            <div className="modal-header"><div className="modal-title">{editandoPermiso ? 'Editar Permiso' : 'Nuevo Permiso'}</div><button className="btn-icon" onClick={() => setShowPermisoModal(false)}>✕</button></div>
            <form onSubmit={handleSavePermiso}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Persona *</label>
                    <select className="form-select" value={permisoForm.perfil_id} onChange={e => setPermisoForm({ ...permisoForm, perfil_id: e.target.value })} required>
                      <option value="">Selecciona...</option>
                      {personas.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </select>
                  </div>
                  <div className="form-group"><label className="form-label">Fecha *</label><input className="form-input" type="date" value={permisoForm.fecha} onChange={e => setPermisoForm({ ...permisoForm, fecha: e.target.value })} required /></div>
                </div>
                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.9rem', padding: '8px 12px', background: 'var(--cream)', borderRadius: 6 }}>
                    <input type="checkbox" checked={permisoForm.dia_completo} onChange={e => setPermisoForm({ ...permisoForm, dia_completo: e.target.checked })} style={{ accentColor: 'var(--navy)' }} />
                    Día completo
                  </label>
                </div>
                {!permisoForm.dia_completo && (
                  <div className="form-grid">
                    <div className="form-group"><label className="form-label">Hora inicio</label><input className="form-input" type="time" value={permisoForm.hora_inicio} onChange={e => setPermisoForm({ ...permisoForm, hora_inicio: e.target.value })} /></div>
                    <div className="form-group"><label className="form-label">Hora fin</label><input className="form-input" type="time" value={permisoForm.hora_fin} onChange={e => setPermisoForm({ ...permisoForm, hora_fin: e.target.value })} /></div>
                  </div>
                )}
                <div className="form-group"><label className="form-label">Notas</label><textarea className="form-textarea" value={permisoForm.notas} onChange={e => setPermisoForm({ ...permisoForm, notas: e.target.value })} placeholder="Motivo del permiso, detalles..." style={{ minHeight: 60 }} /></div>
              </div>
              <div className="modal-footer"><button type="button" className="btn btn-outline" onClick={() => setShowPermisoModal(false)}>Cancelar</button><button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button></div>
            </form>
          </div>
        </div>
      )}

      {/* ===== MODAL VACACIONES ===== */}
      {showVacacionModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowVacacionModal(false)}>
          <div className="modal">
            <div className="modal-header"><div className="modal-title">{editandoVacacion ? 'Editar Vacaciones' : 'Nuevas Vacaciones'}</div><button className="btn-icon" onClick={() => setShowVacacionModal(false)}>✕</button></div>
            <form onSubmit={handleSaveVacacion}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Persona *</label>
                  <select className="form-select" value={vacacionForm.perfil_id} onChange={e => setVacacionForm({ ...vacacionForm, perfil_id: e.target.value })} required>
                    <option value="">Selecciona...</option>
                    {personas.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </div>
                <div className="form-grid">
                  <div className="form-group"><label className="form-label">Fecha Inicio *</label><input className="form-input" type="date" value={vacacionForm.fecha_inicio} onChange={e => setVacacionForm({ ...vacacionForm, fecha_inicio: e.target.value })} required /></div>
                  <div className="form-group"><label className="form-label">Fecha Fin *</label><input className="form-input" type="date" value={vacacionForm.fecha_fin} onChange={e => setVacacionForm({ ...vacacionForm, fecha_fin: e.target.value })} required /></div>
                </div>
                {vacacionForm.fecha_inicio && vacacionForm.fecha_fin && vacacionForm.fecha_fin >= vacacionForm.fecha_inicio && (
                  <div style={{ background: 'var(--gold-light)', padding: '6px 12px', borderRadius: 6, marginBottom: 14, fontSize: '0.85rem', textAlign: 'center', fontWeight: 600 }}>
                    {diasVacacion(vacacionForm.fecha_inicio, vacacionForm.fecha_fin)} días
                  </div>
                )}
                <div className="form-group"><label className="form-label">Notas</label><textarea className="form-textarea" value={vacacionForm.notas} onChange={e => setVacacionForm({ ...vacacionForm, notas: e.target.value })} style={{ minHeight: 60 }} /></div>
              </div>
              <div className="modal-footer"><button type="button" className="btn btn-outline" onClick={() => setShowVacacionModal(false)}>Cancelar</button><button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
