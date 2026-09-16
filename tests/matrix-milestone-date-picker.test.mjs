import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const central = await readFile(new URL('../src/CentralExcelWorkspace.tsx', import.meta.url), 'utf8')
const unit = await readFile(new URL('../src/UnitExcelWorkspace.tsx', import.meta.url), 'utf8')

test('CENTRAL y unidades comparten el selector calendario para Hitos / Fechas', () => {
  assert.match(central, /MatrixMilestoneDateField/)
  assert.match(unit, /MatrixMilestoneDateField/)
  assert.match(central, /formatMilestoneDate\(row\.milestones\)/)
  assert.match(unit, /formatMilestoneDate\(row\.milestones\)/)
})

test('el editor reemplaza texto libre por calendario también en subpuntos de CENTRAL', () => {
  assert.match(central, /<MatrixMilestoneDateField[\s\S]*?value=\{rowDraft\.milestones \|\| ''\}/)
  assert.match(central, /<MatrixMilestoneDateField[\s\S]*?value=\{subpoint\.milestones\}/)
  assert.match(unit, /<MatrixMilestoneDateField[\s\S]*?value=\{rowDraft\.milestones \|\| ''\}/)
  assert.doesNotMatch(central, /<textarea[^>]*value=\{rowDraft\.milestones/)
  assert.doesNotMatch(central, /<textarea[^>]*value=\{subpoint\.milestones/)
  assert.doesNotMatch(unit, /<textarea[^>]*value=\{rowDraft\.milestones/)
})

test('crear y editar conserva el valor milestones existente si no se selecciona otra fecha', () => {
  assert.match(central, /milestones: rowDraft\.milestones \|\| null/)
  assert.match(unit, /milestones: rowDraft\.milestones \|\| null/)
  assert.match(central, /milestones: textValue\(item\.milestones\) \|\| null/)
})

test('el mismo grid con calendario se mantiene al activar pantalla completa', () => {
  assert.match(central, /expanded \? 'matrix-v5--expanded' : ''/)
  assert.match(unit, /expanded \? 'matrix-v5--expanded' : ''/)
  assert.ok((central.match(/MatrixMilestoneDateField/g) || []).length >= 3)
  assert.ok((unit.match(/MatrixMilestoneDateField/g) || []).length >= 2)
})
