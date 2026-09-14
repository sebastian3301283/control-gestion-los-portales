import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const catalog = await readFile(new URL('../src/GuidelineCatalogV2.tsx', import.meta.url), 'utf8')
const queryCache = await readFile(new URL('../src/lib/planning-query-cache.ts', import.meta.url), 'utf8')

test('HU/DEP/VS/HOT filtran Áreas de Unidad con Activar áreas por unidad', () => {
  assert.match(queryCache, /loadMatrixAreaCatalog\(unitCode\)/)
  assert.match(catalog, /const allowed = new Set\(matrixAreaIds\)/)
  assert.match(catalog, /managements\.filter\(item => item\.active && allowed\.has\(item\.id\)\)/)
  assert.match(catalog, /Solo aparecen las áreas configuradas en “Activar áreas por unidad”/)
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

test('cambiar de unidad limpia selecciones de Unidad y Central para evitar ids cruzados', () => {
  assert.match(catalog, /function switchFormUnit\(nextUnitCode: string\)[\s\S]+setFormUnitCode\(nextUnitCode\)[\s\S]+setFormAreaId\(''\)[\s\S]+setFormResponsibleId\(''\)[\s\S]+setSelectedManagementIds\(\[\]\)[\s\S]+setSelectedCentralManagementIds\(\[\]\)/)
  assert.match(catalog, /onChange=\{event => switchFormUnit\(event\.target\.value\)\}/)
})
