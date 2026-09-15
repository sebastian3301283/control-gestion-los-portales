import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')
const dashboard = await readFile(new URL('../src/Dashboard.tsx', import.meta.url), 'utf8')

test('authentication does not eagerly import the authenticated dashboard', () => {
  assert.doesNotMatch(app, /^import Dashboard from '.\/DashboardRestricted'/m)
  assert.match(app, /lazy\(\(\) => import\('\.\/DashboardRestricted'\)\)/)
  assert.match(app, /Suspense/)
})

test('dashboard lazily loads heavy configuration and planning workspaces', () => {
  for (const moduleName of ['CatalogConfiguration', 'PlanningGuidelines', 'MatrixWorkspace']) {
    assert.doesNotMatch(dashboard, new RegExp(`^import ${moduleName} from`, 'm'))
    assert.match(dashboard, new RegExp(`lazy\\(\\(\\) => import\\('\\.\\/${moduleName}'\\)\\)`))
  }
})

test('dashboard prefetches lazy chunks before likely navigation without awaiting them', () => {
  assert.match(dashboard, /prefetchPlanningGuidelinesModule/)
  assert.match(dashboard, /prefetchMatrixWorkspaceModule/)
  assert.match(dashboard, /prefetchCatalogConfigurationModule/)
})
