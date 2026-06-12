import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { hoyEnLima, formatearFecha } from '../lib/dateUtils'
import { useAuth } from '../hooks/useAuth'
import { CheckSquare, Filter } from 'lucide-react'

export default function Tareas() {
  const { perfil } = useAuth()
  const [tareas, setTareas] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtroEstado, setFiltroEstado] = useState('pendiente')
  const [filtroPrioridad, setFiltroPrioridad] = useState('')
  const [filtroMio, setFiltroMio] = useState(false)

  useEffect(() => { loadTareas() }, [])

  async function loadTareas() {
    const { data } = await supabase.from('tareas')
      .select('*, casos(titulo, numero_expediente), perfiles!tareas_asignado_a_fkey(nombre), perfiles!tareas_creado_por_fkey(nombre)')
      .order('fecha_vencimiento', { ascending: true, nullsFirst: false })
    setTareas(data || [])
    setLoading(false)
  }

  async function toggleEstado(tarea) {
    const nuevoEstado = tarea.estado === 'completada' ? 'pendiente' : tarea.estado === 'pendiente' ? 'en_progreso' : 'completada'
    await supabase.from('tareas').update({ estado: nuevoEstado }).eq('id', tarea.id)
    loadTareas()
  }

  const filtered = tareas.filter(t => {
    if (filtroEstado && t.estado !== filtroEstado) return false
    if (filtroPrioridad && t.prioridad !== filtroPrioridad) return false
    if (filtroMio && t.asignado_a !== perfil?.id) return false
    return true
  })

  const hoy = hoyEnLima()
  const isVencida = (t) => t.fecha_vencimiento && t.fecha_vencimiento < hoy && t.estado !== 'completada'

  const estadoIcon = { pendiente: '⏳', en_progreso: '🔄', completada: '✅' }
  const estadoLabel = { pendiente: 'Pendiente', en_progreso: 'En Progreso', completada: 'Completada' }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Tareas</div>
          <div className="page-subtitle">{filtered.length} tarea{filtered.length !== 1 ? 's' : ''}</div>
        </div>
      </div>

      <div className="filter-bar">
        <select className="form-select" style={{ width: 'auto' }} value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          <option value="pendiente">Pendientes</option>
          <option value="en_progreso">En Progreso</option>
          <option value="completada">Completadas</option>
        </select>
        <select className="form-select" style={{ width: 'auto' }} value={filtroPrioridad} onChange={e => setFiltroPrioridad(e.target.value)}>
          <option value="">Todas las prioridades</option>
          <option value="alta">Alta</option>
          <option value="media">Media</option>
          <option value="baja">Baja</option>
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', cursor: 'pointer', userSelect: 'none' }}>
          <input type="checkbox" checked={filtroMio} onChange={e => setFiltroMio(e.target.checked)} style={{ accentColor: 'var(--navy)' }} />
          Solo mis tareas
        </label>
      </div>

      <div className="card">
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner" style={{ margin: '0 auto' }}></div></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state"><CheckSquare size={36} /><p>No se encontraron tareas</p></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Tarea</th><th>Expediente</th><th>Asignado a</th><th>Prioridad</th><th>Estado</th><th>Vencimiento</th><th></th></tr>
              </thead>
              <tbody>
                {filtered.map(t => (
                  <tr key={t.id} style={{ opacity: t.estado === 'completada' ? 0.6 : 1 }}>
                    <td>
                      <div style={{ fontWeight: 500, textDecoration: t.estado === 'completada' ? 'line-through' : 'none' }}>{t.titulo}</div>
                      {t.descripcion && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.descripcion}</div>}
                    </td>
                    <td style={{ fontSize: '0.8rem' }}>
                      {t.casos ? <span style={{ fontFamily: 'monospace', color: 'var(--navy)' }}>{t.casos.numero_expediente}</span> : '—'}
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{t.perfiles?.nombre || '—'}</td>
                    <td><span className={`badge badge-${t.prioridad}`} style={{ textTransform: 'capitalize' }}>{t.prioridad}</span></td>
                    <td><span style={{ fontSize: '0.8rem' }}>{estadoIcon[t.estado]} {estadoLabel[t.estado]}</span></td>
                    <td>
                      {t.fecha_vencimiento ? (
                        <span style={{ fontSize: '0.78rem', color: isVencida(t) ? 'var(--danger)' : 'var(--text-muted)', fontWeight: isVencida(t) ? 600 : 400 }}>
                          {isVencida(t) ? '⚠️ ' : ''}{formatearFecha(t.fecha_vencimiento)}
                        </span>
                      ) : '—'}
                    </td>
                    <td>
                      <button className="btn btn-sm btn-outline" onClick={() => toggleEstado(t)} style={{ fontSize: '0.72rem', whiteSpace: 'nowrap' }}>
                        {t.estado === 'pendiente' ? 'Iniciar' : t.estado === 'en_progreso' ? 'Completar' : 'Reabrir'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
