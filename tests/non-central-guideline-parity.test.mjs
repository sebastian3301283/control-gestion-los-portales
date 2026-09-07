// Contrato de regresión para llevar la experiencia de Lineamientos de Central a HU/DEP/VS/HOT sin alterar su tabla.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const planning = await readFile(new URL('../src/PlanningGuidelines.tsx', import.meta.url), 'utf8')
const catalog = await readFile(new URL('../src/GuidelineCatalogV2.tsx', import.meta.url), 'utf8')
const support = await readFile(new URL('../src/GuidelinePptPanel.tsx', import.meta.url), 'utf8')
const dashboard = await readFile(new URL('../src/Dashboard.tsx', import.meta.url), 'utf8')
const v11 = await readFile(new URL('../src/MatrixWorkspaceV11.tsx', import.meta.url), 'utf8')
const unitExcel = await readFile(new URL('../src/UnitExcelWorkspace.tsx', import.meta.url), 'utf8')

test('HU/DEP/VS/HOT conservan exactamente las cinco columnas del catálogo de lineamientos', () => {
  assert.match(catalog, /<th>N°<\/th><th>Lineamientos Estratégicos<\/th><th>Gerencia Responsable<\/th><th>Gerente Responsable<\/th>\{canManage && <th>Acciones<\/th>\}/)
})

test('los botones de navegación y pantalla completa de Lineamientos funcionan también fuera de Central', () => {
  assert.doesNotMatch(planning, /if \(!isCentral \|\| !selectedArea\) return/)
  assert.doesNotMatch(planning, /\{isCentral && selectedArea && <button className="planning-guideline-matrix-button"/)
  assert.doesNotMatch(planning, /\{isCentral && <button className="planning-guideline-fullscreen-button"/)
  assert.match(planning, /Ir a matriz de \{selectedArea\.name\}/)
  assert.match(planning, /Pantalla completa/)
  assert.match(planning, /Importar lineamientos/)
  assert.match(catalog, /Nuevo lineamiento/)
})

test('Documentos de soporte lista solo gerencias usadas por lineamientos del periodo y conserva su panel actual', () => {
  assert.match(support, /from\('planning_guidelines'\)/)
  assert.match(support, /eq\('period_id', periodId\)/)
  assert.match(support, /eq\('unit_code', unit\.code\)/)
  assert.match(support, /management_id/)
  assert.match(support, /guideline-ppt-panel/)
  assert.match(support, /guideline-ppt-area-select/)
})

test('Ir a matriz y Ver lineamientos transportan la gerencia activa también en HU/DEP/VS/HOT', () => {
  assert.match(unitExcel, /onGuidelineContextChange\?:/)
  assert.match(unitExcel, /onGuidelineContextChange\?\.\(/)
  assert.match(v11, /<UnitExcelWorkspace[^>]*onGuidelineContextChange=\{setGuidelineContext\}/s)
  assert.doesNotMatch(dashboard, /if \(selectedPlanningUnit\.code === 'CENTRAL' && target\?\.managementId\) sessionStorage\.setItem\('cg:guideline-target'/)
  assert.match(planning, /<GuidelineCatalogV2[^>]*initialManagementId=/s)
  assert.match(planning, /<GuidelineCatalogV2[^>]*focusGuidelineId=/s)
  assert.match(catalog, /initialManagementId/)
  assert.match(catalog, /focusGuidelineId/)
})
