import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const central = await readFile(new URL('../src/CentralExcelWorkspace.tsx', import.meta.url), 'utf8')
const v11 = await readFile(new URL('../src/MatrixWorkspaceV11.tsx', import.meta.url), 'utf8')
const v12 = await readFile(new URL('../src/MatrixWorkspaceV12.tsx', import.meta.url), 'utf8')
const v11Css = await readFile(new URL('../src/matrix-workspace-v11.css', import.meta.url), 'utf8')

test('Central conserva la toolbar completa y sigue pasando por MatrixWorkspaceV11', () => {
  for (const label of ['Expandir matriz', 'Historial', 'Importar Excel', 'Exportar Excel', 'Nueva fila']) {
    assert.match(central, new RegExp(label))
  }
  assert.match(v11, /CentralExcelWorkspace/)
  assert.match(v12, /<MatrixWorkspaceV11/)
})

test('Central usa objetivos OB como separadores y acciones como filas de hoja de cálculo', () => {
  assert.match(central, /<th>Acción<\/th>/)
  assert.match(central, /matrix-central-objective-group/)
  assert.match(central, /matrix-central-spreadsheet-grid/)
  assert.match(central, /matrix-central-in-grid-draft/)
  assert.doesNotMatch(central, /<th>Subpunto<\/th>|matrix-v10-central-subpoint-row/)
})

test('V11 no oculta ni desplaza la primera columna Acción de Central', () => {
  assert.doesNotMatch(v11Css, /matrix-v5--central[^}]*thead th:first-child[^}]*display\s*:\s*none/s)
  assert.doesNotMatch(v11Css, /matrix-v5--central[^}]*th:nth-child\(2\)[^}]*width\s*:\s*360px/s)
  assert.doesNotMatch(v11Css, /tr:not\(\.matrix-v5-objective-row\)\s*>\s*td:first-child/)
  assert.doesNotMatch(v11Css, /matrix-v5-edit-row\s*>\s*td:first-child/)
})
