import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const centralSource = await readFile(new URL('../src/CentralExcelWorkspace.tsx', import.meta.url), 'utf8')

test('Central filters responsible managers by the selected area mapping', () => {
  assert.match(centralSource, /managerManagements\.filter\(item => item\.management_id === selectedAreaId\)\.map\(item => item\.manager_id\)/)
  assert.match(centralSource, /managers\.filter\(manager => allowed\.has\(manager\.id\)\)/)
})

test('Central supports selecting several responsible managers on one action', () => {
  assert.match(centralSource, /setSelectedResponsibleIds\(current => current\.includes\(managerId\) \? current\.filter\(id => id !== managerId\) : \[\.\.\.current, managerId\]\)/)
  assert.match(centralSource, /selectedResponsibleIds\.map\(\(managerId, index\) => \(\{ row_id: rowId, manager_id: managerId, sort_order: index \}\)\)/)
})

test('Central keeps the action spreadsheet and renders persisted subpoints as real rows', async () => {
  const source = centralSource
  const cache = await readFile(new URL('../src/lib/planning-query-cache.ts', import.meta.url), 'utf8')
  const v11 = await readFile(new URL('../src/MatrixWorkspaceV11.tsx', import.meta.url), 'utf8')
  assert.match(source, /loadCentralMatrixWorkspaceData\(periodId\)/)
  assert.match(cache, /manager_managements/)
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

test('Central spreadsheet edits rows in-place instead of rendering a detached form below the grid', () => {
  const source = centralSource
  assert.match(source, /matrix-central-in-grid-draft/)
  assert.match(source, /matrix-central-sheet-cell/)
  assert.doesNotMatch(source, /matrix-central-objective-editor-row/)
  assert.match(source, /data-matrix-row-id=\{row\.id\}/)
  assert.doesNotMatch(source, /rowFormOpen && !editingRowId && renderEditRows\('new-central-action'\)/)
})

test('Central spreadsheet keeps native keyboard flow and realtime refresh without replacing the local draft', () => {
  const source = centralSource
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