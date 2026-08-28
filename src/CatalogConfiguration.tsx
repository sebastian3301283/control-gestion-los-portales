import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react'
import { Building2, Check, ChevronDown, Download, LoaderCircle, Pencil, Plus, Search, Trash2, Upload, UserRound, X } from 'lucide-react'
import { supabase } from './lib/supabase'
import './catalog-configuration.css'
import './catalog-matrix-areas.css'

type Unit = { code: string; name: string }
type DirectoryGroup = 'GENERAL' | 'HU' | 'MATRICIAL_HU_VS'
type Management = { id: string; name: string; unit_code: string; directory_group: DirectoryGroup; active: boolean }
type Manager = { id: string; name: string; cargo: string | null; unit_code: string; directory_group: DirectoryGroup; active: boolean }
type ManagerManagement = { manager_id: string; management_id: string }
type Props = { units?: Unit[]; canManage: boolean }
type DeleteTarget = { id: string; name: string } | null

const XLSX_MODULE_URL = 'https://unpkg.com/xlsx@0.18.5/xlsx.mjs'
const fallbackUnits: Unit[] = [
  { code: 'CENTRAL', name: 'Central' },
  { code: 'HU', name: 'Habilitación Urbana' },
  { code: 'DEP', name: 'Departamentos' },
  { code: 'VS', name: 'Vivienda Social' },
  { code: 'HOT', name: 'Hoteles' },
]
const huGroups: Array<{ code: DirectoryGroup; label: string; short: string }> = [
  { code: 'HU', label: 'Habilitación Urbana', short: 'HU' },
  { code: 'MATRICIAL_HU_VS', label: 'Matricial', short: 'MATRICIAL' },
]

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLowerCase()
}
function normalizeHeader(value: unknown) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
}
function splitValues(value: string) {
  return value.split(/\s*(?:\/|;|\||\n)\s*/g).map(item => item.trim()).filter(Boolean)
}
function parseActive(value: string) {
  return !['inactivo', 'inactiva', 'no', '0', 'false'].includes(normalize(value))
}
function valueFromRow(row: Record<string, unknown>, aliases: string[]) {
  const wanted = new Set(aliases.map(normalizeHeader))
  const entry = Object.entries(row).find(([key]) => wanted.has(normalizeHeader(key)))
  return String(entry?.[1] ?? '').trim()
}
function recordsFromDetectedHeader(XLSX: any, sheet: any) {
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false }) as unknown[][]
  const names = new Set(['nombre', 'responsable', 'gerente', 'gerenteresponsable', 'bonista'])
  const areas = new Set(['area', 'areas', 'gerencia', 'gerencias'])
  const headerIndex = matrix.findIndex(row => {
    const headers = row.map(normalizeHeader)
    return headers.some(value => names.has(value)) && headers.some(value => areas.has(value))
  })
  if (headerIndex < 0) return [] as Record<string, unknown>[]
  const headers = matrix[headerIndex].map(value => String(value ?? '').trim())
  return matrix.slice(headerIndex + 1)
    .filter(row => row.some(cell => String(cell ?? '').trim()))
    .map(row => Object.fromEntries(headers.map((header, index) => [header || `col_${index}`, row[index] ?? ''])))
}

