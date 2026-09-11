import test from 'node:test'
import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'

async function loadReloadMigration() {
  const names = await readdir(new URL('../supabase/migrations/', import.meta.url))
  const name = names.find(item => item.endsWith('_reload_postgrest_schema_after_guideline_rpc.sql'))
  if (!name) return ''
  return readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8')
}

test('la migración fuerza a PostgREST a recargar el schema después de publicar save_planning_guideline_multi', async () => {
  const sql = await loadReloadMigration()
  assert.match(sql, /pg_notify\(\s*'pgrst'\s*,\s*'reload schema'\s*\)/i)
})
