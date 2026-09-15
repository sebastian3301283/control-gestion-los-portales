import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

async function text(path) {
  try { return await readFile(new URL(path, import.meta.url), 'utf8') } catch { return '' }
}

const exporter = await text('../src/lib/styled-plan-export.ts')
const unitMatrix = await text('../src/UnitExcelWorkspace.tsx')
const centralMatrix = await text('../src/CentralExcelWorkspace.tsx')

test('el exportador compartido usa xlsx-js-style solo al exportar', () => {
  assert.match(exporter, /xlsx-js-style@1\.2\.0\/\+esm/)
  assert.match(exporter, /@vite-ignore/)
  assert.match(exporter, /export async function exportStyledPlanWorkbook/)
})

test('el Excel aplica título, merges, estilos, filtros y congelado', () => {
  assert.match(exporter, /!merges/)
  assert.match(exporter, /\.s\s*=/)
  assert.match(exporter, /fill:/)
  assert.match(exporter, /font:/)
  assert.match(exporter, /alignment:/)
  assert.match(exporter, /border:/)
  assert.match(exporter, /!autofilter/)
  assert.match(exporter, /!freeze/)
  assert.match(exporter, /PLAN DE ACCIÓN/)
})

test('Unit y Central reutilizan el exportador estilizado', () => {
  assert.match(unitMatrix, /exportStyledPlanWorkbook/)
  assert.match(centralMatrix, /exportStyledPlanWorkbook/)
})
