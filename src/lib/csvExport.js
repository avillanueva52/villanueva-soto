// Helper para descargar datos como CSV (compatible con Excel)
// Excel abre automáticamente archivos .csv con doble clic
// y los reconoce con UTF-8 si se incluye el BOM al inicio.

export function descargarCSV(filename, headers, rows) {
  // Escape de valores: si contienen comas, comillas o saltos de línea,
  // se envuelven en comillas dobles y las comillas internas se duplican.
  const escapar = (val) => {
    if (val == null) return ''
    const s = String(val)
    if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
      return `"${s.replace(/"/g, '""')}"`
    }
    return s
  }

  const lineas = [
    headers.map(escapar).join(','),
    ...rows.map(row => row.map(escapar).join(','))
  ]
  const csv = lineas.join('\n')

  // BOM (\uFEFF) hace que Excel reconozca UTF-8 y muestre acentos correctos
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
