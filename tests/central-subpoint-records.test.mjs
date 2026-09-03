import test from 'node:test'
import assert from 'node:assert/strict'
import { actionPlanFromSubpoints, buildCentralSubpointDrafts, normalizeCentralSubpointRows } from '../src/central-subpoint-records.js'

test('usa los registros detalle existentes con sus hitos, KPI y fechas', () => {
  const drafts = buildCentralSubpointDrafts([
    { id: 's1', text: 'Validar alcance', milestones: 'Kickoff', kpi: '100%', start_date: '2026-09-01', end_date: '2026-09-05', sort_order: 0 },
    { id: 's2', text: 'Cerrar entrega', milestones: 'Cierre', kpi: '1 acta', start_date: '2026-09-06', end_date: '2026-09-10', sort_order: 1 },
  ], {})

  assert.equal(drafts.length, 2)
  assert.deepEqual(drafts[1], {
    id: 's2',
    text: 'Cerrar entrega',
    milestones: 'Cierre',
    kpi: '1 acta',
    start_date: '2026-09-06',
    end_date: '2026-09-10',
  })
})

test('convierte action_plan legado en subpuntos y conserva el detalle general en el primero', () => {
  const drafts = buildCentralSubpointDrafts([], {
    action_plan: '- Primer subpunto\n• Segundo subpunto',
    milestones: 'Hito legado',
    kpi: 'KPI legado',
    start_date: '2026-09-01',
    end_date: '2026-09-30',
  })

  assert.deepEqual(drafts, [
    { id: null, text: 'Primer subpunto', milestones: 'Hito legado', kpi: 'KPI legado', start_date: '2026-09-01', end_date: '2026-09-30' },
    { id: null, text: 'Segundo subpunto', milestones: '', kpi: '', start_date: '', end_date: '' },
  ])
})

test('normaliza filas parciales y conserva cualquier dato ingresado aunque falte el texto del subpunto', () => {
  const rows = normalizeCentralSubpointRows([
    { id: null, text: '  Uno  ', milestones: ' H1 ', kpi: ' K1 ', start_date: '2026-09-01', end_date: '' },
    { id: null, text: '   ', milestones: 'Hito parcial', kpi: '', start_date: '', end_date: '' },
    { id: null, text: 'Dos', milestones: '', kpi: '', start_date: '', end_date: '2026-09-10' },
    { id: null, text: '', milestones: '', kpi: '', start_date: '', end_date: '' },
  ])

  assert.deepEqual(rows, [
    { text: 'Uno', milestones: 'H1', kpi: 'K1', start_date: '2026-09-01', end_date: null, sort_order: 0 },
    { text: '', milestones: 'Hito parcial', kpi: null, start_date: null, end_date: null, sort_order: 1 },
    { text: 'Dos', milestones: null, kpi: null, start_date: null, end_date: '2026-09-10', sort_order: 2 },
  ])
  assert.equal(actionPlanFromSubpoints(rows), 'Uno\nDos')
})

test('recupera una fila parcial guardada aunque el texto del subpunto esté vacío', () => {
  const drafts = buildCentralSubpointDrafts([
    { id: 's1', text: '', milestones: 'Kickoff pendiente', kpi: '', start_date: '', end_date: '', sort_order: 0 },
  ], {})

  assert.equal(drafts.length, 1)
  assert.equal(drafts[0].milestones, 'Kickoff pendiente')
  assert.equal(drafts[0].text, '')
})
