import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, Building2, Check, Download, LoaderCircle, Pencil, Plus, Trash2, X } from 'lucide-react'
import { supabase } from './lib/supabase'
import './matrix-workspace.css'

type UnitCode = 'HU' | 'DEP' | 'VS' | 'HOT' | 'CENTRAL'
type DirectoryGroup = 'GENERAL' | 'HU' | 'MATRICIAL_HU_VS'
type WorkspacePage = 'areas' | 'sheet'
type Area = { id: string; name: string; unit_code: string; directory_group: DirectoryGroup }
type Process = { id: string; management_id: string; unit_code: string; directory_group: DirectoryGroup }
type Matrix = { id: string; name: string; description: string | null; process_id: string; status: 'DRAFT' | 'IN_PROGRESS' | 'REVIEW' | 'APPROVED'; created_at?: string }
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

const XLSX_MODULE_URL = 'https://unpkg.com/xlsx@0.18.5/xlsx.mjs'
const emptyRow: RowDraft = {
  objective: '', action_plan: '', responsible_manager_id: null, responsible_text: '', priority: '', milestones: '', kpi: '', target: '', start_date: '', end_date: '',
  risks: '', restrictions: '', support: '', deliverables: '', committee: '', status: 'DRAFT',
}
const unitAccent: Record<UnitCode, string> = { CENTRAL: 'central', HU: 'hu', DEP: 'dep', VS: 'vs', HOT: 'hot' }

function formatDate(value: string | null) {
  if (!value) return '—'
  const [year, month, day] = value.split('-')
  return year && month && day ? `${day}/${month}/${year}` : value
}

function priorityClass(value: string | null) {
  const normalized = (value || '').trim().toLowerCase()
  if (normalized === 'alta') return 'high'
  if (normalized === 'media') return 'medium'
  if (normalized === 'baja') return 'low'
  return 'none'
}

