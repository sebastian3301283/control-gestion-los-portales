import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'

const catalog = await readFile(new URL('../src/GuidelineCatalogV2.tsx', import.meta.url), 'utf8')
const migrations = await readdir(new URL('../supabase/migrations/', import.meta.url))

test('HU DEP VS HOT guardan por lineamiento sin exigir un área técnica del catálogo', () => {
  assert.doesNotMatch(catalog, /No existe un área técnica activa para crear la matriz de esta unidad/)
  assert.match(catalog, /loadScopedManagements\(formUnitCode/)
  assert.match(catalog, /const orderedTechnicalManagementIds = formAreaId && technicalManagementIds\.includes\(formAreaId\)/)
  assert.match(catalog, /\[formAreaId, \.\.\.technicalManagementIds\.filter\(id => id !== formAreaId\)\]/)
  assert.match(catalog, /management_ids_input: orderedTechnicalManagementIds/)
})

test('la base desacopla la matriz por lineamiento de matrix_unit_area_catalog', async () => {
  const name = migrations.find(file => file.includes('decouple_noncentral_guideline_matrix_from_area'))
  assert.ok(name, 'falta la migración que desacopla lineamientos no Central del catálogo técnico')
  const sql = await readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8')
  assert.match(sql, /managements_global/)
  assert.match(sql, /unit_code = unit_code_input/)
  assert.match(sql, /guideline_id/)
  assert.doesNotMatch(sql, /join public\.matrix_unit_area_catalog catalog/)
})
