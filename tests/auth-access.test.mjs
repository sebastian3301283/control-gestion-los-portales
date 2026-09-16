import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')

function between(startText, endText) {
  const start = source.indexOf(startText)
  const end = source.indexOf(endText, start)
  assert.notEqual(start, -1, `No se encontró ${startText}`)
  assert.notEqual(end, -1, `No se encontró ${endText}`)
  return source.slice(start, end)
}

test('password login resolves current access and opens the dashboard without a reload', () => {
  const signIn = between('async function signIn', 'const resetView')
  assert.match(signIn, /rpc\('current_access'\)/)
  assert.match(signIn, /setAccess\(currentAccess\)/)
  assert.match(signIn, /auth\.signOut\(\)/)
})

test('session restore rejects and closes sessions without active application access', () => {
  const restore = between('async function restoreAccess', 'return () => { mounted = false }')
  assert.match(restore, /auth\.signOut\(\)/)
})
