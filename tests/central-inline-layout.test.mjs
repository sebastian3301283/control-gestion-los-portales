import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const v10 = await readFile(new URL('../src/MatrixWorkspaceV10.tsx', import.meta.url), 'utf8')
const v11 = await readFile(new URL('../src/MatrixWorkspaceV11.tsx', import.meta.url), 'utf8')
const v11Css = await readFile(new URL('../src/matrix-workspace-v11.css', import.meta.url), 'utf8')

function centralEditorSource() {
  const start = v10.indexOf('function renderCentralInlineEditor')
  const end = v10.indexOf('return <div className=', start)
  return v10.slice(start, end)
}

test('Central mantiene Guardar y Cancelar arriba del objetivo', () => {
  const editor = centralEditorSource()
  assert.match(editor, /matrix-v10-inline-top-actions/)
  assert.match(editor, /title="Cancelar"/)
  assert.match(editor, /title="Guardar"/)
})

test('V11 coloca Responsable, Prioridad y campos generales en la fila principal sin sacar los subpuntos de su fila', () => {
  assert.match(v11, /enhanceCentralInlineLayout/)
  assert.match(v11, /matrix-v10-central-inline-header-fill/)
  assert.match(v11, /matrix-v11-inline-original-hidden/)
  assert.match(v11, /matrix-v11-inline-detail-placeholder/)
  assert.match(v11Css, /\.matrix-v11-inline-original-hidden/)
  assert.doesNotMatch(v11Css, /matrix-v5-edit-row td:nth-child\(2\)/)
})

test('cada subpunto conserva Hito, KPI, Inicio y Fin en su misma fila', () => {
  const editor = centralEditorSource()
  const detailStart = editor.indexOf('centralSubpointDrafts.map')
  const detailRows = editor.slice(detailStart)

  assert.match(detailRows, /matrix-v10-central-inline-subpoint-cell/)
  assert.match(detailRows, /detail\.text/)
  assert.match(detailRows, /detail\.milestones/)
  assert.match(detailRows, /detail\.kpi/)
  assert.match(detailRows, /detail\.start_date/)
  assert.match(detailRows, /detail\.end_date/)
})
