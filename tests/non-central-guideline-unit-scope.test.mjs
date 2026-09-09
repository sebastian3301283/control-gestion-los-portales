import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const catalog = await readFile(new URL('../src/GuidelineCatalogV2.tsx', import.meta.url), 'utf8')
const queryCache = await readFile(new URL('../src/lib/planning-query-cache.ts', import.meta.url), 'utf8')

test('HU/DEP/VS/HOT filtran gerencias con Activar áreas por unidad', () => {
  assert.match(queryCache, /loadMatrixAreaCatalog\(unitCode\)/)
  assert.match(catalog, /const allowed = new Set\(matrixAreaIds\)/)
  assert.match(catalog, /managements\.filter\(item => item\.active && allowed\.has\(item\.id\)\)/)
  assert.match(catalog, /Solo aparecen las áreas configuradas en “Activar áreas por unidad”/)
})

test('los bonistas no Central se filtran por cualquiera de las gerencias seleccionadas', () => {
  assert.match(catalog, /const areaIds = formUnitCode === 'CENTRAL' \? \(formAreaId \? \[formAreaId\] : \[\]\) : selectedManagementIds/)
  assert.match(catalog, /const allowedManagerIds = new Set\(links\.filter\(link => areaIds\.includes\(link\.management_id\)\)\.map\(link => link\.manager_id\)\)/)
  assert.match(catalog, /managers\.filter\(item => item\.active && allowedManagerIds\.has\(item\.id\)\)/)
  assert.match(queryCache, /loadScopedManagers\(unitCode\)/)
})

test('cambiar de unidad limpia selecciones singulares y múltiples para evitar ids cruzados', () => {
  assert.match(catalog, /function switchFormUnit\(nextUnitCode: string\)[\s\S]+setFormUnitCode\(nextUnitCode\)[\s\S]+setFormAreaId\(''\)[\s\S]+setFormResponsibleId\(''\)[\s\S]+setSelectedManagementIds\(\[\]\)[\s\S]+setSelectedResponsibleIds\(\[\]\)/)
  assert.match(catalog, /onChange=\{event => switchFormUnit\(event\.target\.value\)\}/)
})
