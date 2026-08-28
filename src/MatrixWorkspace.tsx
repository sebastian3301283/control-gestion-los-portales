import { FormEvent, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, Building2, Check, ChevronRight, ClipboardList, LoaderCircle, Pencil, Plus, Save, Search, Trash2, X } from 'lucide-react'
import { supabase } from './lib/supabase'
import './matrix-workspace.css'
import './matrix-workspace-v2.css'

type UnitCode = 'HU' | 'DEP' | 'VS' | 'HOT' | 'CENTRAL'
type DirectoryGroup = 'GENERAL' | 'HU' | 'MATRICIAL_HU_VS'
type WorkspacePage = 'areas' | 'processes' | 'matrices' | 'sheet'

type Area = { id: string; name: string; unit_code: string; directory_group: DirectoryGroup }
type AreaSelection = { id: string; management_id: string; sort_order: number }
type Process = { id: string; name: string; description: string | null; management_id: string; unit_code: string; directory_group: DirectoryGroup; sort_order: number }
type Matrix = { id: string; name: string; description: string | null; process_id: string; status: 'DRAFT' | 'IN_PROGRESS' | 'REVIEW' | 'APPROVED'; sort_order: number }
type Manager = { id: string; name: string; cargo: string | null; unit_code: string; directory_group: DirectoryGroup }
type MatrixRow = {
  id: string
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

const emptyRow: RowDraft = {
  objective: '', action_plan: '', responsible_manager_id: null, responsible_text: '', priority: '', milestones: '', kpi: '', target: '',
  start_date: '', end_date: '', risks: '', restrictions: '', support: '', deliverables: '', committee: '', status: 'DRAFT',
}

const unitAccent: Record<UnitCode, string> = { CENTRAL: 'central', HU: 'hu', DEP: 'dep', VS: 'vs', HOT: 'hot' }

function statusLabel(status: Matrix['status']) {
  if (status === 'IN_PROGRESS') return 'En progreso'
  if (status === 'REVIEW') return 'En revisión'
  if (status === 'APPROVED') return 'Aprobada'
  return 'Borrador'
}

function normalizeAreaName(value: string) {
  return value.trim().toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export default function MatrixWorkspace({ periodId, year, unitCode, unitName, canManage, onError, onNotice }: Props) {
  const directoryGroup: DirectoryGroup = unitCode === 'HU' ? 'HU' : 'GENERAL'
  const [page, setPage] = useState<WorkspacePage>('areas')
  const [catalogAreas, setCatalogAreas] = useState<Area[]>([])
  const [areaSelections, setAreaSelections] = useState<AreaSelection[]>([])
  const [processes, setProcesses] = useState<Process[]>([])
  const [matrices, setMatrices] = useState<Matrix[]>([])
  const [managers, setManagers] = useState<Manager[]>([])
  const [rows, setRows] = useState<MatrixRow[]>([])
  const [selectedAreaId, setSelectedAreaId] = useState('')
  const [selectedProcessId, setSelectedProcessId] = useState('')
  const [selectedMatrixId, setSelectedMatrixId] = useState('')
  const [loading, setLoading] = useState(true)
  const [rowsLoading, setRowsLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [areaPickerOpen, setAreaPickerOpen] = useState(false)
  const [areaSearch, setAreaSearch] = useState('')
  const [processFormOpen, setProcessFormOpen] = useState(false)
  const [matrixFormOpen, setMatrixFormOpen] = useState(false)
  const [processName, setProcessName] = useState('')
  const [processDescription, setProcessDescription] = useState('')
  const [matrixName, setMatrixName] = useState('')
  const [matrixDescription, setMatrixDescription] = useState('')
  const [rowFormOpen, setRowFormOpen] = useState(false)
  const [editingRowId, setEditingRowId] = useState<string | null>(null)
  const [rowDraft, setRowDraft] = useState<RowDraft>(emptyRow)

  const selectedArea = catalogAreas.find(item => item.id === selectedAreaId) || null
  const selectedProcess = processes.find(item => item.id === selectedProcessId) || null
  const selectedMatrix = matrices.find(item => item.id === selectedMatrixId) || null
  const selectedAreaIds = useMemo(() => new Set(areaSelections.map(item => item.management_id)), [areaSelections])
  const visibleAreas = useMemo(() => catalogAreas.filter(area => selectedAreaIds.has(area.id)), [catalogAreas, selectedAreaIds])
  const availableAreas = useMemo(() => catalogAreas.filter(area => !selectedAreaIds.has(area.id)), [catalogAreas, selectedAreaIds])
  const filteredAvailableAreas = useMemo(() => {
    const term = normalizeAreaName(areaSearch)
    if (!term) return availableAreas
    return availableAreas.filter(area => normalizeAreaName(area.name).includes(term) || normalizeAreaName(area.unit_code).includes(term))
  }, [availableAreas, areaSearch])
  const areaProcesses = useMemo(() => processes.filter(item => item.management_id === selectedAreaId), [processes, selectedAreaId])
  const processMatrices = useMemo(() => matrices.filter(item => item.process_id === selectedProcessId), [matrices, selectedProcessId])
  const managerById = useMemo(() => new Map(managers.map(item => [item.id, item])), [managers])

  useEffect(() => {
    if (unitCode === 'CENTRAL') return
    setPage('areas'); setSelectedAreaId(''); setSelectedProcessId(''); setSelectedMatrixId(''); setRows([])
    void loadWorkspace()
  }, [periodId, unitCode])

  useEffect(() => {
    if (!selectedMatrixId) { setRows([]); return }
    void loadRows(selectedMatrixId)
  }, [selectedMatrixId])

  async function loadManagers() {
    if (!supabase) return [] as Manager[]
    const queries = unitCode === 'HU'
      ? [
          supabase.from('managers').select('id,name,cargo,unit_code,directory_group').eq('unit_code', 'HU').eq('directory_group', 'HU').eq('active', true).order('name'),
          supabase.from('managers').select('id,name,cargo,unit_code,directory_group').eq('unit_code', 'HU').eq('directory_group', 'MATRICIAL_HU_VS').eq('active', true).order('name'),
        ]
      : unitCode === 'VS'
        ? [
            supabase.from('managers').select('id,name,cargo,unit_code,directory_group').eq('unit_code', 'VS').eq('directory_group', 'GENERAL').eq('active', true).order('name'),
            supabase.from('managers').select('id,name,cargo,unit_code,directory_group').eq('unit_code', 'HU').eq('directory_group', 'MATRICIAL_HU_VS').eq('active', true).order('name'),
          ]
        : [supabase.from('managers').select('id,name,cargo,unit_code,directory_group').eq('unit_code', unitCode).eq('directory_group', directoryGroup).eq('active', true).order('name')]
    const results = await Promise.all(queries)
    if (results.some(result => result.error)) throw new Error('MANAGER_LOAD')
    const unique = new Map<string, Manager>()
    results.forEach(result => (result.data || []).forEach(item => unique.set(String(item.id), item as Manager)))
    return [...unique.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'))
  }

  async function loadWorkspace() {
    if (!supabase) return
    setLoading(true); onError('')
    try {
      const [areaResult, selectionResult, processResult, matrixResult, managerList] = await Promise.all([
        supabase.from('managements_global').select('id,name,unit_code,directory_group').eq('active', true).order('name'),
        supabase.from('matrix_area_selections').select('id,management_id,sort_order').eq('period_id', periodId).eq('unit_code', unitCode).eq('directory_group', directoryGroup).order('sort_order'),
        supabase.from('processes').select('id,name,description,management_id,unit_code,directory_group,sort_order').eq('unit_code', unitCode).eq('directory_group', directoryGroup).eq('active', true).order('sort_order').order('name'),
        supabase.from('matrices').select('id,name,description,process_id,status,sort_order').eq('period_id', periodId).eq('unit_code', unitCode).eq('directory_group', directoryGroup).eq('active', true).order('sort_order').order('name'),
        loadManagers(),
      ])
      if (areaResult.error || selectionResult.error || processResult.error || matrixResult.error) throw new Error('WORKSPACE_LOAD')
      const allAreas = (areaResult.data || []) as Area[]
      const selections = (selectionResult.data || []) as AreaSelection[]
      const selectedIds = new Set(selections.map(item => item.management_id))
      const uniqueAreas = new Map<string, Area>()
      allAreas.filter(area => selectedIds.has(area.id)).forEach(area => uniqueAreas.set(normalizeAreaName(area.name), area))
      allAreas.forEach(area => { const key = normalizeAreaName(area.name); if (!uniqueAreas.has(key)) uniqueAreas.set(key, area) })
      setCatalogAreas([...uniqueAreas.values()].sort((a, b) => a.name.localeCompare(b.name, 'es')))
      setAreaSelections(selections)
      setProcesses((processResult.data || []) as Process[])
      setMatrices((matrixResult.data || []) as Matrix[])
      setManagers(managerList)
    } catch {
      onError('No pudimos cargar las áreas, procesos y matrices de esta unidad.')
    } finally { setLoading(false) }
  }

  async function loadRows(matrixId: string) {
    if (!supabase) return
    setRowsLoading(true)
    const { data, error } = await supabase.from('matrix_rows').select('*').eq('matrix_id', matrixId).order('sort_order').order('created_at')
    setRowsLoading(false)
    if (error) { onError('No pudimos cargar la matriz.'); return }
    setRows((data || []) as MatrixRow[])
  }

  async function addArea(managementId: string) {
    if (!supabase || !canManage) return
    setSaving(true); onError(''); onNotice('')
    const { error } = await supabase.from('matrix_area_selections').insert({ period_id: periodId, unit_code: unitCode, directory_group: directoryGroup, management_id: managementId, sort_order: areaSelections.length })
    setSaving(false)
    if (error) { onError(error.code === '23505' ? 'Esa área ya fue añadida.' : 'No pudimos añadir el área.'); return }
    setAreaPickerOpen(false); setAreaSearch(''); setSelectedAreaId(managementId)
    onNotice('Área añadida. Ya puedes generar su matriz.')
    await loadWorkspace()
  }

  async function removeArea(area: Area) {
    if (!supabase || !canManage) return
    const selection = areaSelections.find(item => item.management_id === area.id)
    if (!selection) return
    const { error } = await supabase.from('matrix_area_selections').delete().eq('id', selection.id)
    if (error) { onError('No pudimos quitar el área.'); return }
    onNotice('Área retirada de la vista. Sus procesos y matrices se conservan.')
    if (selectedAreaId === area.id) { setSelectedAreaId(''); setSelectedProcessId(''); setSelectedMatrixId(''); setPage('areas') }
    await loadWorkspace()
  }

  function chooseArea(id: string) {
    setSelectedAreaId(id); setSelectedProcessId(''); setSelectedMatrixId(''); setRows([]); cancelRowEdit(); setPage('processes')
  }

  function generateMatrix(area: Area) {
    const related = processes.filter(process => process.management_id === area.id)
    setSelectedAreaId(area.id); setSelectedMatrixId(''); setRows([]); cancelRowEdit(); onError(''); onNotice('')
    if (related.length === 0) {
      setSelectedProcessId(''); setPage('processes'); setProcessName(''); setProcessDescription(''); setProcessFormOpen(true)
      return
    }
    if (related.length === 1) {
      setSelectedProcessId(related[0].id); setPage('matrices'); setMatrixName(`Matriz de ${related[0].name}`); setMatrixDescription(''); setMatrixFormOpen(true)
      return
    }
    setSelectedProcessId(''); setPage('processes'); onNotice('Selecciona el proceso para el que quieres generar la matriz.')
  }

  function chooseProcess(id: string) { setSelectedProcessId(id); setSelectedMatrixId(''); setRows([]); cancelRowEdit(); setPage('matrices') }
  function chooseMatrix(id: string) { setSelectedMatrixId(id); cancelRowEdit(); setPage('sheet') }

  function goBack() {
    onError(''); onNotice(''); cancelRowEdit()
    if (page === 'sheet') { setSelectedMatrixId(''); setPage('matrices'); return }
    if (page === 'matrices') { setSelectedProcessId(''); setPage('processes'); return }
    if (page === 'processes') { setSelectedAreaId(''); setPage('areas') }
  }

  async function createProcess(event: FormEvent) {
    event.preventDefault()
    if (!supabase || !canManage || !selectedArea) return
    const name = processName.trim(); if (!name) return
    setSaving(true); onError(''); onNotice('')
    const { data, error } = await supabase.from('processes').insert({ unit_code: unitCode, directory_group: directoryGroup, management_id: selectedArea.id, name, description: processDescription.trim() || null, sort_order: areaProcesses.length }).select('id,name,description,management_id,unit_code,directory_group,sort_order').single()
    setSaving(false)
    if (error || !data) { onError(error?.code === '23505' ? 'Ese proceso ya existe en el área seleccionada.' : 'No pudimos crear el proceso.'); return }
    setProcessName(''); setProcessDescription(''); setProcessFormOpen(false); setSelectedProcessId(String(data.id)); setPage('matrices'); setMatrixName(`Matriz de ${data.name}`); setMatrixDescription(''); setMatrixFormOpen(true)
    onNotice('Proceso creado. Ahora genera la matriz.'); await loadWorkspace()
  }

  async function createMatrix(event: FormEvent) {
    event.preventDefault()
    if (!supabase || !canManage || !selectedProcess) return
    const name = matrixName.trim() || `Matriz de ${selectedProcess.name}`
    setSaving(true); onError(''); onNotice('')
    const { data, error } = await supabase.from('matrices').insert({ period_id: periodId, unit_code: unitCode, directory_group: directoryGroup, process_id: selectedProcess.id, name, description: matrixDescription.trim() || null, status: 'DRAFT', sort_order: processMatrices.length }).select('id').single()
    setSaving(false)
    if (error || !data) { onError(error?.code === '23505' ? 'Ya existe una matriz con ese nombre para este proceso.' : 'No pudimos crear la matriz.'); return }
    setMatrixName(''); setMatrixDescription(''); setMatrixFormOpen(false); onNotice('Matriz creada correctamente.'); await loadWorkspace(); setSelectedMatrixId(String(data.id)); setPage('sheet')
  }

  function startNewRow() { setEditingRowId(null); setRowDraft(emptyRow); setRowFormOpen(true); onError(''); onNotice('') }
  function startEditRow(row: MatrixRow) {
    setEditingRowId(row.id)
    setRowDraft({ objective: row.objective || '', action_plan: row.action_plan || '', responsible_manager_id: row.responsible_manager_id, responsible_text: row.responsible_text || '', priority: row.priority || '', milestones: row.milestones || '', kpi: row.kpi || '', target: row.target || '', start_date: row.start_date || '', end_date: row.end_date || '', risks: row.risks || '', restrictions: row.restrictions || '', support: row.support || '', deliverables: row.deliverables || '', committee: row.committee || '', status: row.status || 'DRAFT' })
    setRowFormOpen(true)
  }
  function cancelRowEdit() { setEditingRowId(null); setRowFormOpen(false); setRowDraft(emptyRow) }
  function updateDraft<K extends keyof RowDraft>(key: K, value: RowDraft[K]) { setRowDraft(current => ({ ...current, [key]: value })) }

  async function saveRow() {
    if (!supabase || !selectedMatrix || !canManage) return
    if (!String(rowDraft.objective || '').trim() && !String(rowDraft.action_plan || '').trim()) { onError('Escribe al menos el objetivo o el plan de acción de la fila.'); return }
    setSaving(true); onError(''); onNotice('')
    const manager = rowDraft.responsible_manager_id ? managerById.get(rowDraft.responsible_manager_id) : null
    const payload = { matrix_id: selectedMatrix.id, objective: rowDraft.objective || null, action_plan: rowDraft.action_plan || null, responsible_manager_id: rowDraft.responsible_manager_id || null, responsible_text: manager?.name || rowDraft.responsible_text || null, priority: rowDraft.priority || null, milestones: rowDraft.milestones || null, kpi: rowDraft.kpi || null, target: rowDraft.target || null, start_date: rowDraft.start_date || null, end_date: rowDraft.end_date || null, risks: rowDraft.risks || null, restrictions: rowDraft.restrictions || null, support: rowDraft.support || null, deliverables: rowDraft.deliverables || null, committee: rowDraft.committee || null, status: rowDraft.status, sort_order: editingRowId ? rows.find(item => item.id === editingRowId)?.sort_order || 0 : rows.length }
    const result = editingRowId ? await supabase.from('matrix_rows').update(payload).eq('id', editingRowId) : await supabase.from('matrix_rows').insert(payload)
    setSaving(false)
    if (result.error) { onError('No pudimos guardar la fila de la matriz.'); return }
    const wasEditing = Boolean(editingRowId); cancelRowEdit(); onNotice(wasEditing ? 'Fila actualizada.' : 'Fila agregada a la matriz.'); await loadRows(selectedMatrix.id)
  }

  async function deleteRow(id: string) {
    if (!supabase || !canManage || !selectedMatrix) return
    const { error } = await supabase.from('matrix_rows').delete().eq('id', id)
    if (error) { onError('No pudimos eliminar la fila.'); return }
    onNotice('Fila eliminada.'); await loadRows(selectedMatrix.id)
  }

  if (unitCode === 'CENTRAL') {
    return <section className="matrix-placeholder matrix-placeholder--central"><span><ClipboardList size={26}/></span><div><small>Etapa de matrices</small><h3>Central se configurará después</h3><p>Primero construiremos las matrices de VS, HU, Departamentos y Hoteles.</p></div></section>
  }

  return (
    <div className={`matrix-workspace matrix-workspace--${unitAccent[unitCode]}`}>
      <section className="matrix-intro">
        <div><span className="matrix-kicker">Periodo {year} · {unitCode}</span><h3>Matrices de {unitName}</h3><p>Las áreas son transversales. Añade las que necesites y genera sus matrices para esta unidad.</p></div>
        <div className="matrix-route"><button className={page === 'areas' ? 'active' : 'done'} onClick={() => { setPage('areas'); setSelectedAreaId(''); setSelectedProcessId(''); setSelectedMatrixId('') }}>1. Área / Procesos</button><ChevronRight size={15}/><span className={page === 'matrices' || page === 'sheet' ? 'done' : ''}>2. Matrices</span><ChevronRight size={15}/><span className={page === 'sheet' ? 'active' : ''}>3. Edición</span></div>
      </section>

      {page !== 'areas' && <button className="matrix-back" type="button" onClick={goBack}><ArrowLeft size={16}/> Volver</button>}

      {loading ? <div className="matrix-loading"><LoaderCircle className="spin" size={22}/> Cargando estructura...</div> : <>
        {page === 'areas' && <section className="matrix-stage">
          <div className="matrix-stage-head"><div><small>Área / Procesos</small><h4>Áreas habilitadas para matrices</h4><p>Puedes usar cualquier área de la empresa, sin importar su unidad de origen.</p></div>{canManage && <button className="matrix-primary" onClick={() => { setAreaSearch(''); setAreaPickerOpen(true) }}><Plus size={15}/> Añadir área</button>}</div>
          {visibleAreas.length === 0 ? <div className="matrix-empty"><Building2 size={24}/><strong>Aún no hay áreas añadidas</strong><span>Usa “Añadir área” para comenzar.</span></div> : <div className="matrix-area-grid">{visibleAreas.map(area => {
            const count = processes.filter(process => process.management_id === area.id).length
            return <div className="matrix-area-card matrix-area-card--actions" key={area.id}><button className="matrix-area-main" onClick={() => chooseArea(area.id)}><span><Building2 size={20}/></span><div><strong>{area.name}</strong><small>{count} proceso{count === 1 ? '' : 's'} · Área transversal</small></div><ArrowRight size={17}/></button><div className="matrix-area-card-actions">{canManage && <button className="matrix-generate" onClick={() => generateMatrix(area)}><Plus size={14}/> Generar matriz</button>}{canManage && <button className="matrix-area-remove" title="Quitar área" onClick={() => void removeArea(area)}><Trash2 size={13}/></button>}</div></div>
          })}</div>}
        </section>}

        {page === 'processes' && selectedArea && <section className="matrix-stage">
          <div className="matrix-stage-head"><div><small>{selectedArea.name}</small><h4>Procesos</h4><p>Selecciona un proceso o crea uno nuevo para generar su matriz.</p></div>{canManage && <button className="matrix-primary" onClick={() => setProcessFormOpen(true)}><Plus size={15}/> Nuevo proceso</button>}</div>
          {areaProcesses.length === 0 ? <div className="matrix-empty compact"><ClipboardList size={22}/><strong>Aún no hay procesos</strong><span>Presiona “Nuevo proceso” para crear el primero.</span></div> : <div className="matrix-simple-table-wrap"><table className="matrix-simple-table"><thead><tr><th>N°</th><th>Proceso</th><th>Descripción</th><th>Matrices</th><th></th></tr></thead><tbody>{areaProcesses.map((process, index) => { const count = matrices.filter(matrix => matrix.process_id === process.id).length; return <tr key={process.id}><td>{index + 1}</td><td><strong>{process.name}</strong></td><td>{process.description || '—'}</td><td>{count}</td><td><button onClick={() => chooseProcess(process.id)}>Abrir <ArrowRight size={14}/></button></td></tr> })}</tbody></table></div>}
        </section>}

        {page === 'matrices' && selectedProcess && <section className="matrix-stage">
          <div className="matrix-stage-head"><div><small>{selectedArea?.name} · {selectedProcess.name}</small><h4>Matrices del proceso</h4><p>Abre una matriz o genera una nueva.</p></div>{canManage && <button className="matrix-primary" onClick={() => { setMatrixName(`Matriz de ${selectedProcess.name}`); setMatrixFormOpen(true) }}><Plus size={15}/> Nueva matriz</button>}</div>
          {processMatrices.length === 0 ? <div className="matrix-empty compact"><ClipboardList size={22}/><strong>Aún no hay matrices</strong><span>Crea la primera matriz de este proceso.</span></div> : <div className="matrix-simple-table-wrap"><table className="matrix-simple-table"><thead><tr><th>N°</th><th>Matriz</th><th>Descripción</th><th>Estado</th><th></th></tr></thead><tbody>{processMatrices.map((matrix, index) => <tr key={matrix.id}><td>{index + 1}</td><td><strong>{matrix.name}</strong></td><td>{matrix.description || 'Matriz editable'}</td><td><span className={`matrix-status matrix-status--${matrix.status.toLowerCase()}`}>{statusLabel(matrix.status)}</span></td><td><button onClick={() => chooseMatrix(matrix.id)}>Abrir <ArrowRight size={14}/></button></td></tr>)}</tbody></table></div>}
        </section>}

        {page === 'sheet' && selectedMatrix && <section className="matrix-sheet-card">
          <div className="matrix-sheet-head"><div><small>{selectedArea?.name} → {selectedProcess?.name}</small><h4>{selectedMatrix.name}</h4><p>Completa la información directamente en la matriz.</p></div>{canManage && <button className="matrix-primary" onClick={startNewRow}><Plus size={15}/> Nueva fila</button>}</div>
          <div className="matrix-sheet-scroll"><table className="matrix-sheet"><thead><tr><th>N°</th><th>Objetivo</th><th>Plan de acción</th><th>Responsable</th><th>Prioridad</th><th>Hitos</th><th>KPI</th><th>Objetivo KPI</th><th>Fecha inicio</th><th>Fecha fin</th><th>Riesgos</th><th>Restricciones</th><th>Soporte</th><th>Entregables</th><th>Comité</th>{canManage && <th>Acciones</th>}</tr></thead><tbody>
            {rowFormOpen && <tr className="matrix-edit-row"><td>{editingRowId ? rows.findIndex(row => row.id === editingRowId) + 1 : rows.length + 1}</td><td><textarea value={rowDraft.objective || ''} onChange={e => updateDraft('objective', e.target.value)}/></td><td><textarea value={rowDraft.action_plan || ''} onChange={e => updateDraft('action_plan', e.target.value)}/></td><td><select value={rowDraft.responsible_manager_id || ''} onChange={e => updateDraft('responsible_manager_id', e.target.value || null)}><option value="">Seleccionar</option>{managers.map(manager => <option key={manager.id} value={manager.id}>{manager.name}{manager.directory_group === 'MATRICIAL_HU_VS' ? ' · Matricial' : ''}</option>)}</select></td><td><select value={rowDraft.priority || ''} onChange={e => updateDraft('priority', e.target.value)}><option value="">—</option><option value="Alta">Alta</option><option value="Media">Media</option><option value="Baja">Baja</option></select></td><td><textarea value={rowDraft.milestones || ''} onChange={e => updateDraft('milestones', e.target.value)}/></td><td><textarea value={rowDraft.kpi || ''} onChange={e => updateDraft('kpi', e.target.value)}/></td><td><input value={rowDraft.target || ''} onChange={e => updateDraft('target', e.target.value)}/></td><td><input type="date" value={rowDraft.start_date || ''} onChange={e => updateDraft('start_date', e.target.value)}/></td><td><input type="date" value={rowDraft.end_date || ''} onChange={e => updateDraft('end_date', e.target.value)}/></td><td><textarea value={rowDraft.risks || ''} onChange={e => updateDraft('risks', e.target.value)}/></td><td><textarea value={rowDraft.restrictions || ''} onChange={e => updateDraft('restrictions', e.target.value)}/></td><td><textarea value={rowDraft.support || ''} onChange={e => updateDraft('support', e.target.value)}/></td><td><textarea value={rowDraft.deliverables || ''} onChange={e => updateDraft('deliverables', e.target.value)}/></td><td><textarea value={rowDraft.committee || ''} onChange={e => updateDraft('committee', e.target.value)}/></td><td><div className="matrix-row-actions"><button title="Cancelar" type="button" onClick={cancelRowEdit}><X size={14}/></button><button className="save" title="Guardar" type="button" onClick={() => void saveRow()} disabled={saving}>{saving ? <LoaderCircle className="spin" size={14}/> : <Check size={14}/>}</button></div></td></tr>}
            {rowsLoading ? <tr><td colSpan={16} className="matrix-table-empty"><LoaderCircle className="spin" size={20}/> Cargando matriz...</td></tr> : rows.length === 0 && !rowFormOpen ? <tr><td colSpan={16} className="matrix-table-empty">Aún no hay filas. Presiona “Nueva fila” para comenzar.</td></tr> : rows.map((row, index) => editingRowId === row.id ? null : <tr key={row.id}><td className="matrix-number">{index + 1}</td><td>{row.objective || '—'}</td><td>{row.action_plan || '—'}</td><td>{row.responsible_manager_id ? managerById.get(row.responsible_manager_id)?.name || row.responsible_text || '—' : row.responsible_text || '—'}</td><td>{row.priority || '—'}</td><td>{row.milestones || '—'}</td><td>{row.kpi || '—'}</td><td>{row.target || '—'}</td><td>{row.start_date || '—'}</td><td>{row.end_date || '—'}</td><td>{row.risks || '—'}</td><td>{row.restrictions || '—'}</td><td>{row.support || '—'}</td><td>{row.deliverables || '—'}</td><td>{row.committee || '—'}</td>{canManage && <td><div className="matrix-row-actions"><button title="Editar" onClick={() => startEditRow(row)}><Pencil size={14}/></button><button className="danger" title="Eliminar" onClick={() => void deleteRow(row.id)}><Trash2 size={14}/></button></div></td>}</tr>)}
          </tbody></table></div>
        </section>}
      </>}

      {areaPickerOpen && <div className="matrix-modal-backdrop" onMouseDown={event => { if (event.currentTarget === event.target && !saving) setAreaPickerOpen(false) }}><div className="matrix-modal matrix-modal--area-picker"><button className="matrix-modal-close" onClick={() => setAreaPickerOpen(false)}><X size={17}/></button><small>Catálogo transversal</small><h4>Añadir área</h4><p>Busca y selecciona cualquier área de la empresa.</p><label className="matrix-area-search"><Search size={16}/><input autoFocus value={areaSearch} onChange={event => setAreaSearch(event.target.value)} placeholder="Buscar área..."/></label><div className="matrix-area-picker">{filteredAvailableAreas.length === 0 ? <div className="matrix-empty compact"><strong>{availableAreas.length ? 'No encontramos coincidencias' : 'No quedan áreas por añadir'}</strong><span>{availableAreas.length ? 'Prueba con otro nombre.' : 'Todas las áreas disponibles ya están habilitadas.'}</span></div> : filteredAvailableAreas.map(area => <button key={area.id} disabled={saving} onClick={() => void addArea(area.id)}><Building2 size={18}/><span><strong>{area.name}</strong><small>{area.directory_group === 'MATRICIAL_HU_VS' ? 'Matricial' : area.unit_code}</small></span><Plus size={15}/></button>)}</div></div></div>}

      {processFormOpen && <div className="matrix-modal-backdrop" onMouseDown={event => { if (event.currentTarget === event.target && !saving) setProcessFormOpen(false) }}><div className="matrix-modal"><button className="matrix-modal-close" onClick={() => setProcessFormOpen(false)}><X size={17}/></button><small>{selectedArea?.name}</small><h4>Nuevo proceso</h4><p>La matriz necesita un proceso. Créalo y pasaremos directamente a generar la matriz.</p><form className="matrix-modal-form" onSubmit={createProcess}><label>Nombre del proceso<input autoFocus value={processName} onChange={event => setProcessName(event.target.value)} placeholder="Ej. Gestión comercial"/></label><label>Descripción<input value={processDescription} onChange={event => setProcessDescription(event.target.value)} placeholder="Opcional"/></label><div><button type="button" onClick={() => setProcessFormOpen(false)}>Cancelar</button><button className="matrix-primary" disabled={saving || !processName.trim()}>{saving ? <LoaderCircle className="spin" size={15}/> : <Save size={15}/>} Continuar</button></div></form></div></div>}

      {matrixFormOpen && <div className="matrix-modal-backdrop" onMouseDown={event => { if (event.currentTarget === event.target && !saving) setMatrixFormOpen(false) }}><div className="matrix-modal"><button className="matrix-modal-close" onClick={() => setMatrixFormOpen(false)}><X size={17}/></button><small>{selectedProcess?.name}</small><h4>Generar matriz</h4><form className="matrix-modal-form" onSubmit={createMatrix}><label>Nombre de la matriz<input autoFocus value={matrixName} onChange={event => setMatrixName(event.target.value)}/></label><label>Descripción<input value={matrixDescription} onChange={event => setMatrixDescription(event.target.value)} placeholder="Opcional"/></label><div><button type="button" onClick={() => setMatrixFormOpen(false)}>Cancelar</button><button className="matrix-primary" disabled={saving}>{saving ? <LoaderCircle className="spin" size={15}/> : <Save size={15}/>} Generar matriz</button></div></form></div></div>}
    </div>
  )
}
