// src/lib/dateUtils.js
// Utilidades para manejar fechas con la zona horaria de Lima (UTC-5),
// evitando el bug típico de UTC donde las fechas se muestran un día atrás.

// Devuelve la fecha de hoy en zona horaria de Lima en formato YYYY-MM-DD
export function hoyEnLima() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

// Devuelve el mes actual en zona horaria de Lima en formato YYYY-MM (para inputs type="month")
export function mesActualEnLima() {
  return hoyEnLima().slice(0, 7)
}

// Devuelve el primer día del mes actual en Lima en formato YYYY-MM-DD
export function inicioMesEnLima() {
  return hoyEnLima().slice(0, 7) + '-01'
}

// Dado un mes en formato YYYY-MM, devuelve el último día de ese mes en formato YYYY-MM-DD
export function ultimoDiaDelMes(mesStr) {
  const [anio, mes] = mesStr.split('-').map(Number)
  const ultimoDia = new Date(anio, mes, 0).getDate()
  return `${anio}-${String(mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`
}

// Formatea una fecha tipo 'YYYY-MM-DD' (proveniente de la base de datos) sin conversión UTC,
// evitando que se muestre el día anterior.
export function formatearFecha(fechaStr, opciones = {}) {
  if (!fechaStr) return '—'
  const partes = String(fechaStr).split('T')[0].split('-')
  if (partes.length !== 3) return fechaStr
  const fecha = new Date(parseInt(partes[0]), parseInt(partes[1]) - 1, parseInt(partes[2]))
  return fecha.toLocaleDateString('es-PE', opciones)
}
