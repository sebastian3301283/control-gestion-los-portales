import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const dashboard = await readFile(new URL('../src/Dashboard.tsx', import.meta.url), 'utf8')

test('Inicio usa el año calendario actual como periodo inicial en cada carga', () => {
  assert.match(dashboard, /useState<number>\(\(\) => new Date\(\)\.getFullYear\(\)\)/)
  assert.doesNotMatch(dashboard, /useState\(2026\)/)
})

test('si el año actual no existe, Inicio mantiene el fallback al periodo Actual o al primero disponible', () => {
  assert.match(dashboard, /next\.find\(period => period\.status === 'OPEN'\) \|\| next\[0\]/)
})
