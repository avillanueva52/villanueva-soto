import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import { Download, BarChart2 } from 'lucide-react'

const COLORS = { civil: '#1a56db', penal: '#c81e1e', laboral: '#057a55', constitucional: '#d97706', administrativo: '#7e3af2', consulta: '#1c7ed6' }
const TIPOS_LABELS = { redaccion: 'Redacción', investigacion: 'Investigación', audiencia: 'Audiencia', reunion: 'Reunión', tramite: 'Trámite', consulta: 'Consulta', revision: 'Revisión', otro: 'Otro' }

export default function Reportes() {
  const [tab, setTab] = useState('eficiencia')
  const [mes, setMes] = useState(new Date().toISOString().slice(0, 7))
  const [data, setData] = useState({ abogados: [], casos: [], clientes: [], tiposHoras: [] })
  const [loading, setLoading] = useState(true)
  const [casosData, setCasosData] = useState([])

  useEffect(() => { loadReportes() }, [mes])

  async function loadReportes() {
    setLoading(true)
    const inicio = mes + '-01'
    const fin = new Date(mes.slice(0,4), parseInt(mes.slice(5,7)), 0).toISOString().split('T')[0]

    const [horasRes, perfilesRes, casosRes] = await Promise.all([
      supabase.from('horas_trabajadas').select('*, perfiles(id,nombre,rol,costo_hora), casos(id,titulo,numero_expediente,tipo,clientes(nombre))').gte('fecha', inicio).lte('fecha', fin),
      supabase.from('perfiles').select('*').eq('activo', true),
      supabase.from('casos').select('*, clientes(nombre), horas_trabajadas(horas, perfiles(costo_hora))').eq('estado', 'activo')
    ])

    const horas = horasRes.data || []
    const perfiles = perfilesRes.data || []

    // Por abogado
    const porAbogado = perfiles.map(p => {
      const hs = horas.filter(h => h.perfil_id === p.id)
      const totalH = hs.reduce((s, h) => s + h.horas, 0)
      const totalS = hs.reduce((s, h) => s + (h.horas * (p.costo_hora || 0)), 0)
      return { nombre: p.nombre.split(' ').slice(0,2).join(' '), rol: p.rol, horas: parseFloat(totalH.toFixed(2)), valor: parseFloat(totalS.toFixed(2)), costo_hora: p.costo_hora || 0 }
    }).filter(p => p.horas > 0).sort((a, b) => b.horas - a.horas)

    // Por tipo de tarea
    const tipoCount = {}
    horas.forEach(h => { tipoCount[h.tipo_tarea] = (tipoCount[h.tipo_tarea] || 0) + h.horas })
    const porTipo = Object.entries(tipoCount).map(([tipo, horas]) => ({ name: TIPOS_LABELS[tipo] || tipo, value: parseFloat(horas.toFixed(2)) }))

    // Por caso (horas)
    const porCaso = {}
    horas.forEach(h => {
      if (!h.casos) return
      const key = h.casos.id
      if (!porCaso[key]) porCaso[key] = { numero: h.casos.numero_expediente, titulo: h.casos.titulo, tipo: h.casos.tipo, cliente: h.casos.clientes?.nombre || '—', horas: 0, valor: 0 }
      porCaso[key].horas += h.horas
      porCaso[key].valor += h.horas * (h.perfiles?.costo_hora || 0)
    })
    const porCasoArr = Object.values(porCaso).sort((a, b) => b.horas - a.horas)

    // Por cliente
    const porCliente = {}
    horas.forEach(h => {
      if (!h.casos?.clientes?.nombre) return
      const key = h.casos.clientes.nombre
      if (!porCliente[key]) porCliente[key] = { cliente: key, horas: 0, valor: 0 }
      porCliente[key].horas += h.horas
      porCliente[key].valor += h.horas * (h.perfiles?.costo_hora || 0)
    })

    setData({ abogados: porAbogado, tiposHoras: porTipo, casos: porCasoArr, clientes: Object.values(porCliente).sort((a, b) => b.valor - a.valor) })
    setCasosData(casosRes.data || [])
    setLoading(false)
  }

  function exportarCSV(rows, columns, filename) {
    const header = columns.map(c => c.label).join(',')
    const body = rows.map(r => columns.map(c => `"${r[c.key] ?? ''}"`).join(',')).join('\n')
    const blob = new Blob(['\ufeff' + header + '\n' + body], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
    URL.revokeObjectURL(url)
  }

  const totalHorasMes = data.abogados.reduce((s, a) => s + a.horas, 0)
  const totalValorMes = data.abogados.reduce((s, a) => s + a.valor, 0)

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Reportes</div>
          <div className="page-subtitle">Análisis de rendimiento y facturación</div>
        </div>
        <input type="month" className="form-input" style={{ width: 'auto' }} value={mes} onChange={e => setMes(e.target.value)} />
      </div>

      <div className="tabs">
        {[['eficiencia', 'Eficiencia por Abogado'], ['casos', 'Reporte por Caso'], ['clientes', 'Reporte por Cliente'], ['distribucion', 'Distribución']].map(([key, label]) => (
          <div key={key} className={`tab ${tab === key ? 'active' : ''}`} onClick={() => setTab(key)}>{label}</div>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><div className="spinner" style={{ margin: '0 auto' }}></div></div>
      ) : (
        <>
          {tab === 'eficiencia' && (
            <div>
              <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: 20 }}>
                <div className="stat-card"><div className="stat-value">{totalHorasMes.toFixed(1)}h</div><div className="stat-label">Total horas del mes</div></div>
                <div className="stat-card"><div className="stat-value">S/ {totalValorMes.toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2})}</div><div className="stat-label">Valor facturado estimado</div></div>
                <div className="stat-card"><div className="stat-value">{data.abogados.length}</div><div className="stat-label">Abogados activos</div></div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
                <div className="card">
                  <div className="card-header"><div className="card-title">Horas por Abogado</div></div>
                  {data.abogados.length === 0 ? <div className="empty-state"><p>Sin datos para este mes</p></div> : (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={data.abogados} margin={{ top: 5, right: 10, left: 0, bottom: 40 }}>
                        <XAxis dataKey="nombre" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(v) => [`${v}h`, 'Horas']} />
                        <Bar dataKey="horas" fill="var(--navy)" radius={[4,4,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
                <div className="card">
                  <div className="card-header"><div className="card-title">Valor por Abogado (S/)</div></div>
                  {data.abogados.length === 0 ? <div className="empty-state"><p>Sin datos para este mes</p></div> : (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={data.abogados} margin={{ top: 5, right: 10, left: 10, bottom: 40 }}>
                        <XAxis dataKey="nombre" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(v) => [`S/ ${v.toFixed(2)}`, 'Valor']} />
                        <Bar dataKey="valor" fill="var(--gold)" radius={[4,4,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <div className="card-title">Detalle por Abogado</div>
                  <button className="btn btn-sm btn-outline" onClick={() => exportarCSV(data.abogados, [{key:'nombre',label:'Abogado'},{key:'rol',label:'Rol'},{key:'horas',label:'Horas'},{key:'costo_hora',label:'Costo x Hora'},{key:'valor',label:'Valor Total S/'}], `eficiencia_${mes}.csv`)}><Download size={14} />Exportar CSV</button>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Abogado</th><th>Rol</th><th>Costo/Hora (S/)</th><th style={{textAlign:'right'}}>Horas</th><th style={{textAlign:'right'}}>Valor (S/)</th></tr></thead>
                    <tbody>
                      {data.abogados.length === 0 ? (
                        <tr><td colSpan={5} style={{textAlign:'center',padding:24,color:'var(--text-muted)'}}>Sin registros para este mes</td></tr>
                      ) : data.abogados.map((a, i) => (
                        <tr key={i}>
                          <td style={{fontWeight:600}}>{a.nombre}</td>
                          <td><span style={{fontSize:'0.75rem',background:'var(--cream)',padding:'2px 8px',borderRadius:4}}>{a.rol?.replace('_',' ')}</span></td>
                          <td style={{textAlign:'right'}}>S/ {a.costo_hora.toFixed(2)}</td>
                          <td style={{textAlign:'right',fontWeight:700}}>{a.horas}h</td>
                          <td style={{textAlign:'right',fontWeight:700,color:'var(--success)'}}>S/ {a.valor.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                    {data.abogados.length > 0 && (
                      <tfoot>
                        <tr style={{borderTop:'2px solid var(--border)',background:'var(--cream)'}}>
                          <td colSpan={3} style={{padding:'10px 14px',fontWeight:700}}>TOTAL</td>
                          <td style={{padding:'10px 14px',fontWeight:700,textAlign:'right'}}>{totalHorasMes.toFixed(2)}h</td>
                          <td style={{padding:'10px 14px',fontWeight:700,textAlign:'right',color:'var(--success)'}}>S/ {totalValorMes.toFixed(2)}</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            </div>
          )}

          {tab === 'casos' && (
            <div className="card">
              <div className="card-header">
                <div className="card-title">Horas y Valor por Expediente</div>
                <button className="btn btn-sm btn-outline" onClick={() => exportarCSV(data.casos, [{key:'numero',label:'N° Expediente'},{key:'cliente',label:'Cliente'},{key:'titulo',label:'Título'},{key:'tipo',label:'Tipo'},{key:'horas',label:'Horas'},{key:'valor',label:'Valor S/'}], `casos_${mes}.csv`)}><Download size={14} />Exportar CSV</button>
              </div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>N° Expediente</th><th>Cliente</th><th>Título</th><th>Tipo</th><th style={{textAlign:'right'}}>Horas</th><th style={{textAlign:'right'}}>Valor (S/)</th></tr></thead>
                  <tbody>
                    {data.casos.length === 0 ? (
                      <tr><td colSpan={6} style={{textAlign:'center',padding:24,color:'var(--text-muted)'}}>Sin registros para este período</td></tr>
                    ) : data.casos.map((c, i) => (
                      <tr key={i}>
                        <td style={{fontFamily:'monospace',fontSize:'0.82rem',color:'var(--navy)',fontWeight:600}}>{c.numero}</td>
                        <td style={{color:'var(--text-secondary)'}}>{c.cliente}</td>
                        <td style={{maxWidth:240,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.titulo}</td>
                        <td><span className={`badge badge-${c.tipo}`} style={{textTransform:'capitalize'}}>{c.tipo}</span></td>
                        <td style={{textAlign:'right',fontWeight:700}}>{c.horas.toFixed(2)}h</td>
                        <td style={{textAlign:'right',fontWeight:700,color:'var(--success)'}}>S/ {c.valor.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'clientes' && (
            <div className="card">
              <div className="card-header">
                <div className="card-title">Reporte por Cliente</div>
                <button className="btn btn-sm btn-outline" onClick={() => exportarCSV(data.clientes, [{key:'cliente',label:'Cliente'},{key:'horas',label:'Horas'},{key:'valor',label:'Valor S/'}], `clientes_${mes}.csv`)}><Download size={14} />Exportar CSV</button>
              </div>
              <p style={{fontSize:'0.82rem',color:'var(--text-muted)',marginBottom:16}}>Este reporte puede ser enviado a cada cliente con el detalle de horas trabajadas en el período.</p>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Cliente</th><th style={{textAlign:'right'}}>Horas del Período</th><th style={{textAlign:'right'}}>Valor Total (S/)</th></tr></thead>
                  <tbody>
                    {data.clientes.length === 0 ? (
                      <tr><td colSpan={3} style={{textAlign:'center',padding:24,color:'var(--text-muted)'}}>Sin registros para este período</td></tr>
                    ) : data.clientes.map((c, i) => (
                      <tr key={i}>
                        <td style={{fontWeight:600}}>{c.cliente}</td>
                        <td style={{textAlign:'right',fontWeight:700}}>{c.horas.toFixed(2)}h</td>
                        <td style={{textAlign:'right',fontWeight:700,color:'var(--success)'}}>S/ {c.valor.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'distribucion' && (
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
              <div className="card">
                <div className="card-header"><div className="card-title">Horas por Tipo de Tarea</div></div>
                {data.tiposHoras.length === 0 ? <div className="empty-state"><p>Sin datos para este mes</p></div> : (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie data={data.tiposHoras} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                        {data.tiposHoras.map((_, i) => <Cell key={i} fill={Object.values(COLORS)[i % 6]} />)}
                      </Pie>
                      <Tooltip formatter={(v) => [`${v}h`]} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
              <div className="card">
                <div className="card-header"><div className="card-title">Casos Activos por Materia</div></div>
                {(() => {
                  const porTipo = {}
                  casosData.forEach(c => { if(c.estado==='activo') porTipo[c.tipo] = (porTipo[c.tipo]||0)+1 })
                  const d = Object.entries(porTipo).map(([tipo,count])=>({name:tipo.charAt(0).toUpperCase()+tipo.slice(1),value:count,color:COLORS[tipo]}))
                  return d.length === 0 ? <div className="empty-state"><p>Sin casos activos</p></div> : (
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie data={d} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({name,value})=>`${name} (${value})`} fontSize={11}>
                          {d.map((entry,i) => <Cell key={i} fill={entry.color} />)}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  )
                })()}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
