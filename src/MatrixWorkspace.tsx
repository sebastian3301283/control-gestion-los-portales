import { FormEvent, useEffect, useMemo, useState } from 'react'
import { ArrowRight, Building2, Check, ChevronRight, ClipboardList, LoaderCircle, Pencil, Plus, Save, Trash2, X } from 'lucide-react'
import { supabase } from './lib/supabase'
import './matrix-workspace.css'

type UnitCode = 'HU' | 'DEP' | 'VS' | 'HOT' | 'CENTRAL'
type DirectoryGroup = 'GENERAL' | 'HU' | 'MATRICIAL_HU_VS'

type Area = { id: string; name: string; unit_code: string; directory_group: DirectoryGroup }
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

const unitAccent: Record<UnitCode, string> = {
  CENTRAL: 'central', HU: 'hu', DEP: 'dep', VS: 'vs', HOT: 'hot',
}

const huGroups: Array<{ code: DirectoryGroup; label: string }> = [
  { code: 'HU', label: 'HU' },
  { code: 'MATRICIAL_HU_VS', label: 'Matricial' },
]

function statusLabel(status: Matrix['status']) {
  if (status === 'IN_PROGRESS') return 'En progreso'
  if (status === 'REVIEW') return 'En revisión'
  if (status === 'APPROVED') return 'Aprobada'
  return 'Borrador'
}

