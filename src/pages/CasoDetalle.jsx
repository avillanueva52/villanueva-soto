import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { hoyEnLima, formatearFecha } from '../lib/dateUtils'
import { useAuth } from '../hooks/useAuth'
import { ArrowLeft, Upload, Plus, Trash2, FileText, Clock, CheckSquare, Edit2, Save, X, Activity } from 'lucide-react'

const TIPOS_TAREA = ['redaccion', 'investigacion', 'audiencia', 'reunion', 'tramite', 'consulta', 'revision', 'otro']
const TIPOS_TAREA_LABELS = { redaccion: 'Redacción', investigacion: 'Investigación', audiencia: 'Audiencia', reunion: 'Reunión', tramite: 'Trámite', consulta: 'Consulta', revision: 'Revisión', otro: 'Otro' }

// Etapas procesales por tipo de caso (basadas en el sistema procesal peruano)
const ETAPAS_POR_TIPO = {
  penal: ['En Sede Policial', 'Diligencias preliminares', 'Investigación preparatoria', 'Etapa intermedia', 'Juicio oral', 'Sentencia', 'Apelación', 'Casación', 'Ejecución de sentencia', 'Archivado'],
  civil: ['Postulación / Demanda', 'Saneamiento procesal', 'Audiencia de pruebas', 'Sentencia (1ra instancia)', 'Apelación', 'Sentencia (2da instancia)', 'Casación', 'Ejecución de sentencia'],
  laboral: ['Demanda', 'Audiencia de conciliación', 'Audiencia de juzgamiento', 'Sentencia', 'Apelación', 'Casación', 'Ejecución'],
  constitucional: ['Admisión', 'Audiencia única', 'Sentencia (1ra instancia)', 'Apelación', 'Vista de causa TC', 'Sentencia TC'],
  administrativo: ['Demanda', 'Saneamiento', 'Audiencia', 'Sentencia', 'Apelación', 'Casación'],
  consulta: ['En análisis', 'Informe emitido', 'Concluida']
}

