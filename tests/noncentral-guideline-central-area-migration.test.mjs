import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const migration = await readFile(new URL('../supabase/migrations/20260914160000_noncentral_guideline_central_areas.sql', import.meta.url), 'utf8').catch(() => '')

test('la migración separa Áreas de Central de las Áreas de Unidad', () => {
  assert.match(migration, /create table if not exists public\.planning_guideline_central_managements/)
  assert.match(migration, /primary key \(guideline_id, management_id\)/)
  assert.match(migration, /enable row level security/)
  assert.match(migration, /planning_guideline_central_managements_select/)
  assert.match(migration, /public\.can_access_guideline_multi\(guideline_id\)/)
})

test('la migración preserva asociaciones Central existentes y publica guardado transaccional', () => {
  assert.match(migration, /insert into public\.planning_guideline_central_managements/)
  assert.match(migration, /join public\.manager_managements/)
  assert.match(migration, /management\.unit_code = 'CENTRAL'/)
  assert.match(migration, /central_management_ids_input uuid\[\]/)
  assert.match(migration, /management\.unit_code = 'CENTRAL'[\s\S]*management\.active = true/)
  assert.match(migration, /delete from public\.planning_guideline_central_managements/)
  assert.match(migration, /notify pgrst, 'reload schema'/)
})
