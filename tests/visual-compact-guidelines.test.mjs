import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const planning = await readFile(new URL('../src/PlanningGuidelines.tsx', import.meta.url), 'utf8')
const planningCss = await readFile(new URL('../src/planning-guidelines.css', import.meta.url), 'utf8')
const responsibleCss = await readFile(new URL('../src/guideline-responsible-configuration.css', import.meta.url), 'utf8')
const catalog = await readFile(new URL('../src/GuidelineCatalogV2.tsx', import.meta.url), 'utf8')
const catalogCss = await readFile(new URL('../src/guideline-catalog-v2.css', import.meta.url), 'utf8')
const unitOverrides = await readFile(new URL('../src/guideline-unit-layout-overrides.css', import.meta.url), 'utf8')

test('Ir a matriz mantiene prioridad antes de las utilidades de la cabecera', () => {
  const actionsIndex = planning.indexOf('planning-guidelines-heading-actions')
  const matrixIndex = planning.indexOf('planning-guideline-matrix-button', actionsIndex)
  const fullscreenIndex = planning.indexOf('planning-guideline-fullscreen-button', actionsIndex)
  assert.ok(actionsIndex >= 0, 'falta la zona de acciones')
  assert.ok(matrixIndex > actionsIndex, 'Ir a matriz debe permanecer en la zona de acciones')
  assert.ok(fullscreenIndex > matrixIndex, 'Pantalla completa debe aparecer después del CTA de matriz')
})

test('las acciones de lineamientos usan una jerarquía visual compacta', () => {
  assert.match(planningCss, /\.planning-guidelines-heading-actions\{[^}]*padding:6px[^}]*border:1px solid #dbe5ed[^}]*border-radius:13px/)
  assert.match(planningCss, /\.planning-guideline-matrix-button\{[^}]*min-height:38px[^}]*font-size:11px[^}]*box-shadow:/)
  assert.match(planningCss, /\.planning-guideline-fullscreen-button\{[^}]*min-height:36px[^}]*font-size:11px/)
  assert.match(planningCss, /\.planning-guideline-import-button\{[^}]*min-height:36px[^}]*font-size:11px/)
})

test('la configuración de gerentes responsables usa filas y controles compactos', () => {
  assert.match(responsibleCss, /\.guideline-responsible-config-row\{[^}]*padding:10px/)
  assert.match(responsibleCss, /\.guideline-responsible-config-list\{[^}]*gap:7px/)
  assert.match(responsibleCss, /\.guideline-responsible-config-entry input\{[^}]*height:34px/)
  assert.match(responsibleCss, /\.guideline-responsible-config-entry button\{[^}]*min-height:34px/)
  assert.match(responsibleCss, /\.guideline-responsible-config-guideline p\{[^}]*line-height:1\.35/)
})

test('HU, VS, DEP y HOT muestran las tres acciones alineadas en una sola fila', () => {
  assert.match(catalog, /className="guideline-actions"[\s\S]*guideline-row-matrix-arrow[\s\S]*title="Editar"[\s\S]*className="danger"/)
  assert.match(catalogCss, /\.guideline-actions\{[^}]*display:flex[^}]*align-items:center[^}]*flex-wrap:nowrap/)
  assert.match(catalogCss, /\.guideline-actions \.guideline-row-matrix-arrow\{[^}]*height:34px[^}]*min-width:108px/)
  assert.match(catalogCss, /\.guideline-actions>button:not\(\.guideline-row-matrix-arrow\)\{[^}]*width:34px[^}]*height:34px/)
  assert.match(catalogCss, /\.guideline-v2-table th:nth-child\(6\)\{width:210px/)
  assert.match(unitOverrides, /\.guideline-v2-table--hot th:nth-child\(6\)\{width:210px!important\}/)
  assert.match(unitOverrides, /\.guideline-v2-table--dep th:nth-child\(6\)\{width:210px!important\}/)
})
