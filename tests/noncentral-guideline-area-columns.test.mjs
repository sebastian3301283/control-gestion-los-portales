import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const catalog = await readFile(new URL('../src/GuidelineCatalogV2.tsx', import.meta.url), 'utf8')
const cache = await readFile(new URL('../src/lib/planning-query-cache.ts', import.meta.url), 'utf8')

test('HU DEP VS HOT mantienen áreas manuales y asignación opcional de Gerencia y Bonista por unidad', () => {
  assert.match(catalog, /unitCode === 'CENTRAL' \? 'Gerencia Responsable' : 'Áreas de Unidad'/)
  assert.match(catalog, /unitCode === 'CENTRAL' \? 'Gerente Responsable' : 'Áreas de Central'/)
  assert.match(catalog, /selectedUnitAreaLabels/)
  assert.match(catalog, /selectedCentralAreaLabels/)
  assert.match(catalog, /centralAreaDraft/)
  assert.match(catalog, /management_ids_input: orderedTechnicalManagementIds/)
  assert.match(catalog, /unit_area_labels_input: selectedUnitAreaLabels/)
  assert.match(catalog, /central_management_ids_input: technicalCentralManagementIds/)
  assert.match(catalog, /central_area_labels_input: selectedCentralAreaLabels/)
  assert.match(catalog, /responsible_ids_input: formResponsibleId \? \[formResponsibleId\] : \[\]/)
  assert.match(catalog, /Gerencia responsable \(opcional\)/)
  assert.match(catalog, /Gerente responsable · Bonistas/)
  assert.doesNotMatch(catalog, /renderMultiChips\(responsibleIds, 'manager'\)/)
})

test('la carga no Central conserva catálogos técnicos ocultos y carga ambas etiquetas visibles', () => {
  const start = cache.indexOf('export async function loadNonCentralGuidelineData')
  const end = cache.indexOf('export async function loadCentralGuidelineData', start)
  const block = cache.slice(start, end)
  assert.match(block, /loadScopedManagements\('CENTRAL'\)/)
  assert.match(block, /loadGuidelineCentralManagements/)
  assert.match(block, /loadGuidelineUnitAreaLabels/)
  assert.match(block, /loadGuidelineCentralAreaLabels/)
  assert.doesNotMatch(block, /loadManagersByIds/)
  assert.doesNotMatch(block, /loadManagerManagements/)
})
