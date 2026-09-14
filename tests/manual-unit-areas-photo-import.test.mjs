import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const catalog = await readFile(new URL('../src/GuidelineCatalogV2.tsx', import.meta.url), 'utf8')
const importer = await readFile(new URL('../src/GuidelineMultiImport.tsx', import.meta.url), 'utf8')
const cache = await readFile(new URL('../src/lib/planning-query-cache.ts', import.meta.url), 'utf8')
const migration = await readFile(new URL('../supabase/migrations/20260914170500_manual_unit_areas_and_photo_import.sql', import.meta.url), 'utf8').catch(() => '')

test('Áreas de Unidad se editan como etiquetas libres y no como catálogo visible', () => {
  assert.match(catalog, /selectedUnitAreaLabels/)
  assert.match(catalog, /unitAreaDraft/)
  assert.match(catalog, /Agregar área/)
  assert.match(catalog, /Áreas de Unidad/)
  assert.doesNotMatch(catalog, /<span>Áreas de Unidad<\/span><div className="guideline-multi-options">\{formManagementOptions/)
  assert.match(catalog, /unit_area_labels_input: selectedUnitAreaLabels/)
})

test('las etiquetas manuales se persisten separadas de la relación técnica de matriz', () => {
  assert.match(migration, /create table if not exists public\.planning_guideline_unit_area_labels/)
  assert.match(migration, /label text not null/)
  assert.match(migration, /unit_area_labels_input text\[\]/)
  assert.match(cache, /loadGuidelineUnitAreaLabels/)
})

test('importador no Central usa Categoría N° Lineamiento Áreas de Unidad y Áreas de Central', () => {
  assert.match(importer, /unitAreas: string\[\]/)
  assert.match(importer, /centralAreas: string\[\]/)
  assert.match(importer, /<th>Categoría<\/th>/)
  assert.match(importer, /<th>Áreas de Unidad<\/th>/)
  assert.match(importer, /<th>Áreas de Central<\/th>/)
  assert.doesNotMatch(importer, /<th>Área<\/th><th>Responsable<\/th>/)
})

test('las imágenes usan coordenadas OCR para reconstruir filas y columnas', () => {
  assert.match(importer, /tsv\?: string/)
  assert.match(importer, /parseImageTableFromTsv/)
  assert.match(importer, /categoryHeader/)
  assert.match(importer, /guidelineHeader/)
  assert.match(importer, /areasHeader/)
  assert.match(importer, /centralHeader/)
  assert.match(importer, /code: `L\$\{rowNumber\}`/)
})
