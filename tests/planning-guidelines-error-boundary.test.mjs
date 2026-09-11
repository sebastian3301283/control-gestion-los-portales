import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const source = fs.readFileSync(new URL('../src/Dashboard.tsx', import.meta.url), 'utf8')

test('Lineamientos is isolated by an error boundary instead of blanking the whole dashboard', () => {
  assert.match(source, /class PlanningModuleErrorBoundary/)
  assert.match(source, /No pudimos abrir Lineamientos/)
  assert.match(source, /<PlanningModuleErrorBoundary[^>]*>/)
  assert.match(source, /<PlanningGuidelines unit=/)
  assert.match(source, /<\/PlanningModuleErrorBoundary>/)
})
