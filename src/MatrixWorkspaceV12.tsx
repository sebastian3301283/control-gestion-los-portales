import { Check, LoaderCircle, Plus, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import MatrixWorkspaceV11 from './MatrixWorkspaceV11'
import { supabase } from './lib/supabase'
import { actionPlanFromSubpoints, buildCentralSubpointDrafts, normalizeCentralSubpointRows, type CentralSubpointDraft } from './central-subpoint-records.js'
import './matrix-workspace-v12.css'

type UnitCode = 'HU' | 'DEP' | 'VS' | 'HOT' | 'CENTRAL'
type Props = {
  periodId: string
  year: number
  unitCode: UnitCode
  unitName: string
  canManage: boolean
  onError: (message: string) => void
  onNotice: (message: string) => void
  onViewGuidelines?: () => void
}
type Manager = { id: string; name: string; cargo: string | null }
type Guideline = { id: string; guideline_text: string; sort_order: number }
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
type SubpointRecord = {
  id: string
  matrix_row_id: string
  text: string
  milestones: string | null
  kpi: string | null
  start_date: string | null
  end_date: string | null
  sort_order: number
}
type FormState = {
  objective_group: string
  objective: string
  responsible_manager_id: string
  responsible_text: string
  priority: string
  risks: string
  restrictions: string
  support: string
  deliverables: string
  committee: string
}
type LockAttempt = { ok: boolean; owner_email: string; owner_name: string }

const emptyForm: FormState = {
  objective_group: '', objective: '', responsible_manager_id: '', responsible_text: '', priority: '',
  risks: '', restrictions: '', support: '', deliverables: '', committee: '',
}
const emptySubpoint = (): CentralSubpointDraft => ({ id: null, text: '', milestones: '', kpi: '', start_date: '', end_date: '' })

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  const [year, month, day] = value.split('-')
  return year && month && day ? `${day}/${month}/${year}` : value
}

