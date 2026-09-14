import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const catalog = await readFile(new URL('../src/GuidelineCatalogV2.tsx', import.meta.url), 'utf8')
const queryCache = await readFile(new URL('../src/lib/planning-query-cache.ts', import.meta.url), 'utf8')

test('HU/DEP/VS/HOT mantienen catálogo técnico de matriz oculto y Áreas de Unidad manuales', () => {
  assert.match(queryCache, /loadMatrixAreaCatalog\(unitCode\)/)
  assert.match(catalog, /const allowed = new Set\(matrixAreaIds\)/)
  assert.match(catalog, /managements\.filter\(item => item\.active && allowed\.has\(item\.id\)\)/)
  assert.match(catalog, /selectedUnitAreaLabels/)
  assert.match(catalog, /unitAreaDraft/)
  assert.match(catalog, /Escribe las áreas manualmente/)
  assert.doesNotMatch(catalog, /Solo aparecen las áreas configuradas en “Activar áreas por unidad”/)
})

test('Áreas de Central usa el catálogo Central completo y ya no depende de bonistas', () => {
  assert.match(catalog, /const centralManagementOptions = useMemo/)
  assert.match(catalog, /centralManagements\.filter\(item => item\.active && item\.unit_code === 'CENTRAL'\)/)
  assert.match(queryCache, /loadScopedManagements\('CENTRAL'\)/)
  const nonCentralStart = queryCache.indexOf('export async function loadNonCentralGuidelineData')
  const nonCentralEnd = queryCache.indexOf('export async function loadCentralGuidelineData', nonCentralStart)
  const nonCentralBlock = queryCache.slice(nonCentralStart, nonCentralEnd)
  assert.doesNotMatch(nonCentralBlock, /loadScopedManagers/)
  assert.doesNotMatch(nonCentralBlock, /loadManagersByIds/)
})

test('cambiar de unidad limpia etiquetas manuales y selecciones Central para evitar datos cruzados', () => {
  assert.match(catalog, /function switchFormUnit\(nextUnitCode: string\)[\s\S]+setFormUnitCode\(nextUnitCode\)[\s\S]+setFormAreaId\(''\)[\s\S]+setFormResponsibleId\(''\)[\s\S]+setSelectedManagementIds\(\[\]\)[\s\S]+setSelectedUnitAreaLabels\(\[\]\)[\s\S]+setUnitAreaDraft\(''\)[\s\S]+setSelectedCentralManagementIds\(\[\]\)/)
  assert.match(catalog, /onChange=\{event => switchFormUnit\(event\.target\.value\)\}/)
})