export default function MatrixWorkspace({ periodId, year, unitCode, unitName, canManage, onError, onNotice }: Props) {
  const [directoryGroup, setDirectoryGroup] = useState<DirectoryGroup>(unitCode === 'HU' ? 'HU' : 'GENERAL')
  const [areas, setAreas] = useState<Area[]>([])
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
  const [processFormOpen, setProcessFormOpen] = useState(false)
  const [matrixFormOpen, setMatrixFormOpen] = useState(false)
  const [processName, setProcessName] = useState('')
  const [processDescription, setProcessDescription] = useState('')
  const [matrixName, setMatrixName] = useState('')
  const [matrixDescription, setMatrixDescription] = useState('')
  const [rowFormOpen, setRowFormOpen] = useState(false)
  const [editingRowId, setEditingRowId] = useState<string | null>(null)
  const [rowDraft, setRowDraft] = useState<RowDraft>(emptyRow)

  const selectedArea = areas.find(item => item.id === selectedAreaId) || null
  const selectedProcess = processes.find(item => item.id === selectedProcessId) || null
  const selectedMatrix = matrices.find(item => item.id === selectedMatrixId) || null
  const areaProcesses = useMemo(() => processes.filter(item => item.management_id === selectedAreaId), [processes, selectedAreaId])
  const processMatrices = useMemo(() => matrices.filter(item => item.process_id === selectedProcessId), [matrices, selectedProcessId])
  const managerById = useMemo(() => new Map(managers.map(item => [item.id, item])), [managers])

  useEffect(() => {
    setDirectoryGroup(unitCode === 'HU' ? 'HU' : 'GENERAL')
  }, [unitCode])

  useEffect(() => {
    if (unitCode === 'CENTRAL') return
    setSelectedAreaId(''); setSelectedProcessId(''); setSelectedMatrixId(''); setRows([])
    void loadWorkspace()
  }, [periodId, unitCode, directoryGroup])

  useEffect(() => {
    if (!selectedMatrixId) { setRows([]); return }
    void loadRows(selectedMatrixId)
  }, [selectedMatrixId])

  async function loadWorkspace() {
    if (!supabase) return
    setLoading(true)
    onError('')
    const [areaResult, processResult, matrixResult, managerResult] = await Promise.all([
      supabase.from('managements_global').select('id,name,unit_code,directory_group').eq('unit_code', unitCode).eq('directory_group', directoryGroup).eq('active', true).order('name'),
      supabase.from('processes').select('id,name,description,management_id,unit_code,directory_group,sort_order').eq('unit_code', unitCode).eq('directory_group', directoryGroup).eq('active', true).order('sort_order').order('name'),
      supabase.from('matrices').select('id,name,description,process_id,status,sort_order').eq('period_id', periodId).eq('unit_code', unitCode).eq('directory_group', directoryGroup).eq('active', true).order('sort_order').order('name'),
      supabase.from('managers').select('id,name,cargo,unit_code,directory_group').eq('unit_code', unitCode).eq('directory_group', directoryGroup).eq('active', true).order('name'),
    ])
    setLoading(false)
    if (areaResult.error || processResult.error || matrixResult.error || managerResult.error) {
      onError('No pudimos cargar las áreas, procesos y matrices de esta unidad.')
      return
    }
    setAreas((areaResult.data || []) as Area[])
    setProcesses((processResult.data || []) as Process[])
    setMatrices((matrixResult.data || []) as Matrix[])
    setManagers((managerResult.data || []) as Manager[])
  }

  async function loadRows(matrixId: string) {
    if (!supabase) return
    setRowsLoading(true)
    const { data, error } = await supabase.from('matrix_rows').select('*').eq('matrix_id', matrixId).order('sort_order').order('created_at')
    setRowsLoading(false)
    if (error) { onError('No pudimos cargar la matriz.'); return }
    setRows((data || []) as MatrixRow[])
  }

  function chooseArea(id: string) {
    setSelectedAreaId(id); setSelectedProcessId(''); setSelectedMatrixId(''); setRows([]); setProcessFormOpen(false); setMatrixFormOpen(false); cancelRowEdit()
  }

  function chooseProcess(id: string) {
    setSelectedProcessId(id); setSelectedMatrixId(''); setRows([]); setMatrixFormOpen(false); cancelRowEdit()
  }

  function chooseMatrix(id: string) {
    setSelectedMatrixId(id); cancelRowEdit()
  }

  async function createProcess(event: FormEvent) {
    event.preventDefault()
    if (!supabase || !canManage || !selectedArea) return
    const name = processName.trim()
    if (!name) return
    setSaving(true); onError(''); onNotice('')
    const { error } = await supabase.from('processes').insert({
      unit_code: unitCode,
      directory_group: directoryGroup,
      management_id: selectedArea.id,
      name,
      description: processDescription.trim() || null,
      sort_order: areaProcesses.length,
    })
    setSaving(false)
    if (error) { onError(error.code === '23505' ? 'Ese proceso ya existe en el área seleccionada.' : 'No pudimos crear el proceso.'); return }
    setProcessName(''); setProcessDescription(''); setProcessFormOpen(false); onNotice('Proceso creado correctamente.'); await loadWorkspace()
  }

  async function createMatrix(event: FormEvent) {
    event.preventDefault()
    if (!supabase || !canManage || !selectedProcess) return
    const name = matrixName.trim() || `Matriz de ${selectedProcess.name}`
    setSaving(true); onError(''); onNotice('')
    const { data, error } = await supabase.from('matrices').insert({
      period_id: periodId,
      unit_code: unitCode,
      directory_group: directoryGroup,
      process_id: selectedProcess.id,
      name,
      description: matrixDescription.trim() || null,
      status: 'DRAFT',
      sort_order: processMatrices.length,
    }).select('id').single()
    setSaving(false)
    if (error || !data) { onError(error?.code === '23505' ? 'Ya existe una matriz con ese nombre para este proceso.' : 'No pudimos crear la matriz.'); return }
    setMatrixName(''); setMatrixDescription(''); setMatrixFormOpen(false); onNotice('Matriz creada correctamente.'); await loadWorkspace(); setSelectedMatrixId(String(data.id))
  }

  function startNewRow() {
    setEditingRowId(null); setRowDraft(emptyRow); setRowFormOpen(true); onError(''); onNotice('')
  }

  function startEditRow(row: MatrixRow) {
    setEditingRowId(row.id)
    setRowDraft({
      objective: row.objective || '', action_plan: row.action_plan || '', responsible_manager_id: row.responsible_manager_id,
      responsible_text: row.responsible_text || '', priority: row.priority || '', milestones: row.milestones || '', kpi: row.kpi || '', target: row.target || '',
      start_date: row.start_date || '', end_date: row.end_date || '', risks: row.risks || '', restrictions: row.restrictions || '', support: row.support || '',
      deliverables: row.deliverables || '', committee: row.committee || '', status: row.status || 'DRAFT',
    })
    setRowFormOpen(true)
  }

  function cancelRowEdit() {
    setEditingRowId(null); setRowFormOpen(false); setRowDraft(emptyRow)
  }

  function updateDraft<K extends keyof RowDraft>(key: K, value: RowDraft[K]) {
    setRowDraft(current => ({ ...current, [key]: value }))
  }

  async function saveRow() {
    if (!supabase || !selectedMatrix || !canManage) return
    if (!String(rowDraft.objective || '').trim() && !String(rowDraft.action_plan || '').trim()) {
      onError('Escribe al menos el objetivo o el plan de acción de la fila.')
      return
    }
    setSaving(true); onError(''); onNotice('')
    const manager = rowDraft.responsible_manager_id ? managerById.get(rowDraft.responsible_manager_id) : null
    const payload = {
      matrix_id: selectedMatrix.id,
      objective: rowDraft.objective || null,
      action_plan: rowDraft.action_plan || null,
      responsible_manager_id: rowDraft.responsible_manager_id || null,
      responsible_text: manager?.name || rowDraft.responsible_text || null,
      priority: rowDraft.priority || null,
      milestones: rowDraft.milestones || null,
      kpi: rowDraft.kpi || null,
      target: rowDraft.target || null,
      start_date: rowDraft.start_date || null,
      end_date: rowDraft.end_date || null,
      risks: rowDraft.risks || null,
      restrictions: rowDraft.restrictions || null,
      support: rowDraft.support || null,
      deliverables: rowDraft.deliverables || null,
      committee: rowDraft.committee || null,
      status: rowDraft.status,
      sort_order: editingRowId ? rows.find(item => item.id === editingRowId)?.sort_order || 0 : rows.length,
    }
    const result = editingRowId
      ? await supabase.from('matrix_rows').update(payload).eq('id', editingRowId)
      : await supabase.from('matrix_rows').insert(payload)
    setSaving(false)
    if (result.error) { onError('No pudimos guardar la fila de la matriz.'); return }
    cancelRowEdit(); onNotice(editingRowId ? 'Fila actualizada.' : 'Fila agregada a la matriz.'); await loadRows(selectedMatrix.id)
  }

  async function deleteRow(id: string) {
    if (!supabase || !canManage || !selectedMatrix) return
    const { error } = await supabase.from('matrix_rows').delete().eq('id', id)
    if (error) { onError('No pudimos eliminar la fila.'); return }
    onNotice('Fila eliminada.'); await loadRows(selectedMatrix.id)
  }

  if (unitCode === 'CENTRAL') {
    return (
      <section className="matrix-placeholder matrix-placeholder--central">
        <span><ClipboardList size={26}/></span>
        <div><small>Etapa de matrices</small><h3>Central se configurará después</h3><p>Primero construiremos las matrices de VS, HU, Departamentos y Hoteles. Los lineamientos se trabajarán después a partir de esta estructura.</p></div>
      </section>
    )
  }

  return (
    <div className={`matrix-workspace matrix-workspace--${unitAccent[unitCode]}`}>
      <section className="matrix-intro">
        <div><span className="matrix-kicker">Periodo {year} · {unitCode}</span><h3>Matrices de {unitName}</h3><p>La ruta será <strong>Área → Proceso → Matriz</strong>. Los lineamientos se definirán después a partir de la información consolidada en las matrices.</p></div>
        <div className="matrix-route"><span className={selectedArea ? 'done' : 'active'}>1. Área</span><ChevronRight size={15}/><span className={selectedProcess ? 'done' : selectedArea ? 'active' : ''}>2. Proceso</span><ChevronRight size={15}/><span className={selectedMatrix ? 'done' : selectedProcess ? 'active' : ''}>3. Matriz</span></div>
      </section>

      {unitCode === 'HU' && <div className="matrix-hu-tabs">{huGroups.map(group => <button key={group.code} className={directoryGroup === group.code ? 'active' : ''} onClick={() => setDirectoryGroup(group.code)}>{group.label}</button>)}</div>}

      {loading ? <div className="matrix-loading"><LoaderCircle className="spin" size={22}/> Cargando estructura...</div> : <>
        <section className="matrix-stage">
          <div className="matrix-stage-head"><div><small>Paso 1</small><h4>Selecciona un área</h4><p>Las áreas vienen del catálogo de Bonistas en Configuración.</p></div></div>
          {areas.length === 0 ? <div className="matrix-empty"><Building2 size={24}/><strong>No hay áreas configuradas</strong><span>Primero carga los Bonistas y sus áreas en Configuración.</span></div> : <div className="matrix-area-grid">{areas.map(area => {
            const count = processes.filter(process => process.management_id === area.id).length
            return <button key={area.id} className={selectedAreaId === area.id ? 'selected' : ''} onClick={() => chooseArea(area.id)}><span><Building2 size={20}/></span><div><strong>{area.name}</strong><small>{count} proceso{count === 1 ? '' : 's'}</small></div><ArrowRight size={17}/></button>
          })}</div>}
        </section>

        {selectedArea && <section className="matrix-stage">
          <div className="matrix-stage-head"><div><small>Paso 2 · {selectedArea.name}</small><h4>Procesos del área</h4><p>Cada proceso puede tener una o varias matrices durante el periodo.</p></div>{canManage && <button className="matrix-primary" onClick={() => setProcessFormOpen(value => !value)}><Plus size={15}/> Nuevo proceso</button>}</div>
          {processFormOpen && <form className="matrix-inline-form" onSubmit={createProcess}><label>Nombre del proceso<input autoFocus value={processName} onChange={event => setProcessName(event.target.value)} placeholder="Ej. Gestión comercial"/></label><label>Descripción<input value={processDescription} onChange={event => setProcessDescription(event.target.value)} placeholder="Opcional"/></label><div><button type="button" onClick={() => setProcessFormOpen(false)}>Cancelar</button><button className="matrix-primary" disabled={saving || !processName.trim()}>{saving ? <LoaderCircle className="spin" size={15}/> : <Save size={15}/>} Guardar</button></div></form>}
          {areaProcesses.length === 0 ? <div className="matrix-empty compact"><ClipboardList size={22}/><strong>Aún no hay procesos</strong><span>Crea el primer proceso de {selectedArea.name}.</span></div> : <div className="matrix-process-grid">{areaProcesses.map(process => {
            const count = matrices.filter(matrix => matrix.process_id === process.id).length
            return <button key={process.id} className={selectedProcessId === process.id ? 'selected' : ''} onClick={() => chooseProcess(process.id)}><span className="process-index">{String(areaProcesses.indexOf(process) + 1).padStart(2, '0')}</span><div><strong>{process.name}</strong><small>{process.description || `${count} matriz${count === 1 ? '' : 'ces'}`}</small></div><ArrowRight size={17}/></button>
          })}</div>}
        </section>}

        {selectedProcess && <section className="matrix-stage">
          <div className="matrix-stage-head"><div><small>Paso 3 · {selectedArea?.name} · {selectedProcess.name}</small><h4>Matrices del proceso</h4><p>Abre una matriz para trabajarla como una hoja de Excel.</p></div>{canManage && <button className="matrix-primary" onClick={() => { setMatrixName(`Matriz de ${selectedProcess.name}`); setMatrixFormOpen(value => !value) }}><Plus size={15}/> Nueva matriz</button>}</div>
          {matrixFormOpen && <form className="matrix-inline-form" onSubmit={createMatrix}><label>Nombre de la matriz<input autoFocus value={matrixName} onChange={event => setMatrixName(event.target.value)}/></label><label>Descripción<input value={matrixDescription} onChange={event => setMatrixDescription(event.target.value)} placeholder="Opcional"/></label><div><button type="button" onClick={() => setMatrixFormOpen(false)}>Cancelar</button><button className="matrix-primary" disabled={saving}>{saving ? <LoaderCircle className="spin" size={15}/> : <Save size={15}/>} Crear matriz</button></div></form>}
          {processMatrices.length === 0 ? <div className="matrix-empty compact"><ClipboardList size={22}/><strong>Aún no hay matrices</strong><span>Crea la primera matriz de este proceso.</span></div> : <div className="matrix-card-grid">{processMatrices.map(matrix => <button key={matrix.id} className={selectedMatrixId === matrix.id ? 'selected' : ''} onClick={() => chooseMatrix(matrix.id)}><div><span className={`matrix-status matrix-status--${matrix.status.toLowerCase()}`}>{statusLabel(matrix.status)}</span><strong>{matrix.name}</strong><small>{matrix.description || 'Matriz editable'}</small></div><ArrowRight size={18}/></button>)}</div>}
        </section>}

        {selectedMatrix && <section className="matrix-sheet-card">
          <div className="matrix-sheet-head"><div><small>{selectedArea?.name} → {selectedProcess?.name}</small><h4>{selectedMatrix.name}</h4><p>Completa la información directamente en la matriz. Los lineamientos se trabajarán en una etapa posterior.</p></div>{canManage && <button className="matrix-primary" onClick={startNewRow}><Plus size={15}/> Nueva fila</button>}</div>
          <div className="matrix-sheet-scroll"><table className="matrix-sheet"><thead><tr><th>N°</th><th>Objetivo</th><th>Plan de acción</th><th>Responsable</th><th>Prioridad</th><th>Hitos</th><th>KPI</th><th>Objetivo KPI</th><th>Fecha inicio</th><th>Fecha fin</th><th>Riesgos</th><th>Restricciones</th><th>Soporte</th><th>Entregables</th><th>Comité</th>{canManage && <th>Acciones</th>}</tr></thead><tbody>
            {rowFormOpen && <tr className="matrix-edit-row"><td>{editingRowId ? rows.findIndex(row => row.id === editingRowId) + 1 : rows.length + 1}</td><td><textarea value={rowDraft.objective || ''} onChange={e => updateDraft('objective', e.target.value)}/></td><td><textarea value={rowDraft.action_plan || ''} onChange={e => updateDraft('action_plan', e.target.value)}/></td><td><select value={rowDraft.responsible_manager_id || ''} onChange={e => updateDraft('responsible_manager_id', e.target.value || null)}><option value="">Seleccionar</option>{managers.map(manager => <option key={manager.id} value={manager.id}>{manager.name}</option>)}</select></td><td><select value={rowDraft.priority || ''} onChange={e => updateDraft('priority', e.target.value)}><option value="">—</option><option value="Alta">Alta</option><option value="Media">Media</option><option value="Baja">Baja</option></select></td><td><textarea value={rowDraft.milestones || ''} onChange={e => updateDraft('milestones', e.target.value)}/></td><td><textarea value={rowDraft.kpi || ''} onChange={e => updateDraft('kpi', e.target.value)}/></td><td><input value={rowDraft.target || ''} onChange={e => updateDraft('target', e.target.value)}/></td><td><input type="date" value={rowDraft.start_date || ''} onChange={e => updateDraft('start_date', e.target.value)}/></td><td><input type="date" value={rowDraft.end_date || ''} onChange={e => updateDraft('end_date', e.target.value)}/></td><td><textarea value={rowDraft.risks || ''} onChange={e => updateDraft('risks', e.target.value)}/></td><td><textarea value={rowDraft.restrictions || ''} onChange={e => updateDraft('restrictions', e.target.value)}/></td><td><textarea value={rowDraft.support || ''} onChange={e => updateDraft('support', e.target.value)}/></td><td><textarea value={rowDraft.deliverables || ''} onChange={e => updateDraft('deliverables', e.target.value)}/></td><td><textarea value={rowDraft.committee || ''} onChange={e => updateDraft('committee', e.target.value)}/></td><td><div className="matrix-row-actions"><button title="Cancelar" type="button" onClick={cancelRowEdit}><X size={14}/></button><button className="save" title="Guardar" type="button" onClick={() => void saveRow()} disabled={saving}>{saving ? <LoaderCircle className="spin" size={14}/> : <Check size={14}/>}</button></div></td></tr>}
            {rowsLoading ? <tr><td colSpan={16} className="matrix-table-empty"><LoaderCircle className="spin" size={20}/> Cargando matriz...</td></tr> : rows.length === 0 && !rowFormOpen ? <tr><td colSpan={16} className="matrix-table-empty">Aún no hay filas. Presiona “Nueva fila” para comenzar.</td></tr> : rows.map((row, index) => editingRowId === row.id ? null : <tr key={row.id}><td className="matrix-number">{index + 1}</td><td>{row.objective || '—'}</td><td>{row.action_plan || '—'}</td><td>{row.responsible_manager_id ? managerById.get(row.responsible_manager_id)?.name || row.responsible_text || '—' : row.responsible_text || '—'}</td><td>{row.priority || '—'}</td><td>{row.milestones || '—'}</td><td>{row.kpi || '—'}</td><td>{row.target || '—'}</td><td>{row.start_date || '—'}</td><td>{row.end_date || '—'}</td><td>{row.risks || '—'}</td><td>{row.restrictions || '—'}</td><td>{row.support || '—'}</td><td>{row.deliverables || '—'}</td><td>{row.committee || '—'}</td>{canManage && <td><div className="matrix-row-actions"><button title="Editar" onClick={() => startEditRow(row)}><Pencil size={14}/></button><button className="danger" title="Eliminar" onClick={() => void deleteRow(row.id)}><Trash2 size={14}/></button></div></td>}</tr>)}
          </tbody></table></div>
        </section>}
      </>}
    </div>
  )
}
