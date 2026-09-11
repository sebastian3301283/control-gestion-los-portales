import test from 'node:test'
import assert from 'node:assert/strict'

async function loadModule() {
  try { return await import('../src/lib/matrix-history-diff.js') } catch { return {} }
}

const module = await loadModule()

test('resume una actualización de acción con etiquetas de negocio', () => {
  assert.equal(typeof module.summarizeMatrixVersionChanges, 'function')
  const before = { rows: [{ id: 'r1', objective_group: 'Objetivo A', objective: 'Acción A', priority: 'Media', deliverables: 'Informe' }] }
  const after = { rows: [{ id: 'r1', objective_group: 'Objetivo A', objective: 'Acción A', priority: 'Alta', deliverables: 'Informe final' }] }
  const result = module.summarizeMatrixVersionChanges(after, before)
  assert.match(result.summary, /actualiz/i)
  assert.deepEqual(result.changes.map(change => change.label), ['Prioridad', 'Entregable'])
  assert.deepEqual(result.changes[0], { label: 'Prioridad', before: 'Media', after: 'Alta' })
})

test('resume altas y bajas sin mostrar ruido técnico', () => {
  assert.equal(typeof module.summarizeMatrixVersionChanges, 'function')
  const inserted = module.summarizeMatrixVersionChanges({ rows: [{ id: 'r1', objective: 'Nueva acción', sort_order: 1 }] }, { rows: [] })
  assert.match(inserted.summary, /agreg/i)
  assert.equal(inserted.changes.some(change => /id|sort/i.test(change.label)), false)
  const removed = module.summarizeMatrixVersionChanges({ rows: [] }, { rows: [{ id: 'r1', objective: 'Vieja acción' }] })
  assert.match(removed.summary, /elimin/i)
})
