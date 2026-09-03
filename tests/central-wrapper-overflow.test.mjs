import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const realtimeCss = await readFile(new URL('../src/matrix-realtime-layer.css', import.meta.url), 'utf8')
const v12Css = await readFile(new URL('../src/matrix-workspace-v12.css', import.meta.url), 'utf8')
const v11Css = await readFile(new URL('../src/matrix-workspace-v11.css', import.meta.url), 'utf8')
const v5Css = await readFile(new URL('../src/matrix-workspace-v5.css', import.meta.url), 'utf8')

function declaration(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = css.match(new RegExp(`${escaped}\\{([^}]*)\\}`))
  assert.ok(match, `No se encontró la regla ${selector}`)
  return match[1]
}

test('los wrappers de Central se encogen al ancho disponible y no heredan el min-content de la tabla', () => {
  const realtimeHost = declaration(realtimeCss, '.matrix-realtime-host')
  assert.match(realtimeHost, /(?:^|;)min-width:0(?:;|$)/)
  assert.match(realtimeHost, /(?:^|;)max-width:100%(?:;|$)/)

  const v12Host = declaration(v12Css, '.matrix-v12-host')
  assert.match(v12Host, /(?:^|;)min-width:0(?:;|$)/)
  assert.match(v12Host, /(?:^|;)max-width:100%(?:;|$)/)
  assert.match(v12Host, /(?:^|;)grid-template-columns:minmax\(0,1fr\)(?:;|$)/)

  const v11Host = declaration(v11Css, '.matrix-v11-host')
  assert.match(v11Host, /(?:^|;)min-width:0(?:;|$)/)
  assert.match(v11Host, /(?:^|;)max-width:100%(?:;|$)/)
})

test('el desplazamiento horizontal de la matriz permanece dentro del contenedor de la tabla', () => {
  const sheetScroll = declaration(v5Css, '.matrix-v5-sheet-scroll')
  assert.match(sheetScroll, /(?:^|;)overflow:auto(?:;|$)/)

  for (const [css, selector] of [
    [realtimeCss, '.matrix-realtime-host'],
    [v12Css, '.matrix-v12-host'],
    [v11Css, '.matrix-v11-host'],
  ]) {
    const wrapper = declaration(css, selector)
    assert.doesNotMatch(wrapper, /overflow-x:auto|overflow:auto/)
  }
})
