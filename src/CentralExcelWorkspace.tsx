import { CSSProperties, Fragment, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Building2, Download, History, LoaderCircle, Maximize2, Minimize2, Plus, RotateCcw, Trash2, X, ZoomIn, ZoomOut } from 'lucide-react'
import { supabase } from './lib/supabase'
import { actionPlanFromSubpoints, buildCentralSubpointDrafts, findIncompleteCentralSubpoint, normalizeCentralSubpointRows, type CentralSubpointDraft, type CentralSubpointRecord } from './central-subpoint-records.js'
import './matrix-workspace-v5.css'
import './matrix-workspace-v10.css'
import './central-excel-workspace.css'

type Area = { id: string; name: string; unit_code: string; directory_group: string }
type Process = { id: string; management_id: string; unit_code: string }
type Matrix = { id: string; name: string; process_id: string; status: string; guideline_id: string | null }
type Manager = { id: string; name: string; cargo: string | null; unit_code: string; directory_group: string }
type ManagerManagement = { manager_id: string; management_id: string }
type Guideline = { id: string; management_id: string; code: string | null; responsible_manager_id: string | null; guideline_text: string }
type MatrixRow = {
  id: string
  guideline_id: string | null
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
type RowResponsible = { row_id: string; manager_id: string; sort_order: number }
type PersistedCentralSubpoint = CentralSubpointRecord & { id: string; matrix_row_id: string; sort_order: number }
type MatrixVersion = { id: string; version_no: number; action: string; changed_email: string | null; created_at: string; snapshot: { rows?: unknown[] } | null }
type RowDraft = Omit<MatrixRow, 'id' | 'sort_order'>
type Props = {
  periodId: string
  year: number
  unitCode: 'CENTRAL'
  unitName: string
  canManage: boolean
  onError: (message: string) => void
  onNotice: (message: string) => void
  onActiveMatrixChange?: (matrixId: string) => void
  onGuidelineContextChange?: (context: { managementId: string; guidelineId: string | null }) => void
}

const XLSX_MODULE_URL = 'https://unpkg.com/xlsx@0.18.5/xlsx.mjs'
const emptyRow: RowDraft = {
  guideline_id: null, objective_group: '', objective: '', action_plan: null, responsible_manager_id: null, responsible_text: '', priority: '', milestones: '', kpi: '', target: null,
  start_date: '', end_date: '', risks: '', restrictions: '', support: '', deliverables: '', committee: '', status: 'DRAFT',
}
const emptyCentralSubpoint = (): CentralSubpointDraft => ({ id: null, text: '', milestones: '', kpi: '', start_date: '', end_date: '' })

function normalizeText(value: unknown) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/\s+/g, ' ')
}
function textValue(value: unknown) { return String(value ?? '').trim() }
function formatDate(value: string | null) {
  if (!value) return '—'
  const [year, month, day] = value.split('-')
  return year && month && day ? `${day}/${month}/${year}` : value
}
function formatDateTime(value: string) {
  try { return new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) } catch { return value }
}
function priorityClass(value: string | null) {
  const normalized = normalizeText(value)
  if (normalized === 'alta') return 'high'
  if (normalized === 'media') return 'medium'
  if (normalized === 'baja') return 'low'
  return 'none'
}
function historyActionLabel(value: string) {
  if (value === 'BASELINE') return 'Versión inicial'
  if (value === 'ROW_INSERT') return 'Fila agregada'
  if (value === 'ROW_UPDATE') return 'Fila actualizada'
  if (value === 'ROW_DELETE') return 'Fila eliminada'
  if (value === 'MATRIX_UPDATE') return 'Matriz actualizada'
  if (value === 'RESTORE') return 'Versión restaurada'
  return value.replaceAll('_', ' ').toLowerCase()
}

