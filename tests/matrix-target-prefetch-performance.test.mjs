import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

async function source(path) {
  return readFile(new URL(path, import.meta.url), 'utf8').catch(() => '')
}

const prefetch = await source('../src/lib/matrix-target-prefetch.ts')
const planning = await source('../src/PlanningGuidelines.tsx')
const catalog = await source('../src/GuidelineCatalogV2.tsx')
const unitMatrix = await source('../src/UnitExcelWorkspace.tsx')
const centralMatrix = await source('../src/CentralExcelWorkspace.tsx')

test('exact matrix target prefetch warms metadata and row relations before navigation', () => {
  assert.match(prefetch, /export async function prefetchMatrixTargetRows/)
  assert.match(prefetch, /loadMatrices\(periodId, unitCode\)/)
  assert.match(prefetch, /loadProcesses\(unitCode\)/)
  assert.match(prefetch, /matrix_rows/)
  assert.match(prefetch, /matrix_row_responsibles/)
  assert.match(prefetch, /matrix_row_subpoints/)
})

test('prefetched row data is short lived and consumed only once by the destination workspace', () => {
  assert.match(prefetch, /MATRIX_TARGET_PREFETCH_TTL_MS\s*=\s*10_000/)
  assert.match(prefetch, /export async function takePrefetchedMatrixRows/)
  assert.match(prefetch, /prefetches\.delete\(key\)/)
})

test('lineamientos begin exact matrix prefetch before the navigation click', () => {
  assert.match(planning, /prefetchMatrixTargetRows/)
  assert.match(planning, /selectedArea[\s\S]{0,500}prefetchMatrixTargetRows/)
  assert.match(planning, /onPrefetchMatrixForGuideline/)
  assert.match(catalog, /onPrefetchMatrixForGuideline/)
  assert.match(catalog, /onPointerEnter=/)
  assert.match(catalog, /onFocus=/)
})

test('matrix workspaces reuse prefetched rows for the initial open but keep realtime refreshes fresh', () => {
  assert.match(unitMatrix, /takePrefetchedMatrixRows/)
  assert.match(unitMatrix, /keepEditor\s*\?\s*null\s*:\s*await takePrefetchedMatrixRows/)
  assert.match(centralMatrix, /takePrefetchedMatrixRows/)
  assert.match(centralMatrix, /keepEditor\s*\?\s*null\s*:\s*await takePrefetchedMatrixRows/)
})