export default function MatrixWorkspaceV12(props: Props) {
  if (props.unitCode !== 'CENTRAL') return <MatrixWorkspaceV11 {...props} />

  const hostRef = useRef<HTMLDivElement>(null)
  const matrixIdRef = useRef('')
  const managementIdRef = useRef('')
  const areaNameRef = useRef('')
  const lockedRowIdRef = useRef<string | null>(null)
  const [revision, setRevision] = useState(0)
  const [matrixId, setMatrixId] = useState('')
  const [rows, setRows] = useState<MatrixRow[]>([])
  const [subpointsByRow, setSubpointsByRow] = useState<Record<string, SubpointRecord[]>>({})
  const [managers, setManagers] = useState<Manager[]>([])
  const [guidelines, setGuidelines] = useState<Guideline[]>([])
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingRowId, setEditingRowId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [subpointDrafts, setSubpointDrafts] = useState<CentralSubpointDraft[]>([emptySubpoint()])
  const [saving, setSaving] = useState(false)

  const managerById = useMemo(() => new Map(managers.map(item => [item.id, item])), [managers])

  useEffect(() => {
    if (!supabase) return
    void supabase.from('managers').select('id,name,cargo').eq('active', true).order('name').then(({ data }) => setManagers((data || []) as Manager[]))
  }, [])

  async function loadMatrixData(nextMatrixId: string) {
    if (!supabase || !nextMatrixId) return
    const rowResult = await supabase.from('matrix_rows')
      .select('id,objective_group,objective,action_plan,responsible_manager_id,responsible_text,priority,milestones,kpi,start_date,end_date,risks,restrictions,support,deliverables,committee,status,sort_order')
      .eq('matrix_id', nextMatrixId).order('sort_order').order('created_at')
    if (rowResult.error) return
    const nextRows = (rowResult.data || []) as MatrixRow[]
    setRows(nextRows)
    const ids = nextRows.map(item => item.id)
    if (!ids.length) { setSubpointsByRow({}); return }
    const detailResult = await supabase.from('matrix_row_subpoints')
      .select('id,matrix_row_id,text,milestones,kpi,start_date,end_date,sort_order')
      .in('matrix_row_id', ids).order('sort_order').order('created_at')
    if (detailResult.error) return
    const grouped: Record<string, SubpointRecord[]> = {}
    ;((detailResult.data || []) as SubpointRecord[]).forEach(item => {
      if (!grouped[item.matrix_row_id]) grouped[item.matrix_row_id] = []
      grouped[item.matrix_row_id].push(item)
    })
    setSubpointsByRow(grouped)
  }

  async function resolveCurrentContext(force = false) {
    if (!supabase) return null
    const areaName = hostRef.current?.querySelector<HTMLElement>('.matrix-v5-summary > div:first-child strong')?.textContent?.trim() || ''
    if (!areaName) return null
    if (!force && areaName === areaNameRef.current && matrixIdRef.current && managementIdRef.current) {
      return { matrixId: matrixIdRef.current, managementId: managementIdRef.current }
    }

    const { data: managementData } = await supabase.from('managements_global').select('id').eq('unit_code', props.unitCode).eq('active', true).ilike('name', areaName).limit(1).maybeSingle()
    if (!managementData?.id) return null
    const managementId = String(managementData.id)
    const { data: processData } = await supabase.from('processes').select('id').eq('unit_code', props.unitCode).eq('management_id', managementId).eq('active', true)
    const processIds = (processData || []).map(item => String(item.id))
    if (!processIds.length) return null
    const { data: matrixData } = await supabase.from('matrices').select('id').eq('period_id', props.periodId).eq('unit_code', props.unitCode).eq('active', true).in('process_id', processIds).limit(1).maybeSingle()
    if (!matrixData?.id) return null

    const nextMatrixId = String(matrixData.id)
    areaNameRef.current = areaName
    managementIdRef.current = managementId
    matrixIdRef.current = nextMatrixId
    setMatrixId(nextMatrixId)
    const guidelineResult = await supabase.from('planning_guidelines').select('id,guideline_text,sort_order').eq('period_id', props.periodId).eq('unit_code', props.unitCode).eq('management_id', managementId).eq('active', true).order('sort_order').order('created_at')
    setGuidelines((guidelineResult.data || []) as Guideline[])
    await loadMatrixData(nextMatrixId)
    return { matrixId: nextMatrixId, managementId }
  }

  useEffect(() => {
    let stopped = false
    const tick = async () => { if (!stopped) await resolveCurrentContext() }
    void tick()
    const timer = window.setInterval(() => void tick(), 1800)
    return () => { stopped = true; window.clearInterval(timer) }
  }, [props.periodId, props.unitCode, revision])

  useEffect(() => {
    if (!matrixId) return
    const timer = window.setInterval(() => { if (!editorOpen) void loadMatrixData(matrixId) }, 6000)
    return () => window.clearInterval(timer)
  }, [matrixId, editorOpen])

  async function acquireLock(rowId: string) {
    if (!supabase) return false
    const { data, error } = await supabase.rpc('try_lock_matrix_row', { row_id_input: rowId })
    if (error) { props.onError('No pudimos reservar este objetivo para edición.'); return false }
    const result = data as LockAttempt | null
    if (!result?.ok) {
      props.onError(`${result?.owner_name || result?.owner_email || 'Otro usuario'} está editando este objetivo.`)
      return false
    }
    lockedRowIdRef.current = rowId
    return true
  }

  async function releaseLock() {
    const rowId = lockedRowIdRef.current
    if (!supabase || !rowId) return
    await supabase.rpc('release_matrix_row_lock', { row_id_input: rowId })
    lockedRowIdRef.current = null
  }

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (supabase && lockedRowIdRef.current) void supabase.rpc('heartbeat_matrix_row_lock', { row_id_input: lockedRowIdRef.current })
    }, 25000)
    return () => window.clearInterval(timer)
  }, [])
  useEffect(() => () => { if (supabase && lockedRowIdRef.current) void supabase.rpc('release_matrix_row_lock', { row_id_input: lockedRowIdRef.current }) }, [])

  function scrollEditorIntoView() {
    window.setTimeout(() => hostRef.current?.querySelector('.matrix-v12-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 40)
  }

  async function openNewEditor() {
    const context = await resolveCurrentContext(true)
    if (!context) { props.onError('No pudimos identificar la matriz activa.'); return }
    props.onError(''); props.onNotice('')
    setEditingRowId(null)
    setForm({ ...emptyForm, objective_group: guidelines.length === 1 ? guidelines[0].guideline_text : '' })
    setSubpointDrafts([emptySubpoint()])
    setEditorOpen(true)
    scrollEditorIntoView()
  }

  async function openEditEditor(rowId: string) {
    const row = rows.find(item => item.id === rowId)
    if (!row) { props.onError('No pudimos cargar el objetivo seleccionado.'); return }
    if (!(await acquireLock(rowId))) return
    props.onError(''); props.onNotice('')
    setEditingRowId(rowId)
    setForm({
      objective_group: row.objective_group || '', objective: row.objective || '', responsible_manager_id: row.responsible_manager_id || '', responsible_text: row.responsible_text || '', priority: row.priority || '',
      risks: row.risks || '', restrictions: row.restrictions || '', support: row.support || '', deliverables: row.deliverables || '', committee: row.committee || '',
    })
    const details = buildCentralSubpointDrafts(subpointsByRow[rowId] || [], row)
    setSubpointDrafts(details.length ? details : [emptySubpoint()])
    setEditorOpen(true)
    scrollEditorIntoView()
  }

  async function cancelEditor() {
    setEditorOpen(false); setEditingRowId(null); setForm(emptyForm); setSubpointDrafts([emptySubpoint()])
    await releaseLock()
  }

  function updateSubpoint(index: number, key: keyof CentralSubpointDraft, value: string) {
    setSubpointDrafts(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item))
  }

  async function saveEditor() {
    if (!supabase || saving) return
    const context = await resolveCurrentContext(true)
    if (!context) { props.onError('No pudimos identificar la matriz activa.'); return }
    if (!form.objective_group.trim()) { props.onError('Selecciona el lineamiento.'); return }
    if (!form.objective.trim()) { props.onError('Escribe el objetivo general.'); return }
    const detailRows = normalizeCentralSubpointRows(subpointDrafts)
    if (!detailRows.length) { props.onError('Añade al menos un subpunto.'); return }

    setSaving(true); props.onError(''); props.onNotice('')
    const firstDetail = detailRows[0]
    const manager = form.responsible_manager_id ? managerById.get(form.responsible_manager_id) : null
    const rowPayload = {
      matrix_id: context.matrixId,
      objective_group: form.objective_group.trim(),
      objective: form.objective.trim(),
      action_plan: actionPlanFromSubpoints(detailRows),
      responsible_manager_id: form.responsible_manager_id || null,
      responsible_text: manager?.name || form.responsible_text.trim() || null,
      priority: form.priority || null,
      milestones: firstDetail?.milestones || null,
      kpi: firstDetail?.kpi || null,
      target: null,
      start_date: firstDetail?.start_date || null,
      end_date: firstDetail?.end_date || null,
      risks: form.risks.trim() || null,
      restrictions: form.restrictions.trim() || null,
      support: form.support.trim() || null,
      deliverables: form.deliverables.trim() || null,
      committee: form.committee.trim() || null,
      status: 'DRAFT' as const,
      sort_order: editingRowId ? rows.find(item => item.id === editingRowId)?.sort_order || 0 : rows.length,
    }

    let rowId = editingRowId
    let created = false
    if (editingRowId) {
      const { error } = await supabase.from('matrix_rows').update(rowPayload).eq('id', editingRowId)
      if (error) { setSaving(false); props.onError('No pudimos actualizar el objetivo general.'); return }
    } else {
      const { data, error } = await supabase.from('matrix_rows').insert(rowPayload).select('id').single()
      if (error || !data?.id) { setSaving(false); props.onError('No pudimos crear el objetivo general.'); return }
      rowId = String(data.id); created = true
    }

    const previousDetails = rowId ? (subpointsByRow[rowId] || []) : []
    if (rowId) {
      const deleteResult = await supabase.from('matrix_row_subpoints').delete().eq('matrix_row_id', rowId)
      if (deleteResult.error) {
        if (created) await supabase.from('matrix_rows').delete().eq('id', rowId)
        setSaving(false); props.onError('No pudimos preparar los subpuntos para guardar.'); return
      }
      const insertResult = await supabase.from('matrix_row_subpoints').insert(detailRows.map(item => ({ ...item, matrix_row_id: rowId })))
      if (insertResult.error) {
        if (previousDetails.length) {
          await supabase.from('matrix_row_subpoints').insert(previousDetails.map(({ id: _id, ...item }) => item))
        }
        if (created) await supabase.from('matrix_rows').delete().eq('id', rowId)
        setSaving(false); props.onError('No pudimos guardar el detalle de los subpuntos.'); return
      }
    }

    setSaving(false)
    setEditorOpen(false); setEditingRowId(null); setForm(emptyForm); setSubpointDrafts([emptySubpoint()])
    await releaseLock()
    await loadMatrixData(context.matrixId)
    setRevision(value => value + 1)
    props.onNotice(created ? 'Objetivo general y subpuntos agregados.' : 'Objetivo general y subpuntos actualizados.')
  }

  function rowIdForButton(button: HTMLButtonElement) {
    const tr = button.closest('tr')
    const root = hostRef.current
    if (!tr || !root) return ''
    const dataRows = Array.from(root.querySelectorAll<HTMLTableRowElement>('.matrix-v5-sheet tbody > tr')).filter(item =>
      !item.classList.contains('matrix-v5-objective-row') && !item.classList.contains('matrix-v5-edit-row') && Boolean(item.querySelector('.matrix-v5-row-actions')),
    )
    const index = dataRows.indexOf(tr as HTMLTableRowElement)
    return index >= 0 ? rows[index]?.id || '' : ''
  }

  function handleCapture(event: ReactMouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement
    const newButton = target.closest<HTMLButtonElement>('.matrix-v5-primary')
    if (newButton && newButton.textContent?.toLowerCase().includes('nueva fila')) {
      event.preventDefault(); event.stopPropagation(); void openNewEditor(); return
    }
    const actionButton = target.closest<HTMLButtonElement>('.matrix-v5-row-actions button')
    if (!actionButton || actionButton.classList.contains('danger')) return
    const rowId = rowIdForButton(actionButton)
    if (!rowId) return
    event.preventDefault(); event.stopPropagation(); void openEditEditor(rowId)
  }

  useEffect(() => {
    const root = hostRef.current
    if (!root) return
    const enhance = () => {
      const dataRows = Array.from(root.querySelectorAll<HTMLTableRowElement>('.matrix-v5-sheet tbody > tr')).filter(item =>
        !item.classList.contains('matrix-v5-objective-row') && !item.classList.contains('matrix-v5-edit-row') && Boolean(item.querySelector('.matrix-v5-row-actions')),
      )
      dataRows.forEach((tr, index) => {
        const row = rows[index]
        if (!row) return
        const details = buildCentralSubpointDrafts(subpointsByRow[row.id] || [], row)
        const signature = JSON.stringify([row.objective, details.map(item => [item.text,item.milestones,item.kpi,item.start_date,item.end_date])])
        if (tr.dataset.v12Signature === signature && tr.querySelector('.matrix-v12-objective-stack')) return
        tr.dataset.v12Signature = signature
        const cells = Array.from(tr.cells)
        if (cells.length < 8) return

        const objectiveCell = cells[1]
        objectiveCell.textContent = ''
        const objectiveWrap = document.createElement('div'); objectiveWrap.className = 'matrix-v12-objective-stack'
        const objective = document.createElement('strong'); objective.textContent = row.objective || '—'; objectiveWrap.appendChild(objective)
        if (details.length) {
          const list = document.createElement('ol')
          details.forEach(item => { const li = document.createElement('li'); li.textContent = item.text; list.appendChild(li) })
          objectiveWrap.appendChild(list)
        }
        objectiveCell.appendChild(objectiveWrap)

        const renderStack = (cell: HTMLTableCellElement, key: 'milestones'|'kpi'|'start_date'|'end_date') => {
          cell.textContent = ''
          const stack = document.createElement('div'); stack.className = 'matrix-v12-detail-stack'
          const source = details.length ? details : [emptySubpoint()]
          source.forEach((item, detailIndex) => {
            const line = document.createElement('div')
            const label = document.createElement('small'); label.textContent = `S${detailIndex + 1}`
            const value = document.createElement('span')
            const raw = item[key]
            value.textContent = key === 'start_date' || key === 'end_date' ? formatDate(String(raw || '')) : String(raw || '—')
            line.append(label, value); stack.appendChild(line)
          })
          cell.appendChild(stack)
        }
        renderStack(cells[4], 'milestones'); renderStack(cells[5], 'kpi'); renderStack(cells[6], 'start_date'); renderStack(cells[7], 'end_date')
      })
    }
    const observer = new MutationObserver(enhance)
    observer.observe(root, { childList: true, subtree: true })
    enhance()
    return () => observer.disconnect()
  }, [rows, subpointsByRow, revision])

  return <div ref={hostRef} className={`matrix-v12-host ${editorOpen ? 'matrix-v12-host--editing' : ''}`} onClickCapture={handleCapture}>
    {editorOpen && <section className="matrix-v12-editor">
      <header><div><span>{editingRowId ? 'EDITAR OBJETIVO' : 'NUEVO OBJETIVO'}</span><h3>{editingRowId ? 'Editar objetivo general y subpuntos' : 'Crear objetivo general y subpuntos'}</h3><p>Completa el objetivo arriba y administra el detalle de cada subpunto en una sola vista.</p></div><button type="button" onClick={() => void cancelEditor()} disabled={saving}><X size={18}/></button></header>
      <div className="matrix-v12-main-grid">
        <label><span>Lineamiento</span><select value={form.objective_group} onChange={e => setForm(current => ({ ...current, objective_group: e.target.value }))}><option value="">Selecciona un lineamiento</option>{guidelines.map(item => <option key={item.id} value={item.guideline_text}>{item.guideline_text}</option>)}</select></label>
        <label className="wide"><span>Objetivo general</span><textarea value={form.objective} onChange={e => setForm(current => ({ ...current, objective: e.target.value }))} placeholder="Escribe el objetivo general"/></label>
        <label><span>Responsable</span><select value={form.responsible_manager_id} onChange={e => setForm(current => ({ ...current, responsible_manager_id: e.target.value }))}><option value="">Seleccionar responsable</option>{managers.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label><span>Prioridad</span><select value={form.priority} onChange={e => setForm(current => ({ ...current, priority: e.target.value }))}><option value="">—</option><option>Alta</option><option>Media</option><option>Baja</option></select></label>
      </div>

      <div className="matrix-v12-subpoints-head"><div><span>SUBPUNTOS</span><strong>Detalle por subpunto</strong><small>Cada subpunto tiene sus propios hitos, KPI, inicio y fin.</small></div><button type="button" onClick={() => setSubpointDrafts(current => [...current, emptySubpoint()])}><Plus size={16}/> Añadir subpunto</button></div>
      <div className="matrix-v12-subpoints-table"><div className="matrix-v12-subpoint-row matrix-v12-subpoint-row--head"><span>Subpunto</span><span>Hitos / Fechas</span><span>KPI (Cuantitativo)</span><span>Inicio</span><span>Fin</span><span/></div>{subpointDrafts.map((item,index) => <div className="matrix-v12-subpoint-row" key={`${item.id || 'new'}-${index}`}><textarea value={item.text} onChange={e => updateSubpoint(index,'text',e.target.value)} placeholder={`Subpunto ${index+1}`}/><textarea value={item.milestones} onChange={e => updateSubpoint(index,'milestones',e.target.value)} placeholder="Hito o fecha"/><textarea value={item.kpi} onChange={e => updateSubpoint(index,'kpi',e.target.value)} placeholder="KPI"/><input type="date" value={item.start_date} onChange={e => updateSubpoint(index,'start_date',e.target.value)}/><input type="date" value={item.end_date} onChange={e => updateSubpoint(index,'end_date',e.target.value)}/><button className="danger" type="button" title="Eliminar subpunto" onClick={() => setSubpointDrafts(current => current.length === 1 ? [emptySubpoint()] : current.filter((_,i) => i !== index))}><Trash2 size={15}/></button></div>)}</div>

      <div className="matrix-v12-extra-grid">
        <label><span>Riesgos de no ejecutar</span><textarea value={form.risks} onChange={e => setForm(current => ({ ...current, risks: e.target.value }))}/></label>
        <label><span>Restricciones</span><textarea value={form.restrictions} onChange={e => setForm(current => ({ ...current, restrictions: e.target.value }))}/></label>
        <label><span>Soporte</span><textarea value={form.support} onChange={e => setForm(current => ({ ...current, support: e.target.value }))}/></label>
        <label><span>Entregable</span><textarea value={form.deliverables} onChange={e => setForm(current => ({ ...current, deliverables: e.target.value }))}/></label>
        <label><span>Comité</span><textarea value={form.committee} onChange={e => setForm(current => ({ ...current, committee: e.target.value }))}/></label>
      </div>
      <footer><button type="button" className="secondary" onClick={() => void cancelEditor()} disabled={saving}>Cancelar</button><button type="button" className="primary" onClick={() => void saveEditor()} disabled={saving}>{saving ? <LoaderCircle className="spin" size={16}/> : <Check size={16}/>} {saving ? 'Guardando...' : 'Guardar todo'}</button></footer>
    </section>}
    <MatrixWorkspaceV11 key={revision} {...props}/>
  </div>
}
