import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { formatMilestoneDate, milestoneDateInputValue } from '../src/matrix-milestone-date.js'

const central = await readFile(new URL('../src/CentralExcelWorkspace.tsx', import.meta.url), 'utf8')
const unit = await readFile(new URL('../src/UnitExcelWorkspace.tsx', import.meta.url), 'utf8')
const enhancer = await readFile(new URL('../src/MatrixMilestoneDateEnhancer.tsx', import.meta.url), 'utf8')
const v13 = await readFile(new URL('../src/MatrixWorkspaceV13.tsx', import.meta.url), 'utf8')

test('formatea fechas de milestones como DD/MM/AAAA y conserva texto legado', () => {
  assert.equal(formatMilestoneDate('2026-09-16'), '16/09/2026')
  assert.equal(formatMilestoneDate('16/09/2026'), '16/09/2026')
  assert.equal(formatMilestoneDate('Entrega al comité'), 'Entrega al comité')
  assert.equal(formatMilestoneDate(''), '—')
})

test('normaliza al calendario fechas ISO o DD/MM/AAAA sin inventar fechas para texto legado', () => {
  assert.equal(milestoneDateInputValue('2026-09-16'), '2026-09-16')
  assert.equal(milestoneDateInputValue('16/09/2026'), '2026-09-16')
  assert.equal(milestoneDateInputValue('31/02/2026'), '')
  assert.equal(milestoneDateInputValue('Hito histórico'), '')
})

test('CENTRAL, HU, VS, DEP y HOT comparten un único enhancer de calendario', () => {
  assert.match(v13, /MatrixMilestoneDateEnhancer/)
  assert.match(v13, /<MatrixMilestoneDateEnhancer rootRef=\{hostRef\}/)
  assert.match(enhancer, /textarea\[aria-label="Hitos o fechas"\]/)
  assert.match(enhancer, /textarea\[aria-label\^="Hito del subpunto"\]/)
  assert.match(enhancer, /MatrixMilestoneDateField/)
})

test('el calendario actualiza el mismo textarea React para crear y editar sin cambiar el guardado existente', () => {
  assert.match(enhancer, /setNativeTextareaValue\(target\.textarea, value\)/)
  assert.match(enhancer, /dispatchEvent\(new Event\('input', \{ bubbles: true \}\)\)/)
  assert.match(central, /milestones: rowDraft\.milestones \|\| null/)
  assert.match(unit, /milestones: rowDraft\.milestones \|\| null/)
  assert.match(central, /milestones: textValue\(item\.milestones\) \|\| null/)
})

test('la integración conserva datos existentes y formatea también filas persistidas y subpuntos', () => {
  assert.match(enhancer, /formatPersistedMilestones/)
  assert.match(enhancer, /matrix-central-subpoint-row/)
  assert.match(enhancer, /formatMilestoneDate\(raw\)/)
  assert.match(central, /milestones: row\.milestones \|\| ''/)
  assert.match(unit, /milestones: row\.milestones \|\| ''/)
})

test('pantalla completa reutiliza el mismo grid donde vive el enhancer', () => {
  assert.match(central, /expanded \? 'matrix-v5--expanded' : ''/)
  assert.match(unit, /expanded \? 'matrix-v5--expanded' : ''/)
  assert.match(v13, /matrix-v12-theme-host/)
})
