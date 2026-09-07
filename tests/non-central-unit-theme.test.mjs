import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const workspace = await readFile(new URL('../src/UnitExcelWorkspace.tsx', import.meta.url), 'utf8')
const baseCss = await readFile(new URL('../src/matrix-workspace-v5.css', import.meta.url), 'utf8')
const unitCss = await readFile(new URL('../src/unit-excel-workspace.css', import.meta.url), 'utf8')

test('HU/DEP/VS/HOT conservan su token de color en la matriz no Central', () => {
  assert.match(workspace, /matrix-v5--\$\{unitAccent\[unitCode\]\}/)
  assert.match(baseCss, /\.matrix-v5--hu\{--unit:#2e9b5f/)
  assert.match(baseCss, /\.matrix-v5--dep\{--unit:#e88324/)
  assert.match(baseCss, /\.matrix-v5--vs\{--unit:#42bfe8/)
  assert.match(baseCss, /\.matrix-v5--hot\{--unit:#171717/)
})

test('la tabla y commandbar no Central usan var(--unit) en vez del azul fijo de Central', () => {
  assert.match(unitCss, /\.matrix-unit-excel thead th\{[^}]*background:var\(--unit\)/)
  assert.match(unitCss, /\.matrix-v5--sheet \.matrix-central-commandbar-primary \.matrix-central-add-action\{[^}]*background:var\(--unit\)[^}]*border-color:var\(--unit\)/)
  assert.match(unitCss, /\.matrix-v5--sheet \.matrix-central-commandbar-context button\.save\{[^}]*background:var\(--unit\)[^}]*border-color:var\(--unit\)/)
  assert.match(unitCss, /\.matrix-v5--sheet \.matrix-central-sheet-cell:focus-within\{[^}]*var\(--unit\)/)
})
