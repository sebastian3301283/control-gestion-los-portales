import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const migrationUrl = new URL('../supabase/migrations/20260907195000_noncentral_guideline_matrix_one_to_one.sql', import.meta.url)

test('non-Central guidelines own exactly one matrix and clean obsolete test data', async () => {
  const sql = await readFile(migrationUrl, 'utf8')

  assert.match(sql, /delete\s+from\s+public\.matrices[\s\S]+unit_code\s+in\s*\(\s*'HU'\s*,\s*'DEP'\s*,\s*'VS'\s*,\s*'HOT'\s*\)/i)
  assert.match(sql, /delete\s+from\s+public\.planning_guidelines[\s\S]+unit_code\s+in\s*\(\s*'HU'\s*,\s*'DEP'\s*,\s*'VS'\s*,\s*'HOT'\s*\)/i)
  assert.match(sql, /create\s+unique\s+index[\s\S]+matrices_noncentral_guideline_uidx[\s\S]+guideline_id[\s\S]+unit_code\s+in\s*\(\s*'HU'\s*,\s*'DEP'\s*,\s*'VS'\s*,\s*'HOT'\s*\)/i)
  assert.doesNotMatch(sql, /delete\s+from\s+public\.planning_guidelines[\s\S]+unit_code\s*=\s*'CENTRAL'/i)
})

test('non-Central guideline matrix trigger creates updates and deletes the exact guideline matrix', async () => {
  const sql = await readFile(migrationUrl, 'utf8')

  assert.match(sql, /create\s+or\s+replace\s+function\s+public\.sync_noncentral_guideline_matrix\s*\(\s*\)/i)
  assert.match(sql, /security\s+definer[\s\S]+set\s+search_path\s*=\s*public\s*,\s*pg_temp/i)
  assert.match(sql, /from\s+public\.processes[\s\S]+management_id\s*=\s*new\.management_id[\s\S]+unit_code\s*=\s*new\.unit_code[\s\S]+active\s*=\s*true/i)
  assert.match(sql, /insert\s+into\s+public\.matrices[\s\S]+guideline_id[\s\S]+new\.id/i)
  assert.match(sql, /update\s+public\.matrices[\s\S]+where\s+guideline_id\s*=\s*new\.id/i)
  assert.match(sql, /delete\s+from\s+public\.matrices[\s\S]+where\s+guideline_id\s*=\s*old\.id/i)
  assert.match(sql, /revoke\s+execute\s+on\s+function\s+public\.sync_noncentral_guideline_matrix\(\)\s+from\s+public\s*,\s*anon\s*,\s*authenticated/i)
  assert.match(sql, /create\s+trigger\s+planning_guidelines_noncentral_matrix_sync/i)
})
