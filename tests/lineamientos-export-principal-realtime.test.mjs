import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

async function readOptional(url) {
  try { return await readFile(url, 'utf8') } catch { return '' }
}

const planning = await readFile(new URL('../src/PlanningGuidelines.tsx', import.meta.url), 'utf8')
const leadership = await readFile(new URL('../src/UnitPlanLeadershipHeader.tsx', import.meta.url), 'utf8')
const config = await readOptional(new URL('../src/GuidelineResponsibleConfiguration.tsx', import.meta.url))
const realtimeCss = await readFile(new URL('../src/matrix-realtime-layer.css', import.meta.url), 'utf8')
const exporter = await readOptional(new URL('../src/lib/styled-guideline-export.ts', import.meta.url))
const migration = await readOptional(new URL('../supabase/migrations/20260914201709_planning_guideline_principal_responsible_labels.sql', import.meta.url))

test('Gestión Estratégica puede descargar Lineamientos en Excel con formato por unidad', () => {
  assert.match(planning, /exportStyledGuidelineWorkbook/)
  assert.match(planning, /Descargar Excel/)
  assert.match(planning, /canManage\s*&&[\s\S]{0,500}Descargar Excel/)
  assert.match(exporter, /xlsx-js-style/)
  assert.match(exporter, /HU:\s*'00B050'/)
  assert.match(exporter, /DEP:\s*'F28A22'/)
  assert.match(exporter, /VS:\s*'2BB5D6'/)
  assert.match(exporter, /HOT:\s*'262A2F'/)
  assert.match(exporter, /CENTRAL:\s*'176FB3'/)
  assert.match(exporter, /Lineamientos_/)
})

test('Gerente Responsable es manual, múltiple y persistente por lineamiento desde Configuración', () => {
  assert.match(config, /planning_guideline_principal_responsible_labels/)
  assert.match(config, /Agregar responsable/)
  assert.match(config, /guideline_id:/)
  assert.match(leadership, /planning_guideline_principal_responsible_labels/)
  assert.doesNotMatch(leadership, /Agregar responsable/)
  assert.doesNotMatch(leadership, />Editar</)
  assert.match(migration, /create table if not exists public\.planning_guideline_principal_responsible_labels/)
  assert.match(migration, /matrix_principal_responsible_labels/)
  assert.match(migration, /is_global_planning_manager\(\)/)
})

test('Colaboración en tiempo real queda abajo a la izquierda', () => {
  assert.match(realtimeCss, /\.matrix-realtime-bar\{[^}]*position:fixed[^}]*bottom:/)
  assert.match(realtimeCss, /\.matrix-realtime-bar\{[^}]*left:/)
  assert.doesNotMatch(realtimeCss, /\.matrix-realtime-host:has\(\.matrix-v5--expanded\)>\.matrix-realtime-bar\{[^}]*top:/)
})
