import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const central = fs.readFileSync(new URL('../src/CentralExcelWorkspace.tsx', import.meta.url), 'utf8')
const guidelines = fs.readFileSync(new URL('../src/CentralGuidelineWorkspace.tsx', import.meta.url), 'utf8')

test('Central renders a newly added action after the existing actions of the active guideline', () => {
  const persistedRows = "{groupOpen && group.rows.map(row => <Fragment key={row.id}>{editingRowId === row.id ? renderSpreadsheetDraftRows(`edit-${row.id}`) : renderPersistedRow(row)}</Fragment>)}"
  const newDraft = "{rowFormOpen && !editingRowId && selectedRowGuidelineId === group.key && <Fragment key={`new-${group.key}`}>{renderSpreadsheetDraftRows(`new-${group.key}`)}</Fragment>}"
  const persistedIndex = central.indexOf(persistedRows)
  const draftIndex = central.indexOf(newDraft)

  assert.notEqual(persistedIndex, -1)
  assert.notEqual(draftIndex, -1)
  assert.ok(persistedIndex < draftIndex, 'la fila nueva debe renderizarse después de las acciones guardadas del lineamiento')
})

test('Central keeps the guideline fixed while editing and does not render a guideline selector inside the matrix', () => {
  assert.doesNotMatch(central, /function renderObjectiveGroupEditor\(/)
  assert.doesNotMatch(central, /matrix-central-objective-editor-row/)
  assert.doesNotMatch(central, /<strong>LINEAMIENTO<\/strong><select/)
  assert.match(central, /guideline_id: selectedRowGuidelineId \|\| rowDraft\.guideline_id \|\| null/)
})

test('Central guidelines open without a default area unless an explicit contextual area was provided', () => {
  assert.match(guidelines, /useState\(initialAreaId \|\| ''\)/)
  assert.match(guidelines, /if \(initialAreaId\) setSelectedAreaId\(initialAreaId\)/)
  assert.doesNotMatch(guidelines, /if \(!selectedAreaId && areas\.length\) setSelectedAreaId\(areas\[0\]\.id\)/)
  assert.match(guidelines, /<option value="">Selecciona un área<\/option>/)
})
