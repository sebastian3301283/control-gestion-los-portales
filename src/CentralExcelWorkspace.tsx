import { ChangeEvent, CSSProperties, Fragment, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Building2, Check, Download, History, LoaderCircle, Maximize2, Minimize2, Plus, RotateCcw, Trash2, Upload, X, ZoomIn, ZoomOut } from 'lucide-react'
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
type Guideline = { id: string; management_id: string; responsible_manager_id: string | null; guideline_text: string }
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
}

const XLSX_MODULE_URL = 'https://unpkg.com/xlsx@0.18.5/xlsx.mjs'
const emptyRow: RowDraft = {
  objective_group: '', objective: '', action_plan: null, responsible_manager_id: null, responsible_text: '', priority: '', milestones: '', kpi: '', target: null,
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
function dateToIso(value: unknown) {
  if (!value) return null
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10)
  const text = textValue(value)
  const match = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/)
  if (match) return `${match[3].length === 2 ? `20${match[3]}` : match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null
}
function splitResponsibleNames(value: unknown) {
  return String(value ?? '').split(/[;,\n|]+/).map(item => item.trim()).filter(Boolean)
}

export default function CentralExcelWorkspace({ periodId, year, unitName, canManage, onError, onNotice, onActiveMatrixChange }: Props) {
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
  const [importing, setImporting] = useState(false)
  const [editingRowId, setEditingRowId] = useState<string | null>(null)
  const [rowFormOpen, setRowFormOpen] = useState(false)
  const [rowDraft, setRowDraft] = useState<RowDraft>(emptyRow)
  const [selectedResponsibleIds, setSelectedResponsibleIds] = useState<string[]>([])
  const [centralSubpointDrafts, setCentralSubpointDrafts] = useState<CentralSubpointDraft[]>([emptyCentralSubpoint()])
  const [creatingObjectiveGroup, setCreatingObjectiveGroup] = useState(false)
  const [areaCanEdit, setAreaCanEdit] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [versions, setVersions] = useState<MatrixVersion[]>([])
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const loadRowsRequestRef = useRef(0)

  const selectedArea = areas.find(item => item.id === selectedAreaId) || null
  const selectedMatrix = matrices.find(item => item.id === selectedMatrixId) || null
  const managerById = useMemo(() => new Map(managers.map(item => [item.id, item])), [managers])
  const rowObjectiveGroups = useMemo(() => [...new Set(rows.map(row => textValue(row.objective_group)).filter(Boolean))], [rows])
  const centralManagers = useMemo(() => {
    const allowed = new Set(managerManagements.filter(item => item.management_id === selectedAreaId).map(item => item.manager_id))
    return managers.filter(manager => allowed.has(manager.id)).sort((a, b) => a.name.localeCompare(b.name, 'es'))
  }, [managerManagements, managers, selectedAreaId])
  const effectiveCanManage = canManage || areaCanEdit
  const tableColSpan = 12 + (effectiveCanManage ? 1 : 0)
  const zoomStyle = { '--matrix-zoom': zoom } as CSSProperties

  const selectedGuideline = useMemo(() => guidelines.find(item => item.management_id === selectedAreaId) || null, [guidelines, selectedAreaId])
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
        supabase.from('planning_guidelines').select('id,management_id,responsible_manager_id,guideline_text').eq('period_id', periodId).eq('unit_code', 'CENTRAL').eq('active', true).order('sort_order'),
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
  function backToAreas() {
    cancelRowEdit(); setSelectedAreaId(''); setSelectedMatrixId(''); setPage('areas'); onError(''); onNotice('')
  }

  function startNewRow() {
    if (rowFormOpen || !effectiveCanManage) return
    setEditingRowId(null)
    setRowDraft({ ...emptyRow, objective_group: rowObjectiveGroups.length === 1 ? rowObjectiveGroups[0] : '' })
    setSelectedResponsibleIds([])
    setCentralSubpointDrafts([emptyCentralSubpoint()])
    setCreatingObjectiveGroup(rowObjectiveGroups.length === 0)
    setRowFormOpen(true); onError(''); onNotice('')
  }
  function startEditRow(row: MatrixRow) {
    if (!effectiveCanManage || rowFormOpen) return
    setEditingRowId(row.id)
    setRowDraft({
      objective_group: row.objective_group || '', objective: row.objective || '', action_plan: row.action_plan, responsible_manager_id: row.responsible_manager_id,
      responsible_text: row.responsible_text || '', priority: row.priority || '', milestones: row.milestones || '', kpi: row.kpi || '', target: row.target,
      start_date: row.start_date || '', end_date: row.end_date || '', risks: row.risks || '', restrictions: row.restrictions || '', support: row.support || '',
      deliverables: row.deliverables || '', committee: row.committee || '', status: row.status || 'DRAFT',
    })
    setSelectedResponsibleIds(centralResponsibleIdsByRow[row.id] || (row.responsible_manager_id ? [row.responsible_manager_id] : []))
    const subpoints = buildCentralSubpointDrafts(centralSubpointsByRow[row.id] || [], row)
    setCentralSubpointDrafts(subpoints.length ? subpoints : [emptyCentralSubpoint()])
    setCreatingObjectiveGroup(false)
    setRowFormOpen(true); onError(''); onNotice('')
  }
  function cancelRowEdit() {
    setEditingRowId(null); setRowFormOpen(false); setRowDraft(emptyRow); setSelectedResponsibleIds([]); setCentralSubpointDrafts([emptyCentralSubpoint()]); setCreatingObjectiveGroup(false)
  }
  function updateDraft<K extends keyof RowDraft>(key: K, value: RowDraft[K]) { setRowDraft(current => ({ ...current, [key]: value })) }
  function toggleResponsible(managerId: string) {
    setSelectedResponsibleIds(current => current.includes(managerId) ? current.filter(id => id !== managerId) : [...current, managerId])
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
    const responsibleNames = selectedResponsibleIds.map(id => managerById.get(id)?.name).filter((name): name is string => Boolean(name))
    const payload = {
      matrix_id: selectedMatrix.id,
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
      sort_order: editingRowId ? rows.find(row => row.id === editingRowId)?.sort_order || 0 : rows.length,
    }

    let rowId = editingRowId
    let created = false
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
        await supabase.from('matrix_row_responsibles').delete().eq('row_id', rowId)
        if (previousIds.length) await supabase.from('matrix_row_responsibles').insert(previousIds.map((managerId, index) => ({ row_id: rowId, manager_id: managerId, sort_order: index })))
      }
      const deleteResult = await supabase.from('matrix_row_responsibles').delete().eq('row_id', rowId)
      if (deleteResult.error) {
        if (created) await supabase.from('matrix_rows').delete().eq('id', rowId)
        setSaving(false); onError('No pudimos actualizar los responsables.'); return
      }
      if (selectedResponsibleIds.length) {
        const insertResult = await supabase.from('matrix_row_responsibles').insert(selectedResponsibleIds.map((managerId, index) => ({ row_id: rowId, manager_id: managerId, sort_order: index })))
        if (insertResult.error) {
          await restoreResponsibles()
          if (created) await supabase.from('matrix_rows').delete().eq('id', rowId)
          setSaving(false); onError('No pudimos guardar los responsables seleccionados.'); return
        }
      }

      const deleteSubpointsResult = await supabase.from('matrix_row_subpoints').delete().eq('matrix_row_id', rowId)
      if (deleteSubpointsResult.error) {
        await restoreResponsibles()
        if (created) await supabase.from('matrix_rows').delete().eq('id', rowId)
        setSaving(false); onError('No pudimos preparar los subpuntos para guardar.'); return
      }
      if (subpointRows.length) {
        const insertSubpointsResult = await supabase.from('matrix_row_subpoints').insert(subpointRows.map(item => ({ ...item, matrix_row_id: rowId })))
        if (insertSubpointsResult.error) {
          if (previousSubpoints.length) {
            await supabase.from('matrix_row_subpoints').insert(previousSubpoints.map(item => ({
              matrix_row_id: rowId,
              text: textValue(item.text),
              milestones: textValue(item.milestones) || null,
              kpi: textValue(item.kpi) || null,
              start_date: textValue(item.start_date) || null,
              end_date: textValue(item.end_date) || null,
              sort_order: item.sort_order,
            })))
          }
          await restoreResponsibles()
          if (created) await supabase.from('matrix_rows').delete().eq('id', rowId)
          setSaving(false); onError('No pudimos guardar los subpuntos.'); return
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
    onNotice('Acción eliminada.'); await loadRows(selectedMatrix.id)
  }

  function handleEditKeyDown(event: KeyboardEvent<HTMLTableRowElement>) {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); void saveRow() }
    if (event.key === 'Escape') { event.preventDefault(); cancelRowEdit() }
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

  async function importExcel(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = ''
    if (!file || !selectedMatrix || !supabase || !effectiveCanManage) return
    setImporting(true); onError(''); onNotice('')
    const createdRowIds: string[] = []
    try {
      const XLSX = await import(/* @vite-ignore */ XLSX_MODULE_URL)
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true })
      const sheetName = workbook.SheetNames[0]
      if (!sheetName) throw new Error('NO_SHEET')
      const grid = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '', raw: true }) as unknown[][]
      const headerIndex = grid.findIndex(row => {
        const values = row.map(normalizeText)
        return values.some(value => value === 'accion' || value === 'acción') && values.some(value => value.includes('responsable'))
      })
      if (headerIndex < 0) { onError('No encontramos los encabezados Acción y Responsable del formato Central.'); return }
      const headers = grid[headerIndex].map(normalizeText)
      const findCol = (items: string[]) => headers.findIndex(header => items.some(item => header === item || header.includes(item)))
      const actionCol = findCol(['accion']); const responsibleCol = findCol(['responsable']); const priorityCol = findCol(['prioridad']); const milestoneCol = findCol(['hitos fechas','hitos']); const kpiCol = findCol(['kpi']); const startCol = findCol(['inicio']); const endCol = findCol(['fin']); const riskCol = findCol(['riesgos']); const restrictionCol = findCol(['restricciones']); const supportCol = findCol(['soporte']); const deliverableCol = findCol(['entregable']); const committeeCol = findCol(['comite'])
      const at = (row: unknown[], col: number) => col >= 0 ? row[col] : ''
      let currentGroup = ''
      let imported = 0
      let importedSubpoints = 0
      let lastImportedRowId = ''
      let lastImportedSubpointTexts: string[] = []
      for (const sourceRow of grid.slice(headerIndex + 1)) {
        const action = textValue(at(sourceRow, actionCol))
        const otherValues = sourceRow.filter((_, index) => index !== actionCol).map(textValue).filter(Boolean)
        const subpointMatch = action.match(/^S\d+\s*:\s*(.*)$/i)
        if (subpointMatch && lastImportedRowId) {
          const subpoint = {
            matrix_row_id: lastImportedRowId,
            text: textValue(subpointMatch[1]),
            milestones: textValue(at(sourceRow, milestoneCol)) || null,
            kpi: textValue(at(sourceRow, kpiCol)) || null,
            start_date: dateToIso(at(sourceRow, startCol)),
            end_date: dateToIso(at(sourceRow, endCol)),
            sort_order: lastImportedSubpointTexts.length,
          }
          if (subpoint.text || subpoint.milestones || subpoint.kpi || subpoint.start_date || subpoint.end_date) {
            const subpointResult = await supabase.from('matrix_row_subpoints').insert(subpoint)
            if (subpointResult.error) throw subpointResult.error
            lastImportedSubpointTexts.push(subpoint.text)
            const mirrorResult = await supabase.from('matrix_rows').update({ action_plan: lastImportedSubpointTexts.filter(Boolean).join('\n') || null }).eq('id', lastImportedRowId)
            if (mirrorResult.error) throw mirrorResult.error
            importedSubpoints += 1
          }
          continue
        }
        if (action && otherValues.length === 0) { currentGroup = action; lastImportedRowId = ''; lastImportedSubpointTexts = []; continue }
        if (!action) continue
        const responsibleNames = splitResponsibleNames(at(sourceRow, responsibleCol))
        const managerIds = responsibleNames.map(name => centralManagers.find(manager => normalizeText(manager.name) === normalizeText(name))?.id).filter((id): id is string => Boolean(id))
        const names = managerIds.map(id => managerById.get(id)?.name).filter((name): name is string => Boolean(name))
        const payload = {
          matrix_id: selectedMatrix.id, objective_group: currentGroup || null, objective: action, action_plan: null,
          responsible_manager_id: managerIds[0] || null, responsible_text: names.length ? names.join(', ') : textValue(at(sourceRow, responsibleCol)) || null,
          priority: textValue(at(sourceRow, priorityCol)) || null, milestones: textValue(at(sourceRow, milestoneCol)) || null, kpi: textValue(at(sourceRow, kpiCol)) || null, target: null,
          start_date: dateToIso(at(sourceRow, startCol)), end_date: dateToIso(at(sourceRow, endCol)), risks: textValue(at(sourceRow, riskCol)) || null, restrictions: textValue(at(sourceRow, restrictionCol)) || null,
          support: textValue(at(sourceRow, supportCol)) || null, deliverables: textValue(at(sourceRow, deliverableCol)) || null, committee: textValue(at(sourceRow, committeeCol)) || null, status: 'DRAFT', sort_order: rows.length + imported,
        }
        const { data, error } = await supabase.from('matrix_rows').insert(payload).select('id').single()
        if (error || !data?.id) throw error || new Error('INSERT')
        const rowId = String(data.id)
        createdRowIds.push(rowId)
        lastImportedRowId = rowId
        lastImportedSubpointTexts = []
        if (managerIds.length) {
          const linkResult = await supabase.from('matrix_row_responsibles').insert(managerIds.map((managerId, index) => ({ row_id: rowId, manager_id: managerId, sort_order: index })))
          if (linkResult.error) throw linkResult.error
        }
        imported += 1
      }
      if (!imported) { onError('No encontramos acciones para importar.'); return }
      await loadRows(selectedMatrix.id); onNotice(`${imported} acción${imported === 1 ? '' : 'es'} y ${importedSubpoints} subpunto${importedSubpoints === 1 ? '' : 's'} importados correctamente.`)
    } catch {
      if (createdRowIds.length) await supabase.from('matrix_rows').delete().in('id', createdRowIds)
      onError('No pudimos importar el Excel de Central. No se conservaron filas parciales; revisa el formato y los nombres de responsables.')
    } finally { setImporting(false) }
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
    return <details className="matrix-central-responsible-picker">
      <summary>{selectedNames.length ? <span className="matrix-central-summary-chips">{selectedNames.map(name => <i key={name}>{name}</i>)}</span> : <span>Seleccionar responsables</span>}</summary>
      <div className="matrix-central-responsible-menu">
        {centralManagers.length === 0 ? <small>No hay bonistas asignados a esta área.</small> : centralManagers.map(manager => <label key={manager.id}><input type="checkbox" checked={selectedResponsibleIds.includes(manager.id)} onChange={() => toggleResponsible(manager.id)}/><span><strong>{manager.name}</strong>{manager.cargo && <small>{manager.cargo}</small>}</span></label>)}
      </div>
    </details>
  }

  function renderObjectiveGroupEditor() {
    const groupEditor = creatingObjectiveGroup || rowObjectiveGroups.length === 0
      ? <div className="matrix-central-objective-edit"><strong>OBJETIVO</strong><input value={rowDraft.objective_group || ''} onChange={event => updateDraft('objective_group', event.target.value)} placeholder="Ej. OB1: Consolidar el rol de Auditoría..."/>{rowObjectiveGroups.length > 0 && <button type="button" onClick={() => { setCreatingObjectiveGroup(false); updateDraft('objective_group', '') }}>Usar existente</button>}</div>
      : <div className="matrix-central-objective-edit"><strong>OBJETIVO</strong><select value={rowDraft.objective_group || ''} onChange={event => { if (event.target.value === '__new__') { setCreatingObjectiveGroup(true); updateDraft('objective_group', '') } else updateDraft('objective_group', event.target.value) }}><option value="">Selecciona un objetivo</option>{rowObjectiveGroups.map(group => <option key={group} value={group}>{group}</option>)}<option value="__new__">+ Crear nuevo objetivo</option></select></div>
    return <div className="matrix-central-objective-toolbar">{groupEditor}<button type="button" className="matrix-central-add-subpoint" onClick={() => setCentralSubpointDrafts(current => [...current, emptyCentralSubpoint()])}><Plus size={14}/> Añadir subpunto</button></div>
  }

  function renderSpreadsheetDraftRows(key: string) {
    const sharedRowSpan = centralSubpointDrafts.length + 1
    return <>
      <tr className="matrix-v5-edit-row matrix-central-objective-editor-row" key={`${key}-group`}><td colSpan={tableColSpan}>{renderObjectiveGroupEditor()}</td></tr>
      <tr className="matrix-v5-edit-row matrix-v10-central-excel-row matrix-v10-central-excel-row--editing matrix-central-in-grid-draft" key={`${key}-row`} onKeyDown={handleEditKeyDown}>
        <td className="matrix-central-sheet-cell matrix-central-sheet-cell--action"><textarea rows={1} value={rowDraft.objective || ''} onChange={event => updateDraft('objective', event.target.value)} placeholder="Acción" aria-label="Acción" autoFocus/></td>
        <td className="matrix-central-sheet-cell matrix-central-sheet-cell--responsible" rowSpan={sharedRowSpan}>{renderResponsiblePicker()}</td>
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
        {effectiveCanManage && <td className="matrix-central-sheet-cell matrix-central-sheet-cell--actions" rowSpan={sharedRowSpan}><div className="matrix-v5-row-actions matrix-central-edit-actions"><button type="button" title="Cancelar" onClick={cancelRowEdit}><X size={14}/></button><button type="button" className="save" title="Guardar · Ctrl+Enter" onClick={() => void saveRow()} disabled={saving}>{saving ? <LoaderCircle className="spin" size={14}/> : <Check size={14}/>}</button></div></td>}
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
        <button className="matrix-v5-secondary" onClick={backToAreas}><ArrowLeft size={16}/> Áreas</button>
        <button className="matrix-v5-secondary" onClick={() => setExpanded(value => !value)}>{expanded ? <Minimize2 size={16}/> : <Maximize2 size={16}/>} {expanded ? 'Salir de pantalla completa' : 'Expandir matriz'}</button>
        {expanded && <div className="matrix-v5-zoom"><button title="Alejar" onClick={() => setZoom(value => Math.max(.75, +(value - .1).toFixed(2)))}><ZoomOut size={15}/></button><span>{Math.round(zoom * 100)}%</span><button title="Acercar" onClick={() => setZoom(value => Math.min(1.4, +(value + .1).toFixed(2)))}><ZoomIn size={15}/></button><button title="Restablecer zoom" onClick={() => setZoom(1)}><RotateCcw size={14}/></button></div>}
        <button className="matrix-v5-secondary" onClick={() => void openHistory()}><History size={16}/> Historial</button>
        {effectiveCanManage && <><input ref={fileInputRef} type="file" accept=".xlsx,.xls" hidden onChange={event => void importExcel(event)}/><button className="matrix-v5-secondary" onClick={() => fileInputRef.current?.click()} disabled={importing}><Upload size={16}/>{importing ? 'Importando...' : 'Importar Excel'}</button></>}
        <button className="matrix-v5-secondary" onClick={() => void exportExcel()} disabled={exporting}><Download size={16}/>{exporting ? 'Exportando...' : 'Exportar Excel'}</button>
        {effectiveCanManage && <button className="matrix-v5-primary" onClick={startNewRow}><Plus size={16}/> Nueva fila</button>}
      </div></div>

      <div className="matrix-v5-title"><span>Matriz de Plan de Acción</span><h2>PLAN DE ACCIÓN {year}</h2></div>
      <div className="matrix-v5-summary"><div><span>Área</span><strong>{selectedArea?.name || '—'}</strong></div><div><span>Unidad</span><strong>Central</strong></div><div><span>Responsable principal</span><strong>{firstResponsible}</strong></div></div>

      <div className="matrix-v5-sheet-card"><div className="matrix-v5-sheet-scroll" style={zoomStyle}><table className="matrix-v5-sheet matrix-v10-central-excel matrix-central-spreadsheet-grid"><thead><tr><th>Acción</th><th>Responsable</th><th>Prioridad</th><th>Hitos / Fechas</th><th>KPI (Cuantitativo)</th><th>Inicio</th><th>Fin</th><th>Riesgos de no ejecutar</th><th>Restricciones</th><th>Soporte</th><th>Entregable</th><th>Comité</th>{effectiveCanManage && <th>Acciones</th>}</tr></thead><tbody>
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
              {effectiveCanManage && <td rowSpan={sharedRowSpan}><div className="matrix-v5-row-actions"><button type="button" title="Eliminar acción" className="danger" onClick={event => { event.stopPropagation(); void deleteRow(row.id) }}><Trash2 size={14}/></button></div></td>}
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