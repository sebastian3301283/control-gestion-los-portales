import test from 'node:test'
import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'

const migrationsDir = new URL('../supabase/migrations/', import.meta.url)
const permissionCatalogUrl = new URL('../src/PermissionCatalogV4.tsx', import.meta.url)
const permissionCssUrl = new URL('../src/permission-catalog-v4.css', import.meta.url)

async function permissionMigration() {
  const names = await readdir(migrationsDir)
  const name = names.find(item => item.endsWith('_guideline_matrix_permissions.sql'))
  assert.ok(name, 'Falta la migración incremental guideline_matrix_permissions')
  return (await readFile(new URL(name, migrationsDir), 'utf8')).toLowerCase()
}

test('non-central permissions are stored by exact guideline with access/edit invariant', async () => {
  const sql = await permissionMigration()
  assert.match(sql, /create table (if not exists )?public\.guideline_user_permissions/)
  assert.match(sql, /authorized_user_id uuid not null references public\.authorized_users\(id\)/)
  assert.match(sql, /guideline_id uuid not null references public\.planning_guidelines\(id\)/)
  assert.match(sql, /unique\s*\(authorized_user_id,\s*guideline_id\)/)
  assert.match(sql, /check\s*\(\s*not can_edit\s+or\s+can_view\s*\)/)
  assert.match(sql, /alter table public\.guideline_user_permissions enable row level security/)
})

test('guideline helpers keep CENTRAL by area and use exact guideline permissions for HU VS DEP HOT', async () => {
  const sql = await permissionMigration()
  assert.match(sql, /create or replace function public\.can_access_guideline_multi\(guideline_id_input uuid\)/)
  assert.match(sql, /create or replace function public\.can_edit_guideline_multi\(guideline_id_input uuid\)/)
  assert.match(sql, /when g\.unit_code = 'central' then public\.can_access_management\(g\.management_id, g\.unit_code\)/)
  assert.match(sql, /when g\.unit_code = 'central' then public\.can_edit_management\(g\.management_id, g\.unit_code\)/)
  assert.match(sql, /from public\.guideline_user_permissions/)
  assert.match(sql, /gup\.guideline_id = g\.id/)
  assert.match(sql, /gup\.can_view = true/)
  assert.match(sql, /gup\.can_edit = true/)
  assert.match(sql, /create or replace function public\.can_access_unit\(unit_code_input text\)/)
  assert.match(sql, /join public\.planning_guidelines g on g\.id = gup\.guideline_id/)
})

test('matrix RLS does not retain area/process fallback for non-central units', async () => {
  const sql = await permissionMigration()
  assert.match(sql, /create policy matrices_select_area[\s\S]*?unit_code = 'central'[\s\S]*?can_access_management[\s\S]*?unit_code <> 'central'[\s\S]*?can_access_guideline_multi\(guideline_id\)/)
  assert.match(sql, /create policy matrices_update_area[\s\S]*?unit_code = 'central'[\s\S]*?can_edit_management[\s\S]*?unit_code <> 'central'[\s\S]*?can_edit_guideline_multi\(guideline_id\)/)
  assert.match(sql, /create policy matrix_rows_select_area[\s\S]*?m\.unit_code = 'central'[\s\S]*?can_access_management[\s\S]*?m\.unit_code <> 'central'[\s\S]*?can_access_guideline_multi\(m\.guideline_id\)/)
  assert.match(sql, /create policy matrix_rows_update_area[\s\S]*?m\.unit_code = 'central'[\s\S]*?can_edit_management[\s\S]*?m\.unit_code <> 'central'[\s\S]*?can_edit_guideline_multi\(m\.guideline_id\)/)
})

test('subpoints responsibles locks history and process metadata inherit exact non-central guideline authorization', async () => {
  const sql = await permissionMigration()
  for (const policy of [
    'matrix_row_subpoints_select_area',
    'matrix_row_subpoints_update_area',
    'matrix_row_responsibles_select_area',
    'matrix_row_responsibles_update_area',
    'matrix_row_edit_locks_read',
    'matrix_versions_select_access',
  ]) assert.match(sql, new RegExp(`create policy ${policy}[\\s\\S]*?can_(?:access|edit)_guideline_multi`))

  assert.match(sql, /create or replace function public\.try_lock_matrix_row\(row_id_input uuid\)/)
  assert.match(sql, /v_unit_code = 'central'[\s\S]*?can_edit_management\(v_management_id, v_unit_code\)/)
  assert.match(sql, /v_unit_code <> 'central'[\s\S]*?can_edit_guideline_multi\(v_guideline_id\)/)
  assert.match(sql, /create or replace function public\.can_access_noncentral_process\(process_id_input uuid\)[\s\S]*?can_access_guideline_multi\(m\.guideline_id\)/)
  assert.match(sql, /create policy processes_select_area[\s\S]*?unit_code = 'central'[\s\S]*?can_access_management[\s\S]*?unit_code <> 'central'[\s\S]*?can_access_noncentral_process\(id\)/)
})

test('permission editor keeps CENTRAL area UI separate and renders closed non-central guideline accordions', async () => {
  const source = await readFile(permissionCatalogUrl, 'utf8')
  assert.match(source, /guideline_user_permissions/)
  assert.match(source, /planning_guidelines/)
  assert.match(source, /editorUnit === 'CENTRAL'/)
  assert.match(source, /permission-v4-guideline-accordion/)
  assert.match(source, /<details[^>]*className="permission-v4-guideline-accordion"/)
  assert.doesNotMatch(source, /<details[^>]*className="permission-v4-guideline-accordion"[^>]*\sopen(?:=|\s|>)/)
  assert.match(source, />Acceso a matriz</)
  assert.match(source, />Edición de matriz</)
})

test('non-central toggles are compact and edit can be enabled directly to imply access', async () => {
  const source = await readFile(permissionCatalogUrl, 'utf8')
  const css = await readFile(permissionCssUrl, 'utf8')
  assert.match(source, /updateGuidelinePermission/)
  assert.match(source, /can_view:\s*true/)
  assert.match(source, /can_edit:/)
  assert.match(source, /from\('guideline_user_permissions'\)\.delete\(\)/)
  const controlsStart = source.indexOf('permission-v4-guideline-controls')
  const controlsEnd = source.indexOf('</details>', controlsStart)
  assert.ok(controlsStart >= 0 && controlsEnd > controlsStart, 'No se encontró el bloque de controles por lineamiento')
  const controls = source.slice(controlsStart, controlsEnd)
  assert.doesNotMatch(controls, /disabled=\{!view\s*\|\|/, 'Edición debe poder activarse aunque Acceso esté apagado')
  assert.match(css, /\.permission-v4-guideline-accordion/)
  assert.match(css, /\.permission-v4-guideline-controls/)
  assert.match(css, /\.permission-v4-guideline-control/)
})
