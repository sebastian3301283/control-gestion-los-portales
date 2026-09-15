import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const responsibleUrl = new URL('../src/GuidelineResponsibleConfiguration.tsx', import.meta.url)
const planningCssUrl = new URL('../src/planning-guidelines.css', import.meta.url)

async function source(url) {
  return readFile(url, 'utf8')
}

test('responsible configuration uses the same closed accordion shell as Periodos', async () => {
  const responsible = await source(responsibleUrl)

  assert.match(responsible, /ChevronDown/)
  assert.match(responsible, /const \[open, setOpen\] = useState\(false\)/)
  assert.match(responsible, /guideline-responsible-config config-accordion/)
  assert.match(responsible, /className="config-accordion-head"/)
  assert.match(responsible, /className="config-accordion-icon"/)
  assert.match(responsible, /className=\{open \? 'rotated' : ''\}/)
  assert.match(responsible, /open && <div className="config-accordion-body guideline-responsible-config-body"/)
})

test('Ir a matriz keeps label and arrow inside one shared button box', async () => {
  const css = await source(planningCssUrl)

  assert.match(css, /\.planning-guidelines-host \.guideline-actions \.guideline-row-matrix-arrow\{[^}]*min-width:108px[^}]*min-height:46px[^}]*display:inline-flex[^}]*flex-direction:column[^}]*align-items:center[^}]*justify-content:center[^}]*overflow:hidden[^}]*\}/s)
  assert.match(css, /\.planning-guidelines-host \.guideline-actions \.guideline-row-matrix-arrow::before\{[^}]*display:block[^}]*line-height:1[^}]*\}/s)
  assert.match(css, /\.planning-guidelines-host \.guideline-actions \.guideline-row-matrix-arrow>svg\{[^}]*display:block[^}]*flex:0 0 auto[^}]*\}/s)
})
