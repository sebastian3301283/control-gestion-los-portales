import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const styles = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8')

function hasToken(name, value) {
  return new RegExp(`${name}\\s*:\\s*${value.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}`).test(styles)
}

test('global visual system exposes shared control and surface tokens', () => {
  const requiredTokens = [
    '--ui-control-height',
    '--ui-toolbar-height',
    '--ui-icon-control',
    '--ui-radius-control',
    '--ui-radius-panel',
    '--ui-border',
    '--ui-focus-ring',
    '--ui-text',
    '--ui-muted',
    '--ui-primary',
    '--ui-danger',
    '--ui-space-1',
    '--ui-space-2',
    '--ui-space-3',
    '--ui-space-4',
    '--ui-space-5',
    '--ui-space-6',
  ]

  for (const token of requiredTokens) {
    assert.match(styles, new RegExp(`${token}\\s*:`), `missing ${token}`)
  }

  assert.equal(hasToken('--ui-space-1', '6px'), true)
  assert.equal(hasToken('--ui-space-2', '8px'), true)
  assert.equal(hasToken('--ui-space-3', '12px'), true)
  assert.equal(hasToken('--ui-space-4', '16px'), true)
  assert.equal(hasToken('--ui-space-5', '20px'), true)
  assert.equal(hasToken('--ui-space-6', '24px'), true)
})
