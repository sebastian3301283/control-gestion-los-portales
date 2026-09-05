import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const source = fs.readFileSync(new URL('../src/CentralExcelWorkspace.tsx', import.meta.url), 'utf8')
const css = fs.readFileSync(new URL('../src/central-excel-workspace.css', import.meta.url), 'utf8')

test('Central compact table replaces KPI and dates with one action-level Entregable column', () => {
  assert.match(source, /const tableColSpan = 9/)
  assert.match(source, /<th>Acción<\/th><th>Responsable<\/th><th>Prioridad<\/th><th>Hitos \/ Fechas<\/th><th>Entregable<\/th><th>Riesgos de no ejecutar<\/th><th>Restricciones<\/th><th>Soporte<\/th><th>Comité<\/th>/)
  assert.doesNotMatch(source, /<th>KPI \(Cuantitativo\)<\/th>/)
  assert.doesNotMatch(source, /<th>Inicio<\/th>/)
  assert.doesNotMatch(source, /<th>Fin<\/th>/)
  assert.match(source, /rowSpan=\{sharedRowSpan\}>\{row\.deliverables \|\| '—'\}<\/td>/)
})

test('Central subobjectives only edit their text and milestone in the compact view', () => {
  const start = source.indexOf('centralSubpointDrafts.map')
  const end = source.indexOf('function startNewRowForActiveGuideline', start)
  const block = source.slice(start, end)
  assert.match(block, /subpoint\.milestones/)
  assert.doesNotMatch(block, /subpoint\.kpi/)
  assert.doesNotMatch(block, /subpoint\.start_date/)
  assert.doesNotMatch(block, /subpoint\.end_date/)
})

test('Central uses a compact command bar instead of stacked action rows', () => {
  assert.match(source, /matrix-central-commandbar/)
  assert.match(source, /matrix-central-commandbar-primary/)
  assert.match(source, /matrix-central-commandbar-context/)
  assert.match(css, /\.matrix-central-commandbar\{/)
  assert.match(css, /\.matrix-central-commandbar-primary(?:,|\{)/)
  assert.match(css, /\.matrix-central-commandbar-context\{/)
})
