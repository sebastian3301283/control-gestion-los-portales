import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const app = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
const unitCss = fs.readFileSync(new URL('../src/unit-excel-workspace.css', import.meta.url), 'utf8')
const guidelineCss = fs.readFileSync(new URL('../src/guideline-catalog-v2.css', import.meta.url), 'utf8')

test('OTP precarga el dashboard durante la pantalla de código y muestra etapas claras con timeout', () => {
  assert.match(app, /view === 'verify'[^]*prefetchDashboardModule\(\)/)
  assert.match(app, /Verificando código\.\.\./)
  assert.match(app, /Validando permisos\.\.\./)
  assert.match(app, /Abriendo Control de Gestión\.\.\./)
  assert.match(app, /withTimeout\(/)
})

test('la matriz no Central oculta el resumen duplicado de área unidad y responsable', () => {
  assert.match(unitCss, /matrix-v5-plan-shell:has\(\.matrix-unit-plan-header\)[^}]*>\s*\.matrix-v5-summary\s*\{[^}]*display:\s*none/i)
})

test('la columna N° de lineamientos mantiene el mismo ancho y celdas rectas en header y body', () => {
  assert.match(guidelineCss, /\.guideline-v2-table th:nth-child\(1\),\.guideline-v2-table td\.guideline-number\{[^}]*width:72px[^}]*min-width:72px[^}]*max-width:72px/i)
  assert.match(guidelineCss, /\.guideline-v2-table td\.guideline-number\{[^}]*border-radius:0!important[^}]*text-align:center/i)
})
