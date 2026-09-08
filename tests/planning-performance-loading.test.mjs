import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

async function source(path) {
  return readFile(new URL(path, import.meta.url), 'utf8').catch(() => '')
}

const cache = await source('../src/lib/planning-query-cache.ts')
const planning = await source('../src/PlanningGuidelines.tsx')
const catalog = await source('../src/GuidelineCatalogV2.tsx')
const centralGuidelines = await source('../src/CentralGuidelineWorkspace.tsx')
const unitMatrix = await source('../src/UnitExcelWorkspace.tsx')
const centralMatrix = await source('../src/CentralExcelWorkspace.tsx')
const dashboard = await source('../src/Dashboard.tsx')

test('planning GETs share a short cache and deduplicate in-flight requests', () => {
  assert.match(cache, /PLANNING_CACHE_TTL_MS\s*=\s*15_000/)
  assert.match(cache, /cachedPlanningGet/)
  assert.match(cache, /expiresAt/)
  assert.match(cache, /promise/)
})

test('shared planning loaders scope unit catalogs and guidelines before downloading rows', () => {
  assert.match(cache, /managements_global[\s\S]{0,450}\.eq\('unit_code', unitCode\)/)
  assert.match(cache, /from\('managers'\)[\s\S]{0,450}\.eq\('unit_code', unitCode\)/)
  assert.match(cache, /planning_guidelines[\s\S]{0,550}\.eq\('period_id', periodId\)[\s\S]{0,250}\.eq\('unit_code', unitCode\)/)
  assert.match(cache, /manager_managements[\s\S]{0,450}\.in\('management_id', managementIds\)/)
})

test('HU DEP VS HOT lineamientos use the scoped cached loader for their current period and unit', () => {
  assert.match(planning, /scopePeriodId=\{periodId\}/)
  assert.match(planning, /scopeUnitCode=\{unit\.code\}/)
  assert.match(catalog, /loadScopedGuidelineData/)
})

test('Central lineamientos reuse the scoped Central catalogs instead of reading all managements', () => {
  assert.match(centralGuidelines, /loadCentralGuidelineData\(periodId\)/)
  assert.doesNotMatch(centralGuidelines, /supabase\.from\('managements_global'\)/)
})

test('HU DEP VS HOT matrices reuse scoped unit catalogs instead of global managements and managers', () => {
  assert.match(unitMatrix, /loadUnitMatrixWorkspaceData\(periodId, unitCode\)/)
  assert.doesNotMatch(unitMatrix, /supabase\.from\('managements_global'\)/)
  assert.doesNotMatch(unitMatrix, /supabase\.from\('managers'\)/)
})

test('Central matrix reuses scoped catalogs and scoped manager links', () => {
  assert.match(centralMatrix, /loadCentralMatrixWorkspaceData\(periodId\)/)
  assert.doesNotMatch(centralMatrix, /supabase\.from\('managers'\)/)
  assert.doesNotMatch(centralMatrix, /supabase\.from\('manager_managements'\)/)
})

test('planning periods are shared and the next planning level is prefetched without awaiting navigation', () => {
  assert.match(dashboard, /loadPlanningPeriods/)
  assert.match(dashboard, /void prefetchGuidelineWorkspace\(/)
  assert.match(dashboard, /void prefetchMatrixWorkspace\(/)
  assert.match(planning, /void prefetchMatrixWorkspace\(/)
  assert.match(cache, /export async function prefetchGuidelineWorkspace/)
  assert.match(cache, /export async function prefetchMatrixWorkspace/)
})
