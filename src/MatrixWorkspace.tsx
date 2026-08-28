import { FormEvent, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, Building2, Check, ChevronRight, ClipboardList, LoaderCircle, Pencil, Plus, Save, Trash2, X } from 'lucide-react'
import { supabase } from './lib/supabase'
import './matrix-workspace.css'

type UnitCode = 'HU' | 'DEP' | 'VS' | 'HOT' | 'CENTRAL'
type DirectoryGroup = 'GENERAL' | 'HU' | 'MATRICIAL_HU_VS'
type WorkspacePage = 'areas' | 'matrices' | 'sheet'
type Area = { id: string; name: string; unit_code: string; directory_group: DirectoryGroup }
type Process = { id: string; name: string; description: string | null; management_id: string; unit_code: string; directory_group: DirectoryGroup; sort_order: number }
type Matrix = { id: string; name: string; description: string | null; process_id: string; status: 'DRAFT' | 'IN_PROGRESS' | 'REVIEW' | 'APPROVED'; sort_order: number }
type Manager = { id: string; name: string; cargo: string | null; unit_code: string; directory_group: DirectoryGroup }
type MatrixRow = {
  id: string; objective: string | null; action_plan: string | null; responsible_manager_id: string | null; responsible_text: string | null;
  priority: string | null; milestones: string | null; kpi: string | null; target: string | null; start_date: string | null; end_date: string | null;
  risks: string | null; restrictions: string | null; support: string | null; deliverables: string | null; committee: string | null;
  status: 'DRAFT' | 'IN_PROGRESS' | 'REVIEW' | 'APPROVED'; sort_order: number
}
type Props = { periodId: string; year: number; unitCode: UnitCode; unitName: string; canManage: boolean; onError: (message: string) => void; onNotice: (message: string) => void }
type RowDraft = Omit<MatrixRow, 'id' | 'sort_order'>

const emptyRow: RowDraft = {
  objective:'', action_plan:'', responsible_manager_id:null, responsible_text:'', priority:'', milestones:'', kpi:'', target:'', start_date:'', end_date:'',
  risks:'', restrictions:'', support:'', deliverables:'', committee:'', status:'DRAFT',
}
const unitAccent: Record<UnitCode,string> = { CENTRAL:'central', HU:'hu', DEP:'dep', VS:'vs', HOT:'hot' }
function statusLabel(status: Matrix['status']) { if(status==='IN_PROGRESS') return 'En progreso'; if(status==='REVIEW') return 'En revisión'; if(status==='APPROVED') return 'Aprobada'; return 'Borrador' }
function normalize(value:string){ return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase() }

