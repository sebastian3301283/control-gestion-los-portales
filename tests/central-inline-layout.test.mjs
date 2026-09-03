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

test('Central alinea Responsable y Prioridad de forma nativa sin clonar controles en V11', () => {
  const editor = centralEditorSource()
  assert.match(editor, /matrix-v10-central-inline-owner/)
  assert.match(editor, /matrix-v10-central-inline-priority/)
  assert.doesNotMatch(v11, /enhanceCentralInlineLayout/)
  assert.doesNotMatch(v11, /cloneInlineFieldCell/)
  assert.doesNotMatch(v11Css, /matrix-v5-edit-row > td:first-child/)
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
