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
  assert.match(source, /<MatrixWorkspaceV12 \{\.\.\.props\} onActiveMatrixChange=\{setActiveMatrixId\}/)
  assert.doesNotMatch(source, /props\.unitCode === 'CENTRAL'[\s\S]*MatrixWorkspaceV11/)
})

test('V12 builds Matriz Resumen for any rendered matrix without extra Supabase queries', async () => {
  const source = await read(v12Url)
  assert.match(source, /function refreshMatrixSummary/)
  assert.match(source, /function findHeaderIndex/)
  assert.match(source, /querySelector<HTMLTableElement>\('\.matrix-v5-sheet'\)/)
  assert.match(source, /Acción/)
  assert.match(source, /Responsable/)
  assert.match(source, /Entregable/)
  assert.match(source, /matrix-v12-view-toggle/)

  const summaryStart = source.indexOf('function refreshMatrixSummary')
  const historyStart = source.indexOf('async function loadHistoryPage')
  assert.notEqual(summaryStart, -1)
  assert.notEqual(historyStart, -1)
  assert.doesNotMatch(source.slice(summaryStart, historyStart), /supabase\./)
})

test('all units use only the common paged metadata history and never list snapshots in UnitExcelWorkspace', async () => {
  const [v12Source, unitSource] = await Promise.all([read(v12Url), read(unitUrl)])

  assert.match(v12Source, /const HISTORY_PAGE_SIZE = 20/)
  assert.match(v12Source, /select\('id,version_no,action,changed_email,created_at'\)/)
  assert.match(v12Source, /\.range\(offset, offset \+ HISTORY_PAGE_SIZE\)/)
  assert.match(v12Source, /Cargar más/)
  assert.match(v12Source, /restore_matrix_version_by_context/)
  assert.match(v12Source, /data-matrix-history-trigger/)

  assert.doesNotMatch(unitSource, /select\('id,version_no,action,changed_email,created_at,snapshot'\)/)
  assert.doesNotMatch(unitSource, /historyOpen &&/)
  assert.match(unitSource, /data-matrix-history-trigger/)
})

test('non-Central toolbar matches Central commandbar wording and new actions stay below persisted rows', async () => {
  const source = await read(unitUrl)
  assert.match(source, /matrix-central-page-head/)
  assert.match(source, /matrix-central-commandbar/)
  assert.match(source, /Añadir acción/)
  assert.doesNotMatch(source, />Nueva fila</)

  const persistedRows = source.indexOf('rows.map(row =>')
  const newDraft = source.indexOf("renderSpreadsheetDraftRow('new-unit-action')")
  assert.notEqual(persistedRows, -1)
  assert.notEqual(newDraft, -1)
  assert.ok(newDraft > persistedRows)
})

test('matrix parity work does not replace the dedicated Central and non-Central data workspaces', async () => {
  const v11 = await read(new URL('../src/MatrixWorkspaceV11.tsx', import.meta.url))
  assert.match(v11, /CentralExcelWorkspace/)
  assert.match(v11, /UnitExcelWorkspace/)
  assert.match(v11, /props\.unitCode === 'CENTRAL'/)
})
