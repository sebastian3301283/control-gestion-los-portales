import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('../src/MatrixWorkspaceV10.tsx', import.meta.url), 'utf8')
const css = await readFile(new URL('../src/matrix-subpoints.css', import.meta.url), 'utf8')

test('Central coloca lineamiento y objetivo arriba y los subpuntos debajo en la misma zona de edición', () => {
  assert.match(source, /matrix-v10-central-inline-header-row/)
  assert.match(source, /matrix-v10-central-inline-subpoint-cell/)
  assert.match(source, /colSpan=\{2\}/)
  assert.match(css, /\.matrix-v10-central-inline-header-row/)
})

test('Central muestra Guardar y Cancelar arriba de la edición y no dentro de la columna Acciones', () => {
  assert.match(source, /matrix-v10-inline-top-actions/)
  assert.match(css, /\.matrix-v10-inline-top-actions/)
  const start = source.indexOf('function renderCentralInlineEditor')
  const end = source.indexOf('return <div className=', start)
  const editor = source.slice(start, end)
  assert.doesNotMatch(editor, /matrix-v5-row-actions/)
})
