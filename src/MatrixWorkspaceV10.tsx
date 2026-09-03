import { ChangeEvent, CSSProperties, Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Building2, Check, Download, History, LoaderCircle, Maximize2, Minimize2, Pencil, Plus, RotateCcw, Trash2, Upload, X, ZoomIn, ZoomOut } from 'lucide-react'
import { supabase } from './lib/supabase'
import { buildCentralSubpointDrafts } from './central-subpoint-records.js'
import { buildCentralTableRows, type CentralTableRow } from './central-table-rows.js'
import { prepareCentralMatrixFields } from './matrix-subpoints.js'
import './matrix-workspace-v5.css'
import './matrix-subpoints.css'

type UnitCode = 'HU' | 'DEP' | 'VS' | 'HOT' | 'CENTRAL'
type DirectoryGroup = 'GENERAL' | 'HU' | 'MATRICIAL_HU_VS'
type WorkspacePage = 'areas' | 'sheet'
type Area = { id: string; name: string; unit_code: string; directory_group: DirectoryGroup }
type Process = { id: string; management_id: string; unit_code: string; directory_group: DirectoryGroup }
type Matrix = { id: string; name: string; description: string | null; guideline_text: string | null; guideline_id: string | null; process_id: string; status: 'DRAFT' | 'IN_PROGRESS' | 'REVIEW' | 'APPROVED'; created_at?: string }
type Manager = { id: string; name: string; cargo: string | null; unit_code: string; directory_group: DirectoryGroup }
type Guideline = { id: string; management_id: string; guideline_text: string; responsible_manager_id: string | null; active: boolean; sort_order: number }
type MatrixRow = {
  id: string
  objective_group: string | null
  objective: string | null
  action_plan: string | null
  responsible_manager_id: string | null
  responsible_text: string | null
  priority: string | null
  milestones: string | null
  kpi: string | null
  target: string | null
  start_date: string | null
  end_date: string | null
  risks: string | null
  restrictions: string | null
  support: string | null
  deliverables: string | null
  committee: string | null
  status: 'DRAFT' | 'IN_PROGRESS' | 'REVIEW' | 'APPROVED'
  sort_order: number
}
type CentralSubpointRecord = {
  id: string
  matrix_row_id: string
  text: string
  milestones: string | null
  kpi: string | null
  start_date: string | null
  end_date: string | null
  sort_order: number
}
type MatrixVersion = {
  id: string
  version_no: number
  action: string
  changed_email: string | null
  created_at: string
  snapshot: { rows?: unknown[]; matrix?: Record<string, unknown> } | null
}
type Props = {
  periodId: string
  year: number
  unitCode: UnitCode
  unitName: string
  canManage: boolean
  onError: (message: string) => void
  onNotice: (message: string) => void
}
type RowDraft = Omit<MatrixRow, 'id' | 'sort_order'>

const XLSX_MODULE_URL = 'https://unpkg.com/xlsx@0.18.5/xlsx.mjs'
const emptyRow: RowDraft = {
  objective_group: '', objective: '', action_plan: '', responsible_manager_id: null, responsible_text: '', priority: '', milestones: '', kpi: '', target: '', start_date: '', end_date: '',
  risks: '', restrictions: '', support: '', deliverables: '', committee: '', status: 'DRAFT',
}
const unitAccent: Record<UnitCode, string> = { CENTRAL: 'central', HU: 'hu', DEP: 'dep', VS: 'vs', HOT: 'hot' }

function formatDate(value: string | null) {
  if (!value) return '—'
  const [year, month, day] = value.split('-')
  return year && month && day ? `${day}/${month}/${year}` : value
}
function formatDateTime(value: string) {
  try { return new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) } catch { return value }
}
function priorityClass(value: string | null) {
  const normalized = (value || '').trim().toLowerCase()
  if (normalized === 'alta') return 'high'
  if (normalized === 'media') return 'medium'
  if (normalized === 'baja') return 'low'
  return 'none'
}
function normalizeText(value: unknown) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/\s+/g, ' ')
}
function textValue(value: unknown) { return String(value ?? '').trim() }
function historyActionLabel(value: string) {
  if (value === 'BASELINE') return 'Versión inicial'
  if (value === 'ROW_INSERT') return 'Fila agregada'
  if (value === 'ROW_UPDATE') return 'Fila actualizada'
  if (value === 'ROW_DELETE') return 'Fila eliminada'
  if (value === 'MATRIX_UPDATE') return 'Matriz actualizada'
  return value.replaceAll('_', ' ').toLowerCase()
}

export default function MatrixWorkspaceV10({ periodId, year, unitCode, unitName, canManage, onError, onNotice }: Props) {
  const [page, setPage] = useState<WorkspacePage>('areas')
  const [areas, setAreas] = useState<Area[]>([])
  const [allManagements, setAllManagements] = useState<Area[]>([])
  const [processes, setProcesses] = useState<Process[]>([])
  const [matrices, setMatrices] = useState<Matrix[]>([])
  const [managers, setManagers] = useState<Manager[]>([])
  const [guidelines, setGuidelines] = useState<Guideline[]>([])
  const [rows, setRows] = useState<MatrixRow[]>([])
  const [centralSubpointsByRow, setCentralSubpointsByRow] = useState<Record<string, CentralSubpointRecord[]>>({})
  const [selectedAreaId, setSelectedAreaId] = useState('')
  const [selectedMatrixId, setSelectedMatrixId] = useState('')
  const [loading, setLoading] = useState(true)
  const [rowsLoading, setRowsLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [rowFormOpen, setRowFormOpen] = useState(false)
  const [editingRowId, setEditingRowId] = useState<string | null>(null)
  const [rowDraft, setRowDraft] = useState<RowDraft>(emptyRow)
  const [creatingObjectiveGroup, setCreatingObjectiveGroup] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [areaCanEdit, setAreaCanEdit] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [versions, setVersions] = useState<MatrixVersion[]>([])
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const selectedArea = areas.find(item => item.id === selectedAreaId) || null
  const selectedMatrix = matrices.find(item => item.id === selectedMatrixId) || null
  const showNumberColumn = unitCode === 'CENTRAL'
  const managerById = useMemo(() => new Map(managers.map(item => [item.id, item])), [managers])
  const managementById = useMemo(() => new Map(allManagements.map(item => [item.id, item])), [allManagements])
  const rowObjectiveGroups = useMemo(() => [...new Set(rows.map(row => (row.objective_group || '').trim()).filter(Boolean))], [rows])
  const centralGuidelineGroups = useMemo(() => {
    if (unitCode !== 'CENTRAL' || !selectedArea) return []
    return guidelines
      .filter(item => item.active && normalizeText(managementById.get(item.management_id)?.name || '') === normalizeText(selectedArea.name))
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(item => item.guideline_text.trim())
      .filter(Boolean)
  }, [unitCode, selectedArea, guidelines, managementById])
  const effectiveCanManage = canManage || areaCanEdit

  const selectedGuideline = useMemo(() => {
    if (!selectedMatrix || !selectedArea) return null
    if (selectedMatrix.guideline_id) {
      const linked = guidelines.find(item => item.id === selectedMatrix.guideline_id)
      if (linked) return linked
    }
    const exact = guidelines.filter(item => normalizeText(managementById.get(item.management_id)?.name || '') === normalizeText(selectedArea.name))
    if (exact.length) return exact.sort((a, b) => a.sort_order - b.sort_order)[0]
    if (guidelines.length === 1) return guidelines[0]
    return null
  }, [selectedMatrix, selectedArea, guidelines, managementById])

  const firstResponsible = useMemo(() => {
    if (selectedGuideline?.responsible_manager_id) {
      return managerById.get(selectedGuideline.responsible_manager_id)?.name || 'Sin asignar'
    }
    const row = rows.find(item => item.responsible_manager_id || item.responsible_text)
    if (!row) return 'Sin asignar'
    return row.responsible_manager_id ? managerById.get(row.responsible_manager_id)?.name || row.responsible_text || 'Sin asignar' : row.responsible_text || 'Sin asignar'
  }, [selectedGuideline, rows, managerById])

  useEffect(() => {
    setPage('areas'); setSelectedAreaId(''); setSelectedMatrixId(''); setRows([]); setCentralSubpointsByRow({}); setExpanded(false); setZoom(1); setAreaCanEdit(false); void loadWorkspace()
  }, [periodId, unitCode])
  useEffect(() => { if (!selectedMatrixId) { setRows([]); setCentralSubpointsByRow({}) } else void loadRows(selectedMatrixId) }, [selectedMatrixId])
  useEffect(() => { if (!selectedAreaId) { setAreaCanEdit(false); return }; void loadAreaEditPermission(selectedAreaId) }, [selectedAreaId, unitCode])
  useEffect(() => {
    if (!expanded) return
    const oldOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setExpanded(false) }
    window.addEventListener('keydown', onKeyDown)
    return () => { document.body.style.overflow = oldOverflow; window.removeEventListener('keydown', onKeyDown) }
  }, [expanded])

  async function loadAreaEditPermission(areaId: string) {
    if (!supabase) return
    const { data, error } = await supabase.rpc('can_edit_management', { management_id_input: areaId, unit_code_input: unitCode })
    setAreaCanEdit(!error && Boolean(data))
  }

  async function loadWorkspace() {
    if (!supabase) return
    setLoading(true); onError('')
    try {
      const [catalogResult, allAreasResult, processResult, matrixResult, managerResult, guidelineResult] = await Promise.all([
        supabase.from('matrix_unit_area_catalog').select('management_id').eq('unit_code', unitCode).order('created_at'),
        supabase.from('managements_global').select('id,name,unit_code,directory_group').eq('active', true).order('name'),
        supabase.from('processes').select('id,management_id,unit_code,directory_group').eq('unit_code', unitCode).eq('active', true).order('created_at'),
        supabase.from('matrices').select('id,name,description,guideline_text,guideline_id,process_id,status,created_at').eq('period_id', periodId).eq('unit_code', unitCode).eq('active', true).order('created_at'),
        supabase.from('managers').select('id,name,cargo,unit_code,directory_group').eq('active', true).order('name'),
        supabase.from('planning_guidelines').select('id,management_id,guideline_text,responsible_manager_id,active,sort_order').eq('period_id', periodId).eq('unit_code', unitCode).eq('active', true).order('sort_order').order('created_at'),
      ])
      if (catalogResult.error || allAreasResult.error || processResult.error || matrixResult.error || managerResult.error || guidelineResult.error) throw new Error('LOAD')
      const allAreas = (allAreasResult.data || []) as Area[]
      const processData = (processResult.data || []) as Process[]
      const allowedManagementIds = new Set(processData.map(item => item.management_id))
      const areaById = new Map(allAreas.map(area => [area.id, area]))
      const uniqueAreas = new Map<string, Area>()
      ;(catalogResult.data || []).forEach(item => {
        const id = String(item.management_id)
        const area = areaById.get(id)
        if (area && allowedManagementIds.has(id) && !uniqueAreas.has(normalizeText(area.name))) uniqueAreas.set(normalizeText(area.name), area)
      })
      setAllManagements(allAreas)
      setAreas([...uniqueAreas.values()].sort((a, b) => a.name.localeCompare(b.name, 'es')))
      setProcesses(processData)
      setMatrices((matrixResult.data || []) as Matrix[])
      setManagers((managerResult.data || []) as Manager[])
      setGuidelines((guidelineResult.data || []) as Guideline[])
    } catch { onError('No pudimos cargar las áreas, lineamientos y matrices.') } finally { setLoading(false) }
  }

  async function loadRows(matrixId: string) {
    if (!supabase) return
    setRowsLoading(true)
    const { data, error } = await supabase.from('matrix_rows').select('*').eq('matrix_id', matrixId).order('sort_order').order('created_at')
    if (error) { setRowsLoading(false); onError('No pudimos cargar la matriz.'); return }
    const nextRows = (data || []) as MatrixRow[]
    setRows(nextRows)

    if (unitCode === 'CENTRAL' && nextRows.length) {
      const detailResult = await supabase.from('matrix_row_subpoints')
        .select('id,matrix_row_id,text,milestones,kpi,start_date,end_date,sort_order')
        .in('matrix_row_id', nextRows.map(row => row.id))
        .order('sort_order')
        .order('created_at')
      if (!detailResult.error) {
        const grouped: Record<string, CentralSubpointRecord[]> = {}
        ;((detailResult.data || []) as CentralSubpointRecord[]).forEach(item => {
          if (!grouped[item.matrix_row_id]) grouped[item.matrix_row_id] = []
          grouped[item.matrix_row_id].push(item)
        })
        setCentralSubpointsByRow(grouped)
      } else {
        setCentralSubpointsByRow({})
      }
    } else {
      setCentralSubpointsByRow({})
    }
    setRowsLoading(false)
  }

  async function openHistory() {
    if (!supabase || !selectedMatrix) return
    setHistoryOpen(true); setHistoryLoading(true); setVersions([])
    const { data, error } = await supabase.from('matrix_versions').select('id,version_no,action,changed_email,created_at,snapshot').eq('matrix_id', selectedMatrix.id).order('version_no', { ascending: false })
    setHistoryLoading(false)
    if (error) { onError('No pudimos cargar el historial de la matriz.'); return }
    setVersions((data || []) as MatrixVersion[])
  }

  function matrixForArea(areaId: string) {
    const processIds = new Set(processes.filter(item => item.management_id === areaId).map(item => item.id))
    return matrices.find(item => processIds.has(item.process_id)) || null
  }
  function openArea(area: Area) {
    const matrix = matrixForArea(area.id)
    if (!matrix) { onError(`La matriz de “${area.name}” todavía no está preparada o no tienes acceso.`); return }
    setSelectedAreaId(area.id); setSelectedMatrixId(matrix.id); cancelRowEdit(); setPage('sheet'); onError(''); onNotice('')
  }
  function startNewRow() {
    const defaultGroup = unitCode === 'CENTRAL' && centralGuidelineGroups.length === 1 ? centralGuidelineGroups[0] : ''
    setEditingRowId(null); setRowDraft({ ...emptyRow, objective_group: defaultGroup }); setCreatingObjectiveGroup(unitCode !== 'CENTRAL' && rowObjectiveGroups.length === 0); setRowFormOpen(true); onError(''); onNotice('')
  }
  function startEditRow(row: MatrixRow) {
    setEditingRowId(row.id); setCreatingObjectiveGroup(false)
    setRowDraft({ objective_group: row.objective_group || '', objective: row.objective || '', action_plan: row.action_plan || '', responsible_manager_id: row.responsible_manager_id, responsible_text: row.responsible_text || '', priority: row.priority || '', milestones: row.milestones || '', kpi: row.kpi || '', target: row.target || '', start_date: row.start_date || '', end_date: row.end_date || '', risks: row.risks || '', restrictions: row.restrictions || '', support: row.support || '', deliverables: row.deliverables || '', committee: row.committee || '', status: row.status || 'DRAFT' })
    setRowFormOpen(true)
  }
  function cancelRowEdit() { setEditingRowId(null); setRowFormOpen(false); setCreatingObjectiveGroup(false); setRowDraft(emptyRow) }
  function updateDraft<K extends keyof RowDraft>(key: K, value: RowDraft[K]) { setRowDraft(current => ({ ...current, [key]: value })) }

  function centralRowsFor(row: MatrixRow): CentralTableRow[] {
    const details = buildCentralSubpointDrafts(centralSubpointsByRow[row.id] || [], row)
    const displayDetails = details.length ? details : [{
      text: '—', milestones: row.milestones || '', kpi: row.kpi || '', start_date: row.start_date || '', end_date: row.end_date || '',
    }]
    return buildCentralTableRows({ objective: row.objective, subpointRecords: displayDetails })
  }

  async function saveRow() {
    if (!supabase || !selectedMatrix || !effectiveCanManage) return
    if (!String(rowDraft.objective_group || '').trim()) { onError(unitCode === 'CENTRAL' ? 'Selecciona el lineamiento antes de guardar.' : 'Selecciona un objetivo o crea uno nuevo antes de guardar.'); return }
    if (!String(rowDraft.objective || '').trim()) { onError(unitCode === 'CENTRAL' ? 'Escribe el objetivo general antes de guardar.' : 'Escribe la acción antes de guardar.'); return }
    setSaving(true); onError(''); onNotice('')
    const manager = rowDraft.responsible_manager_id ? managerById.get(rowDraft.responsible_manager_id) : null
    const hierarchy = unitCode === 'CENTRAL'
      ? prepareCentralMatrixFields(rowDraft.objective_group, rowDraft.objective, rowDraft.action_plan)
      : { objective_group: rowDraft.objective_group?.trim() || null, objective: rowDraft.objective || null, action_plan: rowDraft.action_plan || null }
    const payload = { matrix_id: selectedMatrix.id, ...hierarchy, responsible_manager_id: rowDraft.responsible_manager_id || null, responsible_text: manager?.name || rowDraft.responsible_text || null, priority: rowDraft.priority || null, milestones: rowDraft.milestones || null, kpi: rowDraft.kpi || null, target: rowDraft.target || null, start_date: rowDraft.start_date || null, end_date: rowDraft.end_date || null, risks: rowDraft.risks || null, restrictions: rowDraft.restrictions || null, support: rowDraft.support || null, deliverables: rowDraft.deliverables || null, committee: rowDraft.committee || null, status: rowDraft.status, sort_order: editingRowId ? rows.find(item => item.id === editingRowId)?.sort_order || 0 : rows.length }
    const result = editingRowId ? await supabase.from('matrix_rows').update(payload).eq('id', editingRowId) : await supabase.from('matrix_rows').insert(payload)
    setSaving(false)
    if (result.error) { onError('No pudimos guardar la fila. Revisa tus permisos de edición.'); return }
    const wasEditing = Boolean(editingRowId); cancelRowEdit(); onNotice(wasEditing ? 'Fila actualizada.' : 'Fila agregada.'); await loadRows(selectedMatrix.id)
  }
  async function deleteRow(id: string) {
    if (!supabase || !effectiveCanManage || !selectedMatrix) return
    const { error } = await supabase.from('matrix_rows').delete().eq('id', id)
    if (error) { onError('No pudimos eliminar la fila.'); return }
    onNotice('Fila eliminada.'); await loadRows(selectedMatrix.id)
  }

  async function exportExcel() {
    if (!selectedMatrix) return
    setExporting(true); onError('')
    try {
      const XLSX = await import(/* @vite-ignore */ XLSX_MODULE_URL)
      const exportRows = unitCode === 'CENTRAL'
        ? rows.flatMap((row, index) => centralRowsFor(row).map(detail => ({
          'N°': index + 1,
          Lineamiento: row.objective_group || '',
          'Objetivo general': row.objective || '',
          Subpunto: detail.subpoint,
          Responsable: row.responsible_manager_id ? managerById.get(row.responsible_manager_id)?.name || row.responsible_text || '' : row.responsible_text || '',
          Prioridad: row.priority || '',
          'Hitos / Fechas': detail.milestones === '—' ? '' : detail.milestones,
          'KPI (Cuantitativo)': detail.kpi === '—' ? '' : detail.kpi,
          Inicio: detail.startDate === '—' ? '' : detail.startDate,
          Fin: detail.endDate === '—' ? '' : detail.endDate,
          'Riesgos de no ejecutar': row.risks || '', Restricciones: row.restrictions || '', Soporte: row.support || '', Entregable: row.deliverables || '', Comité: row.committee || '',
        })))
        : rows.map(row => ({
          Objetivo: row.objective_group || '', Acción: row.objective || '',
          Responsable: row.responsible_manager_id ? managerById.get(row.responsible_manager_id)?.name || row.responsible_text || '' : row.responsible_text || '',
          Prioridad: row.priority || '', 'Hitos / Fechas': row.milestones || '', 'KPI (Cuantitativo)': row.kpi || '', Inicio: row.start_date || '', Fin: row.end_date || '', 'Riesgos de no ejecutar': row.risks || '', Restricciones: row.restrictions || '', Soporte: row.support || '', Entregable: row.deliverables || '', Comité: row.committee || '',
        }))
      const sheet = XLSX.utils.json_to_sheet(exportRows); const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, sheet, 'Plan de Acción'); XLSX.writeFile(workbook, `Plan_de_Accion_${unitCode}_${selectedArea?.name || 'Matriz'}_${year}.xlsx`)
    } catch { onError('No pudimos exportar la matriz a Excel.') } finally { setExporting(false) }
  }

  async function importExcel(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = ''
    if (!file || !selectedMatrix || !supabase || !effectiveCanManage) return
    setImporting(true); onError(''); onNotice('')
    try {
      const XLSX = await import(/* @vite-ignore */ XLSX_MODULE_URL)
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true }); const sheetName = workbook.SheetNames[0]
      if (!sheetName) throw new Error('NO_SHEET')
      const grid = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], { header: 1, defval: '', raw: true }) as unknown[][]
      const headerIndex = grid.findIndex(row => {
        const normalized = row.map(normalizeText)
        const hasResponsible = normalized.some(value => value.includes('responsable'))
        const hasMainColumn = unitCode === 'CENTRAL'
          ? normalized.some(value => value.includes('objetivo general') || value === 'objetivo' || value.includes('accion'))
          : normalized.some(value => value.includes('accion'))
        return hasResponsible && hasMainColumn
      })
      if (headerIndex < 0) { onError(unitCode === 'CENTRAL' ? 'No encontramos los encabezados. El Excel debe contener Objetivo general y Responsable.' : 'No encontramos la fila de encabezados. El Excel debe contener al menos Acción y Responsable.'); return }
      const headers = grid[headerIndex].map(normalizeText); const findCol = (items: string[]) => headers.findIndex(h => items.some(i => h === i || h.includes(i)))
      const groupCol = unitCode === 'CENTRAL' ? findCol(['lineamiento']) : findCol(['objetivo'])
      const actionCol = findCol(['accion'])
      const centralObjectiveCol = unitCode === 'CENTRAL' ? findCol(['objetivo general','objetivo','accion']) : actionCol
      const subpointCol = unitCode === 'CENTRAL' ? findCol(['subpuntos','subpunto']) : -1
      const responsibleCol = findCol(['responsable']); const priorityCol = findCol(['prioridad']); const milestoneCol = findCol(['hitos fechas','hitos']); const kpiCol = findCol(['kpi cuantitativo','kpi']); const startCol = findCol(['inicio','fecha inicio']); const endCol = findCol(['fin','fecha fin']); const riskCol = findCol(['riesgos de no ejecutar','riesgos']); const restrictionCol = findCol(['restricciones']); const supportCol = findCol(['soporte']); const deliverableCol = findCol(['entregable']); const committeeCol = findCol(['comite'])
      if ((unitCode === 'CENTRAL' ? centralObjectiveCol : actionCol) < 0) { onError(unitCode === 'CENTRAL' ? 'El Excel no contiene la columna Objetivo general.' : 'El Excel no contiene la columna Acción.'); return }
      const at = (row: unknown[], col: number) => col >= 0 ? row[col] : ''
      const dateToIso = (value: unknown) => { if (!value) return null; if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0,10); const t = textValue(value); const m = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/); if (m) return `${m[3].length === 2 ? '20'+m[3] : m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`; return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : null }
      let currentGroup = ''
      const importedRows: Record<string, unknown>[] = []
      for (const row of grid.slice(headerIndex + 1)) {
        const joined = row.map(textValue).filter(Boolean).join(' ').trim(); if (!joined) continue
        const mainCol = unitCode === 'CENTRAL' ? centralObjectiveCol : actionCol
        const isGroupRow = unitCode === 'CENTRAL' ? /^(?:L\d+|LINEAMIENTO\s*\d+)\s*[:.-]?/i.test(joined) : /^OB\d+\s*:/i.test(joined)
        if (isGroupRow && !textValue(at(row, mainCol))) { currentGroup = joined; continue }
        const objective = textValue(at(row, mainCol)); if (!objective) continue
        const explicitGroup = textValue(at(row, groupCol)); if (explicitGroup) currentGroup = explicitGroup
        const responsibleName = textValue(at(row, responsibleCol)); const manager = managers.find(item => normalizeText(item.name) === normalizeText(responsibleName))
        const hierarchy = unitCode === 'CENTRAL'
          ? prepareCentralMatrixFields(currentGroup, objective, at(row, subpointCol))
          : { objective_group: currentGroup || null, objective, action_plan: null }
        importedRows.push({ matrix_id: selectedMatrix.id, ...hierarchy, responsible_manager_id: manager?.id || null, responsible_text: responsibleName || null, priority: textValue(at(row, priorityCol)) || null, milestones: textValue(at(row, milestoneCol)) || null, kpi: textValue(at(row, kpiCol)) || null, target: null, start_date: dateToIso(at(row, startCol)), end_date: dateToIso(at(row, endCol)), risks: textValue(at(row, riskCol)) || null, restrictions: textValue(at(row, restrictionCol)) || null, support: textValue(at(row, supportCol)) || null, deliverables: textValue(at(row, deliverableCol)) || null, committee: textValue(at(row, committeeCol)) || null, status: 'DRAFT', sort_order: rows.length + importedRows.length })
      }
      if (!importedRows.length) { onError(unitCode === 'CENTRAL' ? 'No encontramos objetivos generales para importar.' : 'No encontramos filas de acciones para importar.'); return }
      const { error } = await supabase.from('matrix_rows').insert(importedRows); if (error) throw error
      await loadRows(selectedMatrix.id); onNotice(`${importedRows.length} fila${importedRows.length === 1 ? '' : 's'} importada${importedRows.length === 1 ? '' : 's'} correctamente.`)
    } catch { onError('No pudimos importar el Excel. Revisa los encabezados de la matriz.') } finally { setImporting(false) }
  }

  const tableColSpan = 12 + (unitCode === 'CENTRAL' ? 1 : 0) + (showNumberColumn ? 1 : 0) + (effectiveCanManage ? 1 : 0)
  const zoomStyle = { '--matrix-zoom': zoom } as CSSProperties
  const lineamientoText = selectedGuideline?.guideline_text || selectedMatrix?.guideline_text || 'Sin lineamiento registrado'

  return <div className={`matrix-v5 matrix-v10 matrix-v5--${unitAccent[unitCode]} ${page === 'sheet' ? 'matrix-v5--sheet' : ''} ${expanded ? 'matrix-v5--expanded' : ''}`}>
    {page === 'areas' && <>
      <section className="matrix-v5-intro"><div><span>Periodo {year} · {unitCode}</span><h3>Matrices de {unitName}</h3><p>Las áreas se activan en <strong>Configuración → Activar áreas por unidad</strong>. Solo verás las áreas a las que tengas acceso.</p></div></section>
      {loading ? <div className="matrix-v5-loading"><LoaderCircle className="spin" size={22}/> Cargando matrices...</div> : <section className="matrix-v5-stage"><div className="matrix-v5-stage-head"><small>Áreas habilitadas</small><h4>Selecciona un área</h4></div>{areas.length === 0 ? <div className="matrix-v5-empty"><Building2 size={24}/><strong>No tienes áreas disponibles</strong></div> : <div className="matrix-v5-area-grid">{areas.map(area => <button className="matrix-v5-area-card" key={area.id} onClick={() => openArea(area)}><span><Building2 size={20}/></span><div><strong>{area.name}</strong><small>{matrixForArea(area.id) ? 'Matriz lista para abrir' : 'Sin matriz disponible'}</small></div><ArrowRight size={17}/></button>)}</div>}</section>}
    </>}

    {page === 'sheet' && selectedMatrix && <section className="matrix-v5-plan-shell">
      <div className="matrix-v5-toolbar"><div className="matrix-v5-toolbar-actions">
        <button className="matrix-v5-secondary" onClick={() => setExpanded(value => !value)}>{expanded ? <Minimize2 size={16}/> : <Maximize2 size={16}/>} {expanded ? 'Salir de pantalla completa' : 'Expandir matriz'}</button>
        {expanded && <div className="matrix-v5-zoom"><button title="Alejar" onClick={() => setZoom(z => Math.max(.75, +(z-.1).toFixed(2)))}><ZoomOut size={15}/></button><span>{Math.round(zoom*100)}%</span><button title="Acercar" onClick={() => setZoom(z => Math.min(1.4, +(z+.1).toFixed(2)))}><ZoomIn size={15}/></button><button title="Restablecer zoom" onClick={() => setZoom(1)}><RotateCcw size={14}/></button></div>}
        <button className="matrix-v5-secondary" onClick={() => void openHistory()}><History size={16}/> Historial</button>
        {effectiveCanManage && <><input ref={fileInputRef} type="file" accept=".xlsx,.xls" hidden onChange={event => void importExcel(event)}/><button className="matrix-v5-secondary" onClick={() => fileInputRef.current?.click()} disabled={importing}><Upload size={16}/>{importing ? 'Importando...' : 'Importar Excel'}</button></>}
        <button className="matrix-v5-secondary" onClick={() => void exportExcel()} disabled={exporting}><Download size={16}/>{exporting ? 'Exportando...' : 'Exportar Excel'}</button>
        {effectiveCanManage && <button className="matrix-v5-primary" onClick={startNewRow}><Plus size={16}/> Nueva fila</button>}
      </div></div>

      <div className="matrix-v5-title"><span>Matriz de Plan de Acción</span><h2>PLAN DE ACCIÓN {year}</h2></div>

      {unitCode !== 'CENTRAL' && <section className="matrix-v5-guidelines-card"><div className="matrix-v5-guidelines-head"><div><span>LINEAMIENTOS</span><h3>Lineamiento de la matriz</h3></div></div><div className="matrix-v5-guidelines-scroll"><table><thead><tr><th>Lineamiento estratégico</th></tr></thead><tbody><tr><td><strong>{lineamientoText}</strong></td></tr></tbody></table></div></section>}

      <div className="matrix-v5-summary"><div><span>Área</span><strong>{selectedArea?.name || '—'}</strong></div><div><span>Unidad</span><strong>{unitName}</strong></div><div><span>Responsable principal</span><strong>{firstResponsible}</strong></div></div>

      <div className="matrix-v5-sheet-card"><div className="matrix-v5-sheet-scroll" style={zoomStyle}><table className="matrix-v5-sheet"><thead><tr>{showNumberColumn && <th>N°</th>}<th>{unitCode === 'CENTRAL' ? 'Objetivo general' : 'Acción'}</th>{unitCode === 'CENTRAL' && <th>Subpunto</th>}<th>Responsable</th><th>Prioridad</th><th>Hitos / Fechas</th><th>KPI (Cuantitativo)</th><th>Inicio</th><th>Fin</th><th>Riesgos de no ejecutar</th><th>Restricciones</th><th>Soporte</th><th>Entregable</th><th>Comité</th>{effectiveCanManage && <th>Acciones</th>}</tr></thead><tbody>
        {rowFormOpen && <tr className="matrix-v5-edit-row">{showNumberColumn && <td>{editingRowId ? rows.findIndex(row => row.id === editingRowId)+1 : rows.length+1}</td>}<td><div className="matrix-v5-action-editor">
          {unitCode === 'CENTRAL' ? <div className="matrix-v5-objective-picker matrix-v10-lineamiento-picker"><select value={rowDraft.objective_group || ''} onChange={e => updateDraft('objective_group',e.target.value)}><option value="">Selecciona un lineamiento</option>{centralGuidelineGroups.map(lineamiento => <option key={lineamiento} value={lineamiento}>{lineamiento}</option>)}</select>{centralGuidelineGroups.length===0 && <small>Primero registra el lineamiento de esta área en Configuración → Lineamientos.</small>}</div> : <div className="matrix-v5-objective-picker">{creatingObjectiveGroup || rowObjectiveGroups.length === 0 ? <><input value={rowDraft.objective_group || ''} onChange={e => updateDraft('objective_group', e.target.value)} placeholder="Escribe el primer objetivo, por ejemplo OB1: ..."/>{rowObjectiveGroups.length>0 && <button type="button" onClick={() => { setCreatingObjectiveGroup(false); updateDraft('objective_group','') }}>Usar existente</button>}</> : <select value={rowDraft.objective_group || ''} onChange={e => { if(e.target.value==='__new__'){ updateDraft('objective_group',''); setCreatingObjectiveGroup(true) } else updateDraft('objective_group',e.target.value) }}><option value="">Selecciona un objetivo</option>{rowObjectiveGroups.map(objective => <option key={objective} value={objective}>{objective}</option>)}<option value="__new__">+ Crear nuevo objetivo</option></select>}</div>}
          <textarea value={rowDraft.objective || ''} onChange={e => updateDraft('objective', e.target.value)} placeholder={unitCode === 'CENTRAL' ? 'Escribe el objetivo general' : 'Escribe la acción'}/>
          {unitCode === 'CENTRAL' && <div className="matrix-v10-subpoints-editor"><label>Subpuntos</label><textarea value={rowDraft.action_plan || ''} onChange={e => updateDraft('action_plan', e.target.value)} placeholder={'Escribe un subpunto por línea\nEjemplo: Coordinar alcance\nValidar fecha de entrega'}/></div>}
        </div></td>{unitCode === 'CENTRAL' && <td>—</td>}<td><select value={rowDraft.responsible_manager_id || ''} onChange={e => updateDraft('responsible_manager_id', e.target.value || null)}><option value="">Seleccionar responsable</option>{managers.map(manager => <option key={manager.id} value={manager.id}>{manager.name}{manager.directory_group==='MATRICIAL_HU_VS'?' · Matricial':''}</option>)}</select></td><td><select value={rowDraft.priority || ''} onChange={e => updateDraft('priority', e.target.value)}><option value="">—</option><option>Alta</option><option>Media</option><option>Baja</option></select></td><td><textarea value={rowDraft.milestones || ''} onChange={e => updateDraft('milestones',e.target.value)}/></td><td><textarea value={rowDraft.kpi || ''} onChange={e => updateDraft('kpi',e.target.value)}/></td><td><input type="date" value={rowDraft.start_date || ''} onChange={e => updateDraft('start_date',e.target.value)}/></td><td><input type="date" value={rowDraft.end_date || ''} onChange={e => updateDraft('end_date',e.target.value)}/></td><td><textarea value={rowDraft.risks || ''} onChange={e => updateDraft('risks',e.target.value)}/></td><td><textarea value={rowDraft.restrictions || ''} onChange={e => updateDraft('restrictions',e.target.value)}/></td><td><textarea value={rowDraft.support || ''} onChange={e => updateDraft('support',e.target.value)}/></td><td><textarea value={rowDraft.deliverables || ''} onChange={e => updateDraft('deliverables',e.target.value)}/></td><td><textarea value={rowDraft.committee || ''} onChange={e => updateDraft('committee',e.target.value)}/></td>{effectiveCanManage && <td><div className="matrix-v5-row-actions"><button onClick={cancelRowEdit}><X size={14}/></button><button className="save" onClick={() => void saveRow()} disabled={saving}>{saving?<LoaderCircle className="spin" size={14}/>:<Check size={14}/>}</button></div></td>}</tr>}
        {rowsLoading ? <tr><td colSpan={tableColSpan} className="matrix-v5-table-empty"><LoaderCircle className="spin" size={20}/> Cargando matriz...</td></tr> : rows.length===0 && !rowFormOpen ? <tr><td colSpan={tableColSpan} className="matrix-v5-table-empty">La matriz está lista. Presiona “Nueva fila” para comenzar.</td></tr> : rows.map((row,index) => {
          if (editingRowId === row.id) return null
          const previous = index > 0 ? (rows[index - 1].objective_group || '').trim() : ''
          const current = (row.objective_group || '').trim()
          const show = Boolean(current && current !== previous)
          const responsible = row.responsible_manager_id
            ? managerById.get(row.responsible_manager_id)?.name || row.responsible_text || '—'
            : row.responsible_text || '—'

          if (unitCode !== 'CENTRAL') return <Fragment key={row.id}>
            {show && <tr className="matrix-v5-objective-row"><td colSpan={tableColSpan}>{current}</td></tr>}
            <tr>
              <td className="matrix-v5-action-cell">{row.objective || '—'}</td>
              <td>{row.responsible_manager_id || row.responsible_text ? <span className="matrix-v5-person-chip">{responsible}</span> : '—'}</td>
              <td>{row.priority ? <span className={`matrix-v5-priority matrix-v5-priority--${priorityClass(row.priority)}`}>{row.priority}</span> : '—'}</td>
              <td>{row.milestones || '—'}</td><td>{row.kpi || '—'}</td><td>{formatDate(row.start_date)}</td><td>{formatDate(row.end_date)}</td>
              <td>{row.risks || '—'}</td><td>{row.restrictions || '—'}</td><td>{row.support || '—'}</td><td>{row.deliverables || '—'}</td><td>{row.committee || '—'}</td>
              {effectiveCanManage && <td><div className="matrix-v5-row-actions"><button onClick={() => startEditRow(row)}><Pencil size={14}/></button><button className="danger" onClick={() => void deleteRow(row.id)}><Trash2 size={14}/></button></div></td>}
            </tr>
          </Fragment>

          const centralRows = centralRowsFor(row)
          const rowSpan = centralRows.length
          return <Fragment key={row.id}>
            {show && <tr className="matrix-v5-objective-row matrix-v10-lineamiento-row"><td colSpan={tableColSpan}><strong>Lineamiento</strong><span>{current}</span></td></tr>}
            {centralRows.map((detail, detailIndex) => <tr className={`matrix-v10-central-subpoint-row ${detailIndex === 0 ? 'matrix-v10-central-subpoint-row--first' : ''}`} key={`${row.id}-${detail.index}`}>
              {detailIndex === 0 && <td className="matrix-v5-number" rowSpan={rowSpan}>{index + 1}</td>}
              {detailIndex === 0 && <td className="matrix-v5-action-cell matrix-v10-central-objective" rowSpan={rowSpan}><strong>{row.objective || '—'}</strong></td>}
              <td><div className="matrix-v10-central-subpoint"><span className="matrix-v10-subpoint-badge">{detail.label}</span><span>{detail.subpoint}</span></div></td>
              {detailIndex === 0 && <td rowSpan={rowSpan}>{row.responsible_manager_id || row.responsible_text ? <span className="matrix-v5-person-chip">{responsible}</span> : '—'}</td>}
              {detailIndex === 0 && <td rowSpan={rowSpan}>{row.priority ? <span className={`matrix-v5-priority matrix-v5-priority--${priorityClass(row.priority)}`}>{row.priority}</span> : '—'}</td>}
              <td>{detail.milestones}</td><td>{detail.kpi}</td><td>{formatDate(detail.startDate)}</td><td>{formatDate(detail.endDate)}</td>
              {detailIndex === 0 && <td rowSpan={rowSpan}>{row.risks || '—'}</td>}
              {detailIndex === 0 && <td rowSpan={rowSpan}>{row.restrictions || '—'}</td>}
              {detailIndex === 0 && <td rowSpan={rowSpan}>{row.support || '—'}</td>}
              {detailIndex === 0 && <td rowSpan={rowSpan}>{row.deliverables || '—'}</td>}
              {detailIndex === 0 && <td rowSpan={rowSpan}>{row.committee || '—'}</td>}
              {detailIndex === 0 && effectiveCanManage && <td rowSpan={rowSpan}><div className="matrix-v5-row-actions"><button onClick={() => startEditRow(row)}><Pencil size={14}/></button><button className="danger" onClick={() => void deleteRow(row.id)}><Trash2 size={14}/></button></div></td>}
            </tr>)}
          </Fragment>
        })}
      </tbody></table></div></div>
      <div className="matrix-v5-footer"><span>{rows.length} registro{rows.length===1?'':'s'}</span><small>{expanded?'Usa los controles de zoom o presiona Esc para salir':'Desplázate horizontalmente solo dentro de la tabla'}</small></div>
    </section>}

    {historyOpen && <div className="matrix-v10-history-backdrop" role="presentation" onMouseDown={event => { if(event.currentTarget===event.target) setHistoryOpen(false) }}><section className="matrix-v10-history-dialog"><header><div><span>Historial de versiones</span><h3>{selectedArea?.name || 'Matriz'} · {year}</h3></div><button onClick={() => setHistoryOpen(false)}><X size={18}/></button></header>{historyLoading ? <div className="matrix-v10-history-loading"><LoaderCircle className="spin" size={20}/> Cargando historial...</div> : versions.length===0 ? <div className="matrix-v10-history-empty">Todavía no hay versiones registradas.</div> : <div className="matrix-v10-history-list">{versions.map(version => <article key={version.id}><div className="matrix-v10-version-number">v{version.version_no}</div><div><strong>{historyActionLabel(version.action)}</strong><span>{formatDateTime(version.created_at)}</span><small>{version.changed_email || 'Versión del sistema'} · {Array.isArray(version.snapshot?.rows) ? version.snapshot?.rows?.length : 0} filas</small></div></article>)}</div>}</section></div>}
  </div>
}
