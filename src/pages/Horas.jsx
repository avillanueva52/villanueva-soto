import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { mesActualEnLima, formatearFecha } from '../lib/dateUtils'
import { useAuth } from '../hooks/useAuth'
import { Clock } from 'lucide-react'

const TIPOS_LABELS = { redaccion: 'Redacción', investigacion: 'Investigación', audiencia: 'Audiencia', reunion: 'Reunión', tramite: 'Trámite', consulta: 'Consulta', revision: 'Revisión', otro: 'Otro' }

export default function Horas() {
  const { perfil } = useAuth()
  const [horas, setHoras] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtroAbogado, setFiltroAbogado] = useState(perfil?.rol !== 'socio_admin' ? perfil?.id : '')
  const [filtroMes, setFiltroMes] = useState(mesActualEnLima())
  const [abogados, setAbogados] = useState([])

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const [horasRes, abogadosRes] = await Promise.all([
      supabase.from('horas_trabajadas').select('*, casos(titulo, numero_expediente), perfiles(nombre, rol, costo_hora)').order('fecha', { ascending: false }),
      supabase.from('perfiles').select('id, nombre').eq('activo', true).order('nombre')
    ])
    setHoras(horasRes.data || [])
    setAbogados(abogadosRes.data || [])
    setLoading(false)
  }

  const filtered = horas.filter(h => {
    if (filtroAbogado && h.perfil_id !== filtroAbogado) return false
    if (filtroMes && !h.fecha.startsWith(filtroMes)) return false
    return true
  })

  const totalHoras = filtered.reduce((s, h) => s + h.horas, 0)
  const totalFacturado = filtered.reduce((s, h) => s + (h.horas * (h.perfiles?.costo_hora || 0)), 0)

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Horas Trabajadas</div>
          <div className="page-subtitle">Registro global de horas por abogado y caso</div>
        </div>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(201,168,76,0.15)' }}><Clock size={20} color="var(--gold)" /></div>
          <div className="stat-value">{totalHoras.toFixed(1)}</div>
          <div className="stat-label">Total de horas</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--success-bg)' }}><span style={{ fontSize: 18 }}>S/</span></div>
          <div className="stat-value">{totalFacturado.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          <div className="stat-label">Valor estimado (S/)</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--info-bg)' }}><span style={{ fontSize: 18 }}>📋</span></div>
          <div className="stat-value">{filtered.length}</div>
          <div className="stat-label">Registros</div>
        </div>
      </div>

      <div className="filter-bar">
        <input type="month" className="form-input" style={{ width: 'auto' }} value={filtroMes} onChange={e => setFiltroMes(e.target.value)} />
        {perfil?.rol === 'socio_admin' && (
          <select className="form-select" style={{ width: 'auto' }} value={filtroAbogado} onChange={e => setFiltroAbogado(e.target.value)}>
            <option value="">Todos los abogados</option>
            {abogados.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
          </select>
        )}
      </div>

      <div className="card">
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner" style={{ margin: '0 auto' }}></div></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state"><Clock size={36} /><p>No hay horas registradas para este período</p></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Fecha</th><th>Abogado</th><th>Expediente</th><th>Tipo de Tarea</th><th>Descripción</th><th>Horas</th><th>Valor (S/)</th><th>Estado</th></tr>
              </thead>
              <tbody>
                {filtered.map(h => (
                  <tr key={h.id}>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{formatearFecha(h.fecha)}</td>
                    <td style={{ fontWeight: 500 }}>{h.perfiles?.nombre || '—'}</td>
                    <td style={{ fontSize: '0.8rem' }}>
                      {h.casos ? <span style={{ fontFamily: 'monospace', color: 'var(--navy)' }}>{h.casos.numero_expediente}</span> : '—'}
                      {h.casos?.titulo && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.casos.titulo}</div>}
                    </td>
                    <td><span style={{ fontSize: '0.78rem', background: 'var(--cream)', padding: '2px 8px', borderRadius: 4 }}>{TIPOS_LABELS[h.tipo_tarea] || h.tipo_tarea}</span></td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', maxWidth: 200 }}>{h.descripcion || '—'}</td>
                    <td style={{ fontWeight: 700, textAlign: 'right' }}>{h.horas}h</td>
                    <td style={{ textAlign: 'right', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      {h.perfiles?.costo_hora ? `S/ ${(h.horas * h.perfiles.costo_hora).toFixed(2)}` : '—'}
                    </td>
                    <td><span style={{ fontSize: '0.72rem', background: h.facturado ? 'var(--success-bg)' : 'var(--cream)', color: h.facturado ? 'var(--success)' : 'var(--text-muted)', padding: '2px 8px', borderRadius: 4 }}>{h.facturado ? 'Facturado' : 'Pendiente'}</span></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--cream)' }}>
                  <td colSpan={5} style={{ padding: '10px 14px', fontWeight: 600 }}>TOTAL</td>
                  <td style={{ padding: '10px 14px', fontWeight: 700, textAlign: 'right' }}>{totalHoras.toFixed(2)}h</td>
                  <td style={{ padding: '10px 14px', fontWeight: 700, textAlign: 'right' }}>S/ {totalFacturado.toFixed(2)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
