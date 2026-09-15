import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const planning = await readFile(new URL('../src/PlanningGuidelines.tsx', import.meta.url), 'utf8')
const catalog = await readFile(new URL('../src/GuidelineCatalogV2.tsx', import.meta.url), 'utf8')
const catalogCss = await readFile(new URL('../src/guideline-catalog-v2.css', import.meta.url), 'utf8')

test('los perfiles de consulta pueden abrir la matriz exacta sin permisos de administración', () => {
  assert.match(planning, /onPrefetchMatrixForGuideline=\{prefetchMatrixForGuideline\}/)
  assert.match(planning, /onOpenMatrixForGuideline=\{openMatrixForGuideline\}/)
  assert.doesNotMatch(planning, /onPrefetchMatrixForGuideline=\{canManage \? prefetchMatrixForGuideline : undefined\}/)
  assert.doesNotMatch(planning, /onOpenMatrixForGuideline=\{canManage \? openMatrixForGuideline : undefined\}/)
  assert.match(planning, /onOpenMatrixForArea\?\.\(managementId, guidelineId\)/)
})

test('la vista de consulta muestra Ir a matriz y mantiene edición solo para administradores', () => {
  assert.match(catalog, /className="guideline-row-matrix-arrow"/)
  assert.match(catalogCss, /\.guideline-actions \.guideline-row-matrix-arrow::before\{content:'Ir a matriz'\}/)
  assert.match(catalog, /\{canManage && <><button[\s\S]*title="Editar"[\s\S]*title="Eliminar"/)
  assert.match(catalog, /\{canManage && <button className="guideline-add"/)
})
