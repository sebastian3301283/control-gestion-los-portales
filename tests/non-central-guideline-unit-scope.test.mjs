import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const catalog = await readFile(new URL('../src/GuidelineCatalogV2.tsx', import.meta.url), 'utf8')

test('el formulario filtra gerencias por la unidad elegida', () => {
  assert.match(catalog, /managements\.filter\(item => item\.active && item\.unit_code === formUnitCode\)/)
  assert.match(catalog, /Gerencia responsable[\s\S]+formManagementOptions\.map/)
})

test('el formulario filtra bonistas por la misma unidad y gerencia elegidas', () => {
  assert.match(catalog, /managers\.filter\(item => item\.active && item\.unit_code === formUnitCode && linkedManagerIds\.has\(item\.id\)\)/)
})

test('cambiar de unidad limpia gerencia y bonista para evitar ids cruzados', () => {
  assert.match(catalog, /setFormUnitCode\(event\.target\.value\); setFormAreaId\(''\); setFormResponsibleId\(''\)/)
})
