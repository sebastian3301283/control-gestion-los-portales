// Contrato de regresión para HU/DEP/VS/HOT: un lineamiento posee una matriz y soportes propios.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const planning = await readFile(new URL('../src/PlanningGuidelines.tsx', import.meta.url), 'utf8')
const catalog = await readFile(new URL('../src/GuidelineCatalogV2.tsx', import.meta.url), 'utf8')
const support = await readFile(new URL('../src/GuidelinePptPanel.tsx', import.meta.url), 'utf8')
const dashboard = await readFile(new URL('../src/Dashboard.tsx', import.meta.url), 'utf8')
const matrixWorkspace = await readFile(new URL('../src/MatrixWorkspace.tsx', import.meta.url), 'utf8')
const unitExcel = await readFile(new URL('../src/UnitExcelWorkspace.tsx', import.meta.url), 'utf8')
const v11 = await readFile(new URL('../src/MatrixWorkspaceV11.tsx', import.meta.url), 'utf8')
const planningCss = await readFile(new URL('../src/planning-guidelines.css', import.meta.url), 'utf8')

test('HU/DEP/VS/HOT conservan la tabla de Lineamientos anterior y su color por unidad', () => {
  assert.match(catalog, /<th>N°<\/th><th>Categoría<\/th><th>Lineamientos Estratégicos<\/th><th>Gerencia Responsable<\/th><th>Gerente Responsable<\/th>\{canManage && <th>Acciones<\/th>\}/)
  assert.match(catalog, /HU: '#2f9b5f'/)
  assert.match(catalog, /DEP: '#f28a22'/)
  assert.match(catalog, /VS: '#2bb5d6'/)
  assert.match(catalog, /HOT: '#262a2f'/)
})

test('HU/DEP/VS/HOT muestran Nuevo lineamiento en la vista de planificación', () => {
  assert.match(catalog, /Nuevo lineamiento/)
  assert.doesNotMatch(planningCss, /\.planning-guidelines-host \.guideline-add\{display:none!important\}/)
})

test('cada lineamiento no Central es seleccionable y su flecha transporta el guideline exacto', () => {
  assert.match(catalog, /selectedGuidelineId\?: string \| null/)
  assert.match(catalog, /onSelectGuideline\?:/)
  assert.match(catalog, /onOpenMatrixForGuideline\?: \(managementId: string, guidelineId: string\) => void/)
  assert.match(catalog, /onSelectGuideline\?\.\(\{ id: item\.id, managementId: item\.management_id, label:/)
  assert.match(catalog, /onOpenMatrixForGuideline\?\.\(item\.management_id, item\.id\)/)
  assert.match(catalog, /title="Abrir matriz de este lineamiento"/)
  assert.match(catalog, /guideline-selected/)
})

test('PlanningGuidelines conserva el lineamiento seleccionado para soportes y navegación', () => {
  assert.match(planning, /selectedGuideline/)
  assert.match(planning, /onSelectGuideline=\{setSelectedGuideline\}/)
  assert.match(planning, /selectedGuidelineId=/)
  assert.match(planning, /guidelineId=\{selectedGuideline\?\.id/)
  assert.match(planning, /guidelineLabel=\{selectedGuideline\?\.label/)
  assert.match(planning, /onOpenMatrixForArea\?\.\(managementId, guidelineId\)/)
})

test('Documentos de soporte de HU/DEP/VS/HOT quedan aislados por guidelineId', () => {
  assert.match(support, /guidelineId\?: string \| null/)
  assert.match(support, /guidelineLabel\?: string \| null/)
  assert.match(support, /`\$\{baseFolder\}\/\$\{guidelineId\}`/)
  assert.match(support, /Selecciona un lineamiento/)
  assert.doesNotMatch(support, /Todos los documentos de soporte del periodo se muestran juntos/)
  assert.doesNotMatch(support, /nestedResults/)
})

test('Dashboard transporta managementId y guidelineId desde Lineamientos', () => {
  assert.doesNotMatch(dashboard, /selectedPlanningUnit\.code !== 'CENTRAL' && <button className="planning-module-choice planning-module-choice--matrices"/)
  assert.match(dashboard, /function openMatrixFromGuidelines\(managementId: string, guidelineId/)
  assert.match(dashboard, /guidelineId,/)
  assert.match(dashboard, /onOpenMatrixForArea=\{openMatrixFromGuidelines\}/)
  assert.match(v11, /Ver lineamientos/)
})

test('el wrapper deja que UnitExcel consuma el target con guidelineId y Central conserva su apertura por área', () => {
  assert.match(matrixWorkspace, /guidelineId\?: string \| null/)
  assert.match(matrixWorkspace, /props\.unitCode !== 'CENTRAL'[\s\S]+target\.guidelineId/)
  assert.match(unitExcel, /matrixForGuideline/)
  assert.match(unitExcel, /item\.guideline_id === guidelineId/)
})

test('la matriz HU/DEP/VS/HOT usa exactamente los encabezados visibles de Central', () => {
  assert.match(unitExcel, /<thead><tr><th>Acción<\/th><th>Responsable<\/th><th>Prioridad<\/th><th>Hitos \/ Fechas<\/th><th>Entregable<\/th><th>Riesgos de no ejecutar<\/th><th>Restricciones<\/th><th>Soporte<\/th><th>Comité<\/th><\/tr><\/thead>/)
  assert.doesNotMatch(unitExcel, /<thead><tr><th>Objetivo<\/th>/)
  assert.doesNotMatch(unitExcel, /<th>KPI<\/th><th>Inicio<\/th><th>Fin<\/th>/)
})

test('la matriz no Central adopta la commandbar de Central pero mantiene su modelo de filas', () => {
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

test('la sincronización antigua de matrices por proceso queda limitada a Central', () => {
  assert.match(catalog, /if \(nextUnitCode !== 'CENTRAL'\) return/)
})
