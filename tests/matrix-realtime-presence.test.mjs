import test from 'node:test'
import assert from 'node:assert/strict'
import { flattenPresenceState, collaborationLocationLabel } from '../src/matrix-realtime-presence.js'

test('aplana Presence, elimina sesiones duplicadas y conserva la ubicacion de edicion', () => {
  const users = flattenPresenceState({
    a: [
      { user_id: 'u1', name: 'Maria Lopez', email: 'maria@empresa.com', location: { field: 'KPI', subpoint: 'S2', row: '3' } },
      { user_id: 'u1', name: 'Maria Lopez', email: 'maria@empresa.com', location: { field: 'KPI', subpoint: 'S2', row: '3' } },
    ],
    b: [
      { user_id: 'u2', name: 'Juan Perez', email: 'juan@empresa.com', location: { field: 'Objetivo general', row: '4' } },
    ],
  })

  assert.equal(users.length, 2)
  assert.deepEqual(users[0], {
    user_id: 'u1',
    name: 'Maria Lopez',
    email: 'maria@empresa.com',
    location: { field: 'KPI', subpoint: 'S2', row: '3' },
  })
  assert.equal(collaborationLocationLabel(users[0].location), 'KPI · S2 · fila 3')
})

test('describe una ubicacion sin fila cuando se edita el editor superior', () => {
  assert.equal(collaborationLocationLabel({ field: 'Objetivo general' }), 'Objetivo general')
})
