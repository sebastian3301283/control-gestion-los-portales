import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const v10 = await readFile(new URL('../src/MatrixWorkspaceV10.tsx', import.meta.url), 'utf8')
const v11 = await readFile(new URL('../src/MatrixWorkspaceV11.tsx', import.meta.url), 'utf8')
const v12 = await readFile(new URL('../src/MatrixWorkspaceV12.tsx', import.meta.url), 'utf8')

test('Central edita directamente en la fila y deja de abrir el editor superior', () => {
  assert.match(v10, /matrix-v10-central-inline-editor-row/)
  assert.match(v10, /data-matrix-row-id=\{row\.id\}/)
  assert.match(v10, /onClick=\{\(\) => startEditRow\(row\)\}/)
  assert.doesNotMatch(v12, /matrix-v12-editor|openEditEditor|openNewEditor/)
})

test('la edición inline conserva subpuntos reales y su bloqueo colaborativo', () => {
  assert.match(v10, /centralSubpointDrafts/)
  assert.match(v10, /normalizeCentralSubpointRows/)
  assert.match(v10, /matrix_row_subpoints/)
  assert.match(v10, /Añadir subpunto/)
  assert.match(v11, /dataset\.matrixRowId|data-matrix-row-id/)
})
