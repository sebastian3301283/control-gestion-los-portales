import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'

const dashboard = await readFile(new URL('../src/Dashboard.tsx', import.meta.url), 'utf8')
const planningGuidelines = await readFile(new URL('../src/PlanningGuidelines.tsx', import.meta.url), 'utf8')
const central = await readFile(new URL('../src/CentralExcelWorkspace.tsx', import.meta.url), 'utf8')
const css = await readFile(new URL('../src/central-excel-workspace.css', import.meta.url), 'utf8')
const migrationNames = await readdir(new URL('../supabase/migrations/', import.meta.url))
const principalMigrationName = migrationNames.find(name => name.includes('central_matrix_principal_responsible')) || ''
const principalMigration = principalMigrationName
  ? await readFile(new URL(`../supabase/migrations/${principalMigrationName}`, import.meta.url), 'utf8')
  : ''
const model = await import('../src/central-matrix-view-model.js').catch(() => null)

test('panel general elimina Todo listo y Central entra a matriz solo desde Lineamientos', () => {
  assert.doesNotMatch(dashboard, /Todo listo/)
  assert.match(dashboard, /selectedPlanningUnit\.code !== 'CENTRAL'/)
  assert.match(dashboard, /onOpenMatrixForArea/)
  assert.match(planningGuidelines, /onOpenMatrixForArea/)
  assert.doesNotMatch(planningGuidelines, /planning-module-choice--matrices/)
})

test('Responsable principal persiste en la matriz y solo ofrece máximos cargos del área', () => {
  assert.ok(model, 'debe existir central-matrix-view-model.js')
  const managers = [
    { id: 'g1', name: 'Gerente A', cargo: 'GERENTE DE ADMINISTRACION' },
    { id: 'g2', name: 'Gerente B', cargo: 'GERENTE DE LOGISTICA' },
    { id: 'j1', name: 'Jefe', cargo: 'JEFE DE ADMINISTRACION' },
    { id: 's1', name: 'Subgerente', cargo: 'SUB GERENTE DE ADMINISTRACION' },
  ]
  assert.deepEqual(model.filterHighestAreaManagers(managers).map(item => item.id).sort(), ['g1', 'g2'])
  assert.match(central, /principal_responsible_manager_id/)
  assert.match(central, /matrix-central-principal-responsible/)
  assert.match(central, /savePrincipalResponsible/)
  assert.ok(principalMigrationName, 'debe existir migración para Responsable principal')
  assert.match(principalMigration, /principal_responsible_manager_id/i)
  assert.match(principalMigration, /references public\.managers\s*\(id\)/i)
})

test('edición Central usa Subobjetivo y zoom flotante abajo a la derecha', () => {
  assert.match(central, /Añadir subobjetivo/)
  assert.doesNotMatch(central, /Añadir subpunto/)
  assert.match(central, /matrix-central-zoom-dock/)
  assert.match(css, /\.matrix-central-zoom-dock/)
  assert.match(css, /position:fixed/)
  assert.match(css, /bottom:/)
  assert.match(css, /right:/)
})

test('lineamientos funcionan como barras plegables que cargan sus objetivos', () => {
  assert.match(central, /expandedGuidelineKeys/)
  assert.match(central, /matrix-central-guideline-bar/)
  assert.match(central, /toggleGuidelineGroup/)
  assert.match(central, /objetivo(?:s)?/i)
  assert.match(css, /\.matrix-central-guideline-bar/)
})

test('historial se agrupa por persona y expande sus cambios al hacer clic', () => {
  assert.ok(model, 'debe existir central-matrix-view-model.js')
  const versions = [
    { id: '3', action: 'ROW_UPDATE', changed_email: 'a@x.com', created_at: '2026-09-04T12:00:00Z' },
    { id: '2', action: 'SUBPOINT_INSERT', changed_email: 'a@x.com', created_at: '2026-09-04T11:00:00Z' },
    { id: '1', action: 'ROW_INSERT', changed_email: 'b@x.com', created_at: '2026-09-04T10:00:00Z' },
  ]
  const groups = model.groupHistoryByPerson(versions, { 'a@x.com': 'Ana Pérez', 'b@x.com': 'Bruno Ruiz' })
  assert.equal(groups.length, 2)
  assert.equal(groups[0].name, 'Ana Pérez')
  assert.equal(groups[0].versions.length, 2)
  assert.match(model.historyActionLabel('SUBPOINT_INSERT'), /Subobjetivo agregado/)
  assert.match(central, /matrix-central-history-person/)
  assert.match(central, /expandedHistoryActors/)
})
