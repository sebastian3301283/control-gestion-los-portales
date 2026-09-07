import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const v11Url = new URL('../src/MatrixWorkspaceV11.tsx', import.meta.url)
const cssUrl = new URL('../src/matrix-workspace-v11.css', import.meta.url)

async function readV11() {
  return readFile(v11Url, 'utf8')
}

test('Central exposes Matriz and Resumen views using the already rendered matrix data', async () => {
  const source = await readV11()
  const css = await readFile(cssUrl, 'utf8')

  assert.match(source, /matrix-v11-view-toggle/)
  assert.match(source, />Matriz</)
  assert.match(source, />Resumen</)
  assert.match(source, /matrix-v11-summary-table/)
  assert.match(source, /<th>Acción<\/th>\s*<th>Responsable<\/th>\s*<th>Fecha<\/th>\s*<th>Entregable<\/th>/s)
  assert.match(css, /\.matrix-v11-summary-table/)

  const summaryStart = source.indexOf('function refreshCentralSummary')
  const historyStart = source.indexOf('async function loadHistoryPage')
  assert.notEqual(summaryStart, -1)
  assert.notEqual(historyStart, -1)
  const summaryBlock = source.slice(summaryStart, historyStart)
  assert.doesNotMatch(summaryBlock, /supabase\./)
})

test('Central full matrix uses the agreed column order and the Fechas label', async () => {
  const source = await readV11()

  assert.match(source, /const CENTRAL_COLUMN_ORDER = \[0, 1, 2, 3, 4, 7, 8, 5, 6\]/)
  assert.match(source, /dateHeader\.textContent = 'Fechas'/)
})

test('History loads 20 metadata rows at a time, can load more, and does not fetch snapshots in the listing', async () => {
  const source = await readV11()

  assert.match(source, /const HISTORY_PAGE_SIZE = 20/)
  assert.match(source, /select\('id,version_no,action,changed_email,created_at'\)/)
  assert.doesNotMatch(source, /from\('matrix_versions'\)\.select\('[^']*snapshot/)
  assert.match(source, /\.range\(offset, offset \+ HISTORY_PAGE_SIZE\)/)
  assert.match(source, /Cargar más/)
  assert.match(source, /restore_matrix_version_by_context/)

  const historyStart = source.indexOf('async function loadHistoryPage')
  const restoreStart = source.indexOf('async function restoreVersion')
  assert.notEqual(historyStart, -1)
  assert.notEqual(restoreStart, -1)
  const historyBlock = source.slice(historyStart, restoreStart)
  assert.doesNotMatch(historyBlock, /setInterval|addEventListener/)
})
