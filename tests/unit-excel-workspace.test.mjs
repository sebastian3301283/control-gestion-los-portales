import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const modelUrl = new URL('../src/unit-excel-model.js', import.meta.url)

async function loadModel() {
  return import(modelUrl.href)
}

test('legacy gerente filtering helper remains stable for Central-compatible callers', async () => {
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

test('legacy multi-responsible helper remains stable for existing callers', async () => {
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

test('unit Excel workspace opens the matrix that belongs to the exact guideline id', async () => {
  const source = await readFile(new URL('../src/UnitExcelWorkspace.tsx', import.meta.url), 'utf8')
  assert.match(source, /guideline_id: string \| null/)
  assert.match(source, /guidelineId\?: string \| null/)
  assert.match(source, /function matrixForGuideline\(guidelineId: string\)/)
  assert.match(source, /matrices\.find\(item => item\.guideline_id === guidelineId\)/)
  assert.match(source, /matrixData\.find\(item => item\.guideline_id === target!\.guidelineId\)/)
  assert.doesNotMatch(source, /return matrices\.find\(item => processIds\.has\(item\.process_id\)\) \|\| null/)
})

test('unit Excel workspace returns guideline context through the shared V11 shortcut', async () => {
  const unitSource = await readFile(new URL('../src/UnitExcelWorkspace.tsx', import.meta.url), 'utf8')
  const v11 = await readFile(new URL('../src/MatrixWorkspaceV11.tsx', import.meta.url), 'utf8')
  assert.match(unitSource, /onGuidelineContextChange/)
  assert.match(unitSource, /guidelineId: selectedMatrix\.guideline_id/)
  assert.match(v11, /onGuidelineContextChange=\{setGuidelineContext\}/)
})

test('unit Excel workspace keeps the commandbar and uses manual multi-responsibles per action', async () => {
  const source = await readFile(new URL('../src/UnitExcelWorkspace.tsx', import.meta.url), 'utf8')
  const css = await readFile(new URL('../src/unit-excel-workspace.css', import.meta.url), 'utf8')
  for (const label of ['Expandir matriz', 'Historial', 'Exportar Excel', 'Añadir acción']) assert.match(source, new RegExp(label))
  assert.doesNotMatch(source, />Importar Excel</)
  assert.doesNotMatch(source, />Nueva fila</)
  assert.match(source, /<thead><tr><th>Acción<\/th><th>Responsable<\/th><th>Prioridad<\/th><th>Hitos \/ Fechas<\/th><th>Entregable<\/th><th>Soporte<\/th><th>Comité<\/th><th>Riesgos de no ejecutar<\/th><th>Restricciones<\/th><\/tr><\/thead>/)
  assert.match(source, /matrix_row_responsibles/)
  assert.match(source, /responsibleLabels/)
  assert.match(source, /responsible_text: responsibleLabels\.length/)
  assert.match(source, /data-matrix-row-id=\{row\.id\}/)
  assert.match(source, /matrix-central-sheet-cell/)
  assert.match(source, /kpi: rowDraft\.kpi \|\| null/)
  assert.match(source, /start_date: rowDraft\.start_date \|\| null/)
  assert.match(source, /end_date: rowDraft\.end_date \|\| null/)
  assert.match(css, /matrix-unit-excel/)
  assert.doesNotMatch(source, /manager_managements/)
  assert.doesNotMatch(source, /filterManagersForArea/)
  assert.doesNotMatch(source, /filterGerenteManagers/)
})

test('unit Excel workspace keeps collaboration refresh and Central keeps its behavior through the scoped shared loader', async () => {
  const unitSource = await readFile(new URL('../src/UnitExcelWorkspace.tsx', import.meta.url), 'utf8')
  const centralSource = await readFile(new URL('../src/CentralExcelWorkspace.tsx', import.meta.url), 'utf8')
  assert.match(unitSource, /matrix-realtime-data-change/)
  assert.match(unitSource, /loadRows\(selectedMatrixId, true\)/)
  assert.match(centralSource, /export default function CentralExcelWorkspace/)
  assert.match(centralSource, /loadCentralMatrixWorkspaceData\(periodId\)/)
  assert.doesNotMatch(centralSource, /supabase\.from\('manager_managements'\)/)
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

test('editing an existing row rolls back the parent row if legacy relation cleanup fails', async () => {
  const unitSource = await readFile(new URL('../src/UnitExcelWorkspace.tsx', import.meta.url), 'utf8')
  const centralSource = await readFile(new URL('../src/CentralExcelWorkspace.tsx', import.meta.url), 'utf8')
  assert.match(unitSource, /previousRow/)
  assert.match(unitSource, /rollbackParentRow/)
  assert.match(unitSource, /No se conservaron cambios parciales/)
  assert.match(centralSource, /previousRow/)
  assert.match(centralSource, /rollbackParentRow/)
  assert.match(centralSource, /restoreResponsibles/)
  assert.match(centralSource, /restoreSubpoints/)
})

test('manual responsible editor fits the Responsable cell and supports several free-text labels', async () => {
  const source = await readFile(new URL('../src/UnitExcelWorkspace.tsx', import.meta.url), 'utf8')
  const css = await readFile(new URL('../src/unit-excel-workspace.css', import.meta.url), 'utf8')
  assert.match(source, /matrix-unit-manual-responsible-editor/)
  assert.match(source, /Escribe un responsable/)
  assert.match(source, /Agregar responsable/)
  assert.match(source, /removeResponsibleLabel/)
  assert.match(css, /\.matrix-unit-manual-responsible-editor\{/)
  assert.match(css, /\.matrix-unit-manual-responsible-chips\{/)
  assert.doesNotMatch(source, /matrix-central-responsible-picker/)
})

test('unit objectives are grouped in Excel-style OB rows instead of repeating badges inside every action', async () => {
  const { groupRowsByObjective } = await loadModel()
  const rows = [
    { id: 'r1', objective_group: 'Fortalecer ECOM' },
    { id: 'r2', objective_group: 'Fortalecer ECOM' },
    { id: 'r3', objective_group: 'Mejorar revenue management' },
    { id: 'r4', objective_group: 'Fortalecer ECOM' },
  ]
  assert.deepEqual(groupRowsByObjective(rows).map(group => ({ objective: group.objective, ids: group.rows.map(row => row.id) })), [
    { objective: 'Fortalecer ECOM', ids: ['r1', 'r2', 'r4'] },
    { objective: 'Mejorar revenue management', ids: ['r3'] },
  ])
})

test('unit matrix renders collapsible full-width numbered objective rows', async () => {
  const source = await readFile(new URL('../src/UnitExcelWorkspace.tsx', import.meta.url), 'utf8')
  const css = await readFile(new URL('../src/unit-excel-workspace.css', import.meta.url), 'utf8')
  assert.match(source, /<span>Objetivo<\/span>/)
  assert.doesNotMatch(source, />Objetivo general</)
  assert.match(source, /objectiveGroups\.map\(\(group, groupIndex\)/)
  assert.match(source, /matrix-unit-objective-row/)
  assert.match(source, /matrix-unit-objective-toggle/)
  assert.match(source, /aria-expanded=/)
  assert.match(source, /OB\{groupIndex \+ 1\}:/)
  assert.match(css, /\.matrix-unit-objective-row td\{[^}]*background:/)
  assert.match(css, /\.matrix-unit-objective-toggle\{/)
})