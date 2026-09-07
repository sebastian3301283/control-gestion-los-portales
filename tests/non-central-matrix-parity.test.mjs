import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const v13Url = new URL('../src/MatrixWorkspaceV13.tsx', import.meta.url)
const v12Url = new URL('../src/MatrixWorkspaceV12.tsx', import.meta.url)
const unitUrl = new URL('../src/UnitExcelWorkspace.tsx', import.meta.url)

async function read(url) {
  return readFile(url, 'utf8')
}

test('all matrix units use the V12 common experience shell while keeping one Realtime wrapper', async () => {
  const source = await read(v13Url)
  assert.match(source, /<MatrixRealtimeLayer matrixId=\{activeMatrixId\}>/)
  assert.match(source, /function handleActiveMatrixChange\(matrixId: string\)/)
  assert.match(source, /<MatrixWorkspaceV12 \{\.\.\.workspaceProps\} onActiveMatrixChange=\{handleActiveMatrixChange\}/)
  assert.match(source, /props\.onActiveMatrixChange\?\.\(matrixId\)/)
  assert.doesNotMatch(source, /props\.unitCode === 'CENTRAL'[\s\S]*MatrixWorkspaceV11/)
})

test('V12 builds Matriz Resumen for any rendered matrix without extra Supabase queries', async () => {
  const source = await read(v12Url)
  assert.match(source, /function refreshMatrixSummary/)
  assert.match(source, /function findHeaderIndex/)
  assert.match(source, /querySelector<HTMLTableElement>\('\.matrix-v5-sheet'\)/)
  assert.match(source, /\['accion'\]/)
  assert.match(source, /\['responsable'\]/)
  assert.match(source, /\['entregable'\]/)
  assert.match(source, /matrix-v12-view-toggle/)

  const summaryStart = source.indexOf('function refreshMatrixSummary')
  const historyStart = source.indexOf('async function loadHistoryPage')
  assert.notEqual(summaryStart, -1)
  assert.notEqual(historyStart, -1)
  assert.doesNotMatch(source.slice(summaryStart, historyStart), /supabase\./)
})

test('all units are intercepted by the common paged metadata history before their legacy handlers can run', async () => {
  const source = await read(v12Url)

  assert.match(source, /const HISTORY_PAGE_SIZE = 20/)
  assert.match(source, /select\('id,version_no,action,changed_email,created_at'\)/)
  assert.match(source, /\.range\(offset, offset \+ HISTORY_PAGE_SIZE\)/)
  assert.match(source, /Cargar más/)
  assert.match(source, /restore_matrix_version_by_context/)
  assert.match(source, /setAttribute\('data-matrix-history-trigger', 'true'\)/)
  assert.match(source, /button\.matches\('\[data-matrix-history-trigger\]'\)/)
  assert.match(source, /event\.preventDefault\(\)/)
  assert.match(source, /event\.stopPropagation\(\)/)

  const historyStart = source.indexOf('async function loadHistoryPage')
  const restoreStart = source.indexOf('async function restoreVersion')
  assert.notEqual(historyStart, -1)
  assert.notEqual(restoreStart, -1)
  assert.doesNotMatch(source.slice(historyStart, restoreStart), /snapshot/)
})

test('non-Central matrices receive Central commandbar behavior and creation wording without changing their persistence model', async () => {
  const [v12Source, unitSource] = await Promise.all([read(v12Url), read(unitUrl)])
  assert.match(v12Source, /props\.unitCode !== 'CENTRAL'/)
  assert.match(v12Source, /classList\.add\('matrix-central-commandbar', 'matrix-v12-unit-commandbar'\)/)
  assert.match(v12Source, /classList\.add\('matrix-central-commandbar-primary'\)/)
  assert.match(v12Source, /Añadir acción/)
  assert.match(v12Source, /data-matrix-add-action/)

  const persistedRows = unitSource.indexOf('rows.map(row =>')
  const newDraft = unitSource.indexOf("renderSpreadsheetDraftRow('new-unit-action')")
  assert.notEqual(persistedRows, -1)
  assert.notEqual(newDraft, -1)
  assert.ok(newDraft > persistedRows)
  assert.match(unitSource, /sort_order: editingRowId \? previousRow\?\.sort_order \|\| 0 : rows\.length/)
})

test('matrix parity work does not replace the dedicated Central and non-Central data workspaces', async () => {
  const v11 = await read(new URL('../src/MatrixWorkspaceV11.tsx', import.meta.url))
  assert.match(v11, /CentralExcelWorkspace/)
  assert.match(v11, /UnitExcelWorkspace/)
  assert.match(v11, /props\.unitCode === 'CENTRAL'/)
})
