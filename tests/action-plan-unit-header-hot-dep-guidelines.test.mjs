import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const workspace = await readFile(new URL('../src/UnitExcelWorkspace.tsx', import.meta.url), 'utf8')
const guidelines = await readFile(new URL('../src/GuidelineCatalogV2.tsx', import.meta.url), 'utf8')
const css = await readFile(new URL('../src/guideline-catalog-v2.css', import.meta.url), 'utf8')

test('Plan de Acción usa Gerente de Unidad fijo por unidad y Gerente Responsable editable', () => {
  assert.match(workspace, /HU:\s*'J\.P\. Le Bienvenu V\.'/)
  assert.match(workspace, /VS:\s*'Juan Carlos Campana'/)
  assert.match(workspace, /HOT:\s*'Lucienne Freundt'/)
  assert.match(workspace, /DEP:\s*'Diego Abarca'/)
  assert.match(workspace, /<b>Unidad<\/b>/)
  assert.match(workspace, /<b>Gerente de Unidad<\/b>/)
  assert.match(workspace, /<b>Gerente Responsable<\/b>/)
  assert.match(workspace, /savePrincipalResponsible/)
  assert.match(workspace, /principal_responsible_manager_id/)
})

test('Hoteles reduce Lineamientos a Categoría, Lineamiento y Áreas sin cambiar guardado', () => {
  assert.match(guidelines, /unitCode === 'HOT'/)
  assert.match(guidelines, /<th>Categoría<\/th><th>Lineamiento<\/th><th>Áreas<\/th>/)
  assert.match(guidelines, /mergeAreaLabels\(unitLabels, centralLabels\)/)
  assert.match(guidelines, /guideline-v2-table--hot/)
  assert.match(guidelines, /save_planning_guideline_multi/)
  assert.match(guidelines, /unit_area_labels_input: selectedUnitAreaLabels/)
  assert.match(guidelines, /central_area_labels_input: selectedCentralAreaLabels/)
  assert.match(css, /\.guideline-v2-table--hot/)
})

test('Departamentos conserva cuatro columnas con encabezados específicos', () => {
  assert.match(guidelines, /unitCode === 'DEP'/)
  assert.match(guidelines, /<th>Categoría<\/th><th>Lineamiento<\/th><th>Áreas Matricial<\/th><th>Gerencia Central<\/th>/)
  assert.match(guidelines, /guideline-v2-table--dep/)
  assert.match(css, /\.guideline-v2-table--dep/)
})

test('HU y VS conservan la tabla estándar compartida', () => {
  assert.match(guidelines, /<th>N°<\/th><th>Categoría<\/th><th>Lineamientos Estratégicos<\/th>/)
  assert.match(guidelines, /Áreas de Unidad/)
  assert.match(guidelines, /Áreas de Central/)
})
