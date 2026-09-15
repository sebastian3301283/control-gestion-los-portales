import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const catalog = await readFile(new URL('../src/GuidelineCatalogV2.tsx', import.meta.url), 'utf8')

test('la columna N° muestra el código del lineamiento sin convertir L1 a 1', () => {
  assert.match(catalog, /function displayNumber\(item: Guideline, index: number\) \{[\s\S]*return parsed\.code \|\| String\(index \+ 1\)[\s\S]*\}/)
  assert.doesNotMatch(catalog, /Number\(match\[1\]\)/)
})

test('Lineamientos Estratégicos muestra solo el texto y no repite el código', () => {
  assert.match(catalog, /<span className="guideline-text-copy">\{parsed\.text\}<\/span>/)
  assert.doesNotMatch(catalog, /<strong className="guideline-code">\{parsed\.code\}: <\/strong>/)
})