export default function CatalogConfiguration({ units, canManage }: Props) {
  const unitOptions = units?.length ? units : fallbackUnits
  const defaultUnitCode = unitOptions.find(unit => unit.code === 'CENTRAL')?.code || unitOptions[0]?.code || 'CENTRAL'

  const [managements, setManagements] = useState<Management[]>([])
  const [managers, setManagers] = useState<Manager[]>([])
  const [links, setLinks] = useState<ManagerManagement[]>([])
  const [matrixCatalogIds, setMatrixCatalogIds] = useState<string[]>([])
  const [selectedUnitCode, setSelectedUnitCode] = useState(defaultUnitCode)
  const [selectedHuGroup, setSelectedHuGroup] = useState<DirectoryGroup>('HU')
  const [bonistasOpen, setBonistasOpen] = useState(true)
  const [areasOpen, setAreasOpen] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [unitDeleting, setUnitDeleting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null)
  const [unitDeleteOpen, setUnitDeleteOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [filterName, setFilterName] = useState('')
  const [filterCargo, setFilterCargo] = useState('')
  const [filterAreaId, setFilterAreaId] = useState('')
  const [areaSearch, setAreaSearch] = useState('')
  const [managerFormOpen, setManagerFormOpen] = useState(false)
  const [editingManagerId, setEditingManagerId] = useState<string | null>(null)
  const [managerName, setManagerName] = useState('')
  const [managerCargo, setManagerCargo] = useState('')
  const [managerActive, setManagerActive] = useState(true)
  const [managerManagementIds, setManagerManagementIds] = useState<string[]>([])

  const unitByCode = useMemo(() => new Map(unitOptions.map(unit => [unit.code, unit.name])), [unitOptions])
  const managementById = useMemo(() => new Map(managements.map(item => [item.id, item])), [managements])
  const selectedUnit = unitOptions.find(unit => unit.code === selectedUnitCode) || unitOptions[0]
  const activeGroup: DirectoryGroup = selectedUnitCode === 'HU' ? selectedHuGroup : 'GENERAL'
  const selectedManagements = useMemo(
    () => managements.filter(item => item.unit_code === selectedUnitCode && item.directory_group === activeGroup),
    [managements, selectedUnitCode, activeGroup],
  )
  const selectedManagers = useMemo(
    () => managers.filter(item => item.unit_code === selectedUnitCode && item.directory_group === activeGroup),
    [managers, selectedUnitCode, activeGroup],
  )
  const filteredManagers = useMemo(() => selectedManagers.filter(item => {
    const relatedIds = links.filter(link => link.manager_id === item.id).map(link => link.management_id)
    if (filterName.trim() && !normalize(item.name).includes(normalize(filterName))) return false
    if (filterCargo.trim() && !normalize(item.cargo || '').includes(normalize(filterCargo))) return false
    if (filterAreaId && !relatedIds.includes(filterAreaId)) return false
    return true
  }), [selectedManagers, links, filterName, filterCargo, filterAreaId])

  const matrixCatalogNames = useMemo(() => {
    const names = new Set<string>()
    matrixCatalogIds.forEach(id => {
      const area = managementById.get(id)
      if (area) names.add(normalize(area.name))
    })
    return names
  }, [matrixCatalogIds, managementById])

  const filteredSourceAreas = useMemo(() => {
    const unique = new Map<string, Management>()
    selectedManagements.filter(item => item.active).forEach(item => {
      const key = normalize(item.name)
      if (!unique.has(key)) unique.set(key, item)
    })
    const term = normalize(areaSearch)
    return [...unique.values()]
      .filter(item => !term || normalize(item.name).includes(term))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'))
  }, [selectedManagements, areaSearch])

  const visibleMatrixAreaCount = matrixCatalogNames.size
  const selectedUnitHasData = selectedManagers.length > 0 || selectedManagements.length > 0

  useEffect(() => { void loadCatalogs() }, [])

  async function loadCatalogs() {
    if (!supabase) return
    setLoading(true); setError('')
    const [managementResult, managerResult, linkResult, matrixAreaResult] = await Promise.all([
      supabase.from('managements_global').select('id,name,unit_code,directory_group,active').order('unit_code').order('directory_group').order('name'),
      supabase.from('managers').select('id,name,cargo,unit_code,directory_group,active').order('unit_code').order('directory_group').order('name'),
      supabase.from('manager_managements').select('manager_id,management_id'),
      supabase.from('matrix_area_catalog').select('management_id').order('created_at'),
    ])
    setLoading(false)
    if (managementResult.error || managerResult.error || linkResult.error || matrixAreaResult.error) {
      setError('No pudimos cargar la configuración.'); return
    }
    setManagements((managementResult.data || []) as Management[])
    setManagers((managerResult.data || []) as Manager[])
    setLinks((linkResult.data || []) as ManagerManagement[])
    setMatrixCatalogIds((matrixAreaResult.data || []).map(item => String(item.management_id)))
  }

  function unitLabel(code: string) { return unitByCode.get(code) || code }
  function groupLabel(group: DirectoryGroup) { return huGroups.find(item => item.code === group)?.label || '' }
  function groupForUnit(unitCode: string, group: DirectoryGroup = 'GENERAL'): DirectoryGroup {
    return unitCode === 'HU' ? (group === 'MATRICIAL_HU_VS' ? group : 'HU') : 'GENERAL'
  }
  function chooseUnit(code: string) {
    setSelectedUnitCode(code)
    if (code !== 'HU') setSelectedHuGroup('HU')
    setAreaSearch(''); setFilterName(''); setFilterCargo(''); setFilterAreaId(''); setError(''); setNotice('')
  }
  function resolveLocation(unitValue: string, groupValue = '') {
    const raw = normalizeHeader(unitValue), groupRaw = normalizeHeader(groupValue)
    if (raw.includes('matricial') || groupRaw.includes('matricial')) return { unit_code: 'HU', directory_group: 'MATRICIAL_HU_VS' as DirectoryGroup }
    const aliases: Record<string,string> = {
      central:'CENTRAL', cen:'CENTRAL', hu:'HU', habilitacionurbana:'HU', dep:'DEP', departamentos:'DEP', departamento:'DEP',
      vs:'VS', viviendasocial:'VS', hot:'HOT', hoteles:'HOT', hotel:'HOT',
    }
    const direct = unitOptions.find(unit => normalizeHeader(unit.code) === raw || normalizeHeader(unit.name) === raw)?.code
    const unit_code = direct || aliases[raw] || ''
    return { unit_code, directory_group: groupForUnit(unit_code, 'HU') }
  }

  function openNewManager() {
    setEditingManagerId(null); setManagerName(''); setManagerCargo(''); setManagerActive(true); setManagerManagementIds([])
    setManagerFormOpen(true); setError(''); setNotice('')
  }
  function editManager(item: Manager) {
    setEditingManagerId(item.id); setManagerName(item.name); setManagerCargo(item.cargo || ''); setManagerActive(item.active)
    setManagerManagementIds(links.filter(link => link.manager_id === item.id).map(link => link.management_id))
    setManagerFormOpen(true); setError(''); setNotice('')
  }
  function closeManagerForm() {
    setManagerFormOpen(false); setEditingManagerId(null); setManagerName(''); setManagerCargo(''); setManagerManagementIds([])
  }
  function toggleManagerArea(id: string) {
    setManagerManagementIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id])
  }

  async function saveManager(event: FormEvent) {
    event.preventDefault()
    if (!supabase || !canManage) return
    const name = managerName.trim().replace(/\s+/g, ' ')
    const cargo = managerCargo.trim().replace(/\s+/g, ' ')
    if (!name) { setError('Escribe el nombre del bonista.'); return }
    if (!managerManagementIds.length) { setError('Selecciona al menos un área para el bonista.'); return }

    setSaving(true); setError(''); setNotice('')
    const { error: saveError } = await supabase.rpc('save_directory_manager', {
      manager_id_input: editingManagerId || null,
      name_input: name,
      cargo_input: cargo,
      unit_code_input: selectedUnitCode,
      directory_group_input: activeGroup,
      active_input: managerActive,
      management_ids_input: managerManagementIds,
    })
    setSaving(false)
    if (saveError) {
      setError(`No pudimos guardar el bonista: ${saveError.message}`)
      return
    }
    closeManagerForm(); setNotice(editingManagerId ? 'Bonista actualizado correctamente.' : 'Bonista creado correctamente.')
    await loadCatalogs()
  }

  async function deleteSelectedManager() {
    if (!supabase || !deleteTarget || !canManage) return
    setDeleting(true); setError('')
    const { error: rpcError } = await supabase.rpc('delete_directory_manager', { manager_id_input: deleteTarget.id })
    setDeleting(false)
    if (rpcError) { setError('No pudimos eliminar el bonista.'); return }
    setNotice(`Bonista “${deleteTarget.name}” eliminado correctamente.`); setDeleteTarget(null); await loadCatalogs()
  }

  async function deleteSelectedUnit() {
    if (!supabase || !canManage) return
    setUnitDeleting(true); setError('')
    const { error: rpcError } = await supabase.rpc('delete_responsibility_catalog_by_unit', { unit_code_input: selectedUnitCode })
    setUnitDeleting(false)
    if (rpcError) { setError('No pudimos borrar el directorio de esta unidad.'); return }
    setUnitDeleteOpen(false); setNotice(`Directorio de ${selectedUnit?.name || selectedUnitCode} borrado.`); await loadCatalogs()
  }

  async function addAreaToMatrices(area: Management) {
    if (!supabase || !canManage) return
    if (matrixCatalogNames.has(normalize(area.name))) {
      setNotice(`El área “${area.name}” ya está visible en Matrices.`); return
    }
    setSaving(true); setError(''); setNotice('')
    const { error: insertError } = await supabase.from('matrix_area_catalog').insert({ management_id: area.id })
    setSaving(false)
    if (insertError) { setError('No pudimos añadir el área a Matrices.'); return }
    setNotice(`“${area.name}” ahora aparecerá en Matrices.`)
    await loadCatalogs()
  }

  async function removeAreaFromMatrices(area: Management) {
    if (!supabase || !canManage) return
    const matchingId = matrixCatalogIds.find(id => normalize(managementById.get(id)?.name || '') === normalize(area.name))
    if (!matchingId) return
    setSaving(true); setError(''); setNotice('')
    const { error: deleteError } = await supabase.from('matrix_area_catalog').delete().eq('management_id', matchingId)
    setSaving(false)
    if (deleteError) { setError('No pudimos quitar el área de Matrices.'); return }
    setNotice(`“${area.name}” ya no aparecerá para crear nuevas matrices. Los Bonistas no fueron modificados.`)
    await loadCatalogs()
  }

  async function downloadTemplate() {
    try {
      const XLSX = await import(/* @vite-ignore */ XLSX_MODULE_URL)
      const rows = managers.length ? managers.map((manager, index) => ({
        'Cant.': index + 1,
        UN: manager.directory_group === 'MATRICIAL_HU_VS' ? 'Matricial' : unitLabel(manager.unit_code),
        Nombre: manager.name,
        Cargo: manager.cargo || '',
        Área: links.filter(link => link.manager_id === manager.id).map(link => managementById.get(link.management_id)?.name).filter(Boolean).join(' / '),
        Estado: manager.active ? 'Activo' : 'Inactivo',
      })) : [{ 'Cant.':1, UN:'Departamentos', Nombre:'NOMBRE APELLIDO', Cargo:'GERENTE DE PROYECTOS', Área:'Operaciones', Estado:'Activo' }]
      const sheet = XLSX.utils.json_to_sheet(rows)
      sheet['!cols'] = [{wch:8},{wch:22},{wch:36},{wch:38},{wch:34},{wch:14}]
      const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, sheet, 'Bonistas')
      XLSX.writeFile(workbook, 'Plantilla_Bonistas.xlsx')
    } catch { setError('No pudimos generar la plantilla Excel.') }
  }

  async function importCatalogFromExcel(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = ''
    if (!file || !supabase || !canManage) return
    setImporting(true); setError(''); setNotice('')
    try {
      const XLSX = await import(/* @vite-ignore */ XLSX_MODULE_URL)
      const workbook = XLSX.read(await file.arrayBuffer(), { type:'array' })
      const rows: Record<string, unknown>[] = []
      workbook.SheetNames.forEach(sheetName => {
        rows.push(...recordsFromDetectedHeader(XLSX, workbook.Sheets[sheetName]).map(row => ({ ...row, __sheetName: sheetName })))
      })
      if (!rows.length) throw new Error('FORMAT_NOT_FOUND')

      const parsed = rows.map((row,index) => {
        const sheetName = String(row.__sheetName ?? '')
        const location = resolveLocation(valueFromRow(row,['UN','Unidad','Unidad de negocio']) || sheetName, valueFromRow(row,['Grupo','Subunidad']) || sheetName)
        return {
          row:index+2, ...location,
          name:valueFromRow(row,['Nombre','Bonista','Responsable','Gerente']),
          cargo:valueFromRow(row,['Cargo','Puesto']),
          areas:splitValues(valueFromRow(row,['Área','Area','Áreas','Areas','Gerencia','Gerencias'])),
          active:parseActive(valueFromRow(row,['Estado','Estatus','Activo']) || 'Activo'),
        }
      }).filter(item => item.name)

      if (!parsed.length) throw new Error('NO_ROWS')
      const validationErrors:string[]=[]
      parsed.forEach(item => {
        if(!item.unit_code) validationErrors.push(`Fila ${item.row}: UN no válida.`)
        if(!item.areas.length) validationErrors.push(`Fila ${item.row}: falta Área.`)
      })
      if(validationErrors.length){ setError(`Excel no importado: ${validationErrors.slice(0,8).join(' · ')}`); return }

      const working = [...managements]
      let newAreas = 0
      let processed = 0

      for(const item of parsed){
        for(const areaName of item.areas){
          let area = working.find(a => a.unit_code===item.unit_code && a.directory_group===item.directory_group && normalize(a.name)===normalize(areaName))
          if(!area){
            const {data,error:areaError}=await supabase.from('managements_global').insert({name:areaName,unit_code:item.unit_code,directory_group:item.directory_group,active:true}).select('id,name,unit_code,directory_group,active').single()
            if(areaError||!data) throw areaError || new Error('AREA_INSERT')
            area = data as Management; working.push(area); newAreas += 1
          }
        }
      }

      for(const item of parsed){
        const existing = managers.find(m => m.unit_code===item.unit_code && m.directory_group===item.directory_group && normalize(m.name)===normalize(item.name))
        const areaIds = item.areas.map(name => working.find(a => a.unit_code===item.unit_code && a.directory_group===item.directory_group && normalize(a.name)===normalize(name))?.id).filter((id):id is string => Boolean(id))
        const { error: managerError } = await supabase.rpc('save_directory_manager', {
          manager_id_input: existing?.id || null,
          name_input: item.name,
          cargo_input: item.cargo,
          unit_code_input: item.unit_code,
          directory_group_input: item.directory_group,
          active_input: item.active,
          management_ids_input: areaIds,
        })
        if (managerError) throw managerError
        processed += 1
      }

      await loadCatalogs()
      setSelectedUnitCode(parsed[0].unit_code)
      if(parsed[0].unit_code==='HU') setSelectedHuGroup(parsed[0].directory_group)
      setNotice(`Excel importado: ${processed} bonista${processed===1?'':'s'} y ${newAreas} área${newAreas===1?'':'s'} nueva${newAreas===1?'':'s'}. Las áreas nuevas no se activan en Matrices hasta que las selecciones abajo.`)
    } catch(e){
      const message=e instanceof Error?e.message:''
      setError(message==='FORMAT_NOT_FOUND'?'No encontramos una tabla con columnas Nombre, Cargo y Área.':message==='NO_ROWS'?'El Excel no contiene bonistas.':`No pudimos importar el Excel${message?`: ${message}`:'.'}`)
    } finally { setImporting(false) }
  }

  const groupTitle = selectedUnitCode === 'HU' ? groupLabel(activeGroup) : (selectedUnit?.name || selectedUnitCode)
  const rootUnitClass = `catalog-config--${selectedUnitCode.toLowerCase()}`
  const unitSelector = <>
    <div className="catalog-unit-selector compact" role="tablist">
      {unitOptions.map(unit => <button key={unit.code} type="button" className={selectedUnitCode===unit.code?'active':''} onClick={()=>chooseUnit(unit.code)}><span>{unit.code}</span><small>{unit.name}</small></button>)}
    </div>
    {selectedUnitCode==='HU'&&<div className="catalog-hu-groups compact">{huGroups.map(group=><button key={group.code} type="button" className={selectedHuGroup===group.code?'active':''} onClick={()=>{setSelectedHuGroup(group.code);setAreaSearch('');setFilterAreaId('')}}><strong>{group.short}</strong><small>{group.label}</small></button>)}</div>}
  </>

  return <div className={`catalog-config ${rootUnitClass}`}>
    {error&&<div className="catalog-message catalog-message--error">{error}</div>}
    {notice&&<div className="catalog-message catalog-message--success"><Check size={15}/>{notice}</div>}

    {loading ? <div className="catalog-loading"><LoaderCircle className="spin" size={24}/> Cargando configuración...</div> : <>
      <section className={`config-accordion ${bonistasOpen?'open':''}`}>
        <button className="config-accordion-head" type="button" onClick={()=>setBonistasOpen(value=>!value)}>
          <span className="config-accordion-icon"><UserRound size={21}/></span>
          <div><small>Directorio maestro</small><h2>Bonistas</h2><p>Este directorio conserva las áreas reales de cada bonista.</p></div>
          <ChevronDown className={bonistasOpen?'rotated':''} size={20}/>
        </button>

        {bonistasOpen&&<div className="config-accordion-body">
          {unitSelector}
          <div className="catalog-toolbar">
            <div><strong>{groupTitle}</strong><small>{selectedManagers.length} bonistas registrados</small></div>
            <div>
              <button className="catalog-template-button" onClick={()=>void downloadTemplate()}><Download size={15}/> Plantilla</button>
              {canManage&&<label className={`catalog-template-button catalog-file-button ${importing?'disabled':''}`}><Upload size={15}/>{importing?'Importando...':'Importar Excel'}<input type="file" accept=".xlsx,.xls" onChange={importCatalogFromExcel} disabled={importing}/></label>}
              {canManage&&selectedUnitHasData&&<button className="catalog-template-button catalog-unit-delete" onClick={()=>setUnitDeleteOpen(true)}><Trash2 size={15}/> Borrar unidad</button>}
              {canManage&&<button className="catalog-add" onClick={openNewManager}><Plus size={15}/> Nuevo bonista</button>}
            </div>
          </div>

          <div className="catalog-directory-filters">
            <label><Search size={15}/><input value={filterName} onChange={event=>setFilterName(event.target.value)} placeholder="Buscar nombre"/></label>
            <label><Search size={15}/><input value={filterCargo} onChange={event=>setFilterCargo(event.target.value)} placeholder="Buscar cargo"/></label>
            <label><Building2 size={15}/><select value={filterAreaId} onChange={event=>setFilterAreaId(event.target.value)}><option value="">Todas las áreas</option>{selectedManagements.map(area=><option key={area.id} value={area.id}>{area.name}</option>)}</select></label>
          </div>

          <div className="catalog-directory-scroll"><table className="catalog-directory-table"><thead><tr><th>Cant.</th><th>UN</th><th>Nombre</th><th>Cargo</th><th>Área</th><th>Estado</th>{canManage&&<th>Acciones</th>}</tr></thead><tbody>
            {filteredManagers.length===0?<tr><td colSpan={canManage?7:6} className="catalog-directory-empty">No hay bonistas en esta vista.</td></tr>:filteredManagers.map((item,index)=>{
              const related=links.filter(link=>link.manager_id===item.id).map(link=>managementById.get(link.management_id)?.name).filter((name):name is string=>Boolean(name))
              return <tr key={item.id}><td className="catalog-directory-number">{index+1}</td><td><span className="catalog-unit-badge">{item.directory_group==='MATRICIAL_HU_VS'?'MATRICIAL':item.unit_code}</span></td><td><strong>{item.name}</strong></td><td>{item.cargo||'Sin registrar'}</td><td>{related.length?related.join(' / '):'Sin área'}</td><td><span className={`catalog-status ${item.active?'active':'inactive'}`}>{item.active?'Activo':'Inactivo'}</span></td>{canManage&&<td><div className="catalog-row-actions"><button className="catalog-edit" onClick={()=>editManager(item)}><Pencil size={14}/></button><button className="catalog-delete" onClick={()=>setDeleteTarget({id:item.id,name:item.name})}><Trash2 size={14}/></button></div></td>}</tr>
            })}
          </tbody></table></div>
        </div>}
      </section>

      <section className={`config-accordion ${areasOpen?'open':''}`}>
        <button className="config-accordion-head" type="button" onClick={()=>setAreasOpen(value=>!value)}>
          <span className="config-accordion-icon"><Building2 size={21}/></span>
          <div><small>Configuración de matrices</small><h2>Áreas visibles en Matrices</h2><p>Esta sección es independiente del directorio de Bonistas.</p></div>
          <ChevronDown className={areasOpen?'rotated':''} size={20}/>
        </button>

        {areasOpen&&<div className="config-accordion-body matrix-area-config-body">
          {unitSelector}
          <div className="matrix-area-config-info">
            <div><strong>Áreas de origen: {groupTitle}</strong><small>Se toman de la columna Área de tus Bonistas. Quitar un área aquí NO modifica ningún Bonista.</small></div>
            <span>{visibleMatrixAreaCount} área{visibleMatrixAreaCount===1?'':'s'} visible{visibleMatrixAreaCount===1?'':'s'} en Matrices</span>
          </div>

          <div className="area-editor-toolbar"><label><Search size={16}/><input value={areaSearch} onChange={event=>setAreaSearch(event.target.value)} placeholder="Buscar área..."/></label></div>

          <div className="matrix-area-source-grid">
            {filteredSourceAreas.length===0 ? <div className="catalog-empty">No hay áreas cargadas en los Bonistas de esta unidad/división.</div> : filteredSourceAreas.map(area=>{
              const visible = matrixCatalogNames.has(normalize(area.name))
              return <div className={`matrix-area-source-card ${visible?'visible':''}`} key={area.id}>
                <span className="matrix-area-source-icon"><Building2 size={18}/></span>
                <div><strong>{area.name}</strong><small>{groupTitle}</small></div>
                <span className={`matrix-area-visibility ${visible?'on':'off'}`}>{visible?'Visible en Matrices':'No visible'}</span>
                {canManage && (visible
                  ? <button className="matrix-area-toggle remove" type="button" disabled={saving} onClick={()=>void removeAreaFromMatrices(area)}><X size={14}/> Quitar de Matrices</button>
                  : <button className="matrix-area-toggle add" type="button" disabled={saving} onClick={()=>void addAreaToMatrices(area)}><Plus size={14}/> Añadir a Matrices</button>)}
              </div>
            })}
          </div>
        </div>}
      </section>
    </>}

    {managerFormOpen&&<div className="cg-modal-backdrop"><form className="catalog-form config-modal wide" onSubmit={saveManager}>
      <button className="config-modal-close" type="button" onClick={closeManagerForm}><X size={17}/></button>
      <div className="catalog-form-heading"><div><UserRound size={18}/><span>{editingManagerId?'Editar bonista':'Nuevo bonista'}</span></div></div>
      <div className="catalog-form-grid"><label>Nombre<input autoFocus value={managerName} onChange={event=>setManagerName(event.target.value)}/></label><label>Cargo<input value={managerCargo} onChange={event=>setManagerCargo(event.target.value)}/></label></div>
      <fieldset><legend>Área(s) reales del bonista · {groupTitle}</legend><div className="catalog-check-grid">
        {selectedManagements.length===0?<div className="catalog-check-empty">No hay áreas cargadas para esta unidad. Puedes importarlas junto con los Bonistas desde Excel.</div>:selectedManagements.filter(area=>area.active||managerManagementIds.includes(area.id)).map(area=><label key={area.id} className={managerManagementIds.includes(area.id)?'selected':''}><input type="checkbox" checked={managerManagementIds.includes(area.id)} onChange={()=>toggleManagerArea(area.id)}/><span>{area.name}</span></label>)}
      </div></fieldset>
      <label className="catalog-toggle"><input type="checkbox" checked={managerActive} onChange={event=>setManagerActive(event.target.checked)}/><span>Activo</span></label>
      <div><button type="button" className="catalog-cancel" onClick={closeManagerForm}>Cancelar</button><button className="catalog-save" disabled={saving||!managerName.trim()||!managerManagementIds.length}>{saving?<LoaderCircle className="spin" size={14}/>:<Check size={14}/>} Guardar bonista</button></div>
    </form></div>}

    {deleteTarget&&<div className="cg-modal-backdrop"><div className="cg-confirm-dialog"><button className="cg-modal-close" onClick={()=>setDeleteTarget(null)} disabled={deleting}><X size={18}/></button><div className="cg-confirm-icon"><Trash2 size={23}/></div><h3>¿Eliminar bonista?</h3><p>Se eliminará “{deleteTarget.name}”. Sus áreas del catálogo no se eliminarán.</p><div className="cg-modal-actions"><button className="cg-modal-secondary" onClick={()=>setDeleteTarget(null)} disabled={deleting}>Cancelar</button><button className="cg-modal-primary cg-modal-danger" onClick={()=>void deleteSelectedManager()} disabled={deleting}>{deleting&&<LoaderCircle className="spin" size={16}/>} Sí, eliminar</button></div></div></div>}

    {unitDeleteOpen&&<div className="cg-modal-backdrop"><div className="cg-confirm-dialog"><button className="cg-modal-close" onClick={()=>setUnitDeleteOpen(false)}><X size={18}/></button><div className="cg-confirm-icon"><Trash2 size={23}/></div><h3>¿Borrar {selectedUnit?.name}?</h3><p>Este botón pertenece al directorio de Bonistas: elimina los Bonistas y sus áreas base de esa unidad. No uses este botón para ocultar áreas de Matrices.</p><div className="cg-modal-actions"><button className="cg-modal-secondary" onClick={()=>setUnitDeleteOpen(false)}>Cancelar</button><button className="cg-modal-primary cg-modal-danger" onClick={()=>void deleteSelectedUnit()} disabled={unitDeleting}>{unitDeleting&&<LoaderCircle className="spin" size={16}/>} Sí, borrar</button></div></div></div>}
  </div>
}
