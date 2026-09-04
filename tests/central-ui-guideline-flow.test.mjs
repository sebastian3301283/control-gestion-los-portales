// Contrato de regresión para la experiencia Central acordada y validada visualmente.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'

const central = await readFile(new URL('../src/CentralExcelWorkspace.tsx', import.meta.url), 'utf8')
const v11 = await readFile(new URL('../src/MatrixWorkspaceV11.tsx', import.meta.url), 'utf8')
const dashboard = await readFile(new URL('../src/Dashboard.tsx', import.meta.url), 'utf8')
const planningGuidelines = await readFile(new URL('../src/PlanningGuidelines.tsx', import.meta.url), 'utf8')
const centralGuidelines = await readFile(new URL('../src/CentralGuidelineWorkspace.tsx', import.meta.url), 'utf8')

const migrationNames = await readdir(new URL('../supabase/migrations/', import.meta.url))
const guidelineLinkMigrationName = migrationNames.find(name => name.includes('central_matrix_row_guideline_link')) || ''
const guidelineLinkMigration = guidelineLinkMigrationName
  ? await readFile(new URL(`../supabase/migrations/${guidelineLinkMigrationName}`, import.meta.url), 'utf8')
  : ''

test('Central simplifica la toolbar y ubica las acciones de edición fuera del resumen', () => {
  assert.match(central, /Expandir matriz/)
  assert.match(central, /Historial/)
  assert.match(central, /Exportar Excel/)
  assert.match(central, /Añadir acción/)
  assert.doesNotMatch(central, />\s*Nueva fila\s*</)
  assert.doesNotMatch(central, /<ArrowLeft size=\{16\}\/> Áreas/)
  assert.doesNotMatch(central, /Importar Excel/)
  assert.doesNotMatch(central, /<th>Acciones<\/th>/)
  assert.match(central, /matrix-central-top-actions/)
  assert.doesNotMatch(central, /matrix-central-summary-edit-actions/)
  for (const label of ['Añadir subobjetivo', 'Guardar', 'Cancelar', 'Eliminar acción']) assert.match(central, new RegExp(label))
})

test('Central usa Lineamiento desde planning_guidelines y deja de crear objetivos desde la matriz', () => {
  assert.match(central, /<strong>LINEAMIENTO<\/strong>/)
  assert.match(central, /areaGuidelines\.map/)
  assert.match(central, /planning_guidelines/)
  assert.match(central, /guideline_id/)
  assert.doesNotMatch(central, /Crear nuevo objetivo/)
  assert.doesNotMatch(central, /Usar existente/)
  assert.ok(guidelineLinkMigrationName, 'debe existir una migración que relacione matrix_rows con planning_guidelines')
  assert.match(guidelineLinkMigration, /add column if not exists guideline_id/i)
  assert.match(guidelineLinkMigration, /references public\.planning_guidelines\s*\(id\)/i)
})

test('el selector de responsables tiene cierre visible, Escape y cierre al pulsar fuera', () => {
  assert.match(central, /responsiblePickerOpen/)
  assert.match(central, /matrix-central-responsible-close/)
  assert.match(central, /event\.key === 'Escape'/)
  assert.match(central, /pointerdown|mousedown/)
})

test('Ver lineamientos transporta área y lineamiento hasta CentralGuidelineWorkspace', () => {
  assert.match(v11, /guidelineContext/)
  assert.match(v11, /onViewGuidelines\?\.\(guidelineContext\)/)
  assert.match(dashboard, /cg:guideline-target/)
  assert.match(dashboard, /managementId/)
  assert.match(dashboard, /guidelineId/)
  assert.match(planningGuidelines, /initialAreaId/)
  assert.match(planningGuidelines, /focusGuidelineId/)
  assert.match(centralGuidelines, /initialAreaId/)
  assert.match(centralGuidelines, /focusGuidelineId/)
  assert.match(centralGuidelines, /central-guideline-row--focused/)
})

test('cambiar de fila durante una edición ofrece guardar, descartar o seguir editando', () => {
  for (const label of ['Guardar y cambiar', 'Descartar y cambiar', 'Seguir editando']) assert.match(v11, new RegExp(label))
  assert.match(v11, /pendingRowSwitch/)
})
