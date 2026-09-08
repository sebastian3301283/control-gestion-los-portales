import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const guideline = await readFile(new URL('../src/GuidelineCatalogV2.tsx', import.meta.url), 'utf8')
const unitMatrix = await readFile(new URL('../src/UnitExcelWorkspace.tsx', import.meta.url), 'utf8')
const history = await readFile(new URL('../src/MatrixWorkspaceV12.tsx', import.meta.url), 'utf8')
const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')
const dashboard = await readFile(new URL('../src/Dashboard.tsx', import.meta.url), 'utf8')

test('lineamientos no Central cargan relaciones múltiples y áreas activadas por unidad', () => {
  assert.match(guideline, /loadGuidelineMultiRelations/)
  assert.match(guideline, /matrix_unit_area_catalog/)
  assert.match(guideline, /selectedManagementIds/)
  assert.match(guideline, /selectedResponsibleIds/)
  assert.match(guideline, /save_planning_guideline_multi/)
})

test('lineamientos no Central muestran múltiples gerencias y responsables sin cambiar Central', () => {
  assert.match(guideline, /guideline-multi-chip/)
  assert.match(guideline, /unitCode !== 'CENTRAL'/)
  assert.match(guideline, /Gerencias responsables/)
  assert.match(guideline, /Gerentes responsables · Bonistas/)
})

test('matriz no Central muestra encabezado de plan y selector de objetivo general', () => {
  assert.match(unitMatrix, /matrix-unit-plan-header/)
  assert.match(unitMatrix, /PLAN DE ACCIÓN/)
  assert.match(unitMatrix, /Objetivo general/)
  assert.match(unitMatrix, /Crear nuevo objetivo/)
  assert.match(unitMatrix, /availableObjectives/)
})

test('historial usa portal global y resumen de cambios por versión', () => {
  assert.match(history, /createPortal/)
  assert.match(history, /summarizeMatrixVersionChanges/)
  assert.match(history, /Anterior/)
  assert.match(history, /Nuevo/)
})

test('los fallbacks lazy de la app usan una superficie clara compartida', () => {
  assert.match(app, /module-loading-surface/)
  assert.match(dashboard, /module-loading-surface/)
})
