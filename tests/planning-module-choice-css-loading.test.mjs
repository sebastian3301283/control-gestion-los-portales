import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const basePlanningCss = await readFile(new URL('../src/planning.css', import.meta.url), 'utf8')
const lazyGuidelinesCss = await readFile(new URL('../src/planning-guidelines.css', import.meta.url), 'utf8')

test('la tarjeta de Lineamientos tiene sus estilos críticos antes de cargar el módulo lazy', () => {
  assert.match(basePlanningCss, /\.planning-module-choice-grid\{/)
  assert.match(basePlanningCss, /\.planning-module-choice\{/)
  assert.match(basePlanningCss, /\.planning-module-choice__icon\{/)
  assert.match(basePlanningCss, /\.planning-module-choice__copy\{/)
  assert.match(basePlanningCss, /\.planning-module-choice--guidelines \.planning-module-choice__icon\{/)
})

test('el CSS lazy de Lineamientos no es responsable de estilizar la tarjeta previa a la navegación', () => {
  assert.doesNotMatch(lazyGuidelinesCss, /\.planning-module-choice-grid\{/)
  assert.doesNotMatch(lazyGuidelinesCss, /\.planning-module-choice\{/)
})
