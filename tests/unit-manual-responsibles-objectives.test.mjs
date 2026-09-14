import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const unit = await readFile(new URL('../src/UnitExcelWorkspace.tsx', import.meta.url), 'utf8')
const leadership = await readFile(new URL('../src/UnitPlanLeadershipHeader.tsx', import.meta.url), 'utf8')

test('HU VS DEP HOT usan responsables manuales multiples por accion', () => {
  assert.match(unit, /responsibleLabels/)
  assert.match(unit, /responsibleDraft/)
  assert.match(unit, /Agregar responsable/)
  assert.match(unit, /responsible_text:\s*responsibleLabels\.length/)
  assert.doesNotMatch(unit, /renderResponsiblePicker\(\)/)
  assert.doesNotMatch(unit, /filterGerenteManagers/)
})

test('objetivos no Central se pueden contraer y expandir', () => {
  assert.match(unit, /collapsedObjectives/)
  assert.match(unit, /toggleObjective/)
  assert.match(unit, /aria-expanded=/)
  assert.match(unit, /matrix-unit-objective-toggle/)
})

test('nueva accion se renderiza al final del objetivo seleccionado', () => {
  assert.match(unit, /isDraftForGroup/)
  assert.match(unit, /group\.rows\.map/)
  assert.match(unit, /isDraftForGroup && rowFormOpen && !editingRowId/)
})

test('Gerente Responsable tiene modo lectura y modo edicion con Listo', () => {
  assert.match(leadership, /editingResponsibles/)
  assert.match(leadership, />Listo</)
  assert.match(leadership, /responsibleLabels\.length \? 'Editar' : 'Agregar responsables'/)
  assert.match(leadership, /Agregar responsables/)
})
