import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const modelUrl = new URL('../src/unit-excel-model.js', import.meta.url)

async function loadModel() {
  return import(modelUrl.href)
}

test('HU DEP VS HOT offer every active manager whose cargo is gerente, without area filtering', async () => {
  const { filterGerenteManagers } = await loadModel()
  const managers = [
    { id: 'g1', name: 'Ana', cargo: 'Gerente de Finanzas', active: true },
    { id: 'g2', name: 'Bruno', cargo: 'GERENTE GENERAL', active: true },
    { id: 'j1', name: 'Carla', cargo: 'Jefe de Operaciones', active: true },
    { id: 'sg1', name: 'Diego', cargo: 'Subgerente de Negocios', active: true },
    { id: 'g3', name: 'Eva', cargo: 'Gerente', active: false },
  ]

  assert.deepEqual(filterGerenteManagers(managers).map(item => item.id), ['g1', 'g2'])
})

test('HU DEP VS HOT support several responsible managers per action row', async () => {
  const { toggleResponsibleId } = await loadModel()
  assert.deepEqual(toggleResponsibleId([], 'g1'), ['g1'])
  assert.deepEqual(toggleResponsibleId(['g1'], 'g2'), ['g1', 'g2'])
  assert.deepEqual(toggleResponsibleId(['g1', 'g2'], 'g1'), ['g2'])
})

test('non-Central units use the Excel workspace while Central stays on its existing workspace', async () => {
  const source = await readFile(new URL('../src/MatrixWorkspaceV11.tsx', import.meta.url), 'utf8')
  assert.match(source, /UnitExcelWorkspace/)
  assert.match(source, /props\.unitCode === 'CENTRAL'/)
  assert.match(source, /CentralExcelWorkspace/)
  assert.doesNotMatch(source, /MatrixWorkspaceV10/)
})

test('unit Excel workspace preserves spreadsheet toolbar, direct row editing and multi-responsible persistence', async () => {
  const source = await readFile(new URL('../src/UnitExcelWorkspace.tsx', import.meta.url), 'utf8')
  const css = await readFile(new URL('../src/unit-excel-workspace.css', import.meta.url), 'utf8')
  for (const label of ['Áreas', 'Expandir', 'Historial', 'Importar Excel', 'Exportar Excel', 'Nueva fila']) {
    assert.match(source, new RegExp(label))
  }
  for (const header of ['Objetivo', 'Acción', 'Responsable', 'Prioridad', 'Hitos / Fechas', 'KPI', 'Inicio', 'Fin', 'Riesgos', 'Restricciones', 'Soporte', 'Entregable', 'Comité']) {
    assert.match(source, new RegExp(header))
  }
  assert.match(source, /matrix_row_responsibles/)
  assert.match(source, /selectedResponsibleIds/)
  assert.match(source, /data-matrix-row-id=\{row\.id\}/)
  assert.match(source, /matrix-central-sheet-cell/)
  assert.match(css, /matrix-v10-unit-excel/)
  assert.doesNotMatch(source, /manager_managements/)
  assert.doesNotMatch(source, /filterManagersForArea/)
})

test('unit Excel workspace keeps collaboration refresh and the existing Central implementation is not rewritten', async () => {
  const unitSource = await readFile(new URL('../src/UnitExcelWorkspace.tsx', import.meta.url), 'utf8')
  const centralSource = await readFile(new URL('../src/CentralExcelWorkspace.tsx', import.meta.url), 'utf8')
  assert.match(unitSource, /matrix-realtime-data-change/)
  assert.match(unitSource, /loadRows\(selectedMatrixId, true\)/)
  assert.match(centralSource, /export default function CentralExcelWorkspace/)
  assert.match(centralSource, /manager_managements/)
})

test('matrix reloads ignore stale responses and unit imports remove partial rows', async () => {
  const unitSource = await readFile(new URL('../src/UnitExcelWorkspace.tsx', import.meta.url), 'utf8')
  const centralSource = await readFile(new URL('../src/CentralExcelWorkspace.tsx', import.meta.url), 'utf8')

  for (const source of [unitSource, centralSource]) {
    assert.match(source, /loadRowsRequestRef/)
    assert.match(source, /requestId !== loadRowsRequestRef\.current/)
  }

  assert.match(unitSource, /createdRowIds/)
  assert.match(unitSource, /delete\(\)\.in\('id', createdRowIds\)/)
  assert.doesNotMatch(centralSource, /Importar Excel/)
})

test('the latest matrix reload always releases the loading spinner, including Realtime refreshes', async () => {
  const unitSource = await readFile(new URL('../src/UnitExcelWorkspace.tsx', import.meta.url), 'utf8')
  const centralSource = await readFile(new URL('../src/CentralExcelWorkspace.tsx', import.meta.url), 'utf8')

  for (const source of [unitSource, centralSource]) {
    assert.match(source, /loadRows\(selectedMatrixId, true\)/)
    assert.match(source, /requestId !== loadRowsRequestRef\.current/)
    assert.doesNotMatch(source, /if \(!keepEditor\) setRowsLoading\(false\)/)
    assert.match(source, /setRowsLoading\(false\)/)
  }
})

test('editing an existing row has a compensating rollback when relation persistence fails', async () => {
  const unitSource = await readFile(new URL('../src/UnitExcelWorkspace.tsx', import.meta.url), 'utf8')
  const centralSource = await readFile(new URL('../src/CentralExcelWorkspace.tsx', import.meta.url), 'utf8')

  for (const source of [unitSource, centralSource]) {
    assert.match(source, /previousRow/)
    assert.match(source, /rollbackParentRow/)
    assert.match(source, /restoreResponsibles/)
    assert.match(source, /No se conservaron cambios parciales/)
  }
  assert.match(centralSource, /restoreSubpoints/)
})
