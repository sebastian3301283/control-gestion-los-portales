import test from 'node:test'
import assert from 'node:assert/strict'
import { buildCentralTableRows } from '../src/central-table-rows.js'

test('crea una fila real por subpunto y conserva alineados hitos, KPI, inicio y fin', () => {
  const rows = buildCentralTableRows({
    objective: 'Mejorar la experiencia del cliente',
    subpoints: ['Implementar encuesta', 'Cerrar brechas'],
    milestones: ['Piloto', 'Despliegue'],
    kpis: ['NPS >= 70', '90% brechas cerradas'],
    startDates: ['01/09/2026', '16/09/2026'],
    endDates: ['15/09/2026', '30/09/2026'],
  })

  assert.equal(rows.length, 2)
  assert.deepEqual(rows[1], {
    index: 1,
    label: 'S2',
    objective: 'Mejorar la experiencia del cliente',
    subpoint: 'Cerrar brechas',
    milestones: 'Despliegue',
    kpi: '90% brechas cerradas',
    startDate: '16/09/2026',
    endDate: '30/09/2026',
  })
})
