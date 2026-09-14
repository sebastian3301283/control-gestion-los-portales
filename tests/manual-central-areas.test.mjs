import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const catalog = await readFile(new URL('../src/GuidelineCatalogV2.tsx', import.meta.url), 'utf8')
const importer = await readFile(new URL('../src/GuidelineMultiImport.tsx', import.meta.url), 'utf8')
const cache = await readFile(new URL('../src/lib/planning-query-cache.ts', import.meta.url), 'utf8')

test('Áreas de Central se editan como etiquetas libres y no como catálogo visible', () => {
  assert.match(catalog, /selectedCentralAreaLabels/)
  assert.match(catalog, /centralAreaDraft/)
  assert.match(catalog, /addCentralAreaLabels/)
  assert.match(catalog, /Agregar área Central/)
  assert.match(catalog, /central_area_labels_input: selectedCentralAreaLabels/)
  assert.doesNotMatch(catalog, /<span>Áreas de Central<\/span><div className="guideline-multi-options">\{centralManagementOptions/)
})

test('la persistencia visible de Áreas de Central queda separada de la relación técnica', () => {
  assert.match(cache, /loadGuidelineCentralAreaLabels/)
  assert.match(cache, /planning_guideline_central_area_labels/)
  assert.match(catalog, /resolveTechnicalManagementIds\(selectedCentralAreaLabels, centralManagementOptions\)/)
})

test('el importador conserva Áreas de Central escritas aunque no existan en el catálogo', () => {
  assert.match(importer, /central_area_labels_input: row\.centralAreas/)
  assert.match(importer, /central_management_ids_input: matchCatalogMany\(row\.centralAreas, centralManagements\)/)
})
