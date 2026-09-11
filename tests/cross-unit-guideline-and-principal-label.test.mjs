import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'

const central = await readFile(new URL('../src/CentralExcelWorkspace.tsx', import.meta.url), 'utf8')
const migrationsDir = new URL('../supabase/migrations/', import.meta.url)
const migrationNames = await readdir(migrationsDir)

async function readMigrationBySuffix(suffix) {
  const name = migrationNames.find(item => item.endsWith(suffix))
  if (!name) return { name: '', sql: '' }
  return { name, sql: await readFile(new URL(name, migrationsDir), 'utf8') }
}

test('Responsable principal muestra solo el nombre y no concatena el cargo en el option', () => {
  assert.match(central, /highestAreaManagers\.map\(manager => <option key=\{manager\.id\} value=\{manager\.id\}>\{manager\.name\}<\/option>\)/)
  assert.doesNotMatch(central, /<option key=\{manager\.id\} value=\{manager\.id\}>\{manager\.name\}\{manager\.cargo/)
})

test('repo conserva la migración remota que introdujo el auto-proceso no Central', async () => {
  const migration = await readMigrationBySuffix('_noncentral_guideline_auto_process.sql')
  assert.ok(migration.name, 'falta sincronizar 20260907205925_noncentral_guideline_auto_process')
  assert.match(migration.sql, /function public\.ensure_noncentral_guideline_process/i)
  assert.match(migration.sql, /function public\.sync_noncentral_guideline_matrix/i)
})

test('auto-proceso permite gerencias activadas para la unidad aunque su origen sea otra unidad', async () => {
  const migration = await readMigrationBySuffix('_allow_cross_unit_guideline_process.sql')
  assert.ok(migration.name, 'falta migración que permita áreas cross-unit activadas en matrix_unit_area_catalog')
  assert.match(migration.sql, /matrix_unit_area_catalog/i)
  assert.match(migration.sql, /catalog\.unit_code\s*=\s*unit_code_input/i)
  assert.match(migration.sql, /catalog\.management_id\s*=\s*management_id_input/i)
  assert.doesNotMatch(migration.sql, /managements_global[\s\S]{0,400}unit_code\s*=\s*unit_code_input/i)
})
