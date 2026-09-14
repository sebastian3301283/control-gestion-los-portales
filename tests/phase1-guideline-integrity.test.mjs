import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const catalog = await readFile(new URL('../src/GuidelineCatalogV2.tsx', import.meta.url), 'utf8')
const planning = await readFile(new URL('../src/PlanningGuidelines.tsx', import.meta.url), 'utf8')
const importer = await readFile(new URL('../src/GuidelineMultiImport.tsx', import.meta.url), 'utf8')
const cache = await readFile(new URL('../src/lib/planning-query-cache.ts', import.meta.url), 'utf8')
const support = await readFile(new URL('../src/GuidelinePptPanel.tsx', import.meta.url), 'utf8')
const supportStorage = await readFile(new URL('../src/guideline-support-storage.ts', import.meta.url), 'utf8')
const unitExcel = await readFile(new URL('../src/UnitExcelWorkspace.tsx', import.meta.url), 'utf8')
const v11 = await readFile(new URL('../src/MatrixWorkspaceV11.tsx', import.meta.url), 'utf8')

test('Fase 1: Gerencia y Bonista se cargan bajo demanda y se filtran por unidad + gerencia sin reemplazar las áreas manuales', () => {
  assert.match(cache, /export async function loadScopedGuidelineAssignees\(unitCode: string\)/)
  assert.match(catalog, /loadScopedGuidelineAssignees/)
  assert.match(catalog, /assignmentManagementOptions/)
  assert.match(catalog, /item\.active && item\.unit_code === formUnitCode/)
  assert.match(catalog, /link\.management_id === formAreaId/)
  assert.match(catalog, /item\.active && item\.unit_code === formUnitCode && allowedManagerIds\.has\(item\.id\)/)
  assert.match(catalog, /Gerencia responsable \(opcional\)[\s\S]+assignmentManagementOptions\.map/)
  assert.match(catalog, /Gerente responsable · Bonistas[\s\S]+responsibleOptions\.map/)
  assert.match(catalog, /selectedUnitAreaLabels/)
  assert.match(catalog, /Escribe las áreas manualmente/)
})

test('Fase 1: navegación y retorno conservan el guideline_id exacto en HU/DEP/VS/HOT', () => {
  assert.match(catalog, /onOpenMatrixForGuideline\?\.\(item\.management_id, item\.id\)/)
  assert.match(unitExcel, /matrices\.find\(item => item\.guideline_id === guidelineId\)/)
  assert.match(unitExcel, /onGuidelineContextChange\?\.\(\{ managementId, guidelineId: selectedMatrix\.guideline_id \}\)/)
  assert.match(v11, /<UnitExcelWorkspace[^>]+onGuidelineContextChange=\{setGuidelineContext\}/)
})

test('Fase 1: soportes no Central permanecen aislados por guidelineId y se limpian antes de borrar el lineamiento', () => {
  assert.match(support, /guidelineFolder = guidelineId \? `\$\{baseFolder\}\/\$\{guidelineId\}` : ''/)
  assert.match(supportStorage, /`\$\{unitCode\}\/\$\{periodId\}\/\$\{guidelineId\}`/)
  assert.match(catalog, /deleteGuidelineSupportFiles\(item\.unit_code, item\.period_id, item\.id\)[\s\S]+from\('planning_guidelines'\)\.delete\(\)\.eq\('id', item\.id\)/)
})

test('Fase 1: create/edit conserva identidad, responsable filtrado y la importación ya no depende del catálogo de áreas', () => {
  assert.match(catalog, /guideline_id_input: editingId \|\| null/)
  assert.match(catalog, /management_ids_input: orderedTechnicalManagementIds/)
  assert.match(catalog, /responsible_ids_input: formResponsibleId \? \[formResponsibleId\] : \[\]/)
  assert.match(importer, /loadScopedManagements\(unit\.code\)/)
  assert.match(importer, /management_ids_input: technicalManagementIds/)
  assert.doesNotMatch(importer, /No hay un área técnica activa para crear las matrices de esta unidad/)
})

test('Fase 1: errores de guardado se muestran dentro del modal y no se duplica la flecha mediante DOM imperativo', () => {
  assert.match(catalog, /guideline-modal-error/)
  assert.match(catalog, /<div className="guideline-actions">[\s\S]*?guideline-row-matrix-arrow[\s\S]*?openEdit\(item\)/)
  assert.doesNotMatch(planning, /relocateMatrixActions/)
})

test('Fase 1: Central conserva su sincronización histórica y su importación directa', () => {
  assert.match(catalog, /if \(nextUnitCode !== 'CENTRAL'\) return/)
  assert.match(importer, /if \(isCentral\)[\s\S]+from\('planning_guidelines'\)\.insert/)
})
