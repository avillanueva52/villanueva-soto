import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { inicioMesEnLima, formatearFecha } from '../lib/dateUtils'
import { useAuth } from '../hooks/useAuth'
import { Link } from 'react-router-dom'
import { FolderOpen, Users, Clock, CheckSquare, AlertCircle, TrendingUp } from 'lucide-react'

const TIPO_COLORS = { civil: '#1a56db', penal: '#c81e1e', laboral: '#057a55', constitucional: '#d97706', administrativo: '#7e3af2', consulta: '#1c7ed6' }

export default function Dashboard() {
  const { perfil } = useAuth()
  const [stats, setStats] = useState({ casos: 0, clientes: 0, tareasPendientes: 0, horasMes: 0 })
  const [casosPorTipo, setCasosPorTipo] = useState([])
  const [ultimosCasos, setUltimosCasos] = useState([])
  const [tareasUrgentes, setTareasUrgentes] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboard()
  }, [])

  async function loadDashboard() {
    const [casosRes, clientesRes, tareasRes, horasRes, ultimosRes, urgentesRes] = await Promise.all([
      supabase.from('casos').select('tipo, estado'),
      supabase.from('clientes').select('id', { count: 'exact', head: true }),
      supabase.from('tareas').select('id', { count: 'exact', head: true }).eq('estado', 'pendiente'),
      supabase.from('horas_trabajadas').select('horas').gte('fecha', inicioMesEnLima()),
      supabase.from('casos').select('*, clientes(nombre), perfiles(nombre)').order('creado_en', { ascending: false }).limit(5),
      supabase.from('tareas').select('*, casos(titulo, numero_expediente), perfiles!tareas_asignado_a_fkey(nombre)').eq('estado', 'pendiente').eq('prioridad', 'alta').order('fecha_vencimiento').limit(5)
    ])

    const casos = casosRes.data || []
    const activos = casos.filter(c => c.estado === 'activo').length
    const tipoCount = {}
    casos.forEach(c => { tipoCount[c.tipo] = (tipoCount[c.tipo] || 0) + 1 })
    const totalHoras = (horasRes.data || []).reduce((s, h) => s + h.horas, 0)

    setStats({ casos: activos, clientes: clientesRes.count || 0, tareasPendientes: tareasRes.count || 0, horasMes: totalHoras.toFixed(1) })
    setCasosPorTipo(Object.entries(tipoCount).map(([tipo, count]) => ({ tipo, count, pct: Math.round(count / casos.length * 100) })))
    setUltimosCasos(ultimosRes.data || [])
    setTareasUrgentes(urgentesRes.data || [])
    setLoading(false)
  }

  if (loading) return <div className="loading-page"><div className="spinner"></div></div>

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Bienvenido, {perfil?.nombre?.split(' ')[0]}</div>
          <div className="page-subtitle">Resumen del estado actual del estudio</div>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#eaf2f8' }}><FolderOpen size={20} color="var(--info)" /></div>
          <div className="stat-value">{stats.casos}</div>
          <div className="stat-label">Casos Activos</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#eaf4ef' }}><Users size={20} color="var(--success)" /></div>
          <div className="stat-value">{stats.clientes}</div>
          <div className="stat-label">Clientes Registrados</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#fef8ec' }}><CheckSquare size={20} color="var(--warning)" /></div>
          <div className="stat-value">{stats.tareasPendientes}</div>
          <div className="stat-label">Tareas Pendientes</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(201,168,76,0.15)' }}><Clock size={20} color="var(--gold)" /></div>
          <div className="stat-value">{stats.horasMes}</div>
          <div className="stat-label">Horas este mes</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        <div className="card">
          <div className="card-header"><div className="card-title">Expedientes por Materia</div></div>
          {casosPorTipo.length === 0 ? (
            <div className="empty-state"><p>Sin datos aún</p></div>
          ) : (
            <div>
              {casosPorTipo.map(({ tipo, count, pct }) => (
                <div key={tipo} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span className={`badge badge-${tipo}`} style={{ textTransform: 'capitalize' }}>{tipo}</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{count} ({pct}%)</span>
                  </div>
                  <div className="progress-bar"><div className="progress-fill" style={{ width: `${pct}%`, background: TIPO_COLORS[tipo] }}></div></div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title"><AlertCircle size={16} style={{ display: 'inline', marginRight: 6, color: 'var(--danger)' }} />Tareas Urgentes</div>
            <Link to="/tareas" className="btn btn-sm btn-outline">Ver todas</Link>
          </div>
          {tareasUrgentes.length === 0 ? (
            <div className="empty-state"><CheckSquare size={32} /><p>Sin tareas urgentes pendientes</p></div>
          ) : (
            tareasUrgentes.map(t => (
              <div key={t.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border-light)' }}>
                <div style={{ fontWeight: 500, fontSize: '0.85rem' }}>{t.titulo}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                  {t.casos?.numero_expediente} · {t.perfiles?.nombre}
                  {t.fecha_vencimiento && ` · Vence: ${formatearFecha(t.fecha_vencimiento)}`}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Últimos Expedientes</div>
          <Link to="/casos" className="btn btn-sm btn-outline">Ver todos</Link>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>N° Expediente</th>
                <th>Título</th>
                <th>Cliente</th>
                <th>Abogado</th>
                <th>Tipo</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {ultimosCasos.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 24 }}>Sin expedientes registrados</td></tr>
              ) : ultimosCasos.map(c => (
                <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => window.location.href = `/casos/${c.id}`}>
                  <td style={{ fontWeight: 600, fontFamily: 'monospace', fontSize: '0.82rem' }}>{c.numero_expediente}</td>
                  <td style={{ fontWeight: 500 }}>{c.titulo}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{c.clientes?.nombre || '—'}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{c.perfiles?.nombre || '—'}</td>
                  <td><span className={`badge badge-${c.tipo}`} style={{ textTransform: 'capitalize' }}>{c.tipo}</span></td>
                  <td><span className={`badge badge-${c.estado}`} style={{ textTransform: 'capitalize' }}>{c.estado}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
