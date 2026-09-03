import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const modelUrl = new URL('../src/central-excel-model.js', import.meta.url)

async function loadModel() {
  return import(modelUrl.href)
}

test('Central filters responsible managers by the selected area mapping', async () => {
  const { filterManagersForArea } = await loadModel()
  const managers = [
    { id: 'm1', name: 'Ana' },
    { id: 'm2', name: 'Bruno' },
    { id: 'm3', name: 'Carla' },
  ]
  const mappings = [
    { manager_id: 'm1', management_id: 'adm' },
    { manager_id: 'm2', management_id: 'audit' },
    { manager_id: 'm3', management_id: 'adm' },
  ]
  assert.deepEqual(filterManagersForArea(managers, mappings, 'adm').map(item => item.id), ['m1', 'm3'])
  assert.deepEqual(filterManagersForArea(managers, mappings, 'audit').map(item => item.id), ['m2'])
})

test('Central supports selecting several responsible managers on one action', async () => {
  const { toggleResponsibleId } = await loadModel()
  assert.deepEqual(toggleResponsibleId([], 'm1'), ['m1'])
  assert.deepEqual(toggleResponsibleId(['m1'], 'm2'), ['m1', 'm2'])
  assert.deepEqual(toggleResponsibleId(['m1', 'm2'], 'm1'), ['m2'])
})

test('Central workspace is an action matrix, not the old subpoint editor', async () => {
  const source = await readFile(new URL('../src/MatrixWorkspaceV10.tsx', import.meta.url), 'utf8')
  assert.match(source, /manager_managements/)
  assert.match(source, /matrix_row_responsibles/)
  assert.match(source, /centralResponsibleIdsByRow/)
  assert.match(source, /unitCode === 'CENTRAL' \? 'Acción'/)
  assert.match(source, /matrix-v10-central-excel-row/)
  assert.doesNotMatch(source, /renderCentralInlineEditor\(/)
})

test('Central Excel layout keeps the table header visible and cells compact', async () => {
  const css = await readFile(new URL('../src/matrix-subpoints.css', import.meta.url), 'utf8')
  assert.match(css, /\.matrix-v10-central-excel[^{]*\{[^}]*border-collapse:separate/)
  assert.match(css, /\.matrix-v10-central-excel thead th[^{]*\{[^}]*position:sticky/)
  assert.match(css, /\.matrix-v10-central-excel-row[^{]*\{[^}]*cursor:cell/)
})
