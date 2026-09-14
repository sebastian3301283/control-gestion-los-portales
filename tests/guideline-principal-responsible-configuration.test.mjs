import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'

const config = await readFile(new URL('../src/CatalogConfiguration.tsx', import.meta.url), 'utf8')
const leadership = await readFile(new URL('../src/UnitPlanLeadershipHeader.tsx', import.meta.url), 'utf8')
const leadershipCss = await readFile(new URL('../src/unit-plan-leadership-header.css', import.meta.url), 'utf8')

async function findResponsibleMigration() {
  const directory = new URL('../supabase/migrations/', import.meta.url)
  const files = (await readdir(directory)).filter(name => name.endsWith('.sql')).sort().reverse()
  for (const name of files) {
    const sql = await readFile(new URL(name, directory), 'utf8')
    if (sql.includes('planning_guideline_principal_responsible_labels')) return { name, sql }
  }
  return null
}

test('Configuración administra Gerentes Responsables manuales por lineamiento', async () => {
  assert.match(config, /GuidelineResponsibleConfiguration/)
  const source = await readFile(new URL('../src/GuidelineResponsibleConfiguration.tsx', import.meta.url), 'utf8')
  assert.match(source, /planning_guidelines/)
  assert.match(source, /planning_guideline_principal_responsible_labels/)
  assert.match(source, /Gerentes responsables por lineamiento/)
  assert.match(source, /selectedPeriodId/)
  assert.match(source, /selectedUnitCode/)
  assert.match(source, /Agregar responsable/)
  assert.match(source, /delete\(\)\.eq\('guideline_id'/)
})

test('Plan de Acción muestra Gerente Responsable como solo lectura por guideline_id', () => {
  assert.match(leadership, /from\('matrices'\)\.select\('guideline_id'\)/)
  assert.match(leadership, /planning_guideline_principal_responsible_labels/)
  assert.doesNotMatch(leadership, /Agregar responsable/)
  assert.doesNotMatch(leadership, />Editar</)
  assert.doesNotMatch(leadership, /editingResponsibles/)
  assert.match(leadership, /matrix-unit-principal-readonly/)
  assert.match(leadershipCss, /\.matrix-unit-principal-readonly\{[^}]*justify-content:center/)
})

test('la migración conserva responsables existentes y los mueve de matrix a guideline', async () => {
  const migration = await findResponsibleMigration()
  assert.ok(migration, 'Debe existir una migración para responsables principales por lineamiento')
  assert.match(migration.sql, /guideline_id uuid not null references public\.planning_guidelines\(id\) on delete cascade/)
  assert.match(migration.sql, /matrix_principal_responsible_labels/)
  assert.match(migration.sql, /matrix\.guideline_id/)
  assert.match(migration.sql, /enable row level security/)
  assert.match(migration.sql, /public\.is_global_planning_manager\(\)/)
})
