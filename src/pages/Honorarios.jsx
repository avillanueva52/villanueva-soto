import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { formatearFecha, hoyEnLima } from '../lib/dateUtils'
import { Plus, Search, FileText, DollarSign, AlertCircle, Receipt } from 'lucide-react'

const TIPO_COMPROBANTE_LABELS = { factura: 'Factura', recibo_honorarios: 'Recibo Honorarios', sin_comprobante: 'Sin Comprobante' }
const ESTADO_LABELS = { borrador: 'Borrador', emitida: 'Emitida', pagada_parcial: 'Pagada Parcial', pagada: 'Pagada', anulada: 'Anulada' }
const ESTADO_COLORS = { borrador: '#6b7280', emitida: '#1a56db', pagada_parcial: '#d97706', pagada: '#057a55', anulada: '#c81e1e' }

function formatearMonto(monto, moneda = 'PEN') {
  if (monto == null) return '—'
  const simbolo = moneda === 'USD' ? '$' : 'S/'
  return `${simbolo} ${Number(monto).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function Honorarios() {
  const { perfil } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState('facturas')
  const [loading, setLoading] = useState(true)
  const [facturas, setFacturas] = useState([])
  const [clientes, setClientes] = useState([])
  const [pagos, setPagos] = useState([])
  const [cxc, setCxc] = useState([])

  // Filtros facturas
  const [search, setSearch] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroCliente, setFiltroCliente] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroAnio, setFiltroAnio] = useState('')

  // Modal nueva factura
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ tipo_comprobante: 'factura', cliente_id: '', moneda: 'PEN', fecha_emision: hoyEnLima(), afecto_igv: true, notas: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [facturasRes, clientesRes, pagosRes, cxcRes] = await Promise.all([
      supabase.from('facturas').select('*, clientes(id, nombre), perfiles!facturas_creado_por_fkey(nombre)').order('creado_en', { ascending: false }),
      supabase.from('clientes').select('id, nombre').order('nombre'),
      supabase.from('pagos').select('*, facturas(id, numero, cliente_id, moneda, clientes(nombre)), perfiles!pagos_registrado_por_fkey(nombre)').order('fecha', { ascending: false }),
      supabase.from('cuentas_por_cobrar').select('*').order('fecha_emision', { ascending: true })
    ])
    setFacturas(facturasRes.data || [])
    setClientes(clientesRes.data || [])
    setPagos(pagosRes.data || [])
    setCxc(cxcRes.data || [])
    setLoading(false)
  }

  // Auto-marcar IGV según tipo de comprobante (factura sí, otros no)
  function handleTipoChange(tipo) {
    setForm(f => ({ ...f, tipo_comprobante: tipo, afecto_igv: tipo === 'factura' }))
  }

  async function handleCrearFactura(e) {
    e.preventDefault()
    if (!form.cliente_id) return
    setSaving(true)
    const { data, error } = await supabase.from('facturas').insert({
      tipo_comprobante: form.tipo_comprobante,
      cliente_id: form.cliente_id,
      moneda: form.moneda,
      fecha_emision: form.fecha_emision,
      afecto_igv: form.afecto_igv,
      notas: form.notas || null,
      creado_por: perfil.id,
      estado: 'borrador',
      serie_anio: new Date(form.fecha_emision).getFullYear()
    }).select().single()
    if (error) { alert('Error al crear factura: ' + error.message); setSaving(false); return }
    setShowModal(false)
    setSaving(false)
    // Llevar al detalle para agregar items
    navigate(`/honorarios/${data.id}`)
  }

  const facturasFiltradas = facturas.filter(f => {
    if (search) {
      const s = search.toLowerCase()
      const matchSearch =
        (f.numero || '').toLowerCase().includes(s) ||
        f.clientes?.nombre?.toLowerCase().includes(s) ||
        (f.notas || '').toLowerCase().includes(s)
      if (!matchSearch) return false
    }
    if (filtroEstado && f.estado !== filtroEstado) return false
    if (filtroCliente && f.cliente_id !== filtroCliente) return false
    if (filtroTipo && f.tipo_comprobante !== filtroTipo) return false
    if (filtroAnio && f.serie_anio !== parseInt(filtroAnio)) return false
    return true
  })

  // Años únicos para el filtro
  const aniosUnicos = [...new Set(facturas.map(f => f.serie_anio))].sort((a, b) => b - a)

  // Resúmenes CxC por moneda
  const cxcPorMoneda = cxc.reduce((acc, f) => {
    if (!acc[f.moneda]) acc[f.moneda] = { total: 0, saldo: 0, cantidad: 0 }
    acc[f.moneda].total += Number(f.total)
    acc[f.moneda].saldo += Number(f.saldo)
    acc[f.moneda].cantidad += 1
    return acc
  }, {})

  if (loading) return <div className="loading-page"><div className="spinner"></div></div>

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Honorarios y Cobranzas</div>
          <div className="page-subtitle">Facturación, pagos y cuentas por cobrar</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={16} />Nueva Factura</button>
      </div>

      <div className="tabs">
        <div className={`tab ${tab === 'facturas' ? 'active' : ''}`} onClick={() => setTab('facturas')}><FileText size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />Facturas ({facturas.length})</div>
        <div className={`tab ${tab === 'cxc' ? 'active' : ''}`} onClick={() => setTab('cxc')}><AlertCircle size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />Cuentas por Cobrar ({cxc.length})</div>
        <div className={`tab ${tab === 'pagos' ? 'active' : ''}`} onClick={() => setTab('pagos')}><Receipt size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />Pagos ({pagos.length})</div>
      </div>

      {/* TAB FACTURAS */}
      {tab === 'facturas' && (
        <>
          <div className="filter-bar">
            <div className="search-bar" style={{ flex: 1, maxWidth: 320 }}>
              <Search size={15} color="var(--text-muted)" />
              <input placeholder="Buscar por número, cliente, notas..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="form-select" style={{ width: 'auto' }} value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
              <option value="">Todos los estados</option>
              {Object.entries(ESTADO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select className="form-select" style={{ width: 'auto' }} value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
              <option value="">Todos los tipos</option>
              {Object.entries(TIPO_COMPROBANTE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select className="form-select" style={{ width: 'auto' }} value={filtroCliente} onChange={e => setFiltroCliente(e.target.value)}>
              <option value="">Todos los clientes</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
            <select className="form-select" style={{ width: 'auto' }} value={filtroAnio} onChange={e => setFiltroAnio(e.target.value)}>
              <option value="">Todos los años</option>
              {aniosUnicos.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>

          <div className="card">
            {facturasFiltradas.length === 0 ? (
              <div className="empty-state"><FileText size={36} /><p>No se encontraron facturas</p></div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Número</th>
                      <th>Tipo</th>
                      <th>Cliente</th>
                      <th>Fecha</th>
                      <th>Total</th>
                      <th>Estado</th>
                      <th>Creada por</th>
                    </tr>
                  </thead>
                  <tbody>
                    {facturasFiltradas.map(f => (
                      <tr key={f.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/honorarios/${f.id}`)}>
                        <td style={{ fontWeight: 600, fontFamily: 'monospace', fontSize: '0.82rem', color: 'var(--navy)' }}>
                          {f.numero || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>(borrador)</span>}
                        </td>
                        <td><span style={{ fontSize: '0.72rem', background: 'var(--cream)', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>{TIPO_COMPROBANTE_LABELS[f.tipo_comprobante]}</span></td>
                        <td style={{ fontWeight: 500 }}>{f.clientes?.nombre || '—'}</td>
                        <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{formatearFecha(f.fecha_emision)}</td>
                        <td style={{ fontWeight: 600 }}>{formatearMonto(f.total, f.moneda)}</td>
                        <td>
                          <span style={{ fontSize: '0.72rem', background: ESTADO_COLORS[f.estado], color: 'white', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>
                            {ESTADO_LABELS[f.estado]}
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>{f.perfiles?.nombre || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* TAB CUENTAS POR COBRAR */}
      {tab === 'cxc' && (
        <>
          {/* Resúmenes por moneda */}
          <div style={{ display: 'grid', gridTemplateColumns: Object.keys(cxcPorMoneda).length > 0 ? `repeat(${Object.keys(cxcPorMoneda).length}, 1fr)` : '1fr', gap: 16, marginBottom: 16 }}>
            {Object.entries(cxcPorMoneda).map(([moneda, datos]) => (
              <div key={moneda} className="card" style={{ background: 'var(--navy)', color: 'white' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--gold-light)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
                  Por cobrar en {moneda}
                </div>
                <div style={{ fontSize: '1.6rem', fontWeight: 700, fontFamily: 'var(--font-display)' }}>
                  {formatearMonto(datos.saldo, moneda)}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>
                  {datos.cantidad} factura{datos.cantidad !== 1 ? 's' : ''} pendiente{datos.cantidad !== 1 ? 's' : ''}
                </div>
              </div>
            ))}
            {Object.keys(cxcPorMoneda).length === 0 && (
              <div className="card" style={{ background: 'var(--cream)' }}>
                <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Sin facturas pendientes de cobro</div>
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-title" style={{ marginBottom: 12 }}>Facturas Pendientes de Cobro</div>
            {cxc.length === 0 ? (
              <div className="empty-state"><DollarSign size={36} /><p>Todas las facturas están al día</p></div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Número</th>
                      <th>Cliente</th>
                      <th>Fecha Emisión</th>
                      <th style={{ textAlign: 'right' }}>Total</th>
                      <th style={{ textAlign: 'right' }}>Pagado</th>
                      <th style={{ textAlign: 'right' }}>Saldo</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cxc.map(f => (
                      <tr key={f.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/honorarios/${f.id}`)}>
                        <td style={{ fontWeight: 600, fontFamily: 'monospace', fontSize: '0.82rem', color: 'var(--navy)' }}>{f.numero}</td>
                        <td style={{ fontWeight: 500 }}>{f.cliente_nombre}</td>
                        <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{formatearFecha(f.fecha_emision)}</td>
                        <td style={{ textAlign: 'right' }}>{formatearMonto(f.total, f.moneda)}</td>
                        <td style={{ textAlign: 'right', color: 'var(--success)' }}>{formatearMonto(f.total_pagado, f.moneda)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--danger)' }}>{formatearMonto(f.saldo, f.moneda)}</td>
                        <td>
                          <span style={{ fontSize: '0.72rem', background: ESTADO_COLORS[f.estado], color: 'white', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>
                            {ESTADO_LABELS[f.estado]}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* TAB PAGOS */}
      {tab === 'pagos' && (
        <div className="card">
          <div className="card-title" style={{ marginBottom: 12 }}>Historial de Pagos</div>
          {pagos.length === 0 ? (
            <div className="empty-state"><Receipt size={36} /><p>No hay pagos registrados</p></div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Factura</th>
                    <th>Cliente</th>
                    <th>Medio</th>
                    <th style={{ textAlign: 'right' }}>Monto</th>
                    <th>Referencia</th>
                    <th>Registrado por</th>
                  </tr>
                </thead>
                <tbody>
                  {pagos.map(p => (
                    <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/honorarios/${p.factura_id}`)}>
                      <td style={{ fontSize: '0.85rem' }}>{formatearFecha(p.fecha)}</td>
                      <td style={{ fontWeight: 600, fontFamily: 'monospace', fontSize: '0.82rem', color: 'var(--navy)' }}>{p.facturas?.numero || '—'}</td>
                      <td style={{ fontWeight: 500 }}>{p.facturas?.clientes?.nombre || '—'}</td>
                      <td><span style={{ fontSize: '0.72rem', background: 'var(--cream)', padding: '2px 8px', borderRadius: 4, fontWeight: 600, textTransform: 'capitalize' }}>{p.medio_pago}</span></td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--success)' }}>{formatearMonto(p.monto, p.facturas?.moneda)}</td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{p.referencia || '—'}</td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{p.perfiles?.nombre || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL NUEVA FACTURA */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">Nueva Factura</div>
              <button className="btn-icon" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCrearFactura}>
              <div className="modal-body">
                <div style={{ background: 'var(--cream)', padding: '8px 12px', borderRadius: 6, marginBottom: 14, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  La factura se crea en estado <strong>borrador</strong>. Al guardar te llevará al detalle para agregar los conceptos. Cuando esté lista, se emite y se le asigna número correlativo.
                </div>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Tipo de Comprobante *</label>
                    <select className="form-select" value={form.tipo_comprobante} onChange={e => handleTipoChange(e.target.value)}>
                      {Object.entries(TIPO_COMPROBANTE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Fecha de Emisión *</label>
                    <input className="form-input" type="date" value={form.fecha_emision} onChange={e => setForm({ ...form, fecha_emision: e.target.value })} required />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Cliente *</label>
                  <select className="form-select" value={form.cliente_id} onChange={e => setForm({ ...form, cliente_id: e.target.value })} required>
                    <option value="">Selecciona un cliente...</option>
                    {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </div>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Moneda *</label>
                    <select className="form-select" value={form.moneda} onChange={e => setForm({ ...form, moneda: e.target.value })}>
                      <option value="PEN">PEN (S/)</option>
                      <option value="USD">USD ($)</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ display: 'flex', alignItems: 'center' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.88rem', paddingTop: 22 }}>
                      <input type="checkbox" checked={form.afecto_igv} onChange={e => setForm({ ...form, afecto_igv: e.target.checked })} style={{ accentColor: 'var(--navy)' }} />
                      Afecto a IGV (18%)
                    </label>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Notas</label>
                  <textarea className="form-textarea" value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })} placeholder="Observaciones internas..." style={{ minHeight: 50 }} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Creando...' : 'Crear y continuar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
