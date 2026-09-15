import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const panelUrl = new URL('../src/GuidelinePptPanel.tsx', import.meta.url)

async function source() {
  return readFile(panelUrl, 'utf8')
}

test('non-central support heading shows only the guideline code instead of the full guideline text', async () => {
  const panel = await source()

  assert.match(panel, /function guidelineCode\(value\?: string \| null\)/)
  assert.match(panel, /const supportCode = guidelineCode\(guidelineLabel\)/)
  assert.match(panel, /: \(supportCode \? ` · \$\{supportCode\}` : ''\)/)
  assert.doesNotMatch(panel, /: \(guidelineLabel \? ` · \$\{guidelineLabel\}` : ''\)/)
})

test('Central support heading continues using the selected management name', async () => {
  const panel = await source()
  assert.match(panel, /managementName \? ` · \$\{managementName\}` : ''/)
})
