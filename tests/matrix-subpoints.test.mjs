import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeSubpoints, prepareCentralMatrixFields, splitSubpoints } from '../src/matrix-subpoints.js'

test('normaliza subpuntos escritos en líneas y elimina viñetas visuales', () => {
  assert.deepEqual(
    splitSubpoints('  Primer subpunto  \n\n- Segundo subpunto\n• Tercer subpunto\n3. Cuarto subpunto  '),
    ['Primer subpunto', 'Segundo subpunto', 'Tercer subpunto', 'Cuarto subpunto'],
  )
})

test('guarda los subpuntos como texto multilínea estable para Supabase y Excel', () => {
  assert.equal(
    normalizeSubpoints('Primer subpunto\n- Segundo subpunto\n\n• Tercer subpunto'),
    'Primer subpunto\nSegundo subpunto\nTercer subpunto',
  )
  assert.equal(normalizeSubpoints('   '), '')
})

test('prepara Lineamiento, Objetivo general y Subpuntos sin mezclar campos', () => {
  assert.deepEqual(
    prepareCentralMatrixFields(' Lineamiento 1 ', ' Objetivo general ', '- Subpunto A\n• Subpunto B'),
    {
      objective_group: 'Lineamiento 1',
      objective: 'Objetivo general',
      action_plan: 'Subpunto A\nSubpunto B',
    },
  )
})
