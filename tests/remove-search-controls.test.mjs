import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const dashboard = await readFile(new URL('../src/Dashboard.tsx', import.meta.url), 'utf8')
const guidelineCatalog = await readFile(new URL('../src/GuidelineCatalogV2.tsx', import.meta.url), 'utf8')

test('la barra superior ya no muestra el buscador global', () => {
  assert.doesNotMatch(dashboard, /className="dashboard-search"/)
  assert.doesNotMatch(dashboard, /placeholder="Buscar"/)
})

test('Lineamientos Estratégicos ya no muestra Buscar lineamiento', () => {
  assert.doesNotMatch(guidelineCatalog, /placeholder="Buscar lineamiento"/)
  assert.doesNotMatch(guidelineCatalog, /const \[search, setSearch\]/)
  assert.doesNotMatch(guidelineCatalog, /search\.trim\(\)/)
})
