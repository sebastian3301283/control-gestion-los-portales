import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const catalog = await readFile(new URL('../src/GuidelineCatalogV2.tsx', import.meta.url), 'utf8')
const workspace = await readFile(new URL('../src/MatrixWorkspaceV12.tsx', import.meta.url), 'utf8')
const css = await readFile(new URL('../src/matrix-workspace-v12.css', import.meta.url), 'utf8')

test('Abrir matriz vive en Acciones antes de Editar y Eliminar', () => {
  const textCellIndex = catalog.indexOf('className="guideline-text-cell"')
  const actionsIndex = catalog.indexOf('className="guideline-actions"')
  const arrowIndex = catalog.indexOf('className="guideline-row-matrix-arrow"')
  const editIndex = catalog.indexOf('title="Editar"')
  const deleteIndex = catalog.indexOf('title="Eliminar"')

  assert.notEqual(textCellIndex, -1)
  assert.notEqual(actionsIndex, -1)
  assert.notEqual(arrowIndex, -1)
  assert.notEqual(editIndex, -1)
  assert.notEqual(deleteIndex, -1)
  assert.ok(textCellIndex < actionsIndex, 'la columna Lineamientos debe aparecer antes de Acciones')
  assert.ok(actionsIndex < arrowIndex, 'la flecha Abrir matriz debe renderizarse dentro de Acciones')
  assert.ok(arrowIndex < editIndex, 'Abrir matriz debe ir antes de Editar')
  assert.ok(editIndex < deleteIndex, 'Editar debe mantenerse antes de Eliminar')
})

test('MatrixWorkspaceV12 hereda el color de cada unidad en Resumen', () => {
  assert.match(workspace, /matrix-v12--\$\{props\.unitCode\.toLowerCase\(\)\}/)

  assert.match(css, /\.matrix-v12--central\{--matrix-v12-accent:#1769aa/)
  assert.match(css, /\.matrix-v12--hu\{--matrix-v12-accent:#2e9b5f/)
  assert.match(css, /\.matrix-v12--dep\{--matrix-v12-accent:#e88324/)
  assert.match(css, /\.matrix-v12--vs\{--matrix-v12-accent:#42bfe8/)
  assert.match(css, /\.matrix-v12--hot\{--matrix-v12-accent:#171717/)

  assert.match(css, /\.matrix-v12-view-toggle button\.active\{[^}]*background:var\(--matrix-v12-accent\)/)
  assert.match(css, /\.matrix-v12-summary\{[^}]*border-top:4px solid var\(--matrix-v12-accent\)/)
  assert.match(css, /\.matrix-v12-summary>header span\{[^}]*color:var\(--matrix-v12-accent\)/)
  assert.match(css, /\.matrix-v12-summary-table th\{[^}]*background:var\(--matrix-v12-accent\)/)
})
