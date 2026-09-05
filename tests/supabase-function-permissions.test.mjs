import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const migrationUrl = new URL('../supabase/migrations/20260904152048_harden_function_execution_permissions.sql', import.meta.url)

test('pre-auth keeps only the email authorization RPC explicitly available to anon', async () => {
  const sql = (await readFile(migrationUrl, 'utf8')).toLowerCase()
  assert.match(sql, /revoke execute on function public\.is_email_authorized\(text\) from public, anon, authenticated/)
  assert.match(sql, /grant execute on function public\.is_email_authorized\(text\) to anon, authenticated, service_role/)
  for (const signature of [
    'current_access()',
    'can_edit_management(uuid, text)',
    'try_lock_matrix_row(uuid)',
    'heartbeat_matrix_row_lock(uuid)',
    'release_matrix_row_lock(uuid)',
    'save_directory_manager(uuid, text, text, text, text, boolean, uuid[])',
    'set_permission_user_role(uuid, text)',
  ]) {
    const escaped = signature.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    assert.match(sql, new RegExp(`revoke execute on function public\\.${escaped} from public, anon`))
  }
})

test('internal trigger helpers are not directly executable by browser roles', async () => {
  const sql = (await readFile(migrationUrl, 'utf8')).toLowerCase()
  for (const functionName of [
    'handle_new_auth_user',
    'matrix_metadata_version_trigger',
    'matrix_rows_version_trigger',
    'matrix_row_subpoints_version_trigger',
    'prepare_matrices_for_area_activation',
    'prepare_matrices_for_new_period',
    'sync_authorized_user_to_profile',
    'sync_guideline_responsible_relations',
    'sync_user_unit_from_area_permissions',
    'validate_guideline_responsibles',
    'validate_management_unit_change',
    'validate_manager_management_unit',
    'validate_manager_unit_change',
    'validate_matrix_process_scope',
    'validate_process_catalog_scope',
    'rls_auto_enable',
  ]) {
    assert.match(sql, new RegExp(`revoke execute on function public\\.${functionName}\\(\\) from public, anon, authenticated`))
  }
  assert.match(sql, /revoke execute on function public\.ensure_default_matrix_for_area\(uuid, text, uuid\) from public, anon, authenticated/)
})

test('timestamp trigger helpers pin their search path', async () => {
  const sql = (await readFile(migrationUrl, 'utf8')).toLowerCase()
  assert.match(sql, /alter function public\.touch_updated_at\(\) set search_path = public/)
  assert.match(sql, /alter function public\.touch_planning_guideline_updated_at\(\) set search_path = public/)
})
