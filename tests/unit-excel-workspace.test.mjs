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
    { id: 'm1', name: 'Ana', cargo: 'Gerente de Finanzas', active: true },
    { id: 'm2', name: 'Bruno', cargo: 'JEFE DE OPERACIONES', active: true },
    { id: 'm3', name: 'Carla', cargo: 'Gerente General', active: true },
    { id: 'm4', name: 'Diego', cargo: 'Subgerente Comercial', active: true },
    { id: 'm5', name: 'Elena', cargo: 'Gerente Legal', active: false },
  ]
  assert.deepEqual(filterGerenteManagers(managers).map(item => item.id), ['m1', 'm3'])
})

test('HU DEP VS HOT support several responsible managers per action row', async () => {
  const { toggleResponsibleId } = await loadModel()
  assert.deepEqual(toggleResponsibleId([], 'm1'), ['m1'])
  assert.deepEqual(toggleResponsibleId(['m1'], 'm3'), ['m1', 'm3'])
  assert.deepEqual(toggleResponsibleId(['m1', 'm3'], 'm1'), ['m3'])
})

test('non-Central units use the Excel workspace while Central stays on its existing workspace', async () => {
  const source = await readFile(new URL('../src/MatrixWorkspaceV11.tsx', import.meta.url), 'utf8')
  assert.match(source, /import UnitExcelWorkspace from '\.\/UnitExcelWorkspace'/)
  assert.match(source, /props\.unitCode === 'CENTRAL'\s*\?\s*<CentralExcelWorkspace/)
  assert.match(source, /:\s*<UnitExcelWorkspace/)
})

test('unit Excel workspace preserves spreadsheet toolbar, direct row editing and multi-responsible persistence', async () => {
  const source = await readFile(new URL('../src/UnitExcelWorkspace.tsx', import.meta.url), 'utf8')
  for (const label of ['Expandir matriz', 'Historial', 'Importar Excel', 'Exportar Excel', 'Nueva fila']) {
    assert.match(source, new RegExp(label))
  }
  for (const header of ['Objetivo', 'Acción', 'Responsable', 'Prioridad', 'Hitos / Fechas', 'KPI', 'Inicio', 'Fin', 'Riesgos', 'Restricciones', 'Soporte', 'Entregable', 'Comité']) {
    assert.match(source, new RegExp(`<th>${header.replace('/', '\\/')}<\\/th>`))
  }
  assert.match(source, /matrix_row_responsibles/)
  assert.match(source, /selectedResponsibleIds/)
  assert.match(source, /data-matrix-row-id=\{row\.id\}/)
  assert.match(source, /matrix-central-sheet-cell/)
  assert.doesNotMatch(source, /manager_managements|filterManagersForArea/)
})

test('unit Excel workspace keeps collaboration refresh and the existing Central implementation is not rewritten', async () => {
  const unitSource = await readFile(new URL('../src/UnitExcelWorkspace.tsx', import.meta.url), 'utf8')
  const centralSource = await readFile(new URL('../src/CentralExcelWorkspace.tsx', import.meta.url), 'utf8')
  assert.match(unitSource, /matrix-realtime-data-change/)
  assert.match(unitSource, /loadRows\(selectedMatrixId, true\)/)
  assert.match(centralSource, /export default function CentralExcelWorkspace/)
  assert.match(centralSource, /manager_managements/)
})

test('matrix reloads ignore stale responses and failed imports remove partial rows', async () => {
  const unitSource = await readFile(new URL('../src/UnitExcelWorkspace.tsx', import.meta.url), 'utf8')
  const centralSource = await readFile(new URL('../src/CentralExcelWorkspace.tsx', import.meta.url), 'utf8')

  for (const source of [unitSource, centralSource]) {
    assert.match(source, /loadRowsRequestRef/)
    assert.match(source, /requestId !== loadRowsRequestRef\.current/)
    assert.match(source, /createdRowIds/)
    assert.match(source, /delete\(\)\.in\('id', createdRowIds\)/)
  }
})
