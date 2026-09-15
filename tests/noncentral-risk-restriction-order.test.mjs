import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

// Regression: el orden visual debe ser idéntico en lectura y edición para HU, VS, DEP y HOT.
const source = await readFile(new URL('../src/UnitExcelWorkspace.tsx', import.meta.url), 'utf8')

test('HU VS DEP HOT dejan Riesgos y Restricciones como las dos últimas columnas', () => {
  assert.match(source, /<thead><tr><th>Acción<\/th><th>Responsable<\/th><th>Prioridad<\/th><th>Hitos \/ Fechas<\/th><th>Entregable<\/th><th>Soporte<\/th><th>Comité<\/th><th>Riesgos de no ejecutar<\/th><th>Restricciones<\/th><\/tr><\/thead>/)
})

test('la fila de edición y las filas guardadas respetan el mismo orden visual', () => {
  const draftSupport = source.indexOf('placeholder="Soporte" aria-label="Soporte"')
  const draftCommittee = source.indexOf('placeholder="Comité" aria-label="Comité"')
  const draftRisk = source.indexOf('placeholder="Riesgos de no ejecutar" aria-label="Riesgos de no ejecutar"')
  const draftRestriction = source.indexOf('placeholder="Restricciones" aria-label="Restricciones"')
  assert.ok(draftSupport > -1 && draftSupport < draftCommittee && draftCommittee < draftRisk && draftRisk < draftRestriction)

  const saved = /<td>\{row\.milestones \|\| '—'\}<\/td><td>\{row\.deliverables \|\| '—'\}<\/td><td>\{row\.support \|\| '—'\}<\/td><td>\{row\.committee \|\| '—'\}<\/td><td>\{row\.risks \|\| '—'\}<\/td><td>\{row\.restrictions \|\| '—'\}<\/td>/
  assert.match(source, saved)
})