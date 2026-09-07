// Contrato de regresión para llevar HU/DEP/VS/HOT a la experiencia de Central
// conservando únicamente su tabla de Lineamientos propia y el color de cada unidad.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const planning = await readFile(new URL('../src/PlanningGuidelines.tsx', import.meta.url), 'utf8')
const catalog = await readFile(new URL('../src/GuidelineCatalogV2.tsx', import.meta.url), 'utf8')
const support = await readFile(new URL('../src/GuidelinePptPanel.tsx', import.meta.url), 'utf8')
const dashboard = await readFile(new URL('../src/Dashboard.tsx', import.meta.url), 'utf8')
const unitExcel = await readFile(new URL('../src/UnitExcelWorkspace.tsx', import.meta.url), 'utf8')
const v11 = await readFile(new URL('../src/MatrixWorkspaceV11.tsx', import.meta.url), 'utf8')

test('HU/DEP/VS/HOT conservan la tabla de Lineamientos anterior y su color por unidad', () => {
  assert.match(catalog, /<th>N°<\/th><th>Lineamientos Estratégicos<\/th><th>Gerencia Responsable<\/th><th>Gerente Responsable<\/th>\{canManage && <th>Acciones<\/th>\}/)
  assert.match(catalog, /HU: '#2f9b5f'/)
  assert.match(catalog, /DEP: '#f28a22'/)
  assert.match(catalog, /VS: '#2bb5d6'/)
  assert.match(catalog, /HOT: '#262a2f'/)
})

test('Lineamientos conserva los controles de Central sin añadir un selector de área para HU/DEP/VS/HOT', () => {
  assert.match(planning, /Pantalla completa/)
  assert.match(planning, /Importar lineamientos/)
  assert.match(catalog, /Nuevo lineamiento/)
  assert.doesNotMatch(planning, /guideline-ppt-area-select/)
  assert.match(planning, /Ir a matriz de \{selectedArea\.name\}/)
})

test('Documentos de soporte de HU/DEP/VS/HOT se muestran juntos sin selector ni filtro por gerencia', () => {
  assert.doesNotMatch(support, /guideline-ppt-area-select/)
  assert.doesNotMatch(support, /from\('planning_guidelines'\)/)
  assert.match(support, /planning-ppts/)
  assert.match(support, /unit\.code/)
  assert.match(support, /periodId/)
  assert.match(support, /guideline-ppt-panel/)
})

test('Matrices deja de ser una tarjeta dentro de HU/DEP/VS/HOT y se abre desde Lineamientos', () => {
  assert.doesNotMatch(dashboard, /selectedPlanningUnit\.code !== 'CENTRAL' && <button className="planning-module-choice planning-module-choice--matrices"/)
  assert.match(dashboard, /onOpenMatrixForArea=\{openMatrixFromGuidelines\}/)
  assert.match(dashboard, /sessionStorage\.setItem\('cg:matrix-target-management'/)
  assert.match(v11, /Ver lineamientos/)
})

test('la matriz HU/DEP/VS/HOT usa exactamente los encabezados visibles de Central', () => {
  assert.match(unitExcel, /<thead><tr><th>Acción<\/th><th>Responsable<\/th><th>Prioridad<\/th><th>Hitos \/ Fechas<\/th><th>Entregable<\/th><th>Riesgos de no ejecutar<\/th><th>Restricciones<\/th><th>Soporte<\/th><th>Comité<\/th><\/tr><\/thead>/)
  assert.doesNotMatch(unitExcel, /<thead><tr><th>Objetivo<\/th>/)
  assert.doesNotMatch(unitExcel, /<th>KPI<\/th><th>Inicio<\/th><th>Fin<\/th>/)
})

test('la matriz no Central adopta la commandbar de Central pero mantiene su modelo de persistencia anterior', () => {
  assert.match(unitExcel, /matrix-central-page-head/)
  assert.match(unitExcel, /matrix-central-commandbar/)
  assert.match(unitExcel, /Añadir acción/)
  assert.doesNotMatch(unitExcel, />Importar Excel</)
  assert.doesNotMatch(unitExcel, />Nueva fila</)
  assert.match(unitExcel, /kpi: rowDraft\.kpi \|\| null/)
  assert.match(unitExcel, /start_date: rowDraft\.start_date \|\| null/)
  assert.match(unitExcel, /end_date: rowDraft\.end_date \|\| null/)
  assert.match(unitExcel, /matrix-v5--\$\{unitAccent\[unitCode\]\}/)
})
