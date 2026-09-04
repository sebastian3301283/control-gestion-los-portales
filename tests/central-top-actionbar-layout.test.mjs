import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const central = await readFile(new URL('../src/CentralExcelWorkspace.tsx', import.meta.url), 'utf8')
const css = await readFile(new URL('../src/central-excel-workspace.css', import.meta.url), 'utf8')

test('Central coloca las acciones fuera del resumen y debajo de la toolbar', () => {
  const toolbarIndex = central.indexOf('matrix-v5-toolbar')
  const actionsIndex = central.indexOf('matrix-central-top-actions')
  const summaryIndex = central.indexOf('matrix-v5-summary')
  assert.ok(toolbarIndex >= 0 && actionsIndex > toolbarIndex && summaryIndex > actionsIndex)

  const summarySlice = central.slice(summaryIndex, central.indexOf('matrix-v5-sheet-card', summaryIndex))
  for (const label of ['Añadir subobjetivo', 'Guardar', 'Cancelar']) {
    assert.doesNotMatch(summarySlice, new RegExp(label))
  }
  assert.match(css, /\.matrix-central-top-actions/)
})

test('Añadir acción vive arriba, aparece primero y conserva el contexto del lineamiento seleccionado', () => {
  const actionsStart = central.indexOf('matrix-central-top-actions')
  const actionsEnd = central.indexOf('</div>', actionsStart)
  const actionBar = central.slice(actionsStart, actionsEnd)
  const addActionIndex = actionBar.indexOf('Añadir acción')
  const addSubobjectiveIndex = actionBar.indexOf('Añadir subobjetivo')
  assert.ok(addActionIndex >= 0)
  assert.ok(addSubobjectiveIndex < 0 || addActionIndex < addSubobjectiveIndex)
  assert.match(central, /activeGuidelineId/)
  assert.match(central, /startNewRowForGuideline\(activeGuideline\.id, activeGuideline\.guideline_text\)/)
  assert.doesNotMatch(central, /matrix-central-guideline-add-action/)
})
