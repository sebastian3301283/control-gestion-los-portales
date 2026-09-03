import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('../src/MatrixWorkspaceV10.tsx', import.meta.url), 'utf8')

function centralEditorSource() {
  const start = source.indexOf('function renderCentralInlineEditor')
  const end = source.indexOf('return <div className=', start)
  return source.slice(start, end)
}

function centralSaveSource() {
  const start = source.indexOf('async function saveCentralRow')
  const end = source.indexOf('async function saveRow', start)
  return source.slice(start, end)
}

test('Central muestra el subpunto debajo de Objetivo general y alinea su detalle con Hito KPI Inicio y Fin', () => {
  const editor = centralEditorSource()
  assert.match(editor, /matrix-v10-central-inline-subpoint-cell/)
  assert.doesNotMatch(editor, /matrix-v10-central-inline-objective" colSpan=\{2\}/)
  assert.doesNotMatch(editor, /matrix-v10-central-inline-subpoint-cell" colSpan=\{2\}/)
  assert.match(editor, /detail\.milestones/)
  assert.match(editor, /detail\.kpi/)
  assert.match(editor, /detail\.start_date/)
  assert.match(editor, /detail\.end_date/)
  assert.doesNotMatch(source, /unitCode === 'CENTRAL' && <th>Subpunto<\/th>/)
})

test('Central permite guardar parcialmente sin exigir lineamiento objetivo o subpuntos', () => {
  const save = centralSaveSource()
  assert.doesNotMatch(save, /Selecciona el lineamiento antes de guardar/)
  assert.doesNotMatch(save, /Escribe el objetivo general antes de guardar/)
  assert.doesNotMatch(save, /Añade al menos un subpunto antes de guardar/)
  assert.match(save, /if \(detailRows\.length\)/)
})
