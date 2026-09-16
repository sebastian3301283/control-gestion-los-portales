import test from 'node:test'
import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'

const migrationsDir = new URL('../supabase/migrations/', import.meta.url)
const files = await readdir(migrationsDir)
const migrationName = files.find(name => name.endsWith('_planning_guideline_multi_policy_optimization.sql'))

test('la optimización RLS de propiedad múltiple existe como migración versionada', () => {
  assert.ok(migrationName, 'falta la migración planning_guideline_multi_policy_optimization')
})

test('las tablas de relaciones usan una sola política SELECT y políticas separadas de escritura', async () => {
  assert.ok(migrationName)
  const sql = await readFile(new URL(migrationName, migrationsDir), 'utf8')
  assert.match(sql, /drop policy if exists planning_guideline_managements_manage_global/)
  assert.match(sql, /create policy planning_guideline_managements_insert_global[\s\S]+for insert/)
  assert.match(sql, /create policy planning_guideline_managements_update_global[\s\S]+for update/)
  assert.match(sql, /create policy planning_guideline_managements_delete_global[\s\S]+for delete/)
  assert.match(sql, /create policy planning_guideline_responsibles_insert_global[\s\S]+for insert/)
  assert.match(sql, /create policy planning_guideline_responsibles_update_global[\s\S]+for update/)
  assert.match(sql, /create policy planning_guideline_responsibles_delete_global[\s\S]+for delete/)
  assert.doesNotMatch(sql, /create policy planning_guideline_(?:managements|responsibles)_manage_global[\s\S]+for all/)
})

test('la política de lineamientos inicializa auth.uid una vez por consulta', async () => {
  assert.ok(migrationName)
  const sql = await readFile(new URL(migrationName, migrationsDir), 'utf8')
  assert.match(sql, /\(select auth\.uid\(\)\) is not null/)
  assert.doesNotMatch(sql, /\bauth\.uid\(\) is not null/)
})
