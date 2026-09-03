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

test('crea filas desde los registros reales de matrix_row_subpoints', () => {
  const rows = buildCentralTableRows({
    objective: 'Optimizar la operación',
    subpointRecords: [
      { text: 'Automatizar alertas', milestones: 'Piloto', kpi: '10 alertas', start_date: '2026-09-01', end_date: '2026-09-10' },
      { text: 'Medir resultados', milestones: 'Informe', kpi: '95% cobertura', start_date: '2026-09-11', end_date: '2026-09-30' },
    ],
  })

  assert.equal(rows.length, 2)
  assert.deepEqual(rows[0], {
    index: 0,
    label: 'S1',
    objective: 'Optimizar la operación',
    subpoint: 'Automatizar alertas',
    milestones: 'Piloto',
    kpi: '10 alertas',
    startDate: '2026-09-01',
    endDate: '2026-09-10',
  })
  assert.equal(rows[1].subpoint, 'Medir resultados')
  assert.equal(rows[1].kpi, '95% cobertura')
})
