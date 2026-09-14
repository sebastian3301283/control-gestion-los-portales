import test from 'node:test'
import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'

const migrationsDir = new URL('../supabase/migrations/', import.meta.url)
const realtimeLayerUrl = new URL('../src/MatrixRealtimeLayer.tsx', import.meta.url)

async function phase3Sql() {
  const names = await readdir(migrationsDir)
  const name = names.find(item => item.endsWith('_phase3_security_realtime_history.sql'))
  assert.ok(name, 'Falta la migración incremental phase3_security_realtime_history')
  return (await readFile(new URL(name, migrationsDir), 'utf8')).toLowerCase()
}

test('phase 3 aligns non-central subpoint RLS with guideline-owned matrix access', async () => {
  const sql = await phase3Sql()
  for (const policy of [
    'matrix_row_subpoints_select_area',
    'matrix_row_subpoints_insert_area',
    'matrix_row_subpoints_update_area',
    'matrix_row_subpoints_delete_area',
  ]) assert.match(sql, new RegExp(policy))

  assert.match(sql, /can_access_guideline_multi\(m\.guideline_id\)/)
  assert.match(sql, /can_edit_guideline_multi\(m\.guideline_id\)/)
  assert.match(sql, /m\.unit_code\s*<>\s*'central'/)
  assert.match(sql, /m\.guideline_id\s+is\s+not\s+null/)
})

test('phase 3 locks use the same non-central guideline authorization as matrix editing', async () => {
  const sql = await phase3Sql()
  assert.match(sql, /create or replace function public\.try_lock_matrix_row\(row_id_input uuid\)/)
  assert.match(sql, /can_edit_guideline_multi\(v_guideline_id\)/)
  assert.match(sql, /matrix_row_edit_locks_read/)
  assert.match(sql, /can_access_guideline_multi\(m\.guideline_id\)/)

  for (const fn of ['heartbeat_matrix_row_lock', 'release_matrix_row_lock']) {
    assert.doesNotMatch(sql, new RegExp(`create or replace function public\\.${fn}`), `${fn} no debe ampliarse en Fase 3`)
  }
})

test('phase 3 history snapshots and restores row responsibles', async () => {
  const sql = await phase3Sql()
  assert.match(sql, /responsibles_json jsonb/)
  assert.match(sql, /from public\.matrix_row_responsibles/)
  assert.match(sql, /'responsibles'\s*,\s*responsibles_json/)
  assert.match(sql, /\^\(row_\|subpoint_\|responsible_\)/)
  assert.match(sql, /matrix_row_responsibles_version_trigger/)
  assert.match(sql, /'responsible_'\s*\|\|\s*tg_op/)
  assert.match(sql, /v_responsibles\s*:=\s*coalesce\(v_version\.snapshot->'responsibles'/)
  assert.match(sql, /insert into public\.matrix_row_responsibles/)
  assert.match(sql, /'responsibles_restored'/)
})

test('phase 3 publishes matrices and the active realtime layer refreshes metadata in the existing channel', async () => {
  const sql = await phase3Sql()
  const source = await readFile(realtimeLayerUrl, 'utf8')

  assert.match(sql, /alter publication supabase_realtime add table public\.matrices/)
  assert.match(sql, /pg_publication_tables/)
  assert.match(source, /table:\s*'matrices'/)
  assert.match(source, /requestRefresh\('matrices',\s*payload\.eventType\)/)
  assert.equal((source.match(/supabase\.channel\(`matrix-collab:\$\{matrixId\}`/g) || []).length, 1)
  assert.match(source, /supabase\.realtime\.setAuth\(\)/)
  assert.match(source, /supabase\.removeChannel\(channel\)/)
})

test('phase 3 keeps intentional pre-auth allowlist semantics and does not broaden Storage', async () => {
  const sql = await phase3Sql()
  const hardening = (await readFile(new URL('20260910141718_harden_authorization_rls_and_indexes.sql', migrationsDir), 'utf8')).toLowerCase()
  const deny = (await readFile(new URL('20260910142150_explicitly_deny_authorized_users_direct_access.sql', migrationsDir), 'utf8')).toLowerCase()

  assert.match(hardening, /grant execute on function public\.is_email_authorized\(text\) to anon, authenticated/)
  assert.match(deny, /authorized_users_no_direct_access/)
  assert.match(deny, /using \(false\)/)
  assert.doesNotMatch(sql, /storage\.objects/)
  assert.doesNotMatch(sql, /planning_ppts_(insert|update|delete|select)/)
})
