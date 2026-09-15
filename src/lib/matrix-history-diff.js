const FIELD_LABELS = {
  objective_group: 'Objetivo general',
  objective: 'Acción',
  responsible_text: 'Responsable',
  priority: 'Prioridad',
  milestones: 'Hitos / Fechas',
  kpi: 'KPI',
  start_date: 'Inicio',
  end_date: 'Fin',
  risks: 'Riesgos de no ejecutar',
  restrictions: 'Restricciones',
  support: 'Soporte',
  deliverables: 'Entregable',
  committee: 'Comité',
}

function text(value) {
  if (value === null || value === undefined || value === '') return '—'
  if (Array.isArray(value)) return value.map(text).join(', ')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function rowsFrom(snapshot) {
  return Array.isArray(snapshot?.rows) ? snapshot.rows.filter(row => row && typeof row === 'object') : []
}

function rowKey(row, index) {
  return String(row.id || row.row_id || `row:${index}:${row.objective_group || ''}:${row.objective || ''}`)
}

export function summarizeMatrixVersionChanges(currentSnapshot, previousSnapshot) {
  const currentRows = rowsFrom(currentSnapshot)
  const previousRows = rowsFrom(previousSnapshot)
  const current = new Map(currentRows.map((row, index) => [rowKey(row, index), row]))
  const previous = new Map(previousRows.map((row, index) => [rowKey(row, index), row]))

  const inserted = [...current.keys()].filter(key => !previous.has(key))
  const removed = [...previous.keys()].filter(key => !current.has(key))
  const changes = []
  let updatedRows = 0

  for (const [key, currentRow] of current) {
    const previousRow = previous.get(key)
    if (!previousRow) continue
    let rowChanged = false
    for (const [field, label] of Object.entries(FIELD_LABELS)) {
      const before = text(previousRow[field])
      const after = text(currentRow[field])
      if (before === after) continue
      rowChanged = true
      changes.push({ label, before, after })
    }
    if (rowChanged) updatedRows += 1
  }

  inserted.forEach(key => {
    const row = current.get(key)
    changes.push({ label: 'Acción agregada', before: '—', after: text(row?.objective || row?.objective_group) })
  })
  removed.forEach(key => {
    const row = previous.get(key)
    changes.push({ label: 'Acción eliminada', before: text(row?.objective || row?.objective_group), after: '—' })
  })

  let summary = 'Sin cambios de contenido detectados'
  if (inserted.length && !removed.length && !updatedRows) summary = `Agregó ${inserted.length} acción${inserted.length === 1 ? '' : 'es'}`
  else if (removed.length && !inserted.length && !updatedRows) summary = `Eliminó ${removed.length} acción${removed.length === 1 ? '' : 'es'}`
  else if (updatedRows && !inserted.length && !removed.length) summary = `Actualizó ${updatedRows} acción${updatedRows === 1 ? '' : 'es'} · ${changes.length} campo${changes.length === 1 ? '' : 's'}`
  else if (inserted.length || removed.length || updatedRows) summary = `Actualizó la matriz · ${inserted.length} agregada${inserted.length === 1 ? '' : 's'}, ${updatedRows} modificada${updatedRows === 1 ? '' : 's'}, ${removed.length} eliminada${removed.length === 1 ? '' : 's'}`

  return { summary, changes }
}
