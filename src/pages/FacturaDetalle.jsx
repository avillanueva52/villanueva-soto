import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { hoyEnLima, formatearFecha } from '../lib/dateUtils'
import { ArrowLeft, Plus, Trash2, Edit2, Save, X, Send, Ban, Printer, FileText, CreditCard } from 'lucide-react'

const TIPO_ITEM_LABELS = { horas: 'Horas', fijo: 'Monto Fijo', iguala: 'Iguala Mensual', exito: 'Cuota de Éxito', otro: 'Otro' }
const TIPO_COMPROBANTE_LABELS = { factura: 'Factura', recibo_honorarios: 'Recibo Honorarios', sin_comprobante: 'Sin Comprobante' }
const ESTADO_LABELS = { borrador: 'Borrador', emitida: 'Emitida', pagada_parcial: 'Pagada Parcial', pagada: 'Pagada', anulada: 'Anulada' }
const ESTADO_COLORS = { borrador: '#6b7280', emitida: '#1a56db', pagada_parcial: '#d97706', pagada: '#057a55', anulada: '#c81e1e' }
const MEDIOS_PAGO = { efectivo: 'Efectivo', transferencia: 'Transferencia', yape: 'Yape', plin: 'Plin', cheque: 'Cheque', deposito: 'Depósito', otro: 'Otro' }

