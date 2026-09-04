import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const migrationUrl = new URL('../supabase/migrations/20260904153000_complete_matrix_realtime_publication.sql', import.meta.url)

test('publishes every collaborative matrix relation idempotently', async () => {
  const sql = await readFile(migrationUrl, 'utf8')

  for (const table of ['matrix_rows', 'matrix_row_subpoints', 'matrix_row_responsibles', 'matrix_row_edit_locks']) {
    assert.match(sql, new RegExp(`'${table}'`))
  }
  assert.match(sql, /pg_publication_tables/i)
  assert.match(sql, /alter publication supabase_realtime add table/i)
})

test('keeps complete old row data available for update and delete convergence', async () => {
  const sql = await readFile(migrationUrl, 'utf8')

  for (const table of ['matrix_rows', 'matrix_row_subpoints', 'matrix_row_responsibles', 'matrix_row_edit_locks']) {
    assert.match(sql, new RegExp(`alter table public\\.${table} replica identity full`, 'i'))
  }
})