export default function MatrixWorkspace({ periodId, year, unitCode, unitName, canManage, onError, onNotice }: Props) {
  const [page,setPage]=useState<WorkspacePage>('areas')
  const [areas,setAreas]=useState<Area[]>([])
  const [processes,setProcesses]=useState<Process[]>([])
  const [matrices,setMatrices]=useState<Matrix[]>([])
  const [managers,setManagers]=useState<Manager[]>([])
  const [rows,setRows]=useState<MatrixRow[]>([])
  const [selectedAreaId,setSelectedAreaId]=useState('')
  const [selectedMatrixId,setSelectedMatrixId]=useState('')
  const [loading,setLoading]=useState(true)
  const [rowsLoading,setRowsLoading]=useState(false)
  const [saving,setSaving]=useState(false)
  const [matrixFormOpen,setMatrixFormOpen]=useState(false)
  const [matrixName,setMatrixName]=useState('')
  const [matrixDescription,setMatrixDescription]=useState('')
  const [rowFormOpen,setRowFormOpen]=useState(false)
  const [editingRowId,setEditingRowId]=useState<string|null>(null)
  const [rowDraft,setRowDraft]=useState<RowDraft>(emptyRow)

  const selectedArea=areas.find(item=>item.id===selectedAreaId)||null
  const selectedMatrix=matrices.find(item=>item.id===selectedMatrixId)||null
  const managerById=useMemo(()=>new Map(managers.map(item=>[item.id,item])),[managers])
  const areaMatrices=useMemo(()=>{
    if(!selectedAreaId) return [] as Matrix[]
    const processIds=new Set(processes.filter(item=>item.management_id===selectedAreaId).map(item=>item.id))
    return matrices.filter(item=>processIds.has(item.process_id))
  },[matrices,processes,selectedAreaId])

  useEffect(()=>{
    setPage('areas'); setSelectedAreaId(''); setSelectedMatrixId(''); setRows([])
    void loadWorkspace()
  },[periodId,unitCode])
  useEffect(()=>{ if(!selectedMatrixId){setRows([]);return} void loadRows(selectedMatrixId) },[selectedMatrixId])

  async function loadManagers(){
    if(!supabase) return [] as Manager[]
    const queries = unitCode==='HU' ? [
      supabase.from('managers').select('id,name,cargo,unit_code,directory_group').eq('unit_code','HU').eq('directory_group','HU').eq('active',true).order('name'),
      supabase.from('managers').select('id,name,cargo,unit_code,directory_group').eq('unit_code','HU').eq('directory_group','MATRICIAL_HU_VS').eq('active',true).order('name'),
    ] : unitCode==='VS' ? [
      supabase.from('managers').select('id,name,cargo,unit_code,directory_group').eq('unit_code','VS').eq('active',true).order('name'),
      supabase.from('managers').select('id,name,cargo,unit_code,directory_group').eq('unit_code','HU').eq('directory_group','MATRICIAL_HU_VS').eq('active',true).order('name'),
    ] : [supabase.from('managers').select('id,name,cargo,unit_code,directory_group').eq('unit_code',unitCode).eq('active',true).order('name')]
    const results=await Promise.all(queries)
    if(results.some(result=>result.error)) throw new Error('MANAGER_LOAD')
    const unique=new Map<string,Manager>()
    results.forEach(result=>(result.data||[]).forEach(item=>unique.set(String(item.id),item as Manager)))
    return [...unique.values()].sort((a,b)=>a.name.localeCompare(b.name,'es'))
  }

  async function loadWorkspace(){
    if(!supabase) return
    setLoading(true); onError('')
    try{
      const [catalogResult,allAreasResult,processResult,matrixResult,managerList]=await Promise.all([
        supabase.from('matrix_unit_area_catalog').select('management_id').eq('unit_code',unitCode).order('created_at'),
        supabase.from('managements_global').select('id,name,unit_code,directory_group').eq('active',true).order('name'),
        supabase.from('processes').select('id,name,description,management_id,unit_code,directory_group,sort_order').eq('unit_code',unitCode).eq('active',true).order('sort_order').order('name'),
        supabase.from('matrices').select('id,name,description,process_id,status,sort_order').eq('period_id',periodId).eq('unit_code',unitCode).eq('active',true).order('sort_order').order('name'),
        loadManagers(),
      ])
      if(catalogResult.error||allAreasResult.error||processResult.error||matrixResult.error) throw new Error('LOAD')

      const allAreas=(allAreasResult.data||[]) as Area[]
      const areaById=new Map(allAreas.map(area=>[area.id,area]))
      const uniqueAreas=new Map<string,Area>()
      ;(catalogResult.data||[]).forEach(item=>{
        const area=areaById.get(String(item.management_id))
        if(!area) return
        const key=normalize(area.name)
        if(!uniqueAreas.has(key)) uniqueAreas.set(key,area)
      })

      setAreas([...uniqueAreas.values()].sort((a,b)=>a.name.localeCompare(b.name,'es')))
      setProcesses((processResult.data||[]) as Process[])
      setMatrices((matrixResult.data||[]) as Matrix[])
      setManagers(managerList)
    }catch{
      onError('No pudimos cargar las áreas activadas para esta unidad.')
    }finally{
      setLoading(false)
    }
  }

  async function loadRows(matrixId:string){
    if(!supabase) return
    setRowsLoading(true)
    const {data,error}=await supabase.from('matrix_rows').select('*').eq('matrix_id',matrixId).order('sort_order').order('created_at')
    setRowsLoading(false)
    if(error){onError('No pudimos cargar la matriz.');return}
    setRows((data||[]) as MatrixRow[])
  }

  function matricesForArea(areaId:string){
    const ids=new Set(processes.filter(item=>item.management_id===areaId).map(item=>item.id))
    return matrices.filter(item=>ids.has(item.process_id))
  }
  function openArea(area:Area){ setSelectedAreaId(area.id); setSelectedMatrixId(''); setRows([]); setPage('matrices'); onError(''); onNotice('') }
  function startMatrix(area:Area){ setSelectedAreaId(area.id); setMatrixName(`Matriz de ${area.name}`); setMatrixDescription(''); setMatrixFormOpen(true); onError(''); onNotice('') }
  function chooseMatrix(id:string){ setSelectedMatrixId(id); cancelRowEdit(); setPage('sheet') }
  function goBack(){ onError(''); onNotice(''); cancelRowEdit(); if(page==='sheet'){setSelectedMatrixId('');setPage('matrices');return} if(page==='matrices'){setSelectedAreaId('');setPage('areas')} }

  async function ensureProcess(area:Area){
    if(!supabase) return null
    const existing=processes.find(item=>item.management_id===area.id && normalize(item.name)==='matriz general') || processes.find(item=>item.management_id===area.id)
    if(existing) return existing
    const {data,error}=await supabase.from('processes').insert({
      unit_code:unitCode,
      directory_group:'GENERAL',
      management_id:area.id,
      name:'Matriz general',
      description:'Proceso automático para matrices',
      sort_order:0,
    }).select('id,name,description,management_id,unit_code,directory_group,sort_order').single()
    if(error||!data) return null
    const created=data as Process
    setProcesses(current=>[...current,created])
    return created
  }

  async function createMatrix(event:FormEvent){
    event.preventDefault()
    if(!supabase||!canManage||!selectedArea) return
    const name=matrixName.trim()||`Matriz de ${selectedArea.name}`
    setSaving(true); onError(''); onNotice('')
    const process=await ensureProcess(selectedArea)
    if(!process){setSaving(false);onError('No pudimos preparar la matriz para esta área.');return}
    const currentCount=matricesForArea(selectedArea.id).length
    const {data,error}=await supabase.from('matrices').insert({
      period_id:periodId,
      unit_code:unitCode,
      directory_group:process.directory_group,
      process_id:process.id,
      name,
      description:matrixDescription.trim()||null,
      status:'DRAFT',
      sort_order:currentCount,
    }).select('id').single()
    setSaving(false)
    if(error||!data){onError(error?.code==='23505'?'Ya existe una matriz con ese nombre en esta área.':`No pudimos generar la matriz${error?.message?`: ${error.message}`:'.'}`);return}
    setMatrixFormOpen(false); setMatrixName(''); setMatrixDescription('')
    await loadWorkspace()
    setSelectedMatrixId(String(data.id)); setPage('sheet'); onNotice('Matriz generada correctamente.')
  }

  function startNewRow(){setEditingRowId(null);setRowDraft(emptyRow);setRowFormOpen(true);onError('');onNotice('')}
  function startEditRow(row:MatrixRow){
    setEditingRowId(row.id)
    setRowDraft({objective:row.objective||'',action_plan:row.action_plan||'',responsible_manager_id:row.responsible_manager_id,responsible_text:row.responsible_text||'',priority:row.priority||'',milestones:row.milestones||'',kpi:row.kpi||'',target:row.target||'',start_date:row.start_date||'',end_date:row.end_date||'',risks:row.risks||'',restrictions:row.restrictions||'',support:row.support||'',deliverables:row.deliverables||'',committee:row.committee||'',status:row.status||'DRAFT'})
    setRowFormOpen(true)
  }
  function cancelRowEdit(){setEditingRowId(null);setRowFormOpen(false);setRowDraft(emptyRow)}
  function updateDraft<K extends keyof RowDraft>(key:K,value:RowDraft[K]){setRowDraft(current=>({...current,[key]:value}))}

  async function saveRow(){
    if(!supabase||!selectedMatrix||!canManage) return
    if(!String(rowDraft.objective||'').trim()&&!String(rowDraft.action_plan||'').trim()){onError('Escribe al menos el objetivo o el plan de acción.');return}
    setSaving(true); onError(''); onNotice('')
    const manager=rowDraft.responsible_manager_id?managerById.get(rowDraft.responsible_manager_id):null
    const payload={matrix_id:selectedMatrix.id,objective:rowDraft.objective||null,action_plan:rowDraft.action_plan||null,responsible_manager_id:rowDraft.responsible_manager_id||null,responsible_text:manager?.name||rowDraft.responsible_text||null,priority:rowDraft.priority||null,milestones:rowDraft.milestones||null,kpi:rowDraft.kpi||null,target:rowDraft.target||null,start_date:rowDraft.start_date||null,end_date:rowDraft.end_date||null,risks:rowDraft.risks||null,restrictions:rowDraft.restrictions||null,support:rowDraft.support||null,deliverables:rowDraft.deliverables||null,committee:rowDraft.committee||null,status:rowDraft.status,sort_order:editingRowId?rows.find(item=>item.id===editingRowId)?.sort_order||0:rows.length}
    const result=editingRowId?await supabase.from('matrix_rows').update(payload).eq('id',editingRowId):await supabase.from('matrix_rows').insert(payload)
    setSaving(false)
    if(result.error){onError('No pudimos guardar la fila.');return}
    const wasEditing=Boolean(editingRowId)
    cancelRowEdit(); onNotice(wasEditing?'Fila actualizada.':'Fila agregada.'); await loadRows(selectedMatrix.id)
  }

  async function deleteRow(id:string){
    if(!supabase||!canManage||!selectedMatrix)return
    const{error}=await supabase.from('matrix_rows').delete().eq('id',id)
    if(error){onError('No pudimos eliminar la fila.');return}
    onNotice('Fila eliminada.');await loadRows(selectedMatrix.id)
  }

  return <div className={`matrix-workspace matrix-workspace--${unitAccent[unitCode]}`}>
    <section className="matrix-intro">
      <div><span className="matrix-kicker">Periodo {year} · {unitCode}</span><h3>Matrices de {unitName}</h3><p>Primero activa las áreas para esta unidad en <strong>Configuración → Activar áreas por unidad</strong>. Aquí solo aparecerán las que hayas activado.</p></div>
      <div className="matrix-route"><button className={page==='areas'?'active':'done'} onClick={()=>{setPage('areas');setSelectedAreaId('');setSelectedMatrixId('')}}>1. Áreas activas</button><ChevronRight size={15}/><span className={page==='matrices'?'active':page==='sheet'?'done':''}>2. Matrices</span><ChevronRight size={15}/><span className={page==='sheet'?'active':''}>3. Edición</span></div>
    </section>

    {page!=='areas'&&<button className="matrix-back" onClick={goBack}><ArrowLeft size={16}/> Volver</button>}

    {loading?<div className="matrix-loading"><LoaderCircle className="spin" size={22}/> Cargando áreas activadas...</div>:<>
      {page==='areas'&&<section className="matrix-stage">
        <div className="matrix-stage-head"><div><small>Áreas activadas para {unitName}</small><h4>Genera una matriz directamente</h4><p>Si falta un área, actívala primero desde Configuración. No se muestran áreas que no hayas habilitado para esta unidad.</p></div></div>
        {areas.length===0?<div className="matrix-empty"><Building2 size={24}/><strong>No hay áreas activadas</strong><span>Ve a Configuración → Activar áreas por unidad → {unitName} y activa las áreas que necesitas.</span></div>:<div className="matrix-area-grid">{areas.map(area=>{const count=matricesForArea(area.id).length;return <div className="matrix-area-card matrix-area-card--direct" key={area.id}><button className="matrix-area-open" onClick={()=>openArea(area)}><span><Building2 size={20}/></span><div><strong>{area.name}</strong><small>{count} matriz{count===1?'':'ces'} generada{count===1?'':'s'} en {unitCode}</small></div><ArrowRight size={17}/></button>{canManage&&<button className="matrix-generate" onClick={()=>startMatrix(area)}><Plus size={14}/> Generar matriz</button>}</div>})}</div>}
      </section>}

      {page==='matrices'&&selectedArea&&<section className="matrix-stage">
        <div className="matrix-stage-head"><div><small>{selectedArea.name}</small><h4>Matrices del área</h4><p>Abre una matriz existente o genera una nueva directamente.</p></div>{canManage&&<button className="matrix-primary" onClick={()=>startMatrix(selectedArea)}><Plus size={15}/> Generar matriz</button>}</div>
        {areaMatrices.length===0?<div className="matrix-empty compact"><ClipboardList size={22}/><strong>Aún no hay matrices</strong><span>Presiona “Generar matriz” para crear la primera.</span></div>:<div className="matrix-simple-table-wrap"><table className="matrix-simple-table"><thead><tr><th>N°</th><th>Matriz</th><th>Descripción</th><th>Estado</th><th></th></tr></thead><tbody>{areaMatrices.map((matrix,index)=><tr key={matrix.id}><td>{index+1}</td><td><strong>{matrix.name}</strong></td><td>{matrix.description||'Matriz editable'}</td><td><span className={`matrix-status matrix-status--${matrix.status.toLowerCase()}`}>{statusLabel(matrix.status)}</span></td><td><button onClick={()=>chooseMatrix(matrix.id)}>Abrir <ArrowRight size={14}/></button></td></tr>)}</tbody></table></div>}
      </section>}

      {page==='sheet'&&selectedMatrix&&<section className="matrix-sheet-card">
        <div className="matrix-sheet-head"><div><small>{selectedArea?.name}</small><h4>{selectedMatrix.name}</h4><p>Edita la matriz directamente como una hoja de trabajo.</p></div>{canManage&&<button className="matrix-primary" onClick={startNewRow}><Plus size={15}/> Nueva fila</button>}</div>
        <div className="matrix-sheet-scroll"><table className="matrix-sheet"><thead><tr><th>N°</th><th>Objetivo</th><th>Plan de acción</th><th>Responsable</th><th>Prioridad</th><th>Hitos</th><th>KPI</th><th>Objetivo KPI</th><th>Fecha inicio</th><th>Fecha fin</th><th>Riesgos</th><th>Restricciones</th><th>Soporte</th><th>Entregables</th><th>Comité</th>{canManage&&<th>Acciones</th>}</tr></thead><tbody>
          {rowFormOpen&&<tr className="matrix-edit-row"><td>{editingRowId?rows.findIndex(row=>row.id===editingRowId)+1:rows.length+1}</td><td><textarea value={rowDraft.objective||''} onChange={e=>updateDraft('objective',e.target.value)}/></td><td><textarea value={rowDraft.action_plan||''} onChange={e=>updateDraft('action_plan',e.target.value)}/></td><td><select value={rowDraft.responsible_manager_id||''} onChange={e=>updateDraft('responsible_manager_id',e.target.value||null)}><option value="">Seleccionar</option>{managers.map(manager=><option key={manager.id} value={manager.id}>{manager.name}{manager.directory_group==='MATRICIAL_HU_VS'?' · Matricial':''}</option>)}</select></td><td><select value={rowDraft.priority||''} onChange={e=>updateDraft('priority',e.target.value)}><option value="">—</option><option value="Alta">Alta</option><option value="Media">Media</option><option value="Baja">Baja</option></select></td><td><textarea value={rowDraft.milestones||''} onChange={e=>updateDraft('milestones',e.target.value)}/></td><td><textarea value={rowDraft.kpi||''} onChange={e=>updateDraft('kpi',e.target.value)}/></td><td><input value={rowDraft.target||''} onChange={e=>updateDraft('target',e.target.value)}/></td><td><input type="date" value={rowDraft.start_date||''} onChange={e=>updateDraft('start_date',e.target.value)}/></td><td><input type="date" value={rowDraft.end_date||''} onChange={e=>updateDraft('end_date',e.target.value)}/></td><td><textarea value={rowDraft.risks||''} onChange={e=>updateDraft('risks',e.target.value)}/></td><td><textarea value={rowDraft.restrictions||''} onChange={e=>updateDraft('restrictions',e.target.value)}/></td><td><textarea value={rowDraft.support||''} onChange={e=>updateDraft('support',e.target.value)}/></td><td><textarea value={rowDraft.deliverables||''} onChange={e=>updateDraft('deliverables',e.target.value)}/></td><td><textarea value={rowDraft.committee||''} onChange={e=>updateDraft('committee',e.target.value)}/></td><td><div className="matrix-row-actions"><button title="Cancelar" onClick={cancelRowEdit}><X size={14}/></button><button className="save" title="Guardar" onClick={()=>void saveRow()} disabled={saving}>{saving?<LoaderCircle className="spin" size={14}/>:<Check size={14}/>}</button></div></td></tr>}
          {rowsLoading?<tr><td colSpan={16} className="matrix-table-empty"><LoaderCircle className="spin" size={20}/> Cargando matriz...</td></tr>:rows.length===0&&!rowFormOpen?<tr><td colSpan={16} className="matrix-table-empty">Aún no hay filas. Presiona “Nueva fila” para comenzar.</td></tr>:rows.map((row,index)=>editingRowId===row.id?null:<tr key={row.id}><td className="matrix-number">{index+1}</td><td>{row.objective||'—'}</td><td>{row.action_plan||'—'}</td><td>{row.responsible_manager_id?managerById.get(row.responsible_manager_id)?.name||row.responsible_text||'—':row.responsible_text||'—'}</td><td>{row.priority||'—'}</td><td>{row.milestones||'—'}</td><td>{row.kpi||'—'}</td><td>{row.target||'—'}</td><td>{row.start_date||'—'}</td><td>{row.end_date||'—'}</td><td>{row.risks||'—'}</td><td>{row.restrictions||'—'}</td><td>{row.support||'—'}</td><td>{row.deliverables||'—'}</td><td>{row.committee||'—'}</td>{canManage&&<td><div className="matrix-row-actions"><button title="Editar" onClick={()=>startEditRow(row)}><Pencil size={14}/></button><button className="danger" title="Eliminar" onClick={()=>void deleteRow(row.id)}><Trash2 size={14}/></button></div></td>}</tr>)}</tbody></table></div>
      </section>}
    </>}

    {matrixFormOpen&&selectedArea&&<div className="matrix-modal-backdrop" onMouseDown={event=>{if(event.currentTarget===event.target&&!saving)setMatrixFormOpen(false)}}><div className="matrix-modal"><button className="matrix-modal-close" onClick={()=>setMatrixFormOpen(false)}><X size={17}/></button><small>{selectedArea.name} · {unitName}</small><h4>Generar matriz</h4><p>Esta matriz se generará únicamente para {unitName}. El área seguirá siendo transversal y puede activarse también en otras unidades.</p><form className="matrix-modal-form" onSubmit={createMatrix}><label>Nombre de la matriz<input autoFocus value={matrixName} onChange={e=>setMatrixName(e.target.value)}/></label><label>Descripción<input value={matrixDescription} onChange={e=>setMatrixDescription(e.target.value)} placeholder="Opcional"/></label><div><button type="button" onClick={()=>setMatrixFormOpen(false)}>Cancelar</button><button className="matrix-primary" disabled={saving}>{saving?<LoaderCircle className="spin" size={15}/>:<Save size={15}/>} Generar matriz</button></div></form></div></div>}
  </div>
}
