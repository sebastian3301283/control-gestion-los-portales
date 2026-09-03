import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('../src/MatrixWorkspaceV10.tsx', import.meta.url), 'utf8')
const css = await readFile(new URL('../src/matrix-subpoints.css', import.meta.url), 'utf8')

function centralEditorSource() {
  const start = source.indexOf('function renderCentralInlineEditor')
  const end = source.indexOf('return <div className=', start)
  return source.slice(start, end)
}

test('Central mantiene Guardar y Cancelar arriba y Responsable/Prioridad en la fila principal', () => {
  const editor = centralEditorSource()
  const detailStart = editor.indexOf('centralSubpointDrafts.map')
  const header = editor.slice(0, detailStart)

  assert.match(header, /matrix-v10-inline-top-actions/)
  assert.match(header, /responsible_manager_id/)
  assert.match(header, /rowDraft\.priority/)
  assert.match(css, /\.matrix-v10-inline-top-actions/)
})

test('cada subpunto queda debajo del objetivo y al lado de Hito, KPI, Inicio y Fin', () => {
  const editor = centralEditorSource()
  const detailStart = editor.indexOf('centralSubpointDrafts.map')
  const detailRows = editor.slice(detailStart)

  assert.match(detailRows, /matrix-v10-central-inline-subpoint-cell/)
  assert.match(detailRows, /detail\.text/)
  assert.match(detailRows, /detail\.milestones/)
  assert.match(detailRows, /detail\.kpi/)
  assert.match(detailRows, /detail\.start_date/)
  assert.match(detailRows, /detail\.end_date/)
  assert.doesNotMatch(detailRows, /responsible_manager_id/)
  assert.doesNotMatch(detailRows, /rowDraft\.priority/)
})
