import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const v10 = await readFile(new URL('../src/MatrixWorkspaceV10.tsx', import.meta.url), 'utf8')
const v12 = await readFile(new URL('../src/MatrixWorkspaceV12.tsx', import.meta.url), 'utf8')
const v11Css = await readFile(new URL('../src/matrix-workspace-v11.css', import.meta.url), 'utf8')

test('Central conserva la toolbar completa de MatrixWorkspaceV11', () => {
  for (const label of ['Expandir matriz', 'Historial', 'Importar Excel', 'Exportar Excel', 'Nueva fila']) {
    assert.match(v10, new RegExp(label))
  }
  assert.match(v12, /<MatrixWorkspaceV11/)
})

test('Central renderiza una columna y filas React reales por subpunto sin manipular el DOM', () => {
  assert.match(v10, /<th>Subpunto<\/th>/)
  assert.match(v10, /matrix-v10-central-subpoint-row/)
  assert.doesNotMatch(v12, /MutationObserver|document\.createElement/)
})

test('el CSS oculta únicamente la celda de número y no el primer subpunto de filas posteriores', () => {
  assert.match(v11Css, /td\.matrix-v5-number/)
  assert.doesNotMatch(v11Css, /tr:not\(\.matrix-v5-objective-row\)\s*>\s*td:first-child/)
})
