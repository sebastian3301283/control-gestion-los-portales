import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const catalog = await readFile(new URL('../src/GuidelineCatalogV2.tsx', import.meta.url), 'utf8')
const cache = await readFile(new URL('../src/lib/planning-query-cache.ts', import.meta.url), 'utf8')

test('HU DEP VS HOT muestran Áreas de Unidad manuales y Áreas de Central, no gerentes', () => {
  assert.match(catalog, /unitCode === 'CENTRAL' \? 'Gerencia Responsable' : 'Áreas de Unidad'/)
  assert.match(catalog, /unitCode === 'CENTRAL' \? 'Gerente Responsable' : 'Áreas de Central'/)
  assert.match(catalog, /selectedUnitAreaLabels/)
  assert.match(catalog, /selectedCentralManagementIds/)
  assert.match(catalog, /centralManagementOptions/)
  assert.match(catalog, /management_ids_input: technicalManagementIds/)
  assert.match(catalog, /unit_area_labels_input: selectedUnitAreaLabels/)
  assert.match(catalog, /central_management_ids_input: selectedCentralManagementIds/)
  assert.match(catalog, /responsible_ids_input: \[\]/)
  assert.doesNotMatch(catalog, /renderMultiChips\(responsibleIds, 'manager'\)/)
})

test('la carga no Central trae el catálogo completo de áreas Central y deja de cargar bonistas', () => {
  const start = cache.indexOf('export async function loadNonCentralGuidelineData')
  const end = cache.indexOf('export async function loadCentralGuidelineData', start)
  const block = cache.slice(start, end)
  assert.match(block, /loadScopedManagements\('CENTRAL'\)/)
  assert.match(block, /loadGuidelineCentralManagements/)
  assert.match(block, /loadGuidelineUnitAreaLabels/)
  assert.doesNotMatch(block, /loadManagersByIds/)
  assert.doesNotMatch(block, /loadManagerManagements/)
})
