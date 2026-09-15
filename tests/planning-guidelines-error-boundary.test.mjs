import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const source = fs.readFileSync(new URL('../src/DashboardRestricted.tsx', import.meta.url), 'utf8')

test('runtime errors are surfaced instead of leaving the deployed app blank', () => {
  assert.match(source, /class DashboardRuntimeBoundary/)
  assert.match(source, /Control de Gestión encontró un error/)
  assert.match(source, /error\.message/)
  assert.match(source, /<DashboardRuntimeBoundary>/)
  assert.match(source, /<Dashboard access=/)
  assert.match(source, /<\/DashboardRuntimeBoundary>/)
})
