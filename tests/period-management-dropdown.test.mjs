import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const periodCatalog = await readFile(new URL('../src/PeriodCatalog.tsx', import.meta.url), 'utf8')
const dashboard = await readFile(new URL('../src/Dashboard.tsx', import.meta.url), 'utf8')
const periodCss = await readFile(new URL('../src/period-catalog.css', import.meta.url), 'utf8')
const interactionCss = await readFile(new URL('../src/interaction-fixes.css', import.meta.url), 'utf8')

test('Configuración permite eliminar periodos no actuales con confirmación', () => {
  assert.match(periodCatalog, /async function deletePeriod\(/)
  assert.match(periodCatalog, /\.from\('planning_periods'\)\.delete\(\)\.eq\('id',/)
  assert.match(periodCatalog, /¿Eliminar periodo/)
  assert.match(periodCatalog, /Eliminar/)
})

test('el periodo Actual no se puede eliminar', () => {
  assert.match(periodCatalog, /item\.status === 'OPEN'/)
  assert.match(periodCatalog, /disabled=\{item\.status === 'OPEN'/)
})

test('la tarjeta de periodo usa un botón completo y un dropdown personalizado', () => {
  assert.doesNotMatch(dashboard, /period-select-control[\s\S]{0,240}<select/)
  assert.match(dashboard, /periodDropdownOpen/)
  assert.match(dashboard, /className="period-select-trigger"/)
  assert.match(dashboard, /className="period-select-menu"/)
  assert.match(dashboard, /period-select-option/)
  assert.match(dashboard, /period-select-badge/)
})

test('el dropdown tiene estados visuales, hover, borde redondeado y sombra', () => {
  assert.match(interactionCss, /\.period-select-menu\{[^}]*border-radius:[^;}]+;[^}]*box-shadow:/)
  assert.match(interactionCss, /\.period-select-option:hover\{/)
  assert.match(interactionCss, /\.period-select-option\.active\{/)
  assert.match(interactionCss, /\.period-select-badge/)
  assert.match(periodCss, /\.period-delete-button/)
})
