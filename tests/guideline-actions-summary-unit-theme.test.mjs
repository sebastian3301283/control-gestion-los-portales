import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const planning = await readFile(new URL('../src/PlanningGuidelines.tsx', import.meta.url), 'utf8')
const catalog = await readFile(new URL('../src/GuidelineCatalogV2.tsx', import.meta.url), 'utf8')
const v13 = await readFile(new URL('../src/MatrixWorkspaceV13.tsx', import.meta.url), 'utf8')
const themeCss = await readFile(new URL('../src/matrix-workspace-v12-unit-theme.css', import.meta.url), 'utf8')

test('Abrir matriz se renderiza directamente en Acciones antes de Editar y Eliminar', () => {
  const actionsIndex = catalog.indexOf('<div className="guideline-actions">')
  const arrowIndex = catalog.indexOf('guideline-row-matrix-arrow', actionsIndex)
  const editIndex = catalog.indexOf('openEdit(item)', arrowIndex)
  const deleteIndex = catalog.indexOf('deleteGuideline(item)', editIndex)
  assert.ok(actionsIndex >= 0, 'falta el contenedor Acciones')
  assert.ok(arrowIndex > actionsIndex, 'Abrir matriz debe estar dentro de Acciones')
  assert.ok(editIndex > arrowIndex, 'Abrir matriz debe aparecer antes de Editar')
  assert.ok(deleteIndex > editIndex, 'Eliminar debe permanecer después de Editar')
  assert.doesNotMatch(planning, /actions\.insertBefore\(arrow, actions\.firstChild\)/)
  assert.doesNotMatch(planning, /relocateMatrixActions/)
})

test('las tres acciones de lineamientos quedan reservadas a Gestión Estratégica', () => {
  assert.match(planning, /onPrefetchMatrixForGuideline=\{canManage \? prefetchMatrixForGuideline : undefined\}/)
  assert.match(planning, /onOpenMatrixForGuideline=\{canManage \? openMatrixForGuideline : undefined\}/)
})

test('MatrixWorkspaceV12 hereda el color de cada unidad en Resumen', () => {
  assert.match(v13, /matrix-v12-theme-host matrix-v12--\$\{props\.unitCode\.toLowerCase\(\)\}/)
  assert.match(v13, /matrix-workspace-v12-unit-theme\.css/)
  assert.match(themeCss, /\.matrix-v12--central\{--matrix-v12-accent:#1769aa/)
  assert.match(themeCss, /\.matrix-v12--hu\{--matrix-v12-accent:#2e9b5f/)
  assert.match(themeCss, /\.matrix-v12--dep\{--matrix-v12-accent:#e88324/)
  assert.match(themeCss, /\.matrix-v12--vs\{--matrix-v12-accent:#42bfe8/)
  assert.match(themeCss, /\.matrix-v12--hot\{--matrix-v12-accent:#171717/)
  assert.match(themeCss, /\.matrix-v12-theme-host \.matrix-v12-view-toggle button\.active\{[^}]*background:var\(--matrix-v12-accent\)/)
  assert.match(themeCss, /\.matrix-v12-theme-host \.matrix-v12-summary\{[^}]*border-top:4px solid var\(--matrix-v12-accent\)/)
  assert.match(themeCss, /\.matrix-v12-theme-host \.matrix-v12-summary>header span\{[^}]*color:var\(--matrix-v12-accent\)/)
  assert.match(themeCss, /\.matrix-v12-theme-host \.matrix-v12-summary-table th\{[^}]*background:var\(--matrix-v12-accent\)/)
})
