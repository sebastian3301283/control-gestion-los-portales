import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const styles = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8')
const main = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8')
const consistencyUrl = new URL('../src/platform-consistency.css', import.meta.url)
const guidelineVisual = readFileSync(new URL('../src/guideline-visual-fixes.css', import.meta.url), 'utf8')

function hasToken(name, value) {
  return new RegExp(`${name}\\s*:\\s*${value.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}`).test(styles)
}

test('global visual system exposes shared control and surface tokens', () => {
  const requiredTokens = [
    '--ui-control-height',
    '--ui-toolbar-height',
    '--ui-icon-control',
    '--ui-radius-control',
    '--ui-radius-panel',
    '--ui-border',
    '--ui-focus-ring',
    '--ui-text',
    '--ui-muted',
    '--ui-primary',
    '--ui-danger',
    '--ui-space-1',
    '--ui-space-2',
    '--ui-space-3',
    '--ui-space-4',
    '--ui-space-5',
    '--ui-space-6',
  ]

  for (const token of requiredTokens) {
    assert.match(styles, new RegExp(`${token}\\s*:`), `missing ${token}`)
  }

  assert.equal(hasToken('--ui-space-1', '6px'), true)
  assert.equal(hasToken('--ui-space-2', '8px'), true)
  assert.equal(hasToken('--ui-space-3', '12px'), true)
  assert.equal(hasToken('--ui-space-4', '16px'), true)
  assert.equal(hasToken('--ui-space-5', '20px'), true)
  assert.equal(hasToken('--ui-space-6', '24px'), true)
})

test('dashboard and configuration use the shared consistency layer', () => {
  assert.match(main, /import ['"]\.\/platform-consistency\.css['"]/)
  assert.equal(existsSync(consistencyUrl), true, 'platform consistency stylesheet must exist')
  const consistency = readFileSync(consistencyUrl, 'utf8')

  assert.match(consistency, /\.dashboard-shell \.dashboard-nav button:focus-visible/)
  assert.match(consistency, /\.dashboard-shell \.icon-button:focus-visible/)
  assert.match(consistency, /\.catalog-config \.config-accordion-head/)
  assert.match(consistency, /\.catalog-config \.config-accordion-head:focus-visible/)
  assert.match(consistency, /min-height:\s*var\(--ui-control-height\)/)
  assert.match(consistency, /border-radius:\s*var\(--ui-radius-panel\)/)
})

test('permission catalog keeps important labels readable and controls aligned', () => {
  const consistency = readFileSync(consistencyUrl, 'utf8')

  assert.match(consistency, /\.permission-v4 \.permission-v4-help\s*\{[^}]*font-size:\s*11px/s)
  assert.match(consistency, /\.permission-v4 \.permission-v4-modal-head p\s*\{[^}]*font-size:\s*11px/s)
  assert.match(consistency, /\.permission-v4 \.permission-v4-modal-role>label>span\s*\{[^}]*font-size:\s*11px/s)
  assert.match(consistency, /\.permission-v4 \.permission-v4-unit-tabs button strong\s*\{[^}]*font-size:\s*11px/s)
  assert.match(consistency, /\.permission-v4 \.permission-v4-guideline-summary strong\s*\{[^}]*font-size:\s*11px/s)
  assert.match(consistency, /\.permission-v4 \.permission-v4-guideline-control>div>span\s*\{[^}]*font-size:\s*11px/s)
  assert.match(consistency, /\.permission-v4 button:focus-visible/)
  assert.match(consistency, /\.permission-v4 \.permission-v4-modal-role select\s*\{[^}]*min-height:\s*var\(--ui-control-height\)/s)
})

test('guidelines and support documents share controls without regressing approved layout', () => {
  const consistency = readFileSync(consistencyUrl, 'utf8')

  assert.match(guidelineVisual, /th:nth-child\(3\)\{width:400px!important\}/)
  assert.match(guidelineVisual, /th:nth-child\(4\)\{width:180px!important\}/)
  assert.match(guidelineVisual, /th:nth-child\(5\)\{width:190px!important\}/)
  assert.match(guidelineVisual, /guideline-row-matrix-arrow[^}]*min-height:46px!important/s)

  assert.match(consistency, /\.planning-guidelines-host \.planning-guideline-matrix-button\s*\{[^}]*min-height:\s*var\(--ui-control-height\)/s)
  assert.match(consistency, /\.planning-guidelines-host \.planning-guideline-fullscreen-button[^}]*min-height:\s*var\(--ui-toolbar-height\)/s)
  assert.match(consistency, /\.planning-guidelines-host button:focus-visible/)
  assert.match(consistency, /\.guideline-ppt-panel \.guideline-ppt-upload\s*\{[^}]*min-height:\s*var\(--ui-control-height\)/s)
  assert.match(consistency, /\.guideline-ppt-panel \.guideline-ppt-view[^}]*min-height:\s*var\(--ui-toolbar-height\)/s)
  assert.match(consistency, /\.guideline-ppt-panel \.guideline-ppt-viewer\s*\{[^}]*border-radius:\s*20px/s)
  assert.match(consistency, /\.guideline-ppt-panel button:focus-visible/)
})
