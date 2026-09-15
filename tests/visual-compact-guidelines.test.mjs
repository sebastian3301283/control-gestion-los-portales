import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const planning = await readFile(new URL('../src/PlanningGuidelines.tsx', import.meta.url), 'utf8')
const planningCss = await readFile(new URL('../src/planning-guidelines.css', import.meta.url), 'utf8')
const responsibleCss = await readFile(new URL('../src/guideline-responsible-configuration.css', import.meta.url), 'utf8')

test('la cabecera separa Ir a matriz de las acciones secundarias', () => {
  assert.match(planning, /planning-guideline-primary-actions/)
  assert.match(planning, /planning-guideline-secondary-actions/)
  const primaryIndex = planning.indexOf('planning-guideline-primary-actions')
  const matrixIndex = planning.indexOf('planning-guideline-matrix-button', primaryIndex)
  const secondaryIndex = planning.indexOf('planning-guideline-secondary-actions', matrixIndex)
  const fullscreenIndex = planning.indexOf('planning-guideline-fullscreen-button', secondaryIndex)
  assert.ok(primaryIndex >= 0, 'falta el grupo principal')
  assert.ok(matrixIndex > primaryIndex, 'Ir a matriz debe estar en el grupo principal')
  assert.ok(secondaryIndex > matrixIndex, 'las utilidades deben ir después del CTA principal')
  assert.ok(fullscreenIndex > secondaryIndex, 'Pantalla completa debe estar en el grupo secundario')
})

test('las acciones de lineamientos usan una composición compacta y jerárquica', () => {
  assert.match(planningCss, /\.planning-guidelines-heading-actions\{[^}]*align-items:center/)
  assert.match(planningCss, /\.planning-guideline-primary-actions\{[^}]*display:flex/)
  assert.match(planningCss, /\.planning-guideline-secondary-actions\{[^}]*display:flex/)
  assert.match(planningCss, /\.planning-guideline-secondary-actions\{[^}]*padding:[^}]*border:/)
})

test('la configuración de gerentes responsables usa filas y controles compactos', () => {
  assert.match(responsibleCss, /\.guideline-responsible-config-row\{[^}]*padding:10px/)
  assert.match(responsibleCss, /\.guideline-responsible-config-list\{[^}]*gap:7px/)
  assert.match(responsibleCss, /\.guideline-responsible-config-entry input\{[^}]*height:34px/)
  assert.match(responsibleCss, /\.guideline-responsible-config-entry button\{[^}]*min-height:34px/)
  assert.match(responsibleCss, /\.guideline-responsible-config-guideline p\{[^}]*line-height:1\.35/)
})
