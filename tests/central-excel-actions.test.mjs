import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const modelUrl = new URL('../src/central-excel-model.js', import.meta.url)

async function loadModel() {
  return import(modelUrl.href)
}

test('Central filters responsible managers by the selected area mapping', async () => {
  const { filterManagersForArea } = await loadModel()
  const managers = [
    { id: 'm1', name: 'Ana' },
    { id: 'm2', name: 'Bruno' },
    { id: 'm3', name: 'Carla' },
  ]
  const mappings = [
    { manager_id: 'm1', management_id: 'adm' },
    { manager_id: 'm2', management_id: 'audit' },
    { manager_id: 'm3', management_id: 'adm' },
  ]
  assert.deepEqual(filterManagersForArea(managers, mappings, 'adm').map(item => item.id), ['m1', 'm3'])
  assert.deepEqual(filterManagersForArea(managers, mappings, 'audit').map(item => item.id), ['m2'])
})

test('Central supports selecting several responsible managers on one action', async () => {
  const { toggleResponsibleId } = await loadModel()
  assert.deepEqual(toggleResponsibleId([], 'm1'), ['m1'])
  assert.deepEqual(toggleResponsibleId(['m1'], 'm2'), ['m1', 'm2'])
  assert.deepEqual(toggleResponsibleId(['m1', 'm2'], 'm1'), ['m2'])
})

test('Central keeps the action spreadsheet and renders persisted subpoints as real rows', async () => {
  const source = await readFile(new URL('../src/CentralExcelWorkspace.tsx', import.meta.url), 'utf8')
  const v11 = await readFile(new URL('../src/MatrixWorkspaceV11.tsx', import.meta.url), 'utf8')
  assert.match(source, /manager_managements/)
  assert.match(source, /matrix_row_responsibles/)
  assert.match(source, /centralResponsibleIdsByRow/)
  assert.match(source, /<th>Acción<\/th>/)
  assert.match(source, /matrix-v10-central-excel-row/)
  assert.match(source, /matrix_row_subpoints/)
  assert.match(source, /centralSubpointsByRow/)
  assert.match(source, /centralSubpointDrafts/)
  assert.match(source, /matrix-central-subpoint-row/)
  assert.match(source, /Añadir subobjetivo/)
  assert.match(v11, /CentralExcelWorkspace/)
  assert.match(v11, /props\.unitCode === 'CENTRAL'/)
})

test('Central spreadsheet edits rows in-place instead of rendering a detached form below the grid', async () => {
  const source = await readFile(new URL('../src/CentralExcelWorkspace.tsx', import.meta.url), 'utf8')
  assert.match(source, /matrix-central-in-grid-draft/)
  assert.match(source, /matrix-central-sheet-cell/)
  assert.match(source, /matrix-central-objective-editor-row/)
  assert.match(source, /data-matrix-row-id=\{row\.id\}/)
  assert.doesNotMatch(source, /rowFormOpen && !editingRowId && renderEditRows\('new-central-action'\)/)
})

test('Central spreadsheet keeps native keyboard flow and realtime refresh without replacing the local draft', async () => {
  const source = await readFile(new URL('../src/CentralExcelWorkspace.tsx', import.meta.url), 'utf8')
  assert.match(source, /\(event\.ctrlKey \|\| event\.metaKey\) && event\.key === 'Enter'/)
  assert.match(source, /loadRows\(selectedMatrixId, true\)/)
  assert.match(source, /keepEditor/)
})

test('Central Excel layout keeps the table header visible and spreadsheet cells compact', async () => {
  const css = await readFile(new URL('../src/central-excel-workspace.css', import.meta.url), 'utf8')
  const v11Css = await readFile(new URL('../src/matrix-workspace-v11.css', import.meta.url), 'utf8')
  assert.match(css, /\.matrix-v10-central-excel[^{]*\{[^}]*border-collapse:separate/)
  assert.match(css, /\.matrix-v10-central-excel thead th[^{]*\{[^}]*position:sticky/)
  assert.match(css, /\.matrix-v10-central-excel-row[^{]*\{[^}]*cursor:cell/)
  assert.match(css, /\.matrix-central-sheet-cell[^{]*\{[^}]*padding:0/)
  assert.match(css, /\.matrix-central-sheet-cell[^}]*:focus-within/)
  assert.doesNotMatch(v11Css, /matrix-v5--central \.matrix-v5-sheet thead th:first-child[^}]*display:none/s)
  assert.doesNotMatch(v11Css, /matrix-v5--central \.matrix-v5-sheet th:nth-child\(2\)/)
})
