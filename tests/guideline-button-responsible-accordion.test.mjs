import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const responsibleAccordionUrl = new URL('../src/GuidelineResponsibleAccordion.tsx', import.meta.url)
const catalogConfigurationUrl = new URL('../src/CatalogConfiguration.tsx', import.meta.url)
const guidelineCatalogUrl = new URL('../src/GuidelineCatalogV2.tsx', import.meta.url)
const catalogCssUrl = new URL('../src/guideline-catalog-v2.css', import.meta.url)
const unitOverridesUrl = new URL('../src/guideline-unit-layout-overrides.css', import.meta.url)
const mainUrl = new URL('../src/main.tsx', import.meta.url)
const visualFixesUrl = new URL('../src/guideline-visual-fixes.css', import.meta.url)

async function source(url) {
  return readFile(url, 'utf8')
}

test('responsible configuration uses the same closed accordion shell as Periodos', async () => {
  const responsible = await source(responsibleAccordionUrl)
  const catalog = await source(catalogConfigurationUrl)

  assert.match(responsible, /ChevronDown/)
  assert.match(responsible, /const \[open, setOpen\] = useState\(false\)/)
  assert.match(responsible, /guideline-responsible-accordion config-accordion/)
  assert.match(responsible, /className="config-accordion-head"/)
  assert.match(responsible, /className="config-accordion-icon"/)
  assert.match(responsible, /className=\{open \? 'rotated' : ''\}/)
  assert.match(responsible, /open && <div className="config-accordion-body guideline-responsible-accordion-body"/)
  assert.match(catalog, /<GuidelineResponsibleAccordion units=\{props\.units\} canManage=\{props\.canManage\} \/>/)
})

test('Ir a matriz keeps the same contained button layout for HU VS DEP and HOT', async () => {
  const css = await source(visualFixesUrl)
  const main = await source(mainUrl)
  const catalog = await source(guidelineCatalogUrl)
  const overrides = await source(unitOverridesUrl)
  const buttonRule = css.match(/\.planning-guidelines-host \.guideline-actions \.guideline-row-matrix-arrow\{([^}]*)\}/s)?.[1] || ''

  assert.match(main, /import '\.\/guideline-visual-fixes\.css'/)
  assert.match(catalog, /\{ code: 'HU'/)
  assert.match(catalog, /\{ code: 'VS'/)
  assert.match(catalog, /\{ code: 'DEP'/)
  assert.match(catalog, /\{ code: 'HOT'/)
  assert.match(catalog, /unitCode !== 'CENTRAL' && onOpenMatrixForGuideline && <button[^>]*className="guideline-row-matrix-arrow"/s)
  assert.doesNotMatch(overrides, /guideline-row-matrix-arrow/)

  for (const expected of [
    /display:inline-flex!important/,
    /flex-direction:column!important/,
    /align-items:center!important/,
    /justify-content:center!important/,
    /min-width:108px!important/,
    /min-height:46px!important/,
    /overflow:hidden!important/,
  ]) assert.match(buttonRule, expected)

  assert.match(css, /\.planning-guidelines-host \.guideline-actions \.guideline-row-matrix-arrow::before\{[^}]*display:block[^}]*line-height:1[^}]*\}/s)
  assert.match(css, /\.planning-guidelines-host \.guideline-actions \.guideline-row-matrix-arrow>svg\{[^}]*display:block[^}]*flex:0 0 auto[^}]*\}/s)
})

test('HU and VS give more width to Lineamientos and less width to both area columns without changing CENTRAL', async () => {
  const css = await source(catalogCssUrl)
  const catalog = await source(guidelineCatalogUrl)

  assert.match(catalog, /guideline-v2-table--noncentral/)
  assert.match(css, /\.guideline-v2-table--noncentral\{[^}]*min-width:1200px[^}]*\}/s)
  assert.match(css, /\.guideline-v2-table--noncentral th:nth-child\(3\)\{width:400px\}/)
  assert.match(css, /\.guideline-v2-table--noncentral th:nth-child\(4\)\{width:180px\}/)
  assert.match(css, /\.guideline-v2-table--noncentral th:nth-child\(5\)\{width:190px\}/)
  assert.match(css, /\.guideline-v2-table--noncentral th:nth-child\(6\)\{width:210px\}/)
  assert.match(css, /\.guideline-v2-table th:nth-child\(4\)\{width:230px\}/)
  assert.match(css, /\.guideline-v2-table th:nth-child\(5\)\{width:250px\}/)
})

test('DEP and HOT preserve their special layouts while prioritizing Lineamientos', async () => {
  const css = await source(unitOverridesUrl)

  assert.match(css, /\.guideline-v2-table--dep\{min-width:1240px!important\}/)
  assert.match(css, /\.guideline-v2-table--dep th:nth-child\(3\)\{width:400px!important\}/)
  assert.match(css, /\.guideline-v2-table--dep th:nth-child\(4\)\{width:180px!important\}/)
  assert.match(css, /\.guideline-v2-table--dep th:nth-child\(5\)\{width:190px!important\}/)
  assert.match(css, /\.guideline-v2-table--dep th:nth-child\(6\)\{width:210px!important\}/)

  assert.match(css, /\.guideline-v2-table--hot\{min-width:1050px!important\}/)
  assert.match(css, /\.guideline-v2-table--hot th:nth-child\(3\)\{width:400px!important\}/)
  assert.match(css, /\.guideline-v2-table--hot th:nth-child\(4\)\{width:180px!important\}/)
  assert.match(css, /\.guideline-v2-table--hot th:nth-child\(6\)\{width:210px!important\}/)
  assert.match(css, /\.guideline-v2-table--hot th:nth-child\(5\),\.guideline-v2-table--hot td:nth-child\(5\)\{display:none!important\}/)
})
