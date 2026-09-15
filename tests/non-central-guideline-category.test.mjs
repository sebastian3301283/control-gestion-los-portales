import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const catalog = await readFile(new URL('../src/GuidelineCatalogV2.tsx', import.meta.url), 'utf8')
const queryCache = await readFile(new URL('../src/lib/planning-query-cache.ts', import.meta.url), 'utf8')

test('HU DEP VS HOT expose Categoria immediately after N', () => {
  assert.match(catalog, /category: string \| null/)
  assert.match(catalog, /const \[formCategory, setFormCategory\] = useState\(''\)/)
  assert.match(catalog, /<th>N°<\/th><th>Categoría<\/th><th>Lineamientos Estratégicos<\/th>/)
  assert.match(catalog, /<td className="guideline-number">\{displayNumber\(item, index\)\}<\/td>\s*<td className="guideline-category">\{item\.category \|\| '—'\}<\/td>/)
  assert.match(catalog, /<label>Categoría<input value=\{formCategory\}/)
})

test('non-Central category is loaded and sent through the multi-save RPC', () => {
  assert.match(queryCache, /management_id,category,code,guideline_text/)
  assert.match(catalog, /category_input: formCategory\.trim\(\) \|\| null/)
})