export default function MatrixWorkspace({ periodId, year, unitCode, unitName, canManage, onError, onNotice }: Props) {
  const [page, setPage] = useState<WorkspacePage>('areas')
  const [areas, setAreas] = useState<Area[]>([])
  const [processes, setProcesses] = useState<Process[]>([])
  const [matrices, setMatrices] = useState<Matrix[]>([])
  const [managers, setManagers] = useState<Manager[]>([])
  const [rows, setRows] = useState<MatrixRow[]>([])
  const [selectedAreaId, setSelectedAreaId] = useState('')
  const [selectedMatrixId, setSelectedMatrixId] = useState('')
  const [loading, setLoading] = useState(true)
  const [rowsLoading, setRowsLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [rowFormOpen, setRowFormOpen] = useState(false)
  const [editingRowId, setEditingRowId] = useState<string | null>(null)
  const [rowDraft, setRowDraft] = useState<RowDraft>(emptyRow)

  const selectedArea = areas.find(item => item.id === selectedAreaId) || null
  const selectedMatrix = matrices.find(item => item.id === selectedMatrixId) || null
  const managerById = useMemo(() => new Map(managers.map(item => [item.id, item])), [managers])
  const firstResponsible = useMemo(() => {
    const row = rows.find(item => item.responsible_manager_id || item.responsible_text)
    if (!row) return 'Sin asignar'
    return row.responsible_manager_id ? managerById.get(row.responsible_manager_id)?.name || row.responsible_text || 'Sin asignar' : row.responsible_text || 'Sin asignar'
  }, [rows, managerById])

  useEffect(() => {
    setPage('areas')
    setSelectedAreaId('')
    setSelectedMatrixId('')
    setRows([])
    void loadWorkspace()
  }, [periodId, unitCode])

  useEffect(() => {
    if (!selectedMatrixId) {
      setRows([])
      return
    }
    void loadRows(selectedMatrixId)
  }, [selectedMatrixId])

  async function loadManagers() {
    if (!supabase) return [] as Manager[]
    const queries = unitCode === 'HU' ? [
      supabase.from('managers').select('id,name,cargo,unit_code,directory_group').eq('unit_code', 'HU').eq('directory_group', 'HU').eq('active', true).order('name'),
      supabase.from('managers').select('id,name,cargo,unit_code,directory_group').eq('unit_code', 'HU').eq('directory_group', 'MATRICIAL_HU_VS').eq('active', true).order('name'),
    ] : unitCode === 'VS' ? [
      supabase.from('managers').select('id,name,cargo,unit_code,directory_group').eq('unit_code', 'VS').eq('active', true).order('name'),
      supabase.from('managers').select('id,name,cargo,unit_code,directory_group').eq('unit_code', 'HU').eq('directory_group', 'MATRICIAL_HU_VS').eq('active', true).order('name'),
    ] : [supabase.from('managers').select('id,name,cargo,unit_code,directory_group').eq('unit_code', unitCode).eq('active', true).order('name')]

    const results = await Promise.all(queries)
    if (results.some(result => result.error)) throw new Error('MANAGER_LOAD')
    const unique = new Map<string, Manager>()
    results.forEach(result => (result.data || []).forEach(item => unique.set(String(item.id), item as Manager)))
    return [...unique.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'))
  }

  async function loadWorkspace() {
    if (!supabase) return
    setLoading(true)
    onError('')
    try {
      const [catalogResult, allAreasResult, processResult, matrixResult, managerList] = await Promise.all([
        supabase.from('matrix_unit_area_catalog').select('management_id').eq('unit_code', unitCode).order('created_at'),
        supabase.from('managements_global').select('id,name,unit_code,directory_group').eq('active', true).order('name'),
        supabase.from('processes').select('id,management_id,unit_code,directory_group').eq('unit_code', unitCode).eq('active', true).order('created_at'),
        supabase.from('matrices').select('id,name,description,process_id,status,created_at').eq('period_id', periodId).eq('unit_code', unitCode).eq('active', true).order('created_at'),
        loadManagers(),
      ])
      if (catalogResult.error || allAreasResult.error || processResult.error || matrixResult.error) throw new Error('LOAD')

      const allAreas = (allAreasResult.data || []) as Area[]
      const areaById = new Map(allAreas.map(area => [area.id, area]))
      const uniqueAreas = new Map<string, Area>()
      ;(catalogResult.data || []).forEach(item => {
        const area = areaById.get(String(item.management_id))
        if (area && !uniqueAreas.has(area.name.toLowerCase().trim())) uniqueAreas.set(area.name.toLowerCase().trim(), area)
      })
      setAreas([...uniqueAreas.values()].sort((a, b) => a.name.localeCompare(b.name, 'es')))
      setProcesses((processResult.data || []) as Process[])
      setMatrices((matrixResult.data || []) as Matrix[])
      setManagers(managerList)
    } catch {
      onError('No pudimos cargar las áreas activadas y sus matrices.')
    } finally {
      setLoading(false)
    }
  }

  async function loadRows(matrixId: string) {
    if (!supabase) return
    setRowsLoading(true)
    const { data, error } = await supabase.from('matrix_rows').select('*').eq('matrix_id', matrixId).order('sort_order').order('created_at')
    setRowsLoading(false)
    if (error) {
      onError('No pudimos cargar la matriz.')
      return
    }
    setRows((data || []) as MatrixRow[])
  }

  function matrixForArea(areaId: string) {
    const processIds = new Set(processes.filter(item => item.management_id === areaId).map(item => item.id))
    return matrices.find(item => processIds.has(item.process_id)) || null
  }

  function openArea(area: Area) {
    const matrix = matrixForArea(area.id)
    if (!matrix) {
      onError(`La matriz de “${area.name}” todavía no está preparada. Actualiza la página; si continúa, desactiva y vuelve a activar el área en Configuración.`)
      return
    }
    setSelectedAreaId(area.id)
    setSelectedMatrixId(matrix.id)
    cancelRowEdit()
    setPage('sheet')
    onError('')
    onNotice('')
  }

  function goBack() {
    onError('')
    onNotice('')
    cancelRowEdit()
    setSelectedMatrixId('')
    setSelectedAreaId('')
    setPage('areas')
  }

  function startNewRow() {
    setEditingRowId(null)
    setRowDraft(emptyRow)
    setRowFormOpen(true)
    onError('')
    onNotice('')
  }

  function startEditRow(row: MatrixRow) {
    setEditingRowId(row.id)
    setRowDraft({
      objective: row.objective || '', action_plan: row.action_plan || '', responsible_manager_id: row.responsible_manager_id, responsible_text: row.responsible_text || '',
      priority: row.priority || '', milestones: row.milestones || '', kpi: row.kpi || '', target: row.target || '', start_date: row.start_date || '', end_date: row.end_date || '',
      risks: row.risks || '', restrictions: row.restrictions || '', support: row.support || '', deliverables: row.deliverables || '', committee: row.committee || '', status: row.status || 'DRAFT',
    })
    setRowFormOpen(true)
  }

  function cancelRowEdit() {
    setEditingRowId(null)
    setRowFormOpen(false)
    setRowDraft(emptyRow)
  }

  function updateDraft<K extends keyof RowDraft>(key: K, value: RowDraft[K]) {
    setRowDraft(current => ({ ...current, [key]: value }))
  }

  async function saveRow() {
    if (!supabase || !selectedMatrix || !canManage) return
    if (!String(rowDraft.objective || '').trim()) {
      onError('Escribe la acción antes de guardar.')
      return
    }
    setSaving(true)
    onError('')
    onNotice('')
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
    const result = editingRowId ? await supabase.from('matrix_rows').update(payload).eq('id', editingRowId) : await supabase.from('matrix_rows').insert(payload)
    setSaving(false)
    if (result.error) {
      onError('No pudimos guardar la fila.')
      return
    }
    const wasEditing = Boolean(editingRowId)
    cancelRowEdit()
    onNotice(wasEditing ? 'Fila actualizada.' : 'Fila agregada.')
    await loadRows(selectedMatrix.id)
  }

  async function deleteRow(id: string) {
    if (!supabase || !canManage || !selectedMatrix) return
    const { error } = await supabase.from('matrix_rows').delete().eq('id', id)
    if (error) {
      onError('No pudimos eliminar la fila.')
      return
    }
    onNotice('Fila eliminada.')
    await loadRows(selectedMatrix.id)
  }

  async function exportExcel() {
    if (!selectedMatrix) return
    setExporting(true)
    onError('')
    try {
      const XLSX = await import(/* @vite-ignore */ XLSX_MODULE_URL)
      const exportRows = rows.map((row, index) => ({
        'N°': index + 1,
        Acción: row.objective || '',
        Responsable: row.responsible_manager_id ? managerById.get(row.responsible_manager_id)?.name || row.responsible_text || '' : row.responsible_text || '',
        Prioridad: row.priority || '',
        'Hitos / Fechas': row.milestones || '',
        'KPI (Cuantitativo)': row.kpi || '',
        Inicio: row.start_date || '',
        Fin: row.end_date || '',
        'Riesgos de no ejecutar': row.risks || '',
        Restricciones: row.restrictions || '',
        Soporte: row.support || '',
        Entregable: row.deliverables || '',
        Comité: row.committee || '',
      }))
      const sheet = XLSX.utils.json_to_sheet(exportRows)
      sheet['!cols'] = [{ wch: 6 }, { wch: 38 }, { wch: 28 }, { wch: 13 }, { wch: 30 }, { wch: 24 }, { wch: 14 }, { wch: 14 }, { wch: 30 }, { wch: 24 }, { wch: 22 }, { wch: 24 }, { wch: 20 }]
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, sheet, 'Plan de Acción')
      XLSX.writeFile(workbook, `Plan_de_Accion_${unitCode}_${selectedArea?.name || 'Matriz'}_${year}.xlsx`)
    } catch {
      onError('No pudimos exportar la matriz a Excel.')
    } finally {
      setExporting(false)
    }
  }

  const tableColSpan = canManage ? 14 : 13

  return <div className={`matrix-workspace matrix-workspace--${unitAccent[unitCode]} ${page === 'sheet' ? 'matrix-workspace--sheet' : ''}`}>
    {page === 'areas' && <>
      <section className="matrix-intro">
        <div><span className="matrix-kicker">Periodo {year} · {unitCode}</span><h3>Matrices de {unitName}</h3><p>Las áreas se activan en <strong>Configuración → Activar áreas por unidad</strong>. Al activar un área, su matriz queda preparada automáticamente.</p></div>
      </section>

      {loading ? <div className="matrix-loading"><LoaderCircle className="spin" size={22} /> Cargando matrices...</div> : <section className="matrix-stage">
        <div className="matrix-stage-head"><div><small>Áreas activadas para {unitName}</small><h4>Selecciona un área</h4><p>Presiona un área para abrir directamente su matriz de trabajo.</p></div></div>
        {areas.length === 0 ? <div className="matrix-empty"><Building2 size={24} /><strong>No hay áreas activadas</strong><span>Ve a Configuración → Activar áreas por unidad → {unitName}.</span></div> : <div className="matrix-area-grid">{areas.map(area => {
          const matrix = matrixForArea(area.id)
          return <div className="matrix-area-card" key={area.id}><button className="matrix-area-open" onClick={() => openArea(area)}><span><Building2 size={20} /></span><div><strong>{area.name}</strong><small>{matrix ? 'Matriz lista para editar' : 'Preparando matriz...'}</small></div><ArrowRight size={17} /></button></div>
        })}</div>}
      </section>}
    </>}

    {page === 'sheet' && selectedMatrix && <section className="matrix-plan-shell">
      <div className="matrix-plan-toolbar">
        <button className="matrix-plan-back" onClick={goBack}><ArrowLeft size={16} /> Volver al listado</button>
      </div>

      <div className="matrix-plan-title-row">
        <div><span className="matrix-plan-eyebrow">Matriz de Plan de Acción</span><h2>PLAN DE ACCIÓN {year}</h2></div>
        <div className="matrix-plan-actions">
          <button className="matrix-export" onClick={() => void exportExcel()} disabled={exporting}><Download size={16} /> {exporting ? 'Exportando...' : 'Exportar Excel'}</button>
          {canManage && <button className="matrix-primary" onClick={startNewRow}><Plus size={16} /> Nueva fila</button>}
        </div>
      </div>

      <div className="matrix-plan-summary">
        <div><span>Área</span><strong>{selectedArea?.name || '—'}</strong></div>
        <div><span>Unidad</span><strong>{unitName}</strong></div>
        <div><span>Responsable principal</span><strong>{firstResponsible}</strong></div>
      </div>

      <div className="matrix-sheet-card">
        <div className="matrix-sheet-scroll"><table className="matrix-sheet"><thead><tr><th>N°</th><th>Acción</th><th>Responsable</th><th>Prioridad</th><th>Hitos / Fechas</th><th>KPI (Cuantitativo)</th><th>Inicio</th><th>Fin</th><th>Riesgos de no ejecutar</th><th>Restricciones</th><th>Soporte</th><th>Entregable</th><th>Comité</th>{canManage && <th>Acciones</th>}</tr></thead><tbody>
          {rowFormOpen && <tr className="matrix-edit-row"><td>{editingRowId ? rows.findIndex(row => row.id === editingRowId) + 1 : rows.length + 1}</td><td><textarea value={rowDraft.objective || ''} onChange={e => updateDraft('objective', e.target.value)} placeholder="Escribe la acción" /></td><td><select value={rowDraft.responsible_manager_id || ''} onChange={e => updateDraft('responsible_manager_id', e.target.value || null)}><option value="">Seleccionar responsable</option>{managers.map(manager => <option key={manager.id} value={manager.id}>{manager.name}{manager.directory_group === 'MATRICIAL_HU_VS' ? ' · Matricial' : ''}</option>)}</select></td><td><select value={rowDraft.priority || ''} onChange={e => updateDraft('priority', e.target.value)}><option value="">—</option><option value="Alta">Alta</option><option value="Media">Media</option><option value="Baja">Baja</option></select></td><td><textarea value={rowDraft.milestones || ''} onChange={e => updateDraft('milestones', e.target.value)} placeholder="Hitos y fechas clave" /></td><td><textarea value={rowDraft.kpi || ''} onChange={e => updateDraft('kpi', e.target.value)} placeholder="Indicador cuantitativo" /></td><td><input type="date" value={rowDraft.start_date || ''} onChange={e => updateDraft('start_date', e.target.value)} /></td><td><input type="date" value={rowDraft.end_date || ''} onChange={e => updateDraft('end_date', e.target.value)} /></td><td><textarea value={rowDraft.risks || ''} onChange={e => updateDraft('risks', e.target.value)} /></td><td><textarea value={rowDraft.restrictions || ''} onChange={e => updateDraft('restrictions', e.target.value)} /></td><td><textarea value={rowDraft.support || ''} onChange={e => updateDraft('support', e.target.value)} /></td><td><textarea value={rowDraft.deliverables || ''} onChange={e => updateDraft('deliverables', e.target.value)} /></td><td><textarea value={rowDraft.committee || ''} onChange={e => updateDraft('committee', e.target.value)} /></td>{canManage && <td><div className="matrix-row-actions"><button title="Cancelar" onClick={cancelRowEdit}><X size={14} /></button><button className="save" title="Guardar" onClick={() => void saveRow()} disabled={saving}>{saving ? <LoaderCircle className="spin" size={14} /> : <Check size={14} />}</button></div></td>}</tr>}
          {rowsLoading ? <tr><td colSpan={tableColSpan} className="matrix-table-empty"><LoaderCircle className="spin" size={20} /> Cargando matriz...</td></tr> : rows.length === 0 && !rowFormOpen ? <tr><td colSpan={tableColSpan} className="matrix-table-empty">La matriz está lista. Presiona “Nueva fila” para comenzar.</td></tr> : rows.map((row, index) => editingRowId === row.id ? null : <tr key={row.id}><td className="matrix-number">{index + 1}</td><td className="matrix-objective-cell">{row.objective || '—'}</td><td>{row.responsible_manager_id || row.responsible_text ? <span className="matrix-person-chip">{row.responsible_manager_id ? managerById.get(row.responsible_manager_id)?.name || row.responsible_text || '—' : row.responsible_text || '—'}</span> : '—'}</td><td>{row.priority ? <span className={`matrix-priority matrix-priority--${priorityClass(row.priority)}`}>{row.priority}</span> : '—'}</td><td>{row.milestones || '—'}</td><td>{row.kpi || '—'}</td><td>{formatDate(row.start_date)}</td><td>{formatDate(row.end_date)}</td><td>{row.risks || '—'}</td><td>{row.restrictions || '—'}</td><td>{row.support || '—'}</td><td>{row.deliverables || '—'}</td><td>{row.committee || '—'}</td>{canManage && <td><div className="matrix-row-actions"><button title="Editar" onClick={() => startEditRow(row)}><Pencil size={14} /></button><button className="danger" title="Eliminar" onClick={() => void deleteRow(row.id)}><Trash2 size={14} /></button></div></td>}</tr>)}</tbody></table></div>
      </div>

      <div className="matrix-plan-footer">
        <span>Mostrando {rows.length ? 1 : 0} a {rows.length} de {rows.length} registros</span>
        <div className="matrix-pagination"><button disabled>‹</button><button className="active">1</button><button disabled>›</button></div>
      </div>
    </section>}
  </div>
}
