import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { hoyEnLima, formatearFecha } from '../lib/dateUtils'
import { Plus, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Edit2, Trash2, X, Save, Users, Briefcase, Clock } from 'lucide-react'

const TIPO_LABELS = { audiencia: 'Audiencia', reunion: 'Reunión', vencimiento_procesal: 'Vencimiento Procesal', plazo_administrativo: 'Plazo Administrativo', otro: 'Otro' }
const TIPO_COLORS = { audiencia: '#c81e1e', reunion: '#1a56db', vencimiento_procesal: '#d97706', plazo_administrativo: '#7e3af2', otro: '#057a55' }
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

// Convierte un Date a string YYYY-MM-DD en hora local (sin conversión UTC)
function fechaToString(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formInicial(fechaInicial) {
  return {
    titulo: '',
    descripcion: '',
    tipo: 'audiencia',
    fecha: fechaInicial || hoyEnLima(),
    hora_inicio: '',
    hora_fin: '',
    caso_id: '',
    todo_el_estudio: false,
    abogados_ids: []
  }
}

export default function Calendario() {
  const { perfil } = useAuth()
  const navigate = useNavigate()
  const [eventos, setEventos] = useState([])
  const [casos, setCasos] = useState([])
  const [abogados, setAbogados] = useState([])
  const [mes, setMes] = useState(new Date())
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [form, setForm] = useState(formInicial())
  const [saving, setSaving] = useState(false)
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroMio, setFiltroMio] = useState(false)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [eventosRes, casosRes, abogadosRes, asignacionesRes] = await Promise.all([
      supabase.from('eventos_calendario').select('*, casos(id, titulo, numero_expediente), perfiles!eventos_calendario_creado_por_fkey(id, nombre)').order('fecha').order('hora_inicio'),
      supabase.from('casos').select('id, titulo, numero_expediente').in('estado', ['activo', 'suspendido']).order('numero_expediente'),
      supabase.from('perfiles').select('id, nombre, rol').eq('activo', true).order('nombre'),
      supabase.from('eventos_asignaciones').select('evento_id, perfil_id, perfiles(id, nombre)')
    ])

    const asignaciones = asignacionesRes.data || []
    const eventosConAsignados = (eventosRes.data || []).map(ev => ({
      ...ev,
      asignados: asignaciones.filter(a => a.evento_id === ev.id).map(a => a.perfiles).filter(Boolean)
    }))

    setEventos(eventosConAsignados)
    setCasos(casosRes.data || [])
    setAbogados(abogadosRes.data || [])
    setLoading(false)
  }

  function puedeEliminar(evento) {
    if (!perfil) return false
    return evento.creado_por === perfil.id || perfil.rol === 'socio_admin'
  }

  function esMiEvento(evento) {
    if (!perfil) return false
    if (evento.todo_el_estudio) return true
    if (evento.creado_por === perfil.id) return true
    return evento.asignados?.some(a => a.id === perfil.id)
  }

  const eventosFiltrados = eventos.filter(ev => {
    if (filtroTipo && ev.tipo !== filtroTipo) return false
    if (filtroMio && !esMiEvento(ev)) return false
    return true
  })

  // GRID DEL MES: 42 celdas (6 semanas) empezando en lunes
  function obtenerGridMes() {
    const primerDia = new Date(mes.getFullYear(), mes.getMonth(), 1)
    const diaSemanaPrimero = (primerDia.getDay() + 6) % 7 // 0=lunes, 6=domingo
    const inicio = new Date(primerDia)
    inicio.setDate(1 - diaSemanaPrimero)
    const hoyStr = hoyEnLima()
    const dias = []
    for (let i = 0; i < 42; i++) {
      const d = new Date(inicio)
      d.setDate(inicio.getDate() + i)
      const fechaStr = fechaToString(d)
      dias.push({
        fecha: d,
        fechaStr,
        esDelMes: d.getMonth() === mes.getMonth(),
        esHoy: fechaStr === hoyStr,
        eventos: eventosFiltrados.filter(ev => ev.fecha === fechaStr)
      })
    }
    return dias
  }

  const grid = obtenerGridMes()
  const hoyStr = hoyEnLima()
  const proximosEventos = eventosFiltrados
    .filter(ev => ev.fecha >= hoyStr)
    .slice(0, 15)

  function navegarMes(delta) {
    const nuevoMes = new Date(mes)
    nuevoMes.setMonth(nuevoMes.getMonth() + delta)
    setMes(nuevoMes)
  }

  function irAHoy() {
    setMes(new Date())
  }

  function abrirNuevoEvento(fechaPreseleccionada = null) {
    setEditandoId(null)
    setForm(formInicial(fechaPreseleccionada))
    setShowModal(true)
  }

  function abrirEditar(evento) {
    setEditandoId(evento.id)
    setForm({
      titulo: evento.titulo || '',
      descripcion: evento.descripcion || '',
      tipo: evento.tipo || 'audiencia',
      fecha: evento.fecha || hoyEnLima(),
      hora_inicio: evento.hora_inicio || '',
      hora_fin: evento.hora_fin || '',
      caso_id: evento.caso_id || '',
      todo_el_estudio: evento.todo_el_estudio || false,
      abogados_ids: (evento.asignados || []).map(a => a.id)
    })
    setShowModal(true)
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.titulo.trim()) return
    setSaving(true)

    const payload = {
      titulo: form.titulo.trim(),
      descripcion: form.descripcion || null,
      tipo: form.tipo,
      fecha: form.fecha,
      hora_inicio: form.hora_inicio || null,
      hora_fin: form.hora_fin || null,
      caso_id: form.caso_id || null,
      todo_el_estudio: form.todo_el_estudio
    }

    let eventoId
    if (editandoId) {
      await supabase.from('eventos_calendario').update({ ...payload, actualizado_en: new Date().toISOString() }).eq('id', editandoId)
      eventoId = editandoId
      // Borrar asignaciones anteriores
      await supabase.from('eventos_asignaciones').delete().eq('evento_id', editandoId)
    } else {
      const { data, error } = await supabase.from('eventos_calendario').insert({ ...payload, creado_por: perfil.id }).select().single()
      if (error) { alert('Error al guardar: ' + error.message); setSaving(false); return }
      eventoId = data.id
    }

    // Insertar asignaciones (solo si NO es para todo el estudio)
    if (!form.todo_el_estudio && form.abogados_ids.length > 0) {
      const inserts = form.abogados_ids.map(perfil_id => ({ evento_id: eventoId, perfil_id }))
      await supabase.from('eventos_asignaciones').insert(inserts)
    }

    setShowModal(false)
    setForm(formInicial())
    setEditandoId(null)
    loadAll()
    setSaving(false)
  }

  async function handleDelete(evento) {
    if (!confirm(`¿Eliminar el evento "${evento.titulo}"?`)) return
    await supabase.from('eventos_calendario').delete().eq('id', evento.id)
    loadAll()
  }

  function toggleAbogadoForm(id) {
    setForm(f => ({
      ...f,
      abogados_ids: f.abogados_ids.includes(id) ? f.abogados_ids.filter(x => x !== id) : [...f.abogados_ids, id]
    }))
  }

  if (loading) return <div className="loading-page"><div className="spinner"></div></div>

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Calendario</div>
          <div className="page-subtitle">Audiencias, reuniones y vencimientos del estudio</div>
        </div>
        <button className="btn btn-primary" onClick={() => abrirNuevoEvento()}><Plus size={16} />Nuevo Evento</button>
      </div>

      <div className="filter-bar">
        <button className="btn btn-outline btn-sm" onClick={() => navegarMes(-1)}><ChevronLeft size={14} />Anterior</button>
        <button className="btn btn-outline btn-sm" onClick={irAHoy}>Hoy</button>
        <button className="btn btn-outline btn-sm" onClick={() => navegarMes(1)}>Siguiente<ChevronRight size={14} /></button>
        <div style={{ fontWeight: 700, fontSize: '1.05rem', marginLeft: 8, fontFamily: 'var(--font-display)' }}>
          {MESES[mes.getMonth()]} {mes.getFullYear()}
        </div>
        <div style={{ flex: 1 }}></div>
        <select className="form-select" style={{ width: 'auto' }} value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
          <option value="">Todos los tipos</option>
          {Object.entries(TIPO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', cursor: 'pointer', userSelect: 'none' }}>
          <input type="checkbox" checked={filtroMio} onChange={e => setFiltroMio(e.target.checked)} style={{ accentColor: 'var(--navy)' }} />
          Solo míos
        </label>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16 }}>
        {/* CUADRÍCULA DEL MES */}
        <div className="card" style={{ padding: 12 }}>
          {/* Encabezado días de la semana */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
            {DIAS_SEMANA.map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', padding: '4px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{d}</div>
            ))}
          </div>

          {/* Celdas del mes */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
            {grid.map((dia, idx) => (
              <div
                key={idx}
                onClick={() => dia.esDelMes && abrirNuevoEvento(dia.fechaStr)}
                style={{
                  minHeight: 90,
                  background: dia.esHoy ? 'var(--gold-light)' : (dia.esDelMes ? 'white' : 'var(--cream)'),
                  border: dia.esHoy ? '2px solid var(--gold)' : '1px solid var(--border-light)',
                  borderRadius: 6,
                  padding: 6,
                  cursor: dia.esDelMes ? 'pointer' : 'default',
                  opacity: dia.esDelMes ? 1 : 0.5,
                  transition: 'background 0.1s'
                }}
                onMouseEnter={e => { if (dia.esDelMes && !dia.esHoy) e.currentTarget.style.background = 'var(--cream)' }}
                onMouseLeave={e => { if (dia.esDelMes && !dia.esHoy) e.currentTarget.style.background = 'white' }}
              >
                <div style={{ fontSize: '0.78rem', fontWeight: dia.esHoy ? 700 : 600, color: dia.esHoy ? 'var(--navy)' : (dia.esDelMes ? 'var(--text-primary)' : 'var(--text-muted)'), marginBottom: 4 }}>
                  {dia.fecha.getDate()}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {dia.eventos.slice(0, 3).map(ev => (
                    <div
                      key={ev.id}
                      onClick={(e) => { e.stopPropagation(); abrirEditar(ev) }}
                      title={ev.titulo + (ev.hora_inicio ? ` (${ev.hora_inicio.slice(0, 5)})` : '')}
                      style={{
                        background: TIPO_COLORS[ev.tipo] || '#666',
                        color: 'white',
                        fontSize: '0.68rem',
                        padding: '2px 5px',
                        borderRadius: 3,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        cursor: 'pointer',
                        fontWeight: 500
                      }}
                    >
                      {ev.hora_inicio && <span style={{ opacity: 0.85, marginRight: 4 }}>{ev.hora_inicio.slice(0, 5)}</span>}
                      {ev.titulo}
                    </div>
                  ))}
                  {dia.eventos.length > 3 && (
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600, paddingLeft: 4 }}>
                      +{dia.eventos.length - 3} más
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* LISTA DE PRÓXIMOS EVENTOS */}
        <div className="card">
          <div className="card-title" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <CalendarIcon size={16} />Próximos Eventos
          </div>
          {proximosEventos.length === 0 ? (
            <div className="empty-state" style={{ padding: 20 }}><CalendarIcon size={28} /><p style={{ fontSize: '0.85rem' }}>No hay eventos próximos</p></div>
          ) : (
            <div>
              {proximosEventos.map(ev => (
                <div
                  key={ev.id}
                  onClick={() => abrirEditar(ev)}
                  style={{ padding: '10px 8px', margin: '0 -8px', borderBottom: '1px solid var(--border-light)', cursor: 'pointer', borderRadius: 4, transition: 'background 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--cream)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: TIPO_COLORS[ev.tipo] }}></div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>{TIPO_LABELS[ev.tipo]}</span>
                  </div>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: 2 }}>{ev.titulo}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {formatearFecha(ev.fecha, { weekday: 'short', day: 'numeric', month: 'short' })}
                    {ev.hora_inicio && ` · ${ev.hora_inicio.slice(0, 5)}${ev.hora_fin ? ' - ' + ev.hora_fin.slice(0, 5) : ''}`}
                  </div>
                  {ev.casos && (
                    <div style={{ fontSize: '0.7rem', color: 'var(--navy)', fontFamily: 'monospace', marginTop: 2 }}>{ev.casos.numero_expediente}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* MODAL CREAR / EDITAR */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal modal-lg">
            <div className="modal-header">
              <div className="modal-title">{editandoId ? 'Editar Evento' : 'Nuevo Evento'}</div>
              <button className="btn-icon" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Título *</label>
                  <input className="form-input" value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} placeholder="Ej: Audiencia de pruebas EXP-2024-001" required />
                </div>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Tipo *</label>
                    <select className="form-select" value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}>
                      {Object.entries(TIPO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Caso vinculado (opcional)</label>
                    <select className="form-select" value={form.caso_id} onChange={e => setForm({ ...form, caso_id: e.target.value })}>
                      <option value="">Sin caso (evento general)</option>
                      {casos.map(c => <option key={c.id} value={c.id}>{c.numero_expediente} — {c.titulo}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Fecha *</label>
                    <input className="form-input" type="date" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Hora inicio (opcional)</label>
                    <input className="form-input" type="time" value={form.hora_inicio} onChange={e => setForm({ ...form, hora_inicio: e.target.value, hora_fin: e.target.value ? form.hora_fin : '' })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Hora fin (opcional)</label>
                    <input className="form-input" type="time" value={form.hora_fin} onChange={e => setForm({ ...form, hora_fin: e.target.value })} disabled={!form.hora_inicio} />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Asignación</label>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 10, padding: '8px 12px', background: 'var(--cream)', borderRadius: 6 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.85rem' }}>
                      <input type="radio" checked={!form.todo_el_estudio} onChange={() => setForm({ ...form, todo_el_estudio: false })} style={{ accentColor: 'var(--navy)' }} />
                      Abogados específicos
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.85rem' }}>
                      <input type="radio" checked={form.todo_el_estudio} onChange={() => setForm({ ...form, todo_el_estudio: true, abogados_ids: [] })} style={{ accentColor: 'var(--navy)' }} />
                      Todo el estudio
                    </label>
                  </div>
                  {!form.todo_el_estudio && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 4, maxHeight: 180, overflowY: 'auto', padding: 8, border: '1px solid var(--border)', borderRadius: 6 }}>
                      {abogados.map(a => (
                        <label key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.85rem', padding: '4px 6px', borderRadius: 4 }}>
                          <input type="checkbox" checked={form.abogados_ids.includes(a.id)} onChange={() => toggleAbogadoForm(a.id)} style={{ accentColor: 'var(--navy)' }} />
                          {a.nombre}
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Descripción / Notas</label>
                  <textarea className="form-textarea" value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} placeholder="Detalles del evento, lugar, observaciones..." style={{ minHeight: 70 }} />
                </div>
              </div>
              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  {editandoId && (() => {
                    const ev = eventos.find(e => e.id === editandoId)
                    return ev && puedeEliminar(ev) ? (
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => { handleDelete(ev); setShowModal(false) }} style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}><Trash2 size={14} />Eliminar</button>
                    ) : null
                  })()}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancelar</button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardando...' : (editandoId ? 'Guardar Cambios' : 'Crear Evento')}</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
