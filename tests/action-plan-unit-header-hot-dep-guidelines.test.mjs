import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const leadership = await readFile(new URL('../src/UnitPlanLeadershipHeader.tsx', import.meta.url), 'utf8')
const wrapper = await readFile(new URL('../src/MatrixWorkspaceV13.tsx', import.meta.url), 'utf8')
const planning = await readFile(new URL('../src/PlanningGuidelines.tsx', import.meta.url), 'utf8')
const guidelines = await readFile(new URL('../src/GuidelineCatalogV2.tsx', import.meta.url), 'utf8')
const css = await readFile(new URL('../src/guideline-unit-layout-overrides.css', import.meta.url), 'utf8')

test('Plan de Acción usa Gerente de Unidad fijo por unidad y Gerente Responsable editable', () => {
  assert.match(leadership, /HU:\s*'J\.P\. Le Bienvenu V\.'/)
  assert.match(leadership, /VS:\s*'Juan Carlos Campana'/)
  assert.match(leadership, /HOT:\s*'Lucienne Freundt'/)
  assert.match(leadership, /DEP:\s*'Diego Abarca'/)
  assert.match(leadership, /<b>Unidad<\/b>/)
  assert.match(leadership, /<b>Gerente de Unidad<\/b>/)
  assert.match(leadership, /<b>Gerente Responsable<\/b>/)
  assert.match(leadership, /savePrincipalResponsible/)
  assert.match(leadership, /principal_responsible_manager_id/)
  assert.match(wrapper, /props\.unitCode !== 'CENTRAL'/)
})

test('Hoteles reduce Lineamientos a Categoría, Lineamiento y una sola región visual de Áreas', () => {
  assert.match(planning, /unit\.code !== 'HOT' && unit\.code !== 'DEP'/)
  assert.match(planning, /setHeader\(1, 'Categoría'\)/)
  assert.match(planning, /setHeader\(2, 'Lineamiento'\)/)
  assert.match(planning, /setHeader\(3, 'Áreas'\)/)
  assert.match(planning, /headers\[3\]\.colSpan = 2/)
  assert.match(planning, /guideline-hot-central-copy/)
  assert.match(css, /\.guideline-v2-table--hot/)
  assert.match(css, /\.guideline-v2-table--hot th:nth-child\(5\)/)
})

test('Departamentos conserva N°, Acciones y solo renombra las dos columnas de áreas', () => {
  assert.match(planning, /setHeader\(3, 'Áreas Matricial'\)/)
  assert.match(planning, /setHeader\(4, 'Gerencia Central'\)/)
  assert.match(planning, /guideline-v2-table--dep/)
  assert.match(planning, /if \(isHotel\) \{[\s\S]*const actions = actionCell\?\.querySelector/)
  assert.match(css, /\.guideline-v2-table--dep/)
  assert.doesNotMatch(css, /\.guideline-v2-table--dep th:nth-child\(1\)[^}]*display:none/)
  assert.doesNotMatch(css, /\.guideline-v2-table--dep th:nth-child\(6\)[^}]*display:none/)
})

test('HU y VS conservan la tabla estándar y la edición/importación de lineamientos', () => {
  assert.match(guidelines, /<th>N°<\/th><th>Categoría<\/th><th>Lineamientos Estratégicos<\/th>/)
  assert.match(guidelines, /Áreas de Unidad/)
  assert.match(guidelines, /Áreas de Central/)
  assert.match(guidelines, /save_planning_guideline_multi/)
  assert.match(guidelines, /unit_area_labels_input: selectedUnitAreaLabels/)
  assert.match(guidelines, /central_area_labels_input: selectedCentralAreaLabels/)
  assert.match(planning, /<GuidelineMultiImport/)
})