function formatearMonto(monto, moneda = 'PEN') {
  if (monto == null) return '—'
  const simbolo = moneda === 'USD' ? '$' : 'S/'
  return `${simbolo} ${Number(monto).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function FacturaDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { perfil } = useAuth()
  const [factura, setFactura] = useState(null)
  const [items, setItems] = useState([])
  const [pagos, setPagos] = useState([])
  const [casos, setCasos] = useState([])
  const [clientes, setClientes] = useState([])
  const [loading, setLoading] = useState(true)

  // Edición de cabecera
  const [editingHeader, setEditingHeader] = useState(false)
  const [headerForm, setHeaderForm] = useState({})
  const [savingHeader, setSavingHeader] = useState(false)

  // Modal de item
  const [showItemModal, setShowItemModal] = useState(false)
  const [editingItemId, setEditingItemId] = useState(null)
  const [itemForm, setItemForm] = useState({ tipo: 'fijo', caso_id: '', descripcion: '', cantidad: 1, precio_unitario: '' })

  // Modal de pago
  const [showPagoModal, setShowPagoModal] = useState(false)
  const [editingPagoId, setEditingPagoId] = useState(null)
  const [pagoForm, setPagoForm] = useState({ fecha: hoyEnLima(), monto: '', medio_pago: 'transferencia', referencia: '', notas: '' })

  const [saving, setSaving] = useState(false)

  const esSocioAdmin = perfil?.rol === 'socio_admin'

  useEffect(() => { loadAll() }, [id])

  async function loadAll() {
    setLoading(true)
    const [facturaRes, itemsRes, pagosRes, casosRes, clientesRes] = await Promise.all([
      supabase.from('facturas').select('*, clientes(id, nombre), perfiles!facturas_creado_por_fkey(nombre)').eq('id', id).single(),
      supabase.from('factura_items').select('*, casos(id, numero_expediente, titulo)').eq('factura_id', id).order('orden').order('creado_en'),
      supabase.from('pagos').select('*, perfiles!pagos_registrado_por_fkey(nombre)').eq('factura_id', id).order('fecha', { ascending: false }),
      supabase.from('casos').select('id, numero_expediente, titulo, cliente_id').order('numero_expediente'),
      supabase.from('clientes').select('id, nombre').order('nombre')
    ])
    setFactura(facturaRes.data)
    setHeaderForm(facturaRes.data || {})
    setItems(itemsRes.data || [])
    setPagos(pagosRes.data || [])
    setCasos(casosRes.data || [])
    setClientes(clientesRes.data || [])
    setLoading(false)
  }

  const enBorrador = factura?.estado === 'borrador'
  const anulada = factura?.estado === 'anulada'
  const totalPagado = pagos.reduce((s, p) => s + Number(p.monto), 0)
  const saldo = (Number(factura?.total) || 0) - totalPagado
  // Edición permitida si: en borrador, o si es socio_admin y no está anulada
  const puedeEditar = enBorrador || (esSocioAdmin && !anulada)

  // ============ CABECERA ============
  async function handleSaveHeader() {
    setSavingHeader(true)
    await supabase.from('facturas').update({
      cliente_id: headerForm.cliente_id,
      moneda: headerForm.moneda,
      fecha_emision: headerForm.fecha_emision,
      afecto_igv: headerForm.afecto_igv,
      notas: headerForm.notas || null
    }).eq('id', id)
    setEditingHeader(false)
    await loadAll()
    setSavingHeader(false)
  }

  // ============ ITEMS ============
  function abrirNuevoItem() {
    setEditingItemId(null)
    setItemForm({ tipo: 'fijo', caso_id: '', descripcion: '', cantidad: 1, precio_unitario: '' })
    setShowItemModal(true)
  }

  function abrirEditarItem(it) {
    setEditingItemId(it.id)
    setItemForm({
      tipo: it.tipo,
      caso_id: it.caso_id || '',
      descripcion: it.descripcion,
      cantidad: it.cantidad,
      precio_unitario: it.precio_unitario
    })
    setShowItemModal(true)
  }

  async function handleSaveItem(e) {
    e.preventDefault()
    setSaving(true)
    const cantidad = parseFloat(itemForm.cantidad) || 0
    const precio = parseFloat(itemForm.precio_unitario) || 0
    const importe = +(cantidad * precio).toFixed(2)

    const payload = {
      tipo: itemForm.tipo,
      caso_id: itemForm.caso_id || null,
      descripcion: itemForm.descripcion,
      cantidad,
      precio_unitario: precio,
      importe
    }

    const { error } = editingItemId
      ? await supabase.from('factura_items').update(payload).eq('id', editingItemId)
      : await supabase.from('factura_items').insert({ ...payload, factura_id: id })

    if (error) { alert('Error: ' + error.message); setSaving(false); return }
    setShowItemModal(false)
    setEditingItemId(null)
    await loadAll()
    setSaving(false)
  }

  async function handleEliminarItem(itemId) {
    if (!confirm('¿Eliminar este item de la factura?')) return
    await supabase.from('factura_items').delete().eq('id', itemId)
    await loadAll()
  }

  // ============ PAGOS ============
  function abrirNuevoPago() {
    setEditingPagoId(null)
    setPagoForm({ fecha: hoyEnLima(), monto: '', medio_pago: 'transferencia', referencia: '', notas: '' })
    setShowPagoModal(true)
  }

  function abrirEditarPago(p) {
    setEditingPagoId(p.id)
    setPagoForm({
      fecha: p.fecha,
      monto: p.monto,
      medio_pago: p.medio_pago,
      referencia: p.referencia || '',
      notas: p.notas || ''
    })
    setShowPagoModal(true)
  }

  async function handleSavePago(e) {
    e.preventDefault()
    const monto = parseFloat(pagoForm.monto)
    if (!monto || monto <= 0) { alert('El monto debe ser mayor a 0'); return }
    setSaving(true)
    const payload = {
      fecha: pagoForm.fecha,
      monto,
      medio_pago: pagoForm.medio_pago,
      referencia: pagoForm.referencia || null,
      notas: pagoForm.notas || null
    }
    const { error } = editingPagoId
      ? await supabase.from('pagos').update(payload).eq('id', editingPagoId)
      : await supabase.from('pagos').insert({ ...payload, factura_id: id, registrado_por: perfil.id })
    if (error) { alert('Error: ' + error.message); setSaving(false); return }
    setShowPagoModal(false)
    setEditingPagoId(null)
    await loadAll()
    setSaving(false)
  }

  async function handleEliminarPago(pagoId) {
    if (!confirm('¿Eliminar este pago? El estado de la factura se recalculará.')) return
    await supabase.from('pagos').delete().eq('id', pagoId)
    await loadAll()
  }

  // ============ ACCIONES DE FACTURA ============
  async function handleEmitir() {
    if (items.length === 0) { alert('No puedes emitir una factura sin items. Agrega al menos uno.'); return }
    if (!confirm('¿Emitir esta factura? Una vez emitida se le asignará número correlativo y solo el Socio Administrador podrá editarla.')) return
    await supabase.from('facturas').update({ estado: 'emitida' }).eq('id', id)
    await loadAll()
  }

  async function handleAnular() {
    if (!confirm('¿Anular esta factura? Los pagos asociados se mantendrán como registro pero la factura no contará para cuentas por cobrar.')) return
    await supabase.from('facturas').update({ estado: 'anulada' }).eq('id', id)
    await loadAll()
  }

  async function handleEliminarFactura() {
    if (!esSocioAdmin) return
    if (pagos.length > 0) {
      alert(`No se puede eliminar esta factura. Tiene ${pagos.length} pago(s) registrado(s). Anúlala en su lugar.`)
      return
    }
    if (!confirm(`⚠️ ELIMINAR PERMANENTEMENTE esta factura.\n\nEsta acción NO se puede deshacer.\n\nSi tienes dudas, mejor anúlala.\n\n¿Continuar?`)) return
    if (!confirm('Última confirmación: ¿borrar la factura para siempre?')) return
    const { error } = await supabase.from('facturas').delete().eq('id', id)
    if (error) { alert('Error: ' + error.message); return }
    navigate('/honorarios')
  }

  function handleImprimir() {
    window.open(`/honorarios/${id}/imprimir`, '_blank')
  }

  if (loading) return <div className="loading-page"><div className="spinner"></div></div>
  if (!factura) return <div style={{ padding: 40, textAlign: 'center' }}>Factura no encontrada</div>

  // Casos filtrados por cliente (si hay cliente seleccionado, mostrar solo sus casos primero)
  const casosDelCliente = casos.filter(c => c.cliente_id === factura.cliente_id)
  const otrosCasos = casos.filter(c => c.cliente_id !== factura.cliente_id)

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn-icon" onClick={() => navigate('/honorarios')}><ArrowLeft size={16} /></button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div className="page-title" style={{ fontSize: '1.2rem' }}>
                {factura.numero || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Borrador sin emitir</span>}
              </div>
              <span style={{ fontSize: '0.72rem', background: ESTADO_COLORS[factura.estado], color: 'white', padding: '3px 10px', borderRadius: 4, fontWeight: 600 }}>
                {ESTADO_LABELS[factura.estado]}
              </span>
              <span style={{ fontSize: '0.72rem', background: 'var(--cream)', padding: '3px 10px', borderRadius: 4, fontWeight: 600 }}>
                {TIPO_COMPROBANTE_LABELS[factura.tipo_comprobante]}
              </span>
            </div>
            <div className="page-subtitle">{factura.clientes?.nombre} · {formatearFecha(factura.fecha_emision)}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {factura.numero && (
            <button className="btn btn-outline btn-sm" onClick={handleImprimir} title="Vista imprimible"><Printer size={14} />Imprimir</button>
          )}
          {enBorrador && (
            <button className="btn btn-primary btn-sm" onClick={handleEmitir}><Send size={14} />Emitir</button>
          )}
          {!enBorrador && !anulada && (
            <button className="btn btn-outline btn-sm" onClick={handleAnular} style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}><Ban size={14} />Anular</button>
          )}
          {esSocioAdmin && enBorrador && (
            <button className="btn-icon" onClick={handleEliminarFactura} style={{ color: 'var(--danger)' }} title="Eliminar factura"><Trash2 size={14} /></button>
          )}
        </div>
      </div>

      <div className="detail-grid">
        {/* COLUMNA IZQUIERDA: Items */}
        <div>
          {/* CABECERA / DATOS GENERALES */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header">
              <div className="card-title">Datos Generales</div>
              {puedeEditar && !editingHeader && (
                <button className="btn-icon" onClick={() => setEditingHeader(true)} title="Editar datos generales"><Edit2 size={14} /></button>
              )}
              {editingHeader && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn-icon" onClick={() => { setHeaderForm(factura); setEditingHeader(false) }}><X size={14} /></button>
                  <button className="btn-icon" onClick={handleSaveHeader} disabled={savingHeader} style={{ color: 'var(--success)' }}><Save size={14} /></button>
                </div>
              )}
            </div>
            {editingHeader ? (
              <div>
                <div className="form-group">
                  <label className="form-label">Cliente *</label>
                  <select className="form-select" value={headerForm.cliente_id || ''} onChange={e => setHeaderForm({ ...headerForm, cliente_id: e.target.value })} required>
                    <option value="">Selecciona...</option>
                    {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </div>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Fecha de Emisión</label>
                    <input className="form-input" type="date" value={headerForm.fecha_emision || ''} onChange={e => setHeaderForm({ ...headerForm, fecha_emision: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Moneda</label>
                    <select className="form-select" value={headerForm.moneda || 'PEN'} onChange={e => setHeaderForm({ ...headerForm, moneda: e.target.value })}>
                      <option value="PEN">PEN (S/)</option>
                      <option value="USD">USD ($)</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.88rem', padding: '8px 12px', background: 'var(--cream)', borderRadius: 6 }}>
                    <input type="checkbox" checked={headerForm.afecto_igv || false} onChange={e => setHeaderForm({ ...headerForm, afecto_igv: e.target.checked })} style={{ accentColor: 'var(--navy)' }} />
                    Afecto a IGV (18%)
                  </label>
                </div>
                <div className="form-group">
                  <label className="form-label">Notas</label>
                  <textarea className="form-textarea" value={headerForm.notas || ''} onChange={e => setHeaderForm({ ...headerForm, notas: e.target.value })} style={{ minHeight: 60 }} />
                </div>
              </div>
            ) : (
              <div>
                <div className="detail-field"><div className="detail-label">Cliente</div><div className="detail-value">{factura.clientes?.nombre}</div></div>
                <div className="detail-field"><div className="detail-label">Tipo</div><div className="detail-value">{TIPO_COMPROBANTE_LABELS[factura.tipo_comprobante]}</div></div>
                <div className="detail-field"><div className="detail-label">Fecha</div><div className="detail-value">{formatearFecha(factura.fecha_emision)}</div></div>
                <div className="detail-field"><div className="detail-label">Moneda</div><div className="detail-value">{factura.moneda}</div></div>
                <div className="detail-field"><div className="detail-label">Afecto a IGV</div><div className="detail-value">{factura.afecto_igv ? 'Sí (18%)' : 'No'}</div></div>
                {factura.notas && <div className="detail-field"><div className="detail-label">Notas</div><div className="detail-value" style={{ whiteSpace: 'pre-wrap' }}>{factura.notas}</div></div>}
              </div>
            )}
          </div>

          {/* ITEMS */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Items / Conceptos ({items.length})</div>
              {puedeEditar && <button className="btn btn-primary btn-sm" onClick={abrirNuevoItem}><Plus size={14} />Agregar Item</button>}
            </div>
            {items.length === 0 ? (
              <div className="empty-state"><FileText size={36} /><p>No hay items en esta factura</p></div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Tipo</th>
                      <th>Descripción</th>
                      <th style={{ textAlign: 'right', width: 80 }}>Cant.</th>
                      <th style={{ textAlign: 'right', width: 110 }}>P. Unit.</th>
                      <th style={{ textAlign: 'right', width: 110 }}>Importe</th>
                      {puedeEditar && <th style={{ width: 70 }}></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(it => (
                      <tr key={it.id}>
                        <td><span style={{ fontSize: '0.7rem', background: 'var(--cream)', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>{TIPO_ITEM_LABELS[it.tipo]}</span></td>
                        <td>
                          <div style={{ fontWeight: 500, fontSize: '0.88rem' }}>{it.descripcion}</div>
                          {it.casos && <div style={{ fontSize: '0.72rem', color: 'var(--navy)', fontFamily: 'monospace', marginTop: 2 }}>{it.casos.numero_expediente} — {it.casos.titulo}</div>}
                        </td>
                        <td style={{ textAlign: 'right' }}>{Number(it.cantidad).toFixed(2)}</td>
                        <td style={{ textAlign: 'right' }}>{formatearMonto(it.precio_unitario, factura.moneda)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatearMonto(it.importe, factura.moneda)}</td>
                        {puedeEditar && (
                          <td>
                            <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                              <button className="btn-icon" onClick={() => abrirEditarItem(it)}><Edit2 size={13} /></button>
                              <button className="btn-icon" onClick={() => handleEliminarItem(it.id)} style={{ color: 'var(--danger)' }}><Trash2 size={13} /></button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* PAGOS */}
          {!enBorrador && (
            <div className="card" style={{ marginTop: 16 }}>
              <div className="card-header">
                <div className="card-title">Pagos Registrados ({pagos.length})</div>
                {!anulada && <button className="btn btn-primary btn-sm" onClick={abrirNuevoPago}><Plus size={14} />Registrar Pago</button>}
              </div>
              {pagos.length === 0 ? (
                <div className="empty-state"><CreditCard size={36} /><p>Aún no hay pagos registrados</p></div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Medio</th>
                        <th>Referencia</th>
                        <th style={{ textAlign: 'right' }}>Monto</th>
                        <th>Registrado por</th>
                        <th style={{ width: 70 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagos.map(p => (
                        <tr key={p.id}>
                          <td style={{ fontSize: '0.85rem' }}>{formatearFecha(p.fecha)}</td>
                          <td><span style={{ fontSize: '0.72rem', background: 'var(--cream)', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>{MEDIOS_PAGO[p.medio_pago]}</span></td>
                          <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{p.referencia || '—'}</td>
                          <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--success)' }}>{formatearMonto(p.monto, factura.moneda)}</td>
                          <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{p.perfiles?.nombre || '—'}</td>
                          <td>
                            <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                              <button className="btn-icon" onClick={() => abrirEditarPago(p)}><Edit2 size={13} /></button>
                              <button className="btn-icon" onClick={() => handleEliminarPago(p.id)} style={{ color: 'var(--danger)' }}><Trash2 size={13} /></button>
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
        </div>

        {/* COLUMNA DERECHA: Totales */}
        <div>
          <div className="card">
            <div className="card-title" style={{ marginBottom: 16 }}>Totales</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-light)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Subtotal:</span>
              <span style={{ fontWeight: 600 }}>{formatearMonto(factura.subtotal, factura.moneda)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-light)' }}>
              <span style={{ color: 'var(--text-muted)' }}>IGV {factura.afecto_igv ? '(18%)' : '(0%)'}:</span>
              <span style={{ fontWeight: 600 }}>{formatearMonto(factura.igv, factura.moneda)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', background: 'var(--navy)', color: 'white', borderRadius: 6, paddingLeft: 12, paddingRight: 12, marginTop: 8 }}>
              <span>TOTAL:</span>
              <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>{formatearMonto(factura.total, factura.moneda)}</span>
            </div>

            {!enBorrador && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', marginTop: 12, borderTop: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Pagado:</span>
                  <span style={{ fontWeight: 600, color: 'var(--success)' }}>{formatearMonto(totalPagado, factura.moneda)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Saldo:</span>
                  <span style={{ fontWeight: 700, color: saldo > 0 ? 'var(--danger)' : 'var(--success)' }}>{formatearMonto(saldo, factura.moneda)}</span>
                </div>
              </>
            )}
          </div>

          {enBorrador && items.length > 0 && (
            <div className="card" style={{ marginTop: 16, background: 'var(--gold-light)', borderLeft: '4px solid var(--gold)' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                <strong>Lista para emitir.</strong> Cuando emitas la factura se le asignará un número correlativo y solo el Socio Administrador podrá modificarla.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL ITEM */}
      {showItemModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowItemModal(false)}>
          <div className="modal">
            <div className="modal-header"><div className="modal-title">{editingItemId ? 'Editar Item' : 'Nuevo Item'}</div><button className="btn-icon" onClick={() => setShowItemModal(false)}>✕</button></div>
            <form onSubmit={handleSaveItem}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Tipo *</label>
                    <select className="form-select" value={itemForm.tipo} onChange={e => setItemForm({ ...itemForm, tipo: e.target.value })}>
                      {Object.entries(TIPO_ITEM_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Caso vinculado (opcional)</label>
                    <select className="form-select" value={itemForm.caso_id} onChange={e => setItemForm({ ...itemForm, caso_id: e.target.value })}>
                      <option value="">Sin caso específico</option>
                      {casosDelCliente.length > 0 && (
                        <optgroup label="Casos del cliente">
                          {casosDelCliente.map(c => <option key={c.id} value={c.id}>{c.numero_expediente} — {c.titulo}</option>)}
                        </optgroup>
                      )}
                      {otrosCasos.length > 0 && (
                        <optgroup label="Otros casos">
                          {otrosCasos.map(c => <option key={c.id} value={c.id}>{c.numero_expediente} — {c.titulo}</option>)}
                        </optgroup>
                      )}
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Descripción *</label>
                  <textarea className="form-textarea" value={itemForm.descripcion} onChange={e => setItemForm({ ...itemForm, descripcion: e.target.value })} placeholder="Ej: Honorarios profesionales por elaboración de demanda civil..." style={{ minHeight: 60 }} required />
                </div>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Cantidad *</label>
                    <input className="form-input" type="number" step="0.01" min="0.01" value={itemForm.cantidad} onChange={e => setItemForm({ ...itemForm, cantidad: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Precio Unitario ({factura.moneda}) *</label>
                    <input className="form-input" type="number" step="0.01" min="0" value={itemForm.precio_unitario} onChange={e => setItemForm({ ...itemForm, precio_unitario: e.target.value })} required />
                  </div>
                </div>
                <div style={{ background: 'var(--cream)', padding: '10px 14px', borderRadius: 6, marginTop: 8, fontSize: '0.88rem', textAlign: 'right', fontWeight: 700 }}>
                  Importe: {formatearMonto((parseFloat(itemForm.cantidad) || 0) * (parseFloat(itemForm.precio_unitario) || 0), factura.moneda)}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowItemModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PAGO */}
      {showPagoModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowPagoModal(false)}>
          <div className="modal">
            <div className="modal-header"><div className="modal-title">{editingPagoId ? 'Editar Pago' : 'Registrar Pago'}</div><button className="btn-icon" onClick={() => setShowPagoModal(false)}>✕</button></div>
            <form onSubmit={handleSavePago}>
              <div className="modal-body">
                {!editingPagoId && saldo > 0 && (
                  <div style={{ background: 'var(--cream)', padding: '8px 12px', borderRadius: 6, marginBottom: 14, fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Saldo pendiente:</span>
                    <strong>{formatearMonto(saldo, factura.moneda)}</strong>
                  </div>
                )}
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Fecha *</label>
                    <input className="form-input" type="date" value={pagoForm.fecha} onChange={e => setPagoForm({ ...pagoForm, fecha: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Monto ({factura.moneda}) *</label>
                    <input className="form-input" type="number" step="0.01" min="0.01" value={pagoForm.monto} onChange={e => setPagoForm({ ...pagoForm, monto: e.target.value })} required />
                  </div>
                </div>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Medio de Pago *</label>
                    <select className="form-select" value={pagoForm.medio_pago} onChange={e => setPagoForm({ ...pagoForm, medio_pago: e.target.value })}>
                      {Object.entries(MEDIOS_PAGO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Referencia</label>
                    <input className="form-input" value={pagoForm.referencia} onChange={e => setPagoForm({ ...pagoForm, referencia: e.target.value })} placeholder="N° de operación, voucher..." />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Notas</label>
                  <textarea className="form-textarea" value={pagoForm.notas} onChange={e => setPagoForm({ ...pagoForm, notas: e.target.value })} style={{ minHeight: 50 }} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowPagoModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