export default function CentralExcelWorkspace({ periodId, year, unitName, canManage, onError, onNotice, onActiveMatrixChange, onGuidelineContextChange }: Props) {
  const [page, setPage] = useState<'areas' | 'sheet'>('areas')
  const [areas, setAreas] = useState<Area[]>([])
  const [processes, setProcesses] = useState<Process[]>([])
  const [matrices, setMatrices] = useState<Matrix[]>([])
  const [managers, setManagers] = useState<Manager[]>([])
  const [managerManagements, setManagerManagements] = useState<ManagerManagement[]>([])
  const [guidelines, setGuidelines] = useState<Guideline[]>([])
  const [rows, setRows] = useState<MatrixRow[]>([])
  const [centralResponsibleIdsByRow, setCentralResponsibleIdsByRow] = useState<Record<string, string[]>>({})
  const [centralSubpointsByRow, setCentralSubpointsByRow] = useState<Record<string, PersistedCentralSubpoint[]>>({})
  const [selectedAreaId, setSelectedAreaId] = useState('')
  const [selectedMatrixId, setSelectedMatrixId] = useState('')
  const [loading, setLoading] = useState(true)
  const [rowsLoading, setRowsLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [editingRowId, setEditingRowId] = useState<string | null>(null)
  const [rowFormOpen, setRowFormOpen] = useState(false)
  const [rowDraft, setRowDraft] = useState<RowDraft>(emptyRow)
  const [selectedRowGuidelineId, setSelectedRowGuidelineId] = useState<string | null>(null)
  const [selectedResponsibleIds, setSelectedResponsibleIds] = useState<string[]>([])
  const [responsiblePickerOpen, setResponsiblePickerOpen] = useState(false)
  const [centralSubpointDrafts, setCentralSubpointDrafts] = useState<CentralSubpointDraft[]>([emptyCentralSubpoint()])
  const [areaCanEdit, setAreaCanEdit] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [versions, setVersions] = useState<MatrixVersion[]>([])
  const responsiblePickerRef = useRef<HTMLDivElement | null>(null)
  const loadRowsRequestRef = useRef(0)

  const selectedArea = areas.find(item => item.id === selectedAreaId) || null
  const selectedMatrix = matrices.find(item => item.id === selectedMatrixId) || null
  const managerById = useMemo(() => new Map(managers.map(item => [item.id, item])), [managers])
  const areaGuidelines = useMemo(() => guidelines.filter(item => item.management_id === selectedAreaId), [guidelines, selectedAreaId])
  const centralManagers = useMemo(() => {
    const allowed = new Set(managerManagements.filter(item => item.management_id === selectedAreaId).map(item => item.manager_id))
    return managers.filter(manager => allowed.has(manager.id)).sort((a, b) => a.name.localeCompare(b.name, 'es'))
  }, [managerManagements, managers, selectedAreaId])
  const effectiveCanManage = canManage || areaCanEdit
  const tableColSpan = 12
  const zoomStyle = { '--matrix-zoom': zoom } as CSSProperties

  const selectedGuideline = useMemo(() => areaGuidelines[0] || null, [areaGuidelines])
  const guidelineContextId = useMemo(() => {
    if (selectedRowGuidelineId) return selectedRowGuidelineId
    const rowGuidelineIds = [...new Set(rows.map(row => row.guideline_id).filter((id): id is string => Boolean(id)))]
    if (rowGuidelineIds.length === 1) return rowGuidelineIds[0]
    return selectedMatrix?.guideline_id || null
  }, [selectedRowGuidelineId, rows, selectedMatrix?.guideline_id])
  const firstResponsible = useMemo(() => {
    if (selectedGuideline?.responsible_manager_id) return managerById.get(selectedGuideline.responsible_manager_id)?.name || 'Sin asignar'
    const firstRow = rows.find(row => (centralResponsibleIdsByRow[row.id] || []).length || row.responsible_text)
    if (!firstRow) return 'Sin asignar'
    const names = (centralResponsibleIdsByRow[firstRow.id] || []).map(id => managerById.get(id)?.name).filter(Boolean)
    return names.length ? names.join(', ') : firstRow.responsible_text || 'Sin asignar'
  }, [selectedGuideline, managerById, rows, centralResponsibleIdsByRow])

  useEffect(() => { void loadWorkspace() }, [periodId])
  useEffect(() => {
    if (!selectedAreaId) { setAreaCanEdit(false); return }
    void loadAreaEditPermission(selectedAreaId)
  }, [selectedAreaId])
  useEffect(() => {
    if (!selectedMatrixId) { setRows([]); setCentralResponsibleIdsByRow({}); setCentralSubpointsByRow({}); return }
    void loadRows(selectedMatrixId)
  }, [selectedMatrixId])
  useEffect(() => {
    onActiveMatrixChange?.(selectedMatrixId)
    return () => onActiveMatrixChange?.('')
  }, [onActiveMatrixChange, selectedMatrixId])
  useEffect(() => {
    onGuidelineContextChange?.({ managementId: selectedAreaId, guidelineId: selectedAreaId ? guidelineContextId : null })
  }, [guidelineContextId, onGuidelineContextChange, selectedAreaId])
  useEffect(() => {
    if (!responsiblePickerOpen) return
    const handlePointerDown = (event: PointerEvent) => {
      if (!responsiblePickerRef.current?.contains(event.target as Node)) setResponsiblePickerOpen(false)
    }
    const handleKeyDown = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape') setResponsiblePickerOpen(false) }
    document.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => { document.removeEventListener('pointerdown', handlePointerDown); window.removeEventListener('keydown', handleKeyDown) }
  }, [responsiblePickerOpen])
  useEffect(() => {
    const handleRealtimeDataChange = (event: Event) => {
      const detail = (event as CustomEvent<{ matrixId?: string }>).detail
      const changedMatrixId = String(detail?.matrixId || '')
      if (!selectedMatrixId || (changedMatrixId && changedMatrixId !== selectedMatrixId)) return
      void loadRows(selectedMatrixId, true)
    }
    window.addEventListener('matrix-realtime-data-change', handleRealtimeDataChange)
    return () => window.removeEventListener('matrix-realtime-data-change', handleRealtimeDataChange)
  }, [selectedMatrixId])
  useEffect(() => {
    if (!expanded) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape') setExpanded(false) }
    window.addEventListener('keydown', onKeyDown)
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener('keydown', onKeyDown) }
  }, [expanded])

  async function loadWorkspace() {
    if (!supabase) return
    setLoading(true); onError('')
    try {
      const [catalogResult, areaResult, processResult, matrixResult, managerResult, mappingResult, guidelineResult] = await Promise.all([
        supabase.from('matrix_unit_area_catalog').select('management_id').eq('unit_code', 'CENTRAL').order('created_at'),
        supabase.from('managements_global').select('id,name,unit_code,directory_group').eq('unit_code', 'CENTRAL').eq('active', true).order('name'),
        supabase.from('processes').select('id,management_id,unit_code').eq('unit_code', 'CENTRAL').eq('active', true).order('created_at'),
        supabase.from('matrices').select('id,name,process_id,status,guideline_id').eq('period_id', periodId).eq('unit_code', 'CENTRAL').eq('active', true).order('created_at'),
        supabase.from('managers').select('id,name,cargo,unit_code,directory_group').eq('active', true).order('name'),
        supabase.from('manager_managements').select('manager_id,management_id'),
        supabase.from('planning_guidelines').select('id,management_id,code,responsible_manager_id,guideline_text').eq('period_id', periodId).eq('unit_code', 'CENTRAL').eq('active', true).order('sort_order'),
      ])
      if (catalogResult.error || areaResult.error || processResult.error || matrixResult.error || managerResult.error || mappingResult.error || guidelineResult.error) throw new Error('LOAD')
      const allAreas = (areaResult.data || []) as Area[]
      const processData = (processResult.data || []) as Process[]
      const allowedByCatalog = new Set((catalogResult.data || []).map(item => String(item.management_id)))
      const allowedByProcess = new Set(processData.map(item => item.management_id))
      setAreas(allAreas.filter(area => allowedByCatalog.has(area.id) && allowedByProcess.has(area.id)))
      setProcesses(processData)
      setMatrices((matrixResult.data || []) as Matrix[])
      setManagers((managerResult.data || []) as Manager[])
      setManagerManagements((mappingResult.data || []) as ManagerManagement[])
      setGuidelines((guidelineResult.data || []) as Guideline[])
    } catch {
      onError('No pudimos cargar las áreas y matrices de Central.')
    } finally { setLoading(false) }
  }

  async function loadAreaEditPermission(areaId: string) {
    if (!supabase) return
    const { data, error } = await supabase.rpc('can_edit_management', { management_id_input: areaId, unit_code_input: 'CENTRAL' })
    setAreaCanEdit(!error && Boolean(data))
  }

  async function loadRows(matrixId: string, keepEditor = false) {
    if (!supabase) return
    const requestId = ++loadRowsRequestRef.current
    if (!keepEditor) setRowsLoading(true)
    const rowResult = await supabase.from('matrix_rows').select('*').eq('matrix_id', matrixId).order('sort_order').order('created_at')
    if (requestId !== loadRowsRequestRef.current) return
    if (rowResult.error) { setRowsLoading(false); onError('No pudimos cargar la matriz.'); return }
    const nextRows = (rowResult.data || []) as MatrixRow[]
    const rowIds = nextRows.map(row => row.id)
    const [linksResult, subpointsResult] = rowIds.length
      ? await Promise.all([
          supabase.from('matrix_row_responsibles').select('row_id,manager_id,sort_order').in('row_id', rowIds).order('sort_order'),
          supabase.from('matrix_row_subpoints').select('id,matrix_row_id,text,milestones,kpi,start_date,end_date,sort_order').in('matrix_row_id', rowIds).order('sort_order').order('created_at'),
        ])
      : [{ data: [], error: null }, { data: [], error: null }]
    if (requestId !== loadRowsRequestRef.current) return
    if (linksResult.error || subpointsResult.error) {
      setRowsLoading(false)
      onError('No pudimos cargar responsables y subpuntos sin riesgo de perder información.')
      return
    }

    const groupedResponsibleIds: Record<string, string[]> = {}
    ;((linksResult.data || []) as RowResponsible[]).forEach(link => {
      if (!groupedResponsibleIds[link.row_id]) groupedResponsibleIds[link.row_id] = []
      groupedResponsibleIds[link.row_id].push(link.manager_id)
    })
    nextRows.forEach(row => {
      if (!groupedResponsibleIds[row.id]?.length && row.responsible_manager_id) groupedResponsibleIds[row.id] = [row.responsible_manager_id]
    })

    const groupedSubpoints: Record<string, PersistedCentralSubpoint[]> = {}
    ;((subpointsResult.data || []) as PersistedCentralSubpoint[]).forEach(item => {
      if (!groupedSubpoints[item.matrix_row_id]) groupedSubpoints[item.matrix_row_id] = []
      groupedSubpoints[item.matrix_row_id].push(item)
    })

    setRows(nextRows)
    setCentralResponsibleIdsByRow(groupedResponsibleIds)
    setCentralSubpointsByRow(groupedSubpoints)
    setRowsLoading(false)
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
    if (rowFormOpen || !effectiveCanManage) return
    setEditingRowId(null)
    setRowDraft({ ...emptyRow })
    setSelectedRowGuidelineId(null)
    setSelectedResponsibleIds([])
    setResponsiblePickerOpen(false)
    setCentralSubpointDrafts([emptyCentralSubpoint()])
    setRowFormOpen(true); onError(''); onNotice('')
  }
  function startEditRow(row: MatrixRow) {
    if (!effectiveCanManage || rowFormOpen) return
    const matchedGuidelineId = row.guideline_id || areaGuidelines.find(item => normalizeText(item.guideline_text) === normalizeText(row.objective_group))?.id || null
    setEditingRowId(row.id)
    setRowDraft({
      guideline_id: matchedGuidelineId, objective_group: row.objective_group || '', objective: row.objective || '', action_plan: row.action_plan, responsible_manager_id: row.responsible_manager_id,
      responsible_text: row.responsible_text || '', priority: row.priority || '', milestones: row.milestones || '', kpi: row.kpi || '', target: row.target,
      start_date: row.start_date || '', end_date: row.end_date || '', risks: row.risks || '', restrictions: row.restrictions || '', support: row.support || '',
      deliverables: row.deliverables || '', committee: row.committee || '', status: row.status || 'DRAFT',
    })
    setSelectedRowGuidelineId(matchedGuidelineId)
    setSelectedResponsibleIds(centralResponsibleIdsByRow[row.id] || (row.responsible_manager_id ? [row.responsible_manager_id] : []))
    setResponsiblePickerOpen(false)
    const subpoints = buildCentralSubpointDrafts(centralSubpointsByRow[row.id] || [], row)
    setCentralSubpointDrafts(subpoints.length ? subpoints : [emptyCentralSubpoint()])
    setRowFormOpen(true); onError(''); onNotice('')
  }
  function cancelRowEdit() {
    setEditingRowId(null); setRowFormOpen(false); setRowDraft(emptyRow); setSelectedRowGuidelineId(null); setSelectedResponsibleIds([]); setResponsiblePickerOpen(false); setCentralSubpointDrafts([emptyCentralSubpoint()])
  }
  function updateDraft<K extends keyof RowDraft>(key: K, value: RowDraft[K]) { setRowDraft(current => ({ ...current, [key]: value })) }
  function toggleResponsible(managerId: string) {
    setSelectedResponsibleIds(current => current.includes(managerId) ? current.filter(id => id !== managerId) : [...current, managerId])
  }
  function selectGuideline(guidelineId: string) {
    const guideline = areaGuidelines.find(item => item.id === guidelineId) || null
    setSelectedRowGuidelineId(guideline?.id || null)
    updateDraft('guideline_id', guideline?.id || null)
    updateDraft('objective_group', guideline?.guideline_text || '')
  }
  function updateCentralSubpoint(index: number, key: keyof CentralSubpointDraft, value: string) {
    setCentralSubpointDrafts(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item))
  }

  async function saveRow() {
  if (!supabase || !selectedMatrix || !effectiveCanManage || saving) return
  const subpointRows = normalizeCentralSubpointRows(centralSubpointDrafts)
  const incompleteSubpointIndex = findIncompleteCentralSubpoint(subpointRows)
  if (incompleteSubpointIndex >= 0) {
    onError(`Escribe el texto del subpunto S${incompleteSubpointIndex + 1} antes de guardar.`)
    return
  }
  setSaving(true); onError(''); onNotice('')
  const previousRow = editingRowId ? rows.find(row => row.id === editingRowId) || null : null
  const responsibleNames = selectedResponsibleIds.map(id => managerById.get(id)?.name).filter((name): name is string => Boolean(name))
  const payload = {
    matrix_id: selectedMatrix.id,
    guideline_id: selectedRowGuidelineId || rowDraft.guideline_id || null,
    objective_group: textValue(rowDraft.objective_group) || null,
    objective: textValue(rowDraft.objective) || null,
    action_plan: actionPlanFromSubpoints(subpointRows) || null,
    responsible_manager_id: selectedResponsibleIds[0] || null,
    responsible_text: responsibleNames.length ? responsibleNames.join(', ') : null,
    priority: rowDraft.priority || null,
    milestones: rowDraft.milestones || null,
    kpi: rowDraft.kpi || null,
    target: null,
    start_date: rowDraft.start_date || null,
    end_date: rowDraft.end_date || null,
    risks: rowDraft.risks || null,
    restrictions: rowDraft.restrictions || null,
    support: rowDraft.support || null,
    deliverables: rowDraft.deliverables || null,
    committee: rowDraft.committee || null,
    status: rowDraft.status,
    sort_order: editingRowId ? previousRow?.sort_order || 0 : rows.length,
  }

  let rowId = editingRowId
  let created = false
  const rollbackParentRow = async () => {
    if (!rowId) return true
    if (created) {
      const { error } = await supabase.from('matrix_rows').delete().eq('id', rowId)
      return !error
    }
    if (!previousRow) return false
    const { error } = await supabase.from('matrix_rows').update({
      guideline_id: previousRow.guideline_id,
      objective_group: previousRow.objective_group,
      objective: previousRow.objective,
      action_plan: previousRow.action_plan,
      responsible_manager_id: previousRow.responsible_manager_id,
      responsible_text: previousRow.responsible_text,
      priority: previousRow.priority,
      milestones: previousRow.milestones,
      kpi: previousRow.kpi,
      target: previousRow.target,
      start_date: previousRow.start_date,
      end_date: previousRow.end_date,
      risks: previousRow.risks,
      restrictions: previousRow.restrictions,
      support: previousRow.support,
      deliverables: previousRow.deliverables,
      committee: previousRow.committee,
      status: previousRow.status,
      sort_order: previousRow.sort_order,
    }).eq('id', rowId)
    return !error
  }
  if (editingRowId) {
    const { error } = await supabase.from('matrix_rows').update(payload).eq('id', editingRowId)
    if (error) { setSaving(false); onError('No pudimos actualizar la acción.'); return }
  } else {
    const { data, error } = await supabase.from('matrix_rows').insert(payload).select('id').single()
    if (error || !data?.id) { setSaving(false); onError('No pudimos agregar la acción.'); return }
    rowId = String(data.id); created = true
  }

  if (rowId) {
    const previousIds = centralResponsibleIdsByRow[rowId] || []
    const previousSubpoints = centralSubpointsByRow[rowId] || []
    const restoreResponsibles = async () => {
      const removeResult = await supabase.from('matrix_row_responsibles').delete().eq('row_id', rowId)
      if (removeResult.error) return false
      if (!previousIds.length) return true
      const restoreResult = await supabase.from('matrix_row_responsibles').insert(previousIds.map((managerId, index) => ({ row_id: rowId, manager_id: managerId, sort_order: index })))
      return !restoreResult.error
    }
    const restoreSubpoints = async () => {
      const removeResult = await supabase.from('matrix_row_subpoints').delete().eq('matrix_row_id', rowId)
      if (removeResult.error) return false
      if (!previousSubpoints.length) return true
      const restoreResult = await supabase.from('matrix_row_subpoints').insert(previousSubpoints.map(item => ({
        matrix_row_id: rowId,
        text: textValue(item.text),
        milestones: textValue(item.milestones) || null,
        kpi: textValue(item.kpi) || null,
        start_date: textValue(item.start_date) || null,
        end_date: textValue(item.end_date) || null,
        sort_order: item.sort_order,
      })))
      return !restoreResult.error
    }
    const deleteResult = await supabase.from('matrix_row_responsibles').delete().eq('row_id', rowId)
    if (deleteResult.error) {
      const parentRestored = await rollbackParentRow()
      setSaving(false)
      await loadRows(selectedMatrix.id, true)
      onError(parentRestored ? 'No pudimos actualizar los responsables. No se conservaron cambios parciales.' : 'No pudimos actualizar los responsables ni confirmar la reversión. Recarga la matriz antes de continuar.')
      return
    }
    if (selectedResponsibleIds.length) {
      const insertResult = await supabase.from('matrix_row_responsibles').insert(selectedResponsibleIds.map((managerId, index) => ({ row_id: rowId, manager_id: managerId, sort_order: index })))
      if (insertResult.error) {
        const responsiblesRestored = await restoreResponsibles()
        const parentRestored = await rollbackParentRow()
        setSaving(false)
        await loadRows(selectedMatrix.id, true)
        onError(responsiblesRestored && parentRestored ? 'No pudimos guardar los responsables seleccionados. No se conservaron cambios parciales.' : 'No pudimos guardar los responsables ni confirmar la reversión completa. Recarga la matriz antes de continuar.')
        return
      }
    }

    const deleteSubpointsResult = await supabase.from('matrix_row_subpoints').delete().eq('matrix_row_id', rowId)
    if (deleteSubpointsResult.error) {
      const responsiblesRestored = await restoreResponsibles()
      const parentRestored = await rollbackParentRow()
      setSaving(false)
      await loadRows(selectedMatrix.id, true)
      onError(responsiblesRestored && parentRestored ? 'No pudimos preparar los subpuntos para guardar. No se conservaron cambios parciales.' : 'No pudimos preparar los subpuntos ni confirmar la reversión completa. Recarga la matriz antes de continuar.')
      return
    }
    if (subpointRows.length) {
      const insertSubpointsResult = await supabase.from('matrix_row_subpoints').insert(subpointRows.map(item => ({ ...item, matrix_row_id: rowId })))
      if (insertSubpointsResult.error) {
        const subpointsRestored = await restoreSubpoints()
        const responsiblesRestored = await restoreResponsibles()
        const parentRestored = await rollbackParentRow()
        setSaving(false)
        await loadRows(selectedMatrix.id, true)
        onError(subpointsRestored && responsiblesRestored && parentRestored ? 'No pudimos guardar los subpuntos. No se conservaron cambios parciales.' : 'No pudimos guardar los subpuntos ni confirmar la reversión completa. Recarga la matriz antes de continuar.')
        return
      }
    }
  }

  const wasEditing = Boolean(editingRowId)
  setSaving(false); cancelRowEdit(); onNotice(wasEditing ? 'Acción actualizada.' : 'Acción agregada.'); await loadRows(selectedMatrix.id)
}
  async function deleteRow(rowId: string) {
    if (!supabase || !selectedMatrix || !effectiveCanManage) return
    const { error } = await supabase.from('matrix_rows').delete().eq('id', rowId)
    if (error) { onError('No pudimos eliminar la acción.'); return }
    if (editingRowId === rowId) cancelRowEdit()
    onNotice('Acción eliminada.'); await loadRows(selectedMatrix.id)
  }

  function handleEditKeyDown(event: KeyboardEvent<HTMLTableRowElement>) {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); void saveRow() }
    if (event.key === 'Escape') {
      event.preventDefault()
      if (responsiblePickerOpen) { setResponsiblePickerOpen(false); return }
      cancelRowEdit()
    }
  }

  async function exportExcel() {
    if (!selectedMatrix) return
    setExporting(true); onError('')
    try {
      const XLSX = await import(/* @vite-ignore */ XLSX_MODULE_URL)
      const headers = ['ACCIÓN','RESPONSABLE','PRIORIDAD','Hitos / Fechas','KPI (Cuantitativo)','INICIO','FIN','RIESGOS DE NO EJECUTAR','RESTRICCIONES','SOPORTE','ENTREGABLE','COMITÉ']
      const grid: unknown[][] = [[`PLAN DE ACCIÓN ${year}`], [`UNIDAD: Central - ${selectedArea?.name || ''}`, `Responsable: ${firstResponsible}`], [], headers]
      const groupRows: number[] = []
      let previousGroup = ''
      rows.forEach(row => {
        const group = textValue(row.objective_group)
        if (group && group !== previousGroup) { grid.push([group]); groupRows.push(grid.length - 1); previousGroup = group }
        const responsible = (centralResponsibleIdsByRow[row.id] || []).map(id => managerById.get(id)?.name).filter(Boolean).join(', ') || row.responsible_text || ''
        grid.push([row.objective || '', responsible, row.priority || '', row.milestones || '', row.kpi || '', row.start_date || '', row.end_date || '', row.risks || '', row.restrictions || '', row.support || '', row.deliverables || '', row.committee || ''])
        buildCentralSubpointDrafts(centralSubpointsByRow[row.id] || [], row).forEach((subpoint, index) => {
          grid.push([`S${index + 1}: ${subpoint.text}`, '', '', subpoint.milestones, subpoint.kpi, subpoint.start_date, subpoint.end_date, '', '', '', '', ''])
        })
      })
      const sheet = XLSX.utils.aoa_to_sheet(grid)
      sheet['!merges'] = groupRows.map(row => ({ s: { r: row, c: 0 }, e: { r: row, c: headers.length - 1 } }))
      sheet['!cols'] = [{ wch: 60 }, { wch: 30 }, { wch: 14 }, { wch: 26 }, { wch: 28 }, { wch: 14 }, { wch: 14 }, { wch: 32 }, { wch: 26 }, { wch: 28 }, { wch: 26 }, { wch: 24 }]
      const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, sheet, 'Plan de Acción')
      XLSX.writeFile(workbook, `Plan_de_Accion_Central_${selectedArea?.name || 'Area'}_${year}.xlsx`)
    } catch { onError('No pudimos exportar la matriz a Excel.') } finally { setExporting(false) }
  }


  async function openHistory() {
    if (!supabase || !selectedMatrix) return
    setHistoryOpen(true); setHistoryLoading(true); setVersions([])
    const { data, error } = await supabase.from('matrix_versions').select('id,version_no,action,changed_email,created_at,snapshot').eq('matrix_id', selectedMatrix.id).order('version_no', { ascending: false })
    setHistoryLoading(false)
    if (error) { onError('No pudimos cargar el historial de la matriz.'); return }
    setVersions((data || []) as MatrixVersion[])
  }

  function renderResponsiblePicker() {
    const selectedNames = selectedResponsibleIds.map(id => managerById.get(id)?.name).filter(Boolean)
    return <div ref={responsiblePickerRef} className="matrix-central-responsible-picker">
      <button type="button" className="matrix-central-responsible-trigger" aria-expanded={responsiblePickerOpen} onClick={() => setResponsiblePickerOpen(value => !value)}>{selectedNames.length ? <span className="matrix-central-summary-chips">{selectedNames.map(name => <i key={name}>{name}</i>)}</span> : <span>Seleccionar responsables</span>}</button>
      {responsiblePickerOpen && <div className="matrix-central-responsible-menu">
        <div className="matrix-central-responsible-menu-head"><strong>Responsables</strong><button type="button" className="matrix-central-responsible-close" title="Cerrar responsables" onClick={() => setResponsiblePickerOpen(false)}><X size={14}/></button></div>
        {centralManagers.length === 0 ? <small>No hay bonistas asignados a esta área.</small> : centralManagers.map(manager => <label key={manager.id}><input type="checkbox" checked={selectedResponsibleIds.includes(manager.id)} onChange={() => toggleResponsible(manager.id)}/><span><strong>{manager.name}</strong>{manager.cargo && <small>{manager.cargo}</small>}</span></label>)}
      </div>}
    </div>
  }

  function renderObjectiveGroupEditor() {
    return <div className="matrix-central-objective-toolbar"><div className="matrix-central-objective-edit"><strong>LINEAMIENTO</strong><select value={selectedRowGuidelineId || ''} onChange={event => selectGuideline(event.target.value)}><option value="">Selecciona un lineamiento</option>{areaGuidelines.map(guideline => <option key={guideline.id} value={guideline.id}>{guideline.code ? `${guideline.code} · ` : ''}{guideline.guideline_text}</option>)}</select></div></div>
  }

  function renderSpreadsheetDraftRows(key: string) {
    const sharedRowSpan = centralSubpointDrafts.length + 1
    return <>
      <tr className="matrix-v5-edit-row matrix-central-objective-editor-row" key={`${key}-group`}><td colSpan={tableColSpan}>{renderObjectiveGroupEditor()}</td></tr>
      <tr className="matrix-v5-edit-row matrix-v10-central-excel-row matrix-v10-central-excel-row--editing matrix-central-in-grid-draft" key={`${key}-row`} onKeyDown={handleEditKeyDown}>
        <td className="matrix-central-sheet-cell matrix-central-sheet-cell--action"><textarea rows={1} value={rowDraft.objective || ''} onChange={event => updateDraft('objective', event.target.value)} placeholder="Acción" aria-label="Acción" autoFocus/></td>
        <td className="matrix-central-sheet-cell matrix-central-sheet-cell--responsible" rowSpan={sharedRowSpan}><div className="matrix-central-responsible-editor"><div className="matrix-central-responsible-editor-actions"><button type="button" onClick={() => setCentralSubpointDrafts(current => [...current, emptyCentralSubpoint()])}><Plus size={13}/> Añadir subpunto</button><button type="button" className="save" data-edit-action="save" onClick={() => void saveRow()} disabled={saving}>{saving && <LoaderCircle className="spin" size={13}/>} Guardar</button><button type="button" data-edit-action="cancel" onClick={cancelRowEdit}>Cancelar</button>{editingRowId && <button type="button" className="danger" data-edit-action="delete" onClick={() => void deleteRow(editingRowId)}><Trash2 size={13}/> Eliminar acción</button>}</div>{renderResponsiblePicker()}</div></td>
        <td className="matrix-central-sheet-cell" rowSpan={sharedRowSpan}><select value={rowDraft.priority || ''} onChange={event => updateDraft('priority', event.target.value)} aria-label="Prioridad"><option value="">—</option><option>Alta</option><option>Media</option><option>Baja</option></select></td>
        <td className="matrix-central-sheet-cell"><textarea rows={1} value={rowDraft.milestones || ''} onChange={event => updateDraft('milestones', event.target.value)} placeholder="Hito o fecha" aria-label="Hitos o fechas"/></td>
        <td className="matrix-central-sheet-cell"><textarea rows={1} value={rowDraft.kpi || ''} onChange={event => updateDraft('kpi', event.target.value)} placeholder="KPI" aria-label="KPI cuantitativo"/></td>
        <td className="matrix-central-sheet-cell"><input type="date" value={rowDraft.start_date || ''} onChange={event => updateDraft('start_date', event.target.value)} aria-label="Inicio"/></td>
        <td className="matrix-central-sheet-cell"><input type="date" value={rowDraft.end_date || ''} onChange={event => updateDraft('end_date', event.target.value)} aria-label="Fin"/></td>
        <td className="matrix-central-sheet-cell" rowSpan={sharedRowSpan}><textarea rows={1} value={rowDraft.risks || ''} onChange={event => updateDraft('risks', event.target.value)} placeholder="Riesgos" aria-label="Riesgos de no ejecutar"/></td>
        <td className="matrix-central-sheet-cell" rowSpan={sharedRowSpan}><textarea rows={1} value={rowDraft.restrictions || ''} onChange={event => updateDraft('restrictions', event.target.value)} placeholder="Restricciones" aria-label="Restricciones"/></td>
        <td className="matrix-central-sheet-cell" rowSpan={sharedRowSpan}><textarea rows={1} value={rowDraft.support || ''} onChange={event => updateDraft('support', event.target.value)} placeholder="Soporte" aria-label="Soporte"/></td>
        <td className="matrix-central-sheet-cell" rowSpan={sharedRowSpan}><textarea rows={1} value={rowDraft.deliverables || ''} onChange={event => updateDraft('deliverables', event.target.value)} placeholder="Entregable" aria-label="Entregable"/></td>
        <td className="matrix-central-sheet-cell" rowSpan={sharedRowSpan}><textarea rows={1} value={rowDraft.committee || ''} onChange={event => updateDraft('committee', event.target.value)} placeholder="Comité" aria-label="Comité"/></td>
      </tr>
      {centralSubpointDrafts.map((subpoint, index) => <tr className="matrix-v5-edit-row matrix-central-subpoint-row matrix-central-subpoint-row--editing" key={`${key}-subpoint-${subpoint.id || 'new'}-${index}`} onKeyDown={handleEditKeyDown}>
        <td className="matrix-central-sheet-cell matrix-central-subpoint-cell"><div><span className="matrix-central-subpoint-badge">S{index + 1}</span><textarea rows={1} value={subpoint.text} onChange={event => updateCentralSubpoint(index, 'text', event.target.value)} placeholder={`Subpunto ${index + 1}`} aria-label={`Subpunto ${index + 1}`}/><button type="button" title="Eliminar subpunto" disabled={centralSubpointDrafts.length === 1} onClick={() => setCentralSubpointDrafts(current => current.length === 1 ? current : current.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={13}/></button></div></td>
        <td className="matrix-central-sheet-cell"><textarea rows={1} value={subpoint.milestones} onChange={event => updateCentralSubpoint(index, 'milestones', event.target.value)} placeholder="Hito o fecha" aria-label={`Hito del subpunto ${index + 1}`}/></td>
        <td className="matrix-central-sheet-cell"><textarea rows={1} value={subpoint.kpi} onChange={event => updateCentralSubpoint(index, 'kpi', event.target.value)} placeholder="KPI" aria-label={`KPI del subpunto ${index + 1}`}/></td>
        <td className="matrix-central-sheet-cell"><input type="date" value={subpoint.start_date} onChange={event => updateCentralSubpoint(index, 'start_date', event.target.value)} aria-label={`Inicio del subpunto ${index + 1}`}/></td>
        <td className="matrix-central-sheet-cell"><input type="date" value={subpoint.end_date} onChange={event => updateCentralSubpoint(index, 'end_date', event.target.value)} aria-label={`Fin del subpunto ${index + 1}`}/></td>
      </tr>)}
    </>
  }

  return <div className={`matrix-v5 matrix-v10 matrix-v5--central ${page === 'sheet' ? 'matrix-v5--sheet' : ''} ${expanded ? 'matrix-v5--expanded' : ''}`}>
    {page === 'areas' && <>
      <section className="matrix-v5-intro"><div><span>Periodo {year} · CENTRAL</span><h3>Matrices de {unitName}</h3><p>Selecciona el área Central. Los responsables disponibles dentro de cada matriz se filtrarán según los bonistas asignados a esa área.</p></div></section>
      {loading ? <div className="matrix-v5-loading"><LoaderCircle className="spin" size={22}/> Cargando matrices...</div> : <section className="matrix-v5-stage"><div className="matrix-v5-stage-head"><small>Áreas habilitadas</small><h4>Selecciona un área</h4></div>{areas.length === 0 ? <div className="matrix-v5-empty"><Building2 size={24}/><strong>No tienes áreas disponibles</strong></div> : <div className="matrix-v5-area-grid">{areas.map(area => <button className="matrix-v5-area-card" key={area.id} onClick={() => openArea(area)}><span><Building2 size={20}/></span><div><strong>{area.name}</strong><small>{matrixForArea(area.id) ? 'Matriz lista para abrir' : 'Sin matriz disponible'}</small></div><ArrowRight size={17}/></button>)}</div>}</section>}
    </>}

    {page === 'sheet' && selectedMatrix && <section className="matrix-v5-plan-shell">
      <div className="matrix-v5-toolbar"><div className="matrix-v5-toolbar-actions">
        <button className="matrix-v5-secondary" onClick={() => setExpanded(value => !value)}>{expanded ? <Minimize2 size={16}/> : <Maximize2 size={16}/>} {expanded ? 'Salir de pantalla completa' : 'Expandir matriz'}</button>
        {expanded && <div className="matrix-v5-zoom"><button title="Alejar" onClick={() => setZoom(value => Math.max(.75, +(value - .1).toFixed(2)))}><ZoomOut size={15}/></button><span>{Math.round(zoom * 100)}%</span><button title="Acercar" onClick={() => setZoom(value => Math.min(1.4, +(value + .1).toFixed(2)))}><ZoomIn size={15}/></button><button title="Restablecer zoom" onClick={() => setZoom(1)}><RotateCcw size={14}/></button></div>}
        <button className="matrix-v5-secondary" onClick={() => void openHistory()}><History size={16}/> Historial</button>
        <button className="matrix-v5-secondary" onClick={() => void exportExcel()} disabled={exporting}><Download size={16}/>{exporting ? 'Exportando...' : 'Exportar Excel'}</button>
        {effectiveCanManage && <button className="matrix-v5-primary" onClick={startNewRow}><Plus size={16}/> Nueva fila</button>}
      </div></div>

      <div className="matrix-v5-title"><span>Matriz de Plan de Acción</span><h2>PLAN DE ACCIÓN {year}</h2></div>
      <div className="matrix-v5-summary"><div><span>Área</span><strong>{selectedArea?.name || '—'}</strong></div><div><span>Unidad</span><strong>Central</strong></div><div><span>Responsable principal</span><strong>{firstResponsible}</strong></div></div>

      <div className="matrix-v5-sheet-card"><div className="matrix-v5-sheet-scroll" style={zoomStyle}><table className="matrix-v5-sheet matrix-v10-central-excel matrix-central-spreadsheet-grid"><thead><tr><th>Acción</th><th>Responsable</th><th>Prioridad</th><th>Hitos / Fechas</th><th>KPI (Cuantitativo)</th><th>Inicio</th><th>Fin</th><th>Riesgos de no ejecutar</th><th>Restricciones</th><th>Soporte</th><th>Entregable</th><th>Comité</th></tr></thead><tbody>
        {rowsLoading ? <tr><td colSpan={tableColSpan} className="matrix-v5-table-empty"><LoaderCircle className="spin" size={20}/> Cargando matriz...</td></tr> : rows.length === 0 && !rowFormOpen ? <tr><td colSpan={tableColSpan} className="matrix-v5-table-empty">La matriz está lista. Presiona “Nueva fila” para comenzar.</td></tr> : rows.map((row, index) => {
          const currentGroup = textValue(row.objective_group)
          const previousGroup = index > 0 ? textValue(rows[index - 1].objective_group) : ''
          const showGroup = Boolean(currentGroup && currentGroup !== previousGroup)
          if (editingRowId === row.id) return <Fragment key={row.id}>{renderSpreadsheetDraftRows(`edit-${row.id}`)}</Fragment>
          const responsibleIds = centralResponsibleIdsByRow[row.id] || (row.responsible_manager_id ? [row.responsible_manager_id] : [])
          const responsibleNames = responsibleIds.map(id => managerById.get(id)?.name).filter(Boolean)
          const subpoints = buildCentralSubpointDrafts(centralSubpointsByRow[row.id] || [], row)
          const sharedRowSpan = subpoints.length + 1
          return <Fragment key={row.id}>
            {showGroup && <tr className="matrix-v5-objective-row matrix-central-objective-group"><td colSpan={tableColSpan}>{currentGroup}</td></tr>}
            <tr data-matrix-row-id={row.id} className={`matrix-v10-central-excel-row ${effectiveCanManage ? 'matrix-v10-central-excel-row--editable' : ''}`} onClick={() => startEditRow(row)}>
              <td className="matrix-v5-action-cell">{row.objective || '—'}</td>
              <td rowSpan={sharedRowSpan}>{responsibleNames.length ? <div className="matrix-central-responsible-chips">{responsibleNames.map(name => <span key={name}>{name}</span>)}</div> : row.responsible_text || '—'}</td>
              <td rowSpan={sharedRowSpan}>{row.priority ? <span className={`matrix-v5-priority matrix-v5-priority--${priorityClass(row.priority)}`}>{row.priority}</span> : '—'}</td>
              <td>{row.milestones || '—'}</td><td>{row.kpi || '—'}</td><td>{formatDate(row.start_date)}</td><td>{formatDate(row.end_date)}</td>
              <td rowSpan={sharedRowSpan}>{row.risks || '—'}</td><td rowSpan={sharedRowSpan}>{row.restrictions || '—'}</td><td rowSpan={sharedRowSpan}>{row.support || '—'}</td><td rowSpan={sharedRowSpan}>{row.deliverables || '—'}</td><td rowSpan={sharedRowSpan}>{row.committee || '—'}</td>
            </tr>
            {subpoints.map((subpoint, subpointIndex) => <tr data-matrix-row-id={row.id} className={`matrix-central-subpoint-row ${effectiveCanManage ? 'matrix-central-subpoint-row--editable' : ''}`} onClick={() => startEditRow(row)} key={`${row.id}-subpoint-${subpoint.id || subpointIndex}`}>
              <td className="matrix-v5-action-cell matrix-central-subpoint-cell"><div><span className="matrix-central-subpoint-badge">S{subpointIndex + 1}</span><span>{subpoint.text || '—'}</span></div></td>
              <td>{subpoint.milestones || '—'}</td><td>{subpoint.kpi || '—'}</td><td>{formatDate(subpoint.start_date || null)}</td><td>{formatDate(subpoint.end_date || null)}</td>
            </tr>)}
          </Fragment>
        })}
        {rowFormOpen && !editingRowId && <Fragment key="new-central-action">{renderSpreadsheetDraftRows('new-central-action')}</Fragment>}
      </tbody></table></div></div>
      <div className="matrix-v5-footer"><span>{rows.length} acción{rows.length === 1 ? '' : 'es'}</span><small>Edición tipo Excel · Tab para avanzar · Ctrl+Enter para guardar</small></div>
    </section>}

    {historyOpen && <div className="matrix-v10-history-backdrop" role="presentation" onMouseDown={event => { if (event.currentTarget === event.target) setHistoryOpen(false) }}><section className="matrix-v10-history-dialog"><header><div><span>Historial de versiones</span><h3>{selectedArea?.name || 'Matriz'} · {year}</h3></div><button onClick={() => setHistoryOpen(false)}><X size={18}/></button></header>{historyLoading ? <div className="matrix-v10-history-loading"><LoaderCircle className="spin" size={20}/> Cargando historial...</div> : versions.length === 0 ? <div className="matrix-v10-history-empty">Todavía no hay versiones registradas.</div> : <div className="matrix-v10-history-list">{versions.map(version => <article key={version.id}><div className="matrix-v10-version-number">v{version.version_no}</div><div><strong>{historyActionLabel(version.action)}</strong><span>{formatDateTime(version.created_at)}</span><small>{version.changed_email || 'Versión del sistema'} · {Array.isArray(version.snapshot?.rows) ? version.snapshot?.rows?.length : 0} filas</small></div></article>)}</div>}</section></div>}
  </div>
}