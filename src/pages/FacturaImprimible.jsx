import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { formatearFecha } from '../lib/dateUtils'
import { Printer, ArrowLeft } from 'lucide-react'

const TIPO_COMPROBANTE_LABELS = { factura: 'FACTURA', recibo_honorarios: 'RECIBO POR HONORARIOS', sin_comprobante: 'DOCUMENTO INTERNO' }
const TIPO_ITEM_LABELS = { horas: 'Horas', fijo: 'Monto Fijo', iguala: 'Iguala Mensual', exito: 'Cuota de Éxito', otro: 'Otro' }
const ESTADO_LABELS = { borrador: 'Borrador', emitida: 'Emitida', pagada_parcial: 'Pagada Parcial', pagada: 'Pagada', anulada: 'ANULADA' }
const MEDIOS_PAGO = { efectivo: 'Efectivo', transferencia: 'Transferencia', yape: 'Yape', plin: 'Plin', cheque: 'Cheque', deposito: 'Depósito', otro: 'Otro' }

function formatearMonto(monto, moneda = 'PEN') {
  if (monto == null) return '—'
  const simbolo = moneda === 'USD' ? '$' : 'S/'
  return `${simbolo} ${Number(monto).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// Convierte número a letras (versión simplificada para facturas)
function numeroALetras(num, moneda) {
  const entero = Math.floor(num)
  const decimal = Math.round((num - entero) * 100)
  const monedaTexto = moneda === 'USD' ? 'DÓLARES AMERICANOS' : 'SOLES'
  return `SON: ${entero.toLocaleString('es-PE')} CON ${String(decimal).padStart(2, '0')}/100 ${monedaTexto}`
}

export default function FacturaImprimible() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [factura, setFactura] = useState(null)
  const [items, setItems] = useState([])
  const [pagos, setPagos] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [id])

  async function loadData() {
    const [facturaRes, itemsRes, pagosRes] = await Promise.all([
      supabase.from('facturas').select('*, clientes(id, nombre, documento_identidad, direccion, email, telefono, tipo), perfiles!facturas_creado_por_fkey(nombre)').eq('id', id).single(),
      supabase.from('factura_items').select('*, casos(numero_expediente, titulo)').eq('factura_id', id).order('orden').order('creado_en'),
      supabase.from('pagos').select('*').eq('factura_id', id).order('fecha')
    ])
    setFactura(facturaRes.data)
    setItems(itemsRes.data || [])
    setPagos(pagosRes.data || [])
    setLoading(false)
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Cargando...</div>
  if (!factura) return <div style={{ padding: 40, textAlign: 'center' }}>Factura no encontrada</div>

  const totalPagado = pagos.reduce((s, p) => s + Number(p.monto), 0)
  const saldo = (Number(factura.total) || 0) - totalPagado

  return (
    <>
      {/* Estilos específicos para impresión */}
      <style>{`
        @media print {
          body { margin: 0; padding: 0; background: white !important; }
          .no-print { display: none !important; }
          .factura-page { box-shadow: none !important; margin: 0 !important; padding: 20mm !important; }
        }
        @page {
          size: A4;
          margin: 0;
        }
        body {
          background: #f0f0f0;
        }
        .factura-page {
          max-width: 210mm;
          margin: 20px auto;
          background: white;
          padding: 20mm;
          box-shadow: 0 2px 12px rgba(0,0,0,0.1);
          font-family: 'Georgia', serif;
          color: #1a1a1a;
          font-size: 11pt;
          line-height: 1.4;
        }
        .factura-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 30px;
          padding-bottom: 20px;
          border-bottom: 3px double #1a365d;
        }
        .firma-logo {
          flex: 1;
        }
        .firma-logo h1 {
          font-size: 22pt;
          color: #1a365d;
          margin: 0 0 4px 0;
          font-weight: bold;
          letter-spacing: 1px;
        }
        .firma-logo .subtitle {
          font-size: 9pt;
          color: #666;
          letter-spacing: 0.5px;
        }
        .doc-info {
          text-align: right;
          border: 2px solid #1a365d;
          padding: 10px 16px;
          min-width: 200px;
        }
        .doc-info .tipo {
          font-size: 12pt;
          font-weight: bold;
          color: #1a365d;
          margin-bottom: 4px;
        }
        .doc-info .numero {
          font-size: 16pt;
          font-weight: bold;
          font-family: 'Courier New', monospace;
          color: #c8a951;
        }
        .seccion-cliente {
          background: #f7f5f0;
          padding: 12px 16px;
          margin-bottom: 20px;
          border-left: 4px solid #c8a951;
        }
        .seccion-cliente .label {
          font-size: 8pt;
          color: #666;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .seccion-cliente .nombre {
          font-size: 12pt;
          font-weight: bold;
          margin: 2px 0;
        }
        .seccion-cliente .detalle {
          font-size: 9pt;
          color: #444;
        }
        .info-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          margin-bottom: 20px;
          font-size: 9pt;
        }
        .info-cell {
          padding: 6px 0;
        }
        .info-cell .label {
          font-size: 8pt;
          color: #666;
          text-transform: uppercase;
        }
        .info-cell .value {
          font-weight: bold;
        }
        table.items-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
        }
        table.items-table th {
          background: #1a365d;
          color: white;
          padding: 8px;
          text-align: left;
          font-size: 9pt;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        table.items-table td {
          padding: 10px 8px;
          border-bottom: 1px solid #e0e0e0;
          font-size: 10pt;
          vertical-align: top;
        }
        table.items-table .text-right {
          text-align: right;
        }
        .caso-tag {
          font-size: 8pt;
          color: #1a365d;
          font-family: 'Courier New', monospace;
          margin-top: 3px;
        }
        .totales {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 20px;
        }
        .totales table {
          min-width: 280px;
          border-collapse: collapse;
        }
        .totales td {
          padding: 6px 12px;
          font-size: 10pt;
        }
        .totales tr td:first-child {
          color: #666;
          text-align: right;
        }
        .totales tr td:last-child {
          text-align: right;
          font-weight: bold;
          min-width: 120px;
        }
        .total-final {
          background: #1a365d;
          color: white;
        }
        .total-final td {
          font-size: 12pt !important;
          font-weight: bold !important;
        }
        .total-final td:first-child {
          color: white !important;
        }
        .monto-letras {
          font-size: 9pt;
          color: #444;
          font-style: italic;
          padding: 10px 0;
          border-top: 1px solid #e0e0e0;
          border-bottom: 1px solid #e0e0e0;
          margin: 16px 0;
        }
        .notas {
          background: #f7f5f0;
          padding: 12px 16px;
          margin: 20px 0;
          font-size: 9pt;
          border-radius: 4px;
        }
        .notas .label {
          font-weight: bold;
          margin-bottom: 4px;
          text-transform: uppercase;
          font-size: 8pt;
          color: #666;
        }
        .pagos-section {
          margin-top: 20px;
        }
        .pagos-section h3 {
          font-size: 10pt;
          color: #1a365d;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin: 0 0 8px 0;
          padding-bottom: 4px;
          border-bottom: 1px solid #1a365d;
        }
        .pagos-section table {
          width: 100%;
          border-collapse: collapse;
          font-size: 9pt;
        }
        .pagos-section th {
          padding: 6px 8px;
          background: #f7f5f0;
          text-align: left;
        }
        .pagos-section td {
          padding: 6px 8px;
          border-bottom: 1px solid #eee;
        }
        .footer {
          margin-top: 30px;
          padding-top: 16px;
          border-top: 1px solid #e0e0e0;
          font-size: 8pt;
          color: #666;
          text-align: center;
        }
        .estado-overlay {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) rotate(-25deg);
          font-size: 80pt;
          color: rgba(200, 30, 30, 0.15);
          font-weight: bold;
          pointer-events: none;
          z-index: 1;
          letter-spacing: 4px;
        }
        .barra-acciones {
          max-width: 210mm;
          margin: 20px auto;
          display: flex;
          justify-content: space-between;
          padding: 12px 20mm 0;
        }
        .btn-print {
          background: #1a365d;
          color: white;
          border: none;
          padding: 10px 20px;
          font-size: 11pt;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border-radius: 4px;
          font-family: inherit;
        }
        .btn-print:hover {
          background: #2d4a73;
        }
        .btn-back {
          background: white;
          color: #1a365d;
          border: 1px solid #1a365d;
          padding: 10px 20px;
          font-size: 11pt;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border-radius: 4px;
          font-family: inherit;
        }
      `}</style>

      {/* Barra de acciones (no se imprime) */}
      <div className="barra-acciones no-print">
        <button className="btn-back" onClick={() => navigate(`/honorarios/${id}`)}>
          <ArrowLeft size={16} />Volver al detalle
        </button>
        <button className="btn-print" onClick={() => window.print()}>
          <Printer size={16} />Imprimir / Guardar PDF
        </button>
      </div>

      {/* Página de la factura */}
      <div className="factura-page" style={{ position: 'relative' }}>
        {factura.estado === 'anulada' && (
          <div className="estado-overlay">ANULADA</div>
        )}

        {/* ENCABEZADO */}
        <div className="factura-header">
          <div className="firma-logo">
            <h1>VILLANUEVA &amp; SOTO</h1>
            <div className="subtitle">ABOGADOS</div>
            <div style={{ marginTop: 12, fontSize: '8pt', color: '#666' }}>
              Lima, Perú
            </div>
          </div>
          <div className="doc-info">
            <div className="tipo">{TIPO_COMPROBANTE_LABELS[factura.tipo_comprobante]}</div>
            <div className="numero">{factura.numero || 'BORRADOR'}</div>
          </div>
        </div>

        {/* DATOS DEL CLIENTE */}
        <div className="seccion-cliente">
          <div className="label">Cliente</div>
          <div className="nombre">{factura.clientes?.nombre}</div>
          <div className="detalle">
            {factura.clientes?.documento_identidad && <>Doc: {factura.clientes.documento_identidad}<br /></>}
            {factura.clientes?.direccion && <>{factura.clientes.direccion}<br /></>}
            {factura.clientes?.email && <>{factura.clientes.email}</>}
            {factura.clientes?.email && factura.clientes?.telefono && ' · '}
            {factura.clientes?.telefono && <>{factura.clientes.telefono}</>}
          </div>
        </div>

        {/* INFO DEL DOCUMENTO */}
        <div className="info-grid">
          <div className="info-cell">
            <div className="label">Fecha de Emisión</div>
            <div className="value">{formatearFecha(factura.fecha_emision)}</div>
          </div>
          <div className="info-cell">
            <div className="label">Moneda</div>
            <div className="value">{factura.moneda === 'USD' ? 'Dólares Americanos (USD)' : 'Soles (PEN)'}</div>
          </div>
          <div className="info-cell">
            <div className="label">Estado</div>
            <div className="value">{ESTADO_LABELS[factura.estado]}</div>
          </div>
        </div>

        {/* TABLA DE ITEMS */}
        <table className="items-table">
          <thead>
            <tr>
              <th style={{ width: '50%' }}>Descripción</th>
              <th style={{ width: '12%' }} className="text-right">Cantidad</th>
              <th style={{ width: '19%' }} className="text-right">P. Unitario</th>
              <th style={{ width: '19%' }} className="text-right">Importe</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan={4} style={{ textAlign: 'center', color: '#999', padding: 20 }}>Sin items registrados</td></tr>
            ) : items.map(it => (
              <tr key={it.id}>
                <td>
                  <div style={{ fontSize: '8pt', color: '#666', textTransform: 'uppercase' }}>{TIPO_ITEM_LABELS[it.tipo]}</div>
                  <div>{it.descripcion}</div>
                  {it.casos && <div className="caso-tag">Ref: {it.casos.numero_expediente} — {it.casos.titulo}</div>}
                </td>
                <td className="text-right">{Number(it.cantidad).toFixed(2)}</td>
                <td className="text-right">{formatearMonto(it.precio_unitario, factura.moneda)}</td>
                <td className="text-right"><strong>{formatearMonto(it.importe, factura.moneda)}</strong></td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* TOTALES */}
        <div className="totales">
          <table>
            <tbody>
              <tr>
                <td>Subtotal:</td>
                <td>{formatearMonto(factura.subtotal, factura.moneda)}</td>
              </tr>
              <tr>
                <td>IGV {factura.afecto_igv ? '(18%)' : '(0%)'}:</td>
                <td>{formatearMonto(factura.igv, factura.moneda)}</td>
              </tr>
              <tr className="total-final">
                <td>TOTAL:</td>
                <td>{formatearMonto(factura.total, factura.moneda)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="monto-letras">
          {numeroALetras(Number(factura.total), factura.moneda)}
        </div>

        {/* NOTAS */}
        {factura.notas && (
          <div className="notas">
            <div className="label">Notas:</div>
            <div style={{ whiteSpace: 'pre-wrap' }}>{factura.notas}</div>
          </div>
        )}

        {/* PAGOS REGISTRADOS */}
        {pagos.length > 0 && (
          <div className="pagos-section">
            <h3>Pagos Recibidos</h3>
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Medio</th>
                  <th>Referencia</th>
                  <th style={{ textAlign: 'right' }}>Monto</th>
                </tr>
              </thead>
              <tbody>
                {pagos.map(p => (
                  <tr key={p.id}>
                    <td>{formatearFecha(p.fecha)}</td>
                    <td>{MEDIOS_PAGO[p.medio_pago]}</td>
                    <td>{p.referencia || '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{formatearMonto(p.monto, factura.moneda)}</td>
                  </tr>
                ))}
                <tr style={{ background: '#f7f5f0', fontWeight: 'bold' }}>
                  <td colSpan={3} style={{ textAlign: 'right' }}>Total Pagado:</td>
                  <td style={{ textAlign: 'right' }}>{formatearMonto(totalPagado, factura.moneda)}</td>
                </tr>
                {saldo > 0 && (
                  <tr style={{ background: '#fef3c7', fontWeight: 'bold' }}>
                    <td colSpan={3} style={{ textAlign: 'right' }}>Saldo Pendiente:</td>
                    <td style={{ textAlign: 'right', color: '#c81e1e' }}>{formatearMonto(saldo, factura.moneda)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* FOOTER */}
        <div className="footer">
          {factura.tipo_comprobante === 'sin_comprobante' && (
            <div style={{ marginBottom: 6, color: '#999', fontStyle: 'italic' }}>
              Documento interno — No constituye comprobante de pago para efectos tributarios.
            </div>
          )}
          {factura.perfiles?.nombre && <>Emitido por: {factura.perfiles.nombre}</>}
          {' · '}Villanueva &amp; Soto Abogados
        </div>
      </div>
    </>
  )
}
