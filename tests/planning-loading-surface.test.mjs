import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')
const dashboard = await readFile(new URL('../src/Dashboard.tsx', import.meta.url), 'utf8')
const styles = `${await readFile(new URL('../src/styles.css', import.meta.url), 'utf8')}\n${await readFile(new URL('../src/dashboard.css', import.meta.url), 'utf8')}`

test('App y Dashboard comparten fallback claro para módulos lazy', () => {
  assert.match(app, /module-loading-surface/)
  assert.match(dashboard, /module-loading-surface/)
})

test('la superficie de carga no usa fondo negro', () => {
  const match = styles.match(/\.module-loading-surface\{[^}]+\}/)
  assert.ok(match, 'falta .module-loading-surface')
  assert.doesNotMatch(match[0], /#000|#111|black|rgb\(0\s*,\s*0\s*,\s*0/i)
  assert.match(match[0], /background:\s*(#fff|white|#f[6-9a-f][f0-9a-f]{4})/i)
})
