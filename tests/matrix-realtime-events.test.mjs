import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  matrixIdFromChange,
  parentRowIdFromChange,
  sameCollaborationLocation,
  shouldRefreshMatrix,
} from '../src/matrix-realtime-events.js'

test('routes direct row inserts and updates only to the active matrix', () => {
  const update = {
    eventType: 'UPDATE',
    new: { id: 'row-1', matrix_id: 'matrix-a' },
    old: { id: 'row-1', matrix_id: 'matrix-a' },
  }

  assert.equal(matrixIdFromChange(update), 'matrix-a')
  assert.equal(shouldRefreshMatrix(update, 'matrix-a'), true)
  assert.equal(shouldRefreshMatrix(update, 'matrix-b'), false)
})

test('refreshes the active matrix safely for an unscoped delete payload', () => {
  const deletion = { eventType: 'DELETE', new: {}, old: { id: 'row-1' } }

  assert.equal(matrixIdFromChange(deletion), '')
  assert.equal(shouldRefreshMatrix(deletion, 'matrix-a'), true)
  assert.equal(shouldRefreshMatrix(deletion, ''), false)
})

test('extracts the parent row for subpoint and responsible relation changes', () => {
  assert.equal(parentRowIdFromChange({ eventType: 'INSERT', new: { matrix_row_id: 'row-subpoint' }, old: {} }), 'row-subpoint')
  assert.equal(parentRowIdFromChange({ eventType: 'DELETE', new: {}, old: { row_id: 'row-responsible' } }), 'row-responsible')
  assert.equal(parentRowIdFromChange({ eventType: 'DELETE', new: {}, old: { id: 'link-only' } }), '')
})

test('deduplicates identical collaboration locations but not a real location change', () => {
  assert.equal(sameCollaborationLocation(null, null), true)
  assert.equal(sameCollaborationLocation({ field: 'KPI', row: '3', subpoint: 'S2' }, { field: 'KPI', row: '3', subpoint: 'S2' }), true)
  assert.equal(sameCollaborationLocation({ field: 'KPI', row: '3' }, { field: 'Inicio', row: '3' }), false)
  assert.equal(sameCollaborationLocation({ field: 'KPI' }, null), false)
})

test('owns one realtime channel from the explicit active matrix id without DOM polling', async () => {
  const layer = await readFile(new URL('../src/MatrixRealtimeLayer.tsx', import.meta.url), 'utf8')
  const v13 = await readFile(new URL('../src/MatrixWorkspaceV13.tsx', import.meta.url), 'utf8')
  const v11 = await readFile(new URL('../src/MatrixWorkspaceV11.tsx', import.meta.url), 'utf8')

  assert.match(layer, /type Props = \{ children: ReactNode; matrixId: string \}/)
  assert.doesNotMatch(layer, /managements_global|processes|setInterval\(\(\) => void resolveMatrix/)
  assert.match(v13, /activeMatrixId/)
  assert.match(v13, /onActiveMatrixChange/)
  assert.match(v11, /onActiveMatrixChange/)
  assert.doesNotMatch(v11, /setInterval\(\(\) => void tick\(\), 3000\)/)
})

test('subscribes to every persisted matrix relation and surfaces degraded channel states', async () => {
  const layer = await readFile(new URL('../src/MatrixRealtimeLayer.tsx', import.meta.url), 'utf8')

  for (const table of ['matrix_rows', 'matrix_row_subpoints', 'matrix_row_responsibles', 'matrix_row_edit_locks']) {
    assert.match(layer, new RegExp(`table: ['"]${table}['"]`))
  }
  for (const status of ['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED']) {
    assert.match(layer, new RegExp(status))
  }
  assert.match(layer, /sameCollaborationLocation/)
})