export default function CasoDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { perfil } = useAuth()
  const [caso, setCaso] = useState(null)
  const [documentos, setDocumentos] = useState([])
  const [horas, setHoras] = useState([])
  const [tareas, setTareas] = useState([])
  const [estados, setEstados] = useState([])
  const [abogados, setAbogados] = useState([])
  const [clientes, setClientes] = useState([])
  const [numerosExpediente, setNumerosExpediente] = useState([])
  const [tab, setTab] = useState('info')
  const [loading, setLoading] = useState(true)
  const [showHorasModal, setShowHorasModal] = useState(false)
  const [showTareaModal, setShowTareaModal] = useState(false)
  const [showEstadoModal, setShowEstadoModal] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({})
  const [horaForm, setHoraForm] = useState({ tipo_tarea: 'redaccion', horas: '', descripcion: '', fecha: hoyEnLima() })
  const [tareaForm, setTareaForm] = useState({ titulo: '', descripcion: '', prioridad: 'media', asignado_a: '', fecha_vencimiento: '' })
  const [estadoForm, setEstadoForm] = useState({ titulo: '', descripcion: '', fecha: hoyEnLima() })
  const [nuevoNumero, setNuevoNumero] = useState({ etapa: '', etapaCustom: '', numero: '' })
  const [etapaCustomEdit, setEtapaCustomEdit] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [uploadQueue, setUploadQueue] = useState([])
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 })
  const [editingDoc, setEditingDoc] = useState(null)
  const [editDocForm, setEditDocForm] = useState({ nombre: '', fecha_documento: '', descripcion: '', carpeta: '' })
  const [subTabDoc, setSubTabDoc] = useState('todos')
  const fileRef = useRef()

  useEffect(() => { loadAll() }, [id])

  async function loadAll() {
    const [casoRes, docsRes, horasRes, tareasRes, estadosRes, abogadosRes, clientesRes, numerosRes] = await Promise.all([
      supabase.from('casos').select('*, clientes(id,nombre), perfiles(id,nombre)').eq('id', id).single(),
      supabase.from('documentos').select('*, perfiles(nombre)').eq('caso_id', id).order('fecha_documento', { ascending: false }),
      supabase.from('horas_trabajadas').select('*, perfiles(nombre,rol)').eq('caso_id', id).order('fecha', { ascending: false }),
      supabase.from('tareas').select('*, perfiles!tareas_asignado_a_fkey(nombre)').eq('caso_id', id).order('creado_en', { ascending: false }),
      supabase.from('estados_procesales').select('*, perfiles(nombre)').eq('caso_id', id).order('fecha', { ascending: false }),
      supabase.from('perfiles').select('id,nombre,rol').eq('activo', true).order('nombre'),
      supabase.from('clientes').select('id,nombre').order('nombre'),
      supabase.from('numeros_expediente').select('*').eq('caso_id', id).order('creado_en', { ascending: true })
    ])
    setCaso(casoRes.data)
    setEditForm(casoRes.data || {})
    setDocumentos(docsRes.data || [])
    setHoras(horasRes.data || [])
    setTareas(tareasRes.data || [])
    setEstados(estadosRes.data || [])
    setAbogados(abogadosRes.data || [])
    setClientes(clientesRes.data || [])
    setNumerosExpediente(numerosRes.data || [])
    setLoading(false)
  }

  async function handleSaveEdit() {
    setSaving(true)
    await supabase.from('casos').update({
      titulo: editForm.titulo,
      tipo: editForm.tipo,
      estado: editForm.estado,
      cliente_id: editForm.cliente_id || null,
      abogado_responsable_id: editForm.abogado_responsable_id || null,
      juzgado: editForm.juzgado,
      juez_nombre: editForm.juez_nombre,
      descripcion: editForm.descripcion,
      notas_observaciones: editForm.notas_observaciones,
      fecha_inicio: editForm.fecha_inicio,
      fecha_cierre: editForm.fecha_cierre || null,
      etapa_procesal: editForm.etapa_procesal,
      // Campos específicos para penal
      delitos: editForm.delitos,
      carpeta_fiscal: editForm.carpeta_fiscal,
      fiscalia: editForm.fiscalia,
      fiscal_nombre: editForm.fiscal_nombre,
      procesados: editForm.procesados,
      agraviados: editForm.agraviados,
      terceros: editForm.terceros,
      // Campos específicos para no penal
      demandante: editForm.demandante,
      demandado: editForm.demandado
    }).eq('id', id)
    setEditing(false)
    setEtapaCustomEdit(false)
    loadAll()
    setSaving(false)
  }

  function cancelarEdicion() {
    setEditForm(caso || {})
    setEditing(false)
    setEtapaCustomEdit(false)
  }

  async function handleAgregarNumero(e) {
    e.preventDefault()
    const etapaFinal = nuevoNumero.etapa === '__custom__' ? nuevoNumero.etapaCustom : nuevoNumero.etapa
    if (!etapaFinal || !etapaFinal.trim() || !nuevoNumero.numero.trim()) return
    await supabase.from('numeros_expediente').insert({
      caso_id: id,
      etapa: etapaFinal.trim(),
      numero: nuevoNumero.numero.trim()
    })
    setNuevoNumero({ etapa: '', etapaCustom: '', numero: '' })
    loadAll()
  }

  async function handleEliminarNumero(numeroId) {
    if (!confirm('¿Eliminar este número de expediente?')) return
    await supabase.from('numeros_expediente').delete().eq('id', numeroId)
    loadAll()
  }

  // Helper: extrae la ruta interna del archivo
  function getStoragePath(urlOrPath) {
    if (!urlOrPath) return null
    if (urlOrPath.startsWith('http')) {
      const match = urlOrPath.match(/\/documentos\/(.+?)(\?|$)/)
      return match ? match[1] : null
    }
    return urlOrPath
  }

  function handleSelectFiles(e) {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    const queue = files.map(file => ({
      file,
      nombre: file.name,
      fecha_documento: hoyEnLima(),
      descripcion: '',
      carpeta: '',
      tipo_documento: (file.name.split('.').pop() || '').toUpperCase()
    }))
    setUploadQueue(queue)
    setShowUploadModal(true)
    if (fileRef.current) fileRef.current.value = ''
  }

  function updateQueueItem(index, field, value) {
    setUploadQueue(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item))
  }

  function removeFromQueue(index) {
    setUploadQueue(prev => prev.filter((_, i) => i !== index))
  }

  async function handleUploadAll() {
    if (uploadQueue.length === 0) return
    setUploadingFile(true)
    setUploadProgress({ current: 0, total: uploadQueue.length })
    let errores = []
    for (let i = 0; i < uploadQueue.length; i++) {
      const item = uploadQueue[i]
      setUploadProgress({ current: i + 1, total: uploadQueue.length })
      const ext = item.file.name.split('.').pop()
      const path = `${id}/${Date.now()}_${i}.${ext}`
      const { error: uploadError } = await supabase.storage.from('documentos').upload(path, item.file)
      if (uploadError) {
        errores.push(`${item.nombre}: ${uploadError.message}`)
        continue
      }
      await supabase.from('documentos').insert({
        caso_id: id,
        nombre: item.nombre,
        url: path,
        subido_por: perfil.id,
        fecha_documento: item.fecha_documento,
        tipo_documento: item.tipo_documento,
        descripcion: item.descripcion || null,
        carpeta: item.carpeta?.trim() || null
      })
    }
    setUploadingFile(false)
    setShowUploadModal(false)
    setUploadQueue([])
    setUploadProgress({ current: 0, total: 0 })
    if (errores.length > 0) {
      alert('Algunos documentos no se pudieron subir:\n\n' + errores.join('\n'))
    }
    loadAll()
  }

  function handleEditDoc(doc) {
    setEditingDoc(doc)
    setEditDocForm({
      nombre: doc.nombre || '',
      fecha_documento: doc.fecha_documento || hoyEnLima(),
      descripcion: doc.descripcion || '',
      carpeta: doc.carpeta || ''
    })
  }

  async function handleSaveEditDoc(e) {
    e.preventDefault()
    setSaving(true)
    await supabase.from('documentos').update({
      nombre: editDocForm.nombre,
      fecha_documento: editDocForm.fecha_documento,
      descripcion: editDocForm.descripcion || null,
      carpeta: editDocForm.carpeta?.trim() || null
    }).eq('id', editingDoc.id)
    setEditingDoc(null)
    setEditDocForm({ nombre: '', fecha_documento: '', descripcion: '', carpeta: '' })
    loadAll()
    setSaving(false)
  }

  async function handleViewDoc(doc) {
    const path = getStoragePath(doc.url)
    if (!path) {
      alert('No se pudo determinar la ruta del documento.')
      return
    }
    const { data, error } = await supabase.storage.from('documentos').createSignedUrl(path, 3600, { download: false })
    if (error) {
      alert('No se pudo abrir el documento: ' + error.message)
      return
    }
    window.open(data.signedUrl, '_blank')
  }

  async function handleDeleteDoc(docId, url) {
    if (!confirm('¿Eliminar este documento?')) return
    const path = getStoragePath(url)
    if (path) {
      await supabase.storage.from('documentos').remove([path])
    }
    await supabase.from('documentos').delete().eq('id', docId)
    loadAll()
  }

  async function handleSaveHoras(e) {
    e.preventDefault()
    setSaving(true)
    await supabase.from('horas_trabajadas').insert({ ...horaForm, caso_id: id, perfil_id: perfil.id, horas: parseFloat(horaForm.horas) })
    setShowHorasModal(false)
    setHoraForm({ tipo_tarea: 'redaccion', horas: '', descripcion: '', fecha: hoyEnLima() })
    loadAll()
    setSaving(false)
  }

  async function handleSaveTarea(e) {
    e.preventDefault()
    setSaving(true)
    await supabase.from('tareas').insert({ ...tareaForm, caso_id: id, creado_por: perfil.id, asignado_a: tareaForm.asignado_a || null, fecha_vencimiento: tareaForm.fecha_vencimiento || null })
    setShowTareaModal(false)
    setTareaForm({ titulo: '', descripcion: '', prioridad: 'media', asignado_a: '', fecha_vencimiento: '' })
    loadAll()
    setSaving(false)
  }

  async function handleSaveEstado(e) {
    e.preventDefault()
    setSaving(true)
    await supabase.from('estados_procesales').insert({ ...estadoForm, caso_id: id, perfil_id: perfil.id })
    setShowEstadoModal(false)
    setEstadoForm({ titulo: '', descripcion: '', fecha: hoyEnLima() })
    loadAll()
    setSaving(false)
  }

  async function handleDeleteEstado(estadoId) {
    if (!confirm('¿Eliminar este estado procesal?')) return
    await supabase.from('estados_procesales').delete().eq('id', estadoId)
    loadAll()
  }

  async function toggleTarea(tarea) {
    const nuevoEstado = tarea.estado === 'completada' ? 'pendiente' : 'completada'
    await supabase.from('tareas').update({ estado: nuevoEstado }).eq('id', tarea.id)
    loadAll()
  }

  const totalHoras = horas.reduce((s, h) => s + h.horas, 0)
  const esPenal = caso?.tipo === 'penal'
  const etapasDisponibles = caso ? (ETAPAS_POR_TIPO[caso.tipo] || []) : []
  const etapaEsCustom = caso && caso.etapa_procesal && !etapasDisponibles.includes(caso.etapa_procesal)

  if (loading) return <div className="loading-page"><div className="spinner"></div></div>
  if (!caso) return <div style={{ padding: 40, textAlign: 'center' }}>Expediente no encontrado</div>

  // Componente reutilizable para mostrar un campo (texto o textarea)
  const Campo = ({ label, value, multilinea = false }) => (
    <div className="detail-field">
      <div className="detail-label">{label}</div>
      <div className="detail-value" style={multilinea ? { whiteSpace: 'pre-wrap' } : {}}>{value || '—'}</div>
    </div>
  )

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn-icon" onClick={() => navigate('/casos')}><ArrowLeft size={16} /></button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div className="page-title" style={{ fontSize: '1.2rem' }}>{caso.titulo}</div>
              <span className={`badge badge-${caso.tipo}`} style={{ textTransform: 'capitalize' }}>{caso.tipo}</span>
              <span className={`badge badge-${caso.estado}`} style={{ textTransform: 'capitalize' }}>{caso.estado}</span>
              {caso.etapa_procesal && <span style={{ fontSize: '0.72rem', background: 'var(--gold-light)', color: 'var(--navy)', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>{caso.etapa_procesal}</span>}
            </div>
            <div className="page-subtitle" style={{ fontFamily: 'monospace' }}>{caso.numero_expediente}</div>
          </div>
        </div>
        {!editing ? (
          <button className="btn btn-outline btn-sm" onClick={() => setEditing(true)}><Edit2 size={14} />Editar</button>
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-outline btn-sm" onClick={cancelarEdicion}><X size={14} />Cancelar</button>
            <button className="btn btn-primary btn-sm" onClick={handleSaveEdit} disabled={saving}><Save size={14} />{saving ? 'Guardando...' : 'Guardar'}</button>
          </div>
        )}
      </div>

      <div className="tabs">
        {[
          ['info', 'Información'],
          ['estado', `Estado Procesal (${estados.length})`],
          ['documentos', `Documentos (${documentos.length})`],
          ['horas', `Horas (${totalHoras.toFixed(1)}h)`],
          ['tareas', `Tareas (${tareas.filter(t=>t.estado!=='completada').length})`]
        ].map(([key, label]) => (
          <div key={key} className={`tab ${tab === key ? 'active' : ''}`} onClick={() => setTab(key)}>{label}</div>
        ))}
      </div>

      {tab === 'info' && (
        <div className="detail-grid">
          {/* COLUMNA IZQUIERDA: secciones de información */}
          <div>
            {/* SECCIÓN: DATOS GENERALES */}
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-title" style={{ marginBottom: 16 }}>Datos Generales</div>
              {editing ? (
                <div>
                  <div className="form-group"><label className="form-label">Título</label><input className="form-input" value={editForm.titulo || ''} onChange={e => setEditForm({ ...editForm, titulo: e.target.value })} /></div>
                  <div className="form-grid">
                    <div className="form-group"><label className="form-label">Tipo</label><select className="form-select" value={editForm.tipo || ''} onChange={e => setEditForm({ ...editForm, tipo: e.target.value })}>{['civil','penal','constitucional','laboral','administrativo','consulta'].map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}</select></div>
                    <div className="form-group"><label className="form-label">Estado</label><select className="form-select" value={editForm.estado || ''} onChange={e => setEditForm({ ...editForm, estado: e.target.value })}>{['activo','archivado','cerrado','suspendido'].map(e => <option key={e} value={e}>{e.charAt(0).toUpperCase()+e.slice(1)}</option>)}</select></div>
                  </div>
                  <div className="form-group"><label className="form-label">Cliente</label><select className="form-select" value={editForm.cliente_id || ''} onChange={e => setEditForm({ ...editForm, cliente_id: e.target.value })}><option value="">Sin cliente</option>{clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></div>
                  <div className="form-group"><label className="form-label">Abogado Responsable</label><select className="form-select" value={editForm.abogado_responsable_id || ''} onChange={e => setEditForm({ ...editForm, abogado_responsable_id: e.target.value })}><option value="">Sin asignar</option>{abogados.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}</select></div>
                  <div className="form-group">
                    <label className="form-label">Etapa Procesal</label>
                    {!etapaCustomEdit && etapasDisponibles.length > 0 ? (
                      <select className="form-select" value={editForm.etapa_procesal || ''} onChange={e => {
                        if (e.target.value === '__custom__') {
                          setEtapaCustomEdit(true)
                          setEditForm({ ...editForm, etapa_procesal: '' })
                        } else {
                          setEditForm({ ...editForm, etapa_procesal: e.target.value })
                        }
                      }}>
                        <option value="">Sin etapa</option>
                        {etapasDisponibles.map(et => <option key={et} value={et}>{et}</option>)}
                        {etapaEsCustom && <option value={editForm.etapa_procesal}>{editForm.etapa_procesal} (personalizada)</option>}
                        <option value="__custom__">+ Escribir etapa personalizada</option>
                      </select>
                    ) : (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input className="form-input" value={editForm.etapa_procesal || ''} onChange={e => setEditForm({ ...editForm, etapa_procesal: e.target.value })} placeholder="Escribir etapa..." style={{ flex: 1 }} />
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => { setEtapaCustomEdit(false); setEditForm({ ...editForm, etapa_procesal: '' }) }}><X size={14} /></button>
                      </div>
                    )}
                  </div>
                  <div className="form-grid">
                    <div className="form-group"><label className="form-label">Juzgado</label><input className="form-input" value={editForm.juzgado || ''} onChange={e => setEditForm({ ...editForm, juzgado: e.target.value })} /></div>
                    <div className="form-group"><label className="form-label">Nombre del Juez</label><input className="form-input" value={editForm.juez_nombre || ''} onChange={e => setEditForm({ ...editForm, juez_nombre: e.target.value })} /></div>
                  </div>
                  <div className="form-grid">
                    <div className="form-group"><label className="form-label">Fecha Inicio</label><input className="form-input" type="date" value={editForm.fecha_inicio || ''} onChange={e => setEditForm({ ...editForm, fecha_inicio: e.target.value })} /></div>
                    <div className="form-group"><label className="form-label">Fecha Cierre</label><input className="form-input" type="date" value={editForm.fecha_cierre || ''} onChange={e => setEditForm({ ...editForm, fecha_cierre: e.target.value })} /></div>
                  </div>
                </div>
              ) : (
                <div>
                  <Campo label="Cliente" value={caso.clientes?.nombre} />
                  <Campo label="Abogado Responsable" value={caso.perfiles?.nombre} />
                  <Campo label="Etapa Procesal" value={caso.etapa_procesal} />
                  <Campo label="Juzgado" value={caso.juzgado} />
                  <Campo label="Nombre del Juez" value={caso.juez_nombre} />
                  <Campo label="Fecha Inicio" value={formatearFecha(caso.fecha_inicio)} />
                  <Campo label="Fecha Cierre" value={formatearFecha(caso.fecha_cierre)} />
                </div>
              )}
            </div>

            {/* SECCIÓN: DATOS FISCALES (solo penal) */}
            {esPenal && (
              <div className="card" style={{ marginBottom: 16 }}>
                <div className="card-title" style={{ marginBottom: 16 }}>Datos Fiscales</div>
                {editing ? (
                  <div>
                    <div className="form-grid">
                      <div className="form-group"><label className="form-label">N° Carpeta Fiscal</label><input className="form-input" value={editForm.carpeta_fiscal || ''} onChange={e => setEditForm({ ...editForm, carpeta_fiscal: e.target.value })} /></div>
                      <div className="form-group"><label className="form-label">Fiscalía</label><input className="form-input" value={editForm.fiscalia || ''} onChange={e => setEditForm({ ...editForm, fiscalia: e.target.value })} /></div>
                    </div>
                    <div className="form-group"><label className="form-label">Nombre del Fiscal</label><input className="form-input" value={editForm.fiscal_nombre || ''} onChange={e => setEditForm({ ...editForm, fiscal_nombre: e.target.value })} /></div>
                    <div className="form-group"><label className="form-label">Delitos</label><textarea className="form-textarea" value={editForm.delitos || ''} onChange={e => setEditForm({ ...editForm, delitos: e.target.value })} placeholder="Lista de delitos imputados..." style={{ minHeight: 60 }} /></div>
                  </div>
                ) : (
                  <div>
                    <Campo label="N° Carpeta Fiscal" value={caso.carpeta_fiscal} />
                    <Campo label="Fiscalía" value={caso.fiscalia} />
                    <Campo label="Nombre del Fiscal" value={caso.fiscal_nombre} />
                    <Campo label="Delitos" value={caso.delitos} multilinea />
                  </div>
                )}
              </div>
            )}

            {/* SECCIÓN: PARTES PROCESALES */}
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-title" style={{ marginBottom: 16 }}>Partes Procesales</div>
              {editing ? (
                <div>
                  {esPenal ? (
                    <>
                      <div className="form-group"><label className="form-label">Procesados</label><textarea className="form-textarea" value={editForm.procesados || ''} onChange={e => setEditForm({ ...editForm, procesados: e.target.value })} placeholder="Nombres de los procesados, uno por línea..." style={{ minHeight: 70 }} /></div>
                      <div className="form-group"><label className="form-label">Agraviados</label><textarea className="form-textarea" value={editForm.agraviados || ''} onChange={e => setEditForm({ ...editForm, agraviados: e.target.value })} placeholder="Nombres de los agraviados, uno por línea..." style={{ minHeight: 70 }} /></div>
                      <div className="form-group"><label className="form-label">Terceros</label><textarea className="form-textarea" value={editForm.terceros || ''} onChange={e => setEditForm({ ...editForm, terceros: e.target.value })} placeholder="Nombres de los terceros, uno por línea..." style={{ minHeight: 70 }} /></div>
                    </>
                  ) : (
                    <>
                      <div className="form-group"><label className="form-label">Demandante(s)</label><textarea className="form-textarea" value={editForm.demandante || ''} onChange={e => setEditForm({ ...editForm, demandante: e.target.value })} placeholder="Nombres de los demandantes, uno por línea..." style={{ minHeight: 70 }} /></div>
                      <div className="form-group"><label className="form-label">Demandado(s)</label><textarea className="form-textarea" value={editForm.demandado || ''} onChange={e => setEditForm({ ...editForm, demandado: e.target.value })} placeholder="Nombres de los demandados, uno por línea..." style={{ minHeight: 70 }} /></div>
                    </>
                  )}
                </div>
              ) : (
                <div>
                  {esPenal ? (
                    <>
                      <Campo label="Procesados" value={caso.procesados} multilinea />
                      <Campo label="Agraviados" value={caso.agraviados} multilinea />
                      <Campo label="Terceros" value={caso.terceros} multilinea />
                    </>
                  ) : (
                    <>
                      <Campo label="Demandante(s)" value={caso.demandante} multilinea />
                      <Campo label="Demandado(s)" value={caso.demandado} multilinea />
                    </>
                  )}
                </div>
              )}
            </div>

            {/* SECCIÓN: NÚMEROS DE EXPEDIENTE JUDICIAL */}
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-title" style={{ marginBottom: 12 }}>Números de Expediente Judicial</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 12 }}>
                Registra los números que el expediente recibe en cada etapa o instancia.
              </div>

              {numerosExpediente.length > 0 ? (
                <div style={{ marginBottom: 16 }}>
                  {numerosExpediente.map(n => (
                    <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--cream)', borderRadius: 6, marginBottom: 6 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{n.etapa}</div>
                        <div style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--navy)' }}>{n.numero}</div>
                      </div>
                      <button className="btn-icon" onClick={() => handleEliminarNumero(n.id)} style={{ color: 'var(--danger)' }} title="Eliminar"><Trash2 size={14} /></button>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', background: 'var(--cream)', borderRadius: 6, marginBottom: 16 }}>
                  Aún no hay números registrados
                </div>
              )}

              <form onSubmit={handleAgregarNumero}>
                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Agregar nuevo número:</div>
                <div className="form-grid" style={{ marginBottom: 8 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <select className="form-select" value={nuevoNumero.etapa} onChange={e => setNuevoNumero({ ...nuevoNumero, etapa: e.target.value })} required>
                      <option value="">Seleccionar etapa...</option>
                      {etapasDisponibles.map(et => <option key={et} value={et}>{et}</option>)}
                      <option value="__custom__">+ Escribir etapa personalizada</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <input className="form-input" value={nuevoNumero.numero} onChange={e => setNuevoNumero({ ...nuevoNumero, numero: e.target.value })} placeholder="N° de expediente" />
                  </div>
                </div>
                {nuevoNumero.etapa === '__custom__' && (
                  <div className="form-group" style={{ marginBottom: 8 }}>
                    <input className="form-input" value={nuevoNumero.etapaCustom} onChange={e => setNuevoNumero({ ...nuevoNumero, etapaCustom: e.target.value })} placeholder="Nombre de la etapa personalizada" required />
                  </div>
                )}
                <button type="submit" className="btn btn-outline btn-sm" disabled={!nuevoNumero.etapa || !nuevoNumero.numero}><Plus size={14} />Agregar número</button>
              </form>
            </div>

            {/* SECCIÓN: DESCRIPCIÓN Y NOTAS */}
            <div className="card">
              <div className="card-title" style={{ marginBottom: 16 }}>Descripción y Notas</div>
              {editing ? (
                <div>
                  <div className="form-group"><label className="form-label">Descripción</label><textarea className="form-textarea" value={editForm.descripcion || ''} onChange={e => setEditForm({ ...editForm, descripcion: e.target.value })} placeholder="Descripción breve del caso..." style={{ minHeight: 80 }} /></div>
                  <div className="form-group"><label className="form-label">Notas y Observaciones</label><textarea className="form-textarea" value={editForm.notas_observaciones || ''} onChange={e => setEditForm({ ...editForm, notas_observaciones: e.target.value })} placeholder="Notas internas, observaciones, recordatorios..." style={{ minHeight: 80 }} /></div>
                </div>
              ) : (
                <div>
                  <Campo label="Descripción" value={caso.descripcion} multilinea />
                  <Campo label="Notas y Observaciones" value={caso.notas_observaciones} multilinea />
                </div>
              )}
            </div>
          </div>

          {/* COLUMNA DERECHA: resumen */}
          <div>
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-title" style={{ marginBottom: 12 }}>Resumen</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[['Documentos', documentos.length], ['Horas', totalHoras.toFixed(1) + 'h'], ['Tareas Pend.', tareas.filter(t => t.estado !== 'completada').length], ['Estados', estados.length]].map(([label, val]) => (
                  <div key={label} style={{ background: 'var(--cream)', borderRadius: 8, padding: '12px 14px' }}>
                    <div style={{ fontSize: '1.3rem', fontWeight: 700, fontFamily: 'var(--font-display)' }}>{val}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>
            {estados.length > 0 && (
              <div className="card">
                <div className="card-title" style={{ marginBottom: 12 }}>Último Estado</div>
                <div style={{ background: 'var(--navy)', borderRadius: 8, padding: '12px 14px', color: 'white' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--gold-light)', marginBottom: 4 }}>{formatearFecha(estados[0].fecha)}</div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{estados[0].titulo}</div>
                  {estados[0].descripcion && <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>{estados[0].descripcion}</div>}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'estado' && (
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Estado Procesal</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Historial cronológico del avance del caso</div>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => setShowEstadoModal(true)}><Plus size={14} />Nuevo Estado</button>
          </div>

          {estados.length === 0 ? (
            <div className="empty-state"><Activity size={36} /><p>No hay estados registrados aún</p></div>
          ) : (
            <div style={{ position: 'relative', paddingLeft: 28 }}>
              <div style={{ position: 'absolute', left: 10, top: 0, bottom: 0, width: 2, background: 'var(--border)' }}></div>
              {estados.map((e, i) => (
                <div key={e.id} style={{ position: 'relative', marginBottom: 20 }}>
                  <div style={{ position: 'absolute', left: -24, top: 4, width: 12, height: 12, borderRadius: '50%', background: i === 0 ? 'var(--gold)' : 'var(--border)', border: '2px solid white', boxShadow: '0 0 0 2px ' + (i === 0 ? 'var(--gold)' : 'var(--border)') }}></div>
                  <div style={{ background: i === 0 ? 'var(--navy)' : 'var(--cream)', borderRadius: 8, padding: '12px 16px', color: i === 0 ? 'white' : 'var(--text-primary)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.72rem', color: i === 0 ? 'var(--gold-light)' : 'var(--text-muted)', marginBottom: 3 }}>
                          {formatearFecha(e.fecha, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                          {e.perfiles?.nombre && ` · ${e.perfiles.nombre}`}
                        </div>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{e.titulo}</div>
                        {e.descripcion && <div style={{ fontSize: '0.82rem', marginTop: 4, color: i === 0 ? 'rgba(255,255,255,0.75)' : 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{e.descripcion}</div>}
                      </div>
                      <button className="btn-icon" onClick={() => handleDeleteEstado(e.id)} style={{ border: 'none', color: i === 0 ? 'rgba(255,255,255,0.4)' : 'var(--text-muted)', marginLeft: 8, flexShrink: 0 }}><Trash2 size={13} /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'documentos' && (() => {
        // Calculamos las carpetas únicas del caso y los documentos filtrados según la sub-pestaña activa
        const carpetasDocs = [...new Set(documentos.map(d => d.carpeta).filter(Boolean))].sort()
        const tieneSinCarpeta = documentos.some(d => !d.carpeta)
        const hayCarpetas = carpetasDocs.length > 0
        const documentosFiltrados = subTabDoc === 'todos'
          ? documentos
          : subTabDoc === '__sin_carpeta__'
            ? documentos.filter(d => !d.carpeta)
            : documentos.filter(d => d.carpeta === subTabDoc)

        return (
          <div className="card">
            <div className="card-header">
              <div className="card-title">Documentos del Expediente</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="file" ref={fileRef} multiple style={{ display: 'none' }} onChange={handleSelectFiles} />
                <button className="btn btn-primary btn-sm" onClick={() => fileRef.current.click()} disabled={uploadingFile}>
                  <Upload size={14} />Subir Documentos
                </button>
              </div>
            </div>

            {/* Sub-pestañas de carpetas (solo si hay al menos una carpeta) */}
            {hayCarpetas && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border-light)' }}>
                <button
                  className={`btn btn-sm ${subTabDoc === 'todos' ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setSubTabDoc('todos')}
                  style={{ fontSize: '0.78rem' }}
                >
                  Todos ({documentos.length})
                </button>
                {carpetasDocs.map(c => (
                  <button
                    key={c}
                    className={`btn btn-sm ${subTabDoc === c ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setSubTabDoc(c)}
                    style={{ fontSize: '0.78rem' }}
                  >
                    {c} ({documentos.filter(d => d.carpeta === c).length})
                  </button>
                ))}
                {tieneSinCarpeta && (
                  <button
                    className={`btn btn-sm ${subTabDoc === '__sin_carpeta__' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setSubTabDoc('__sin_carpeta__')}
                    style={{ fontSize: '0.78rem' }}
                  >
                    Sin carpeta ({documentos.filter(d => !d.carpeta).length})
                  </button>
                )}
              </div>
            )}

            {documentos.length === 0 ? (
              <div className="empty-state"><FileText size={36} /><p>No hay documentos subidos aún</p></div>
            ) : documentosFiltrados.length === 0 ? (
              <div className="empty-state"><FileText size={36} /><p>No hay documentos en esta carpeta</p></div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Nombre</th><th>Tipo</th><th>Subido por</th><th>Fecha</th><th style={{ width: 90 }}></th></tr></thead>
                  <tbody>
                    {documentosFiltrados.map(doc => (
                      <tr key={doc.id}>
                        <td>
                          <a onClick={() => handleViewDoc(doc)} style={{ color: 'var(--navy)', fontWeight: 500, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}><FileText size={14} />{doc.nombre}</a>
                          {/* En la vista "Todos" mostramos un badge con la carpeta para no perder el contexto */}
                          {subTabDoc === 'todos' && doc.carpeta && (
                            <div style={{ marginTop: 4, paddingLeft: 20 }}>
                              <span style={{ fontSize: '0.7rem', background: 'var(--gold-light)', color: 'var(--navy)', padding: '1px 8px', borderRadius: 4, fontWeight: 600 }}>📁 {doc.carpeta}</span>
                            </div>
                          )}
                          {doc.descripcion && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 3, paddingLeft: 20, whiteSpace: 'pre-wrap' }}>{doc.descripcion}</div>}
                        </td>
                        <td><span style={{ background: 'var(--cream)', padding: '2px 8px', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600 }}>{doc.tipo_documento || '—'}</span></td>
                        <td style={{ color: 'var(--text-secondary)' }}>{doc.perfiles?.nombre || '—'}</td>
                        <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{formatearFecha(doc.fecha_documento)}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                            <button className="btn-icon" onClick={() => handleEditDoc(doc)} title="Editar documento"><Edit2 size={14} /></button>
                            <button className="btn-icon" onClick={() => handleDeleteDoc(doc.id, doc.url)} style={{ color: 'var(--danger)' }} title="Eliminar documento"><Trash2 size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      })()}

      {tab === 'horas' && (
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Registro de Horas</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Total: {totalHoras.toFixed(2)} horas</div>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => setShowHorasModal(true)}><Plus size={14} />Registrar Horas</button>
          </div>
          {horas.length === 0 ? (
            <div className="empty-state"><Clock size={36} /><p>No hay horas registradas aún</p></div>
          ) : horas.map(h => (
            <div key={h.id} className="hours-entry">
              <div className="hours-badge">{h.horas}h</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{TIPOS_TAREA_LABELS[h.tipo_tarea] || h.tipo_tarea}</div>
                {h.descripcion && <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 2 }}>{h.descripcion}</div>}
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 3 }}>{h.perfiles?.nombre} · {formatearFecha(h.fecha)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.72rem', background: h.facturado ? 'var(--success-bg)' : 'var(--cream)', color: h.facturado ? 'var(--success)' : 'var(--text-muted)', padding: '2px 8px', borderRadius: 4 }}>{h.facturado ? 'Facturado' : 'Pendiente'}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'tareas' && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">Tareas del Expediente</div>
            <button className="btn btn-primary btn-sm" onClick={() => setShowTareaModal(true)}><Plus size={14} />Nueva Tarea</button>
          </div>
          {tareas.length === 0 ? (
            <div className="empty-state"><CheckSquare size={36} /><p>No hay tareas asignadas</p></div>
          ) : tareas.map(t => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--border-light)' }}>
              <input type="checkbox" checked={t.estado === 'completada'} onChange={() => toggleTarea(t)} style={{ marginTop: 3, width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--navy)' }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500, fontSize: '0.875rem', textDecoration: t.estado === 'completada' ? 'line-through' : 'none', color: t.estado === 'completada' ? 'var(--text-muted)' : 'var(--text-primary)' }}>{t.titulo}</div>
                {t.descripcion && <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 2 }}>{t.descripcion}</div>}
                <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                  <span className={`badge badge-${t.prioridad}`}>{t.prioridad}</span>
                  {t.perfiles?.nombre && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>→ {t.perfiles.nombre}</span>}
                  {t.fecha_vencimiento && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Vence: {formatearFecha(t.fecha_vencimiento)}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL ESTADO PROCESAL */}
      {showEstadoModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowEstadoModal(false)}>
          <div className="modal">
            <div className="modal-header"><div className="modal-title">Nuevo Estado Procesal</div><button className="btn-icon" onClick={() => setShowEstadoModal(false)}>✕</button></div>
            <form onSubmit={handleSaveEstado}>
              <div className="modal-body">
                <div className="form-group"><label className="form-label">Título del estado *</label><input className="form-input" value={estadoForm.titulo} onChange={e => setEstadoForm({ ...estadoForm, titulo: e.target.value })} placeholder="Ej: Se presentó la demanda, Audiencia señalada..." required /></div>
                <div className="form-group"><label className="form-label">Fecha</label><input className="form-input" type="date" value={estadoForm.fecha} onChange={e => setEstadoForm({ ...estadoForm, fecha: e.target.value })} /></div>
                <div className="form-group"><label className="form-label">Descripción / Detalle</label><textarea className="form-textarea" value={estadoForm.descripcion} onChange={e => setEstadoForm({ ...estadoForm, descripcion: e.target.value })} placeholder="Detalles adicionales del estado procesal..." /></div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowEstadoModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardando...' : 'Registrar Estado'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL HORAS */}
      {showHorasModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowHorasModal(false)}>
          <div className="modal">
            <div className="modal-header"><div className="modal-title">Registrar Horas</div><button className="btn-icon" onClick={() => setShowHorasModal(false)}>✕</button></div>
            <form onSubmit={handleSaveHoras}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group"><label className="form-label">Tipo de Tarea *</label><select className="form-select" value={horaForm.tipo_tarea} onChange={e => setHoraForm({ ...horaForm, tipo_tarea: e.target.value })}>{TIPOS_TAREA.map(t => <option key={t} value={t}>{TIPOS_TAREA_LABELS[t]}</option>)}</select></div>
                  <div className="form-group"><label className="form-label">Horas *</label><input className="form-input" type="number" step="0.25" min="0.25" value={horaForm.horas} onChange={e => setHoraForm({ ...horaForm, horas: e.target.value })} placeholder="2.5" required /></div>
                </div>
                <div className="form-group"><label className="form-label">Fecha</label><input className="form-input" type="date" value={horaForm.fecha} onChange={e => setHoraForm({ ...horaForm, fecha: e.target.value })} /></div>
                <div className="form-group"><label className="form-label">Descripción</label><textarea className="form-textarea" value={horaForm.descripcion} onChange={e => setHoraForm({ ...horaForm, descripcion: e.target.value })} placeholder="Detalle de la actividad realizada..." style={{ minHeight: 60 }} /></div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowHorasModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardando...' : 'Registrar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL TAREA */}
      {showTareaModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowTareaModal(false)}>
          <div className="modal">
            <div className="modal-header"><div className="modal-title">Nueva Tarea</div><button className="btn-icon" onClick={() => setShowTareaModal(false)}>✕</button></div>
            <form onSubmit={handleSaveTarea}>
              <div className="modal-body">
                <div className="form-group"><label className="form-label">Título *</label><input className="form-input" value={tareaForm.titulo} onChange={e => setTareaForm({ ...tareaForm, titulo: e.target.value })} placeholder="Descripción de la tarea" required /></div>
                <div className="form-grid">
                  <div className="form-group"><label className="form-label">Prioridad</label><select className="form-select" value={tareaForm.prioridad} onChange={e => setTareaForm({ ...tareaForm, prioridad: e.target.value })}><option value="alta">Alta</option><option value="media">Media</option><option value="baja">Baja</option></select></div>
                  <div className="form-group"><label className="form-label">Asignar a</label><select className="form-select" value={tareaForm.asignado_a} onChange={e => setTareaForm({ ...tareaForm, asignado_a: e.target.value })}><option value="">Sin asignar</option>{abogados.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}</select></div>
                </div>
                <div className="form-group"><label className="form-label">Fecha de Vencimiento</label><input className="form-input" type="date" value={tareaForm.fecha_vencimiento} onChange={e => setTareaForm({ ...tareaForm, fecha_vencimiento: e.target.value })} /></div>
                <div className="form-group"><label className="form-label">Descripción</label><textarea className="form-textarea" value={tareaForm.descripcion} onChange={e => setTareaForm({ ...tareaForm, descripcion: e.target.value })} placeholder="Detalles adicionales..." style={{ minHeight: 60 }} /></div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowTareaModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardando...' : 'Crear Tarea'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL SUBIDA MÚLTIPLE */}
      {showUploadModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && !uploadingFile && setShowUploadModal(false)}>
          <div className="modal modal-lg">
            <div className="modal-header">
              <div className="modal-title">Subir {uploadQueue.length} documento{uploadQueue.length !== 1 ? 's' : ''}</div>
              {!uploadingFile && <button className="btn-icon" onClick={() => { setShowUploadModal(false); setUploadQueue([]) }}>✕</button>}
            </div>
            <div className="modal-body">
              {uploadingFile ? (
                <div style={{ textAlign: 'center', padding: 40 }}>
                  <div className="spinner" style={{ margin: '0 auto 16px' }}></div>
                  <div style={{ fontWeight: 600, fontSize: '1rem' }}>Subiendo {uploadProgress.current} de {uploadProgress.total}...</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>Por favor no cierres esta ventana</div>
                  <div className="progress-bar" style={{ marginTop: 16, maxWidth: 300, marginLeft: 'auto', marginRight: 'auto' }}>
                    <div className="progress-fill" style={{ width: `${uploadProgress.total > 0 ? (uploadProgress.current / uploadProgress.total * 100) : 0}%`, background: 'var(--navy)' }}></div>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 16 }}>
                    Revisa el nombre, fecha y descripción de cada documento antes de subirlos.
                  </div>
                  {uploadQueue.map((item, idx) => (
                    <div key={idx} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 14, marginBottom: 12, background: 'var(--cream)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          <FileText size={14} />
                          <span style={{ fontFamily: 'monospace' }}>{item.file.name}</span>
                          <span>({(item.file.size / 1024).toFixed(0)} KB)</span>
                        </div>
                        <button className="btn-icon" onClick={() => removeFromQueue(idx)} style={{ color: 'var(--danger)' }} title="Quitar de la lista"><Trash2 size={13} /></button>
                      </div>
                      <div className="form-grid">
                        <div className="form-group" style={{ marginBottom: 8 }}>
                          <label className="form-label">Nombre del documento *</label>
                          <input className="form-input" value={item.nombre} onChange={e => updateQueueItem(idx, 'nombre', e.target.value)} required />
                        </div>
                        <div className="form-group" style={{ marginBottom: 8 }}>
                          <label className="form-label">Fecha del documento *</label>
                          <input className="form-input" type="date" value={item.fecha_documento} onChange={e => updateQueueItem(idx, 'fecha_documento', e.target.value)} required />
                        </div>
                      </div>
                      <div className="form-group" style={{ marginBottom: 8 }}>
                        <label className="form-label">Carpeta</label>
                        <input
                          className="form-input"
                          list={`carpetas-existentes-${idx}`}
                          value={item.carpeta}
                          onChange={e => updateQueueItem(idx, 'carpeta', e.target.value)}
                          placeholder="Opcional: ej. Principal, Cautelar, Cuaderno de Apelación..."
                        />
                        <datalist id={`carpetas-existentes-${idx}`}>
                          {[...new Set(documentos.map(d => d.carpeta).filter(Boolean))].map(c => <option key={c} value={c} />)}
                        </datalist>
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Descripción / Notas</label>
                        <textarea className="form-textarea" value={item.descripcion} onChange={e => updateQueueItem(idx, 'descripcion', e.target.value)} placeholder="Opcional: notas sobre el documento..." style={{ minHeight: 50 }} />
                      </div>
                    </div>
                  ))}
                  {uploadQueue.length === 0 && (
                    <div className="empty-state"><FileText size={32} /><p>No quedan documentos en la lista</p></div>
                  )}
                </>
              )}
            </div>
            <div className="modal-footer">
              {!uploadingFile && (
                <>
                  <button type="button" className="btn btn-outline" onClick={() => { setShowUploadModal(false); setUploadQueue([]) }}>Cancelar</button>
                  <button type="button" className="btn btn-primary" onClick={handleUploadAll} disabled={uploadQueue.length === 0}>
                    <Upload size={14} />Subir {uploadQueue.length} documento{uploadQueue.length !== 1 ? 's' : ''}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDITAR DOCUMENTO */}
      {editingDoc && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setEditingDoc(null)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">Editar Documento</div>
              <button className="btn-icon" onClick={() => setEditingDoc(null)}>✕</button>
            </div>
            <form onSubmit={handleSaveEditDoc}>
              <div className="modal-body">
                <div style={{ background: 'var(--cream)', padding: '10px 14px', borderRadius: 6, marginBottom: 16, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  <FileText size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
                  Archivo: <span style={{ fontFamily: 'monospace' }}>{editingDoc.tipo_documento}</span>
                </div>
                <div className="form-group">
                  <label className="form-label">Nombre del documento *</label>
                  <input className="form-input" value={editDocForm.nombre} onChange={e => setEditDocForm({ ...editDocForm, nombre: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Fecha del documento *</label>
                  <input className="form-input" type="date" value={editDocForm.fecha_documento} onChange={e => setEditDocForm({ ...editDocForm, fecha_documento: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Carpeta</label>
                  <input
                    className="form-input"
                    list="carpetas-existentes-edit"
                    value={editDocForm.carpeta}
                    onChange={e => setEditDocForm({ ...editDocForm, carpeta: e.target.value })}
                    placeholder="Opcional: ej. Principal, Cautelar, Cuaderno de Apelación..."
                  />
                  <datalist id="carpetas-existentes-edit">
                    {[...new Set(documentos.map(d => d.carpeta).filter(Boolean))].map(c => <option key={c} value={c} />)}
                  </datalist>
                </div>
                <div className="form-group">
                  <label className="form-label">Descripción / Notas</label>
                  <textarea className="form-textarea" value={editDocForm.descripcion} onChange={e => setEditDocForm({ ...editDocForm, descripcion: e.target.value })} placeholder="Información adicional del documento..." style={{ minHeight: 80 }} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setEditingDoc(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardando...' : 'Guardar Cambios'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
