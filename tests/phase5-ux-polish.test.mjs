import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

async function source(path) {
  return readFile(new URL(path, import.meta.url), 'utf8').catch(() => '')
}

const dashboard = await source('../src/Dashboard.tsx')
const planningGuidelines = await source('../src/PlanningGuidelines.tsx')
const matrixV12 = await source('../src/MatrixWorkspaceV12.tsx')

test('phase 5 shows the real Unidad -> Lineamientos -> Matriz planning path', () => {
  assert.match(dashboard, />1\. Unidad</)
  assert.match(dashboard, />2\. Lineamientos</)
  assert.match(dashboard, />3\. Matriz</)
  assert.match(dashboard, /step === 'guidelines'[\s\S]{0,500}2\. Lineamientos/)
  assert.match(dashboard, /step === 'matrices'[\s\S]{0,500}3\. Matriz/)
})

test('phase 5 back navigation returns from Matriz to Lineamientos before leaving the unit flow', () => {
  assert.match(dashboard, /function goBack\(\)[\s\S]{0,500}step === 'matrices'[\s\S]{0,300}openGuidelinesFromMatrix\(/)
  assert.match(dashboard, /step === 'guidelines'[\s\S]{0,220}setStep\('modules'\)/)
})

test('phase 5 uses an app restore dialog instead of the native browser confirmation', () => {
  assert.doesNotMatch(matrixV12, /window\.confirm\(/)
  assert.match(matrixV12, /pendingRestoreVersion/)
  assert.match(matrixV12, /matrix-v12-restore-confirm/)
  assert.match(matrixV12, /aria-labelledby="matrix-v12-restore-title"/)
})

test('phase 5 exposes error and success feedback with accessible live semantics', () => {
  assert.match(dashboard, /planning-message" role="alert"/)
  assert.match(dashboard, /planning-message planning-message--success" role="status" aria-live="polite"/)
  assert.match(planningGuidelines, /planning-guideline-import-notice" role="status" aria-live="polite"/)
})

test('phase 5 destructive and confirmation dialogs support Escape without bypassing busy actions', () => {
  assert.match(planningGuidelines, /pendingDelete[\s\S]{0,800}event\.key === 'Escape'[\s\S]{0,200}setPendingDelete\(null\)/)
  assert.match(matrixV12, /pendingRestoreVersion[\s\S]{0,900}event\.key === 'Escape'[\s\S]{0,300}restoringVersionNo/)
  assert.match(dashboard, /function ConfirmDialog[\s\S]{0,1200}event\.key === 'Escape'[\s\S]{0,250}!busy/)
})
