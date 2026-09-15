import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const responsibleAccordionUrl = new URL('../src/GuidelineResponsibleAccordion.tsx', import.meta.url)
const catalogConfigurationUrl = new URL('../src/CatalogConfiguration.tsx', import.meta.url)
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

test('Ir a matriz keeps label and arrow inside one shared button box', async () => {
  const css = await source(visualFixesUrl)
  const main = await source(mainUrl)

  assert.match(main, /import '\.\/guideline-visual-fixes\.css'/)
  assert.match(css, /\.planning-guidelines-host \.guideline-actions \.guideline-row-matrix-arrow\{[^}]*min-width:108px!important[^}]*min-height:46px!important[^}]*display:inline-flex!important[^}]*flex-direction:column!important[^}]*align-items:center!important[^}]*justify-content:center!important[^}]*overflow:hidden!important[^}]*\}/s)
  assert.match(css, /\.planning-guidelines-host \.guideline-actions \.guideline-row-matrix-arrow::before\{[^}]*display:block[^}]*line-height:1[^}]*\}/s)
  assert.match(css, /\.planning-guidelines-host \.guideline-actions \.guideline-row-matrix-arrow>svg\{[^}]*display:block[^}]*flex:0 0 auto[^}]*\}/s)
})
