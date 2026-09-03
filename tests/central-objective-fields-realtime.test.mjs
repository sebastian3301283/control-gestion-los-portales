import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const v10 = await readFile(new URL('../src/MatrixWorkspaceV10.tsx', import.meta.url), 'utf8')
const v11 = await readFile(new URL('../src/MatrixWorkspaceV11.tsx', import.meta.url), 'utf8')
const realtime = await readFile(new URL('../src/MatrixRealtimeLayer.tsx', import.meta.url), 'utf8')

function between(source, startText, endText) {
  const start = source.indexOf(startText)
  const end = source.indexOf(endText, start)
  assert.notEqual(start, -1, `No se encontró ${startText}`)
  assert.notEqual(end, -1, `No se encontró ${endText}`)
  return source.slice(start, end)
}

test('Central muestra Hito KPI Inicio y Fin propios del objetivo general antes de los subpuntos', () => {
  const editor = between(v10, 'function renderCentralInlineEditor', 'centralSubpointDrafts.map')
  assert.match(editor, /rowDraft\.milestones/)
  assert.match(editor, /rowDraft\.kpi/)
  assert.match(editor, /rowDraft\.start_date/)
  assert.match(editor, /rowDraft\.end_date/)
  assert.doesNotMatch(editor, /matrix-v10-central-inline-detail-placeholder/)
})

test('Central guarda el detalle del objetivo general separado del detalle de sus subpuntos', () => {
  const save = between(v10, 'async function saveCentralRow', 'async function saveRow')
  assert.match(save, /milestones:\s*rowDraft\.milestones\s*\|\|\s*null/)
  assert.match(save, /kpi:\s*rowDraft\.kpi\s*\|\|\s*null/)
  assert.match(save, /start_date:\s*rowDraft\.start_date\s*\|\|\s*null/)
  assert.match(save, /end_date:\s*rowDraft\.end_date\s*\|\|\s*null/)
})

test('la vista normal de Central muestra una fila propia del objetivo antes de sus subpuntos', () => {
  const display = between(v10, 'const centralRows = centralRowsFor(row)', "{unitCode === 'CENTRAL' && rowFormOpen")
  assert.match(display, /matrix-v10-central-objective-row/)
  assert.match(display, /row\.milestones/)
  assert.match(display, /row\.kpi/)
  assert.match(display, /formatDate\(row\.start_date\)/)
  assert.match(display, /formatDate\(row\.end_date\)/)
})

test('los cambios remotos actualizan filas e índices de bloqueo sin desmontar el editor local', () => {
  assert.match(realtime, /matrix-realtime-data-change/)
  assert.match(v10, /addEventListener\(['"]matrix-realtime-data-change['"]/)
  assert.match(v11, /addEventListener\(['"]matrix-realtime-data-change['"]/)
  assert.doesNotMatch(realtime, /pendingRefreshRef/)
  assert.doesNotMatch(realtime, /key=\{refreshRevision\}/)
})
