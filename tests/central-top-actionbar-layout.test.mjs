import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const central = await readFile(new URL('../src/CentralExcelWorkspace.tsx', import.meta.url), 'utf8')
const css = await readFile(new URL('../src/central-excel-workspace.css', import.meta.url), 'utf8')

test('Central integra los controles en una barra compacta fuera del resumen', () => {
  const headIndex = central.indexOf('matrix-central-page-head')
  const actionsIndex = central.indexOf('matrix-central-commandbar')
  const summaryIndex = central.indexOf('matrix-v5-summary')
  assert.ok(headIndex >= 0 && actionsIndex >= headIndex && summaryIndex > actionsIndex)

  const summarySlice = central.slice(summaryIndex, central.indexOf('matrix-v5-sheet-card', summaryIndex))
  for (const label of ['Añadir subobjetivo', 'Guardar', 'Cancelar']) {
    assert.doesNotMatch(summarySlice, new RegExp(label))
  }
  assert.match(css, /\.matrix-central-commandbar/)
})

test('Añadir acción permanece en la barra principal y conserva el lineamiento seleccionado', () => {
  const primaryStart = central.indexOf('matrix-central-commandbar-primary')
  const primaryEnd = central.indexOf('</div>', primaryStart)
  const primaryBar = central.slice(primaryStart, primaryEnd)
  assert.ok(primaryStart >= 0)
  assert.match(primaryBar, /Añadir acción/)
  assert.doesNotMatch(primaryBar, /Añadir subobjetivo/)

  const contextStart = central.indexOf('matrix-central-commandbar-context')
  const contextEnd = central.indexOf('</div>', contextStart)
  const contextBar = central.slice(contextStart, contextEnd)
  assert.match(contextBar, /Añadir subobjetivo/)
  assert.match(contextBar, /Guardar/)
  assert.match(contextBar, /Cancelar/)

  assert.match(central, /activeGuidelineId/)
  assert.match(central, /startNewRowForGuideline\(activeGuideline\.id, activeGuideline\.guideline_text\)/)
  assert.doesNotMatch(central, /matrix-central-guideline-add-action/)
})
