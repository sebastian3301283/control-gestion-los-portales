import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const source = fs.readFileSync(new URL('../src/CentralExcelWorkspace.tsx', import.meta.url), 'utf8')

test('Central creates actions inside the selected guideline instead of a global editor row', () => {
  assert.match(source, /function startNewRowForGuideline\(/)
  assert.match(source, /Añadir acción/)
  assert.doesNotMatch(source, />\s*Nueva fila\s*</)
  assert.doesNotMatch(source, /rowFormOpen && !editingRowId && <Fragment key="new-central-action"/)
})

test('Central does not create Subpunto 1 until the user explicitly adds a subobjective', () => {
  assert.match(source, /useState<CentralSubpointDraft\[]>\(\[\]\)/)
  assert.match(source, /setCentralSubpointDrafts\(\[\]\)/)
  assert.match(source, /Añadir subobjetivo/)
})

test('Central row edit actions live outside the area summary and below the main toolbar', () => {
  assert.match(source, /matrix-central-commandbar-context/)
  assert.doesNotMatch(source, /matrix-central-summary-edit-actions/)
  assert.match(source, /Responsable principal/)
  assert.match(source, /Guardar/)
  assert.match(source, /Cancelar/)
})
