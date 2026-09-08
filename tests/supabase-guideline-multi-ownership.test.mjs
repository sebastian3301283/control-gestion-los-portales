import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const migrationUrl = new URL('../supabase/migrations/20260908223000_planning_guideline_multi_ownership.sql', import.meta.url)

async function migrationText() {
  try {
    return await readFile(migrationUrl, 'utf8')
  } catch {
    return ''
  }
}

test('la migración crea relaciones múltiples de gerencias y responsables con backfill', async () => {
  const sql = await migrationText()
  assert.match(sql, /create table if not exists public\.planning_guideline_managements/i)
  assert.match(sql, /primary key \(guideline_id, management_id\)/i)
  assert.match(sql, /create table if not exists public\.planning_guideline_responsibles/i)
  assert.match(sql, /primary key \(guideline_id, manager_id\)/i)
  assert.match(sql, /insert into public\.planning_guideline_managements[\s\S]*select[\s\S]*from public\.planning_guidelines/i)
  assert.match(sql, /insert into public\.planning_guideline_responsibles[\s\S]*responsible_manager_id is not null/i)
})

test('la migración agrega guardado transaccional y acceso por cualquier gerencia relacionada', async () => {
  const sql = await migrationText()
  assert.match(sql, /function public\.save_planning_guideline_multi/i)
  assert.match(sql, /is_global_planning_manager\(\)/i)
  assert.match(sql, /matrix_unit_area_catalog/i)
  assert.match(sql, /manager_managements/i)
  assert.match(sql, /function public\.can_access_guideline_multi/i)
  assert.match(sql, /function public\.can_edit_guideline_multi/i)
  assert.match(sql, /planning_guideline_managements/i)
})

test('las nuevas tablas tienen RLS y la migración amplía matrices, filas e historial sin romper Central', async () => {
  const sql = await migrationText()
  assert.match(sql, /enable row level security/i)
  assert.match(sql, /planning_guideline_managements_select/i)
  assert.match(sql, /planning_guideline_responsibles_select/i)
  assert.match(sql, /drop policy if exists matrices_select_area/i)
  assert.match(sql, /drop policy if exists matrix_rows_select_area/i)
  assert.match(sql, /drop policy if exists matrix_versions_select_access/i)
  assert.match(sql, /m\.unit_code <> 'CENTRAL'/i)
  assert.match(sql, /can_access_guideline_multi\(m\.guideline_id\)/i)
  assert.match(sql, /can_edit_guideline_multi\(m\.guideline_id\)/i)
})
