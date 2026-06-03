import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { FolderOpen, Users, RotateCcw } from 'lucide-react'

export default function Archivados() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('expedientes')
  const [casos, setCasos] = useState([])
  const [clientes, setClientes] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const [casosRes, clientesRes] = await Promise.all([
      supabase.from('casos').select('*, clientes(nombre), perfiles(nombre)').in('estado', ['archivado', 'cerrado']).order('creado_en', { ascending: false }),
      supabase.from('clientes').select('*, casos(id)').eq('activo', false).order('nombre')
    ])
    setCasos(casosRes.data || [])
    setClientes(clientesRes.data || [])
    setLoading(false)
  }

  async function reactivarCaso(id) {
    await supabase.from('casos').update({ estado: 'activo' }).eq('id', id)
    loadData()
  }

  async function reactivarCliente(id) {
    await supabase.from('clientes').update({ activo: true }).eq('id', id)
    loadData()
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Archivados</div>
          <div className="page-subtitle">Expedientes cerrados y clientes inactivos</div>
        </div>
      </div>

      <div className="tabs">
        <div className={`tab ${tab === 'expedientes' ? 'active' : ''}`} onClick={() => setTab('expedientes')}>
          Expedientes ({casos.length})
        </div>
        <div className={`tab ${tab === 'clientes' ? 'active' : ''}`} onClick={() => setTab('clientes')}>
          Clientes Inactivos ({clientes.length})
        </div>
      </div>

      {tab === 'expedientes' && (
        <div className="card">
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner" style={{ margin: '0 auto' }}></div></div>
          ) : casos.length === 0 ? (
            <div className="empty-state"><FolderOpen size={36} /><p>No hay expedientes archivados</p></div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>N° Expediente</th><th>Título</th><th>Cliente</th><th>Abogado</th><th>Tipo</th><th>Estado</th><th>Fecha Cierre</th><th></th></tr>
                </thead>
                <tbody>
                  {casos.map(c => (
                    <tr key={c.id} style={{ opacity: 0.75 }}>
                      <td style={{ fontWeight: 600, fontFamily: 'monospace', fontSize: '0.82rem' }}>{c.numero_expediente}</td>
                      <td style={{ cursor: 'pointer', fontWeight: 500 }} onClick={() => navigate(`/casos/${c.id}`)}>{c.titulo}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{c.clientes?.nombre || '—'}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{c.perfiles?.nombre || '—'}</td>
                      <td><span className={`badge badge-${c.tipo}`} style={{ textTransform: 'capitalize' }}>{c.tipo}</span></td>
                      <td><span className={`badge badge-${c.estado}`} style={{ textTransform: 'capitalize' }}>{c.estado}</span></td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{c.fecha_cierre ? new Date(c.fecha_cierre).toLocaleDateString('es-PE') : '—'}</td>
                      <td>
                        <button className="btn btn-sm btn-outline" onClick={() => reactivarCaso(c.id)} title="Reactivar">
                          <RotateCcw size={13} />Reactivar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'clientes' && (
        <div className="card">
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner" style={{ margin: '0 auto' }}></div></div>
          ) : clientes.length === 0 ? (
            <div className="empty-state"><Users size={36} /><p>No hay clientes inactivos</p></div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Nombre</th><th>Tipo</th><th>Documento</th><th>Email</th><th>Casos</th><th></th></tr>
                </thead>
                <tbody>
                  {clientes.map(c => (
                    <tr key={c.id} style={{ opacity: 0.75 }}>
                      <td style={{ fontWeight: 600 }}>{c.nombre}</td>
                      <td><span style={{ fontSize: '0.75rem', background: 'var(--cream)', padding: '2px 8px', borderRadius: 4 }}>{c.tipo === 'empresa' ? 'Empresa' : 'Persona Natural'}</span></td>
                      <td style={{ color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: '0.82rem' }}>{c.documento_identidad || '—'}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{c.email || '—'}</td>
                      <td><span style={{ background: 'var(--navy)', color: 'white', borderRadius: 20, padding: '2px 10px', fontSize: '0.75rem', fontWeight: 700 }}>{c.casos?.length || 0}</span></td>
                      <td>
                        <button className="btn btn-sm btn-outline" onClick={() => reactivarCliente(c.id)}>
                          <RotateCcw size={13} />Reactivar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
