import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react'
import { Building2, Check, Download, LoaderCircle, Pencil, Plus, Search, Trash2, Upload, UserRound, X } from 'lucide-react'
import { supabase } from './lib/supabase'
import './catalog-configuration.css'

type Unit = { code: string; name: string }
type DirectoryGroup = 'GENERAL' | 'HU' | 'MATRICIAL_HU_VS'

type Management = {
  id: string
  name: string
  unit_code: string
  directory_group: DirectoryGroup
  active: boolean
}

type Manager = {
  id: string
  name: string
  email: string | null
  cargo: string | null
  unit_code: string
  directory_group: DirectoryGroup
  active: boolean
}

type ManagerManagement = { manager_id: string; management_id: string }
type Props = { units?: Unit[]; canManage: boolean }
type DeleteTarget = { type: 'manager' | 'management'; id: string; name: string } | null

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
  { code: 'MATRICIAL_HU_VS', label: 'Matricial / HU / VS', short: 'MATRICIAL / HU / VS' },
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

function recordsFromDetectedHeader(XLSX: any, sheet: any, kind: 'directory' | 'areas') {
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false }) as unknown[][]
  const names = kind === 'directory'
    ? new Set(['nombre', 'responsable', 'gerente', 'gerenteresponsable'])
    : new Set(['area', 'areas', 'gerencia', 'gerencias'])
  const units = new Set(['un', 'unidad', 'unidadnegocio', 'unidaddenegocio'])
  const areas = new Set(['area', 'areas', 'gerencia', 'gerencias'])
  const headerIndex = matrix.findIndex(row => {
    const headers = row.map(normalizeHeader)
    const hasName = headers.some(value => names.has(value))
    const hasUnit = headers.some(value => units.has(value))
    return kind === 'areas' ? hasName && hasUnit : hasName && hasUnit && headers.some(value => areas.has(value))
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
  const [selectedUnitCode, setSelectedUnitCode] = useState(defaultUnitCode)
  const [selectedHuGroup, setSelectedHuGroup] = useState<DirectoryGroup>('HU')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  const [filterName, setFilterName] = useState('')
  const [filterCargo, setFilterCargo] = useState('')
  const [filterAreaId, setFilterAreaId] = useState('')

  const [managementFormOpen, setManagementFormOpen] = useState(false)
  const [editingManagementId, setEditingManagementId] = useState<string | null>(null)
  const [managementName, setManagementName] = useState('')
  const [managementUnitCode, setManagementUnitCode] = useState(defaultUnitCode)
  const [managementGroup, setManagementGroup] = useState<DirectoryGroup>('GENERAL')
  const [managementActive, setManagementActive] = useState(true)

  const [managerFormOpen, setManagerFormOpen] = useState(false)
  const [editingManagerId, setEditingManagerId] = useState<string | null>(null)
  const [managerName, setManagerName] = useState('')
  const [managerEmail, setManagerEmail] = useState('')
  const [managerCargo, setManagerCargo] = useState('')
  const [managerUnitCode, setManagerUnitCode] = useState(defaultUnitCode)
  const [managerGroup, setManagerGroup] = useState<DirectoryGroup>('GENERAL')
  const [managerActive, setManagerActive] = useState(true)
  const [managerManagementIds, setManagerManagementIds] = useState<string[]>([])

  const managementById = useMemo(() => new Map(managements.map(item => [item.id, item])), [managements])
  const unitByCode = useMemo(() => new Map(unitOptions.map(unit => [unit.code, unit.name])), [unitOptions])
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

  const managerManagementOptions = useMemo(
    () => managements.filter(item => item.unit_code === managerUnitCode && item.directory_group === managerGroup && (item.active || managerManagementIds.includes(item.id))),
    [managements, managerUnitCode, managerGroup, managerManagementIds],
  )

  useEffect(() => { void loadCatalogs() }, [])

  async function loadCatalogs() {
    if (!supabase) return
    setLoading(true); setError('')
    const [managementResult, managerResult, linkResult] = await Promise.all([
      supabase.from('managements_global').select('id, name, unit_code, directory_group, active').order('unit_code').order('directory_group').order('name'),
      supabase.from('managers').select('id, name, email, cargo, unit_code, directory_group, active').order('unit_code').order('directory_group').order('name'),
      supabase.from('manager_managements').select('manager_id, management_id'),
    ])
    setLoading(false)
    if (managementResult.error || managerResult.error || linkResult.error) { setError('No pudimos cargar el directorio.'); return }
    setManagements((managementResult.data || []) as Management[])
    setManagers((managerResult.data || []) as Manager[])
    setLinks((linkResult.data || []) as ManagerManagement[])
  }

  function unitLabel(code: string) { return unitByCode.get(code) || code }
  function groupLabel(group: DirectoryGroup) { return huGroups.find(item => item.code === group)?.label || '' }
  function groupForUnit(unitCode: string, preferred?: DirectoryGroup): DirectoryGroup { return unitCode === 'HU' ? (preferred === 'MATRICIAL_HU_VS' ? preferred : 'HU') : 'GENERAL' }

  function resolveLocation(unitValue: string, groupValue = ''): { unit_code: string; directory_group: DirectoryGroup } {
    const raw = normalizeHeader(unitValue)
    const groupRaw = normalizeHeader(groupValue)
    if (raw.includes('matricialhuvs') || groupRaw.includes('matricialhuvs')) return { unit_code: 'HU', directory_group: 'MATRICIAL_HU_VS' }
    const aliases: Record<string, string> = {
      central: 'CENTRAL', cen: 'CENTRAL', hu: 'HU', habilitacionurbana: 'HU',
      dep: 'DEP', departamentos: 'DEP', departamento: 'DEP', vs: 'VS', viviendasocial: 'VS',
      hot: 'HOT', hoteles: 'HOT', hotel: 'HOT',
    }
    const direct = unitOptions.find(unit => normalizeHeader(unit.code) === raw || normalizeHeader(unit.name) === raw)?.code
    const unit_code = direct || aliases[raw] || ''
    return { unit_code, directory_group: groupForUnit(unit_code, groupRaw.includes('matricial') ? 'MATRICIAL_HU_VS' : 'HU') }
  }

  function clearFilters() { setFilterName(''); setFilterCargo(''); setFilterAreaId('') }

  function chooseUnit(code: string) {
    setSelectedUnitCode(code); if (code !== 'HU') setSelectedHuGroup('HU')
    setManagementFormOpen(false); setManagerFormOpen(false); setError(''); setNotice(''); clearFilters()
  }

  function chooseHuGroup(group: DirectoryGroup) {
    setSelectedHuGroup(group); setManagementFormOpen(false); setManagerFormOpen(false); setError(''); setNotice(''); clearFilters()
  }

  function resetManagementForm() {
    setManagementFormOpen(false); setEditingManagementId(null); setManagementName('');
    setManagementUnitCode(selectedUnitCode); setManagementGroup(activeGroup); setManagementActive(true)
  }

  function resetManagerForm() {
    setManagerFormOpen(false); setEditingManagerId(null); setManagerName(''); setManagerEmail(''); setManagerCargo('');
    setManagerUnitCode(selectedUnitCode); setManagerGroup(activeGroup); setManagerActive(true); setManagerManagementIds([])
  }

  function openNewManagement() { resetManagementForm(); setManagementFormOpen(true); setManagerFormOpen(false); setError(''); setNotice('') }
  function openNewManager() { resetManagerForm(); setManagerFormOpen(true); setManagementFormOpen(false); setError(''); setNotice('') }

  function editManagement(item: Management) {
    setEditingManagementId(item.id); setManagementName(item.name); setManagementUnitCode(item.unit_code); setManagementGroup(item.directory_group); setManagementActive(item.active)
    setManagementFormOpen(true); setManagerFormOpen(false); setError(''); setNotice('')
  }

  function editManager(item: Manager) {
    setEditingManagerId(item.id); setManagerName(item.name); setManagerEmail(item.email || ''); setManagerCargo(item.cargo || '')
    setManagerUnitCode(item.unit_code); setManagerGroup(item.directory_group); setManagerActive(item.active)
    setManagerManagementIds(links.filter(link => link.manager_id === item.id).map(link => link.management_id))
    setManagerFormOpen(true); setManagementFormOpen(false); setError(''); setNotice('')
  }

  function changeManagementUnit(code: string) { setManagementUnitCode(code); setManagementGroup(groupForUnit(code, code === 'HU' ? 'HU' : 'GENERAL')) }
  function changeManagerUnit(code: string) { setManagerUnitCode(code); setManagerGroup(groupForUnit(code, code === 'HU' ? 'HU' : 'GENERAL')); setManagerManagementIds([]) }
  function changeManagerGroup(group: DirectoryGroup) { setManagerGroup(group); setManagerManagementIds([]) }
  function toggleManagerManagement(id: string) { setManagerManagementIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]) }

  async function saveManagement(event: FormEvent) {
    event.preventDefault(); if (!supabase || !canManage) return
    const name = managementName.trim().replace(/\s+/g, ' ')
    if (!name) { setError('Escribe el nombre del área.'); return }
    const group = groupForUnit(managementUnitCode, managementGroup)
    const duplicate = managements.find(item => item.unit_code === managementUnitCode && item.directory_group === group && normalize(item.name) === normalize(name) && item.id !== editingManagementId)
    if (duplicate) { setError(`El área “${duplicate.name}” ya existe en este grupo.`); return }
    setSaving(true); setError(''); setNotice('')
    const payload = { name, unit_code: managementUnitCode, directory_group: group, active: managementActive }
    const result = editingManagementId ? await supabase.from('managements_global').update(payload).eq('id', editingManagementId) : await supabase.from('managements_global').insert(payload)
    setSaving(false)
    if (result.error) { setError('No pudimos guardar el área. Revisa la unidad y el grupo.'); return }
    setSelectedUnitCode(managementUnitCode); if (managementUnitCode === 'HU') setSelectedHuGroup(group)
    resetManagementForm(); setNotice('Área guardada correctamente.'); await loadCatalogs()
  }

  async function saveManager(event: FormEvent) {
    event.preventDefault(); if (!supabase || !canManage) return
    const name = managerName.trim().replace(/\s+/g, ' '); const cargo = managerCargo.trim().replace(/\s+/g, ' '); const email = managerEmail.trim().toLowerCase()
    if (!name) { setError('Escribe el nombre del responsable.'); return }
    if (!managerManagementIds.length) { setError('Selecciona al menos un área para este responsable.'); return }
    const group = groupForUnit(managerUnitCode, managerGroup)
    setSaving(true); setError(''); setNotice('')
    let managerId = editingManagerId
    const payload = { name, cargo: cargo || null, email: email || null, unit_code: managerUnitCode, directory_group: group, active: managerActive }
    if (managerId) {
      const { error: updateError } = await supabase.from('managers').update(payload).eq('id', managerId)
      if (updateError) { setSaving(false); setError('No pudimos actualizar el responsable.'); return }
    } else {
      const { data, error: insertError } = await supabase.from('managers').insert(payload).select('id').single()
      if (insertError || !data) { setSaving(false); setError('No pudimos crear el responsable. Revisa que el correo no esté repetido.'); return }
      managerId = String(data.id)
    }
    const { error: deleteError } = await supabase.from('manager_managements').delete().eq('manager_id', managerId)
    if (deleteError) { setSaving(false); setError('No pudimos actualizar las áreas del responsable.'); return }
    const { error: linkError } = await supabase.from('manager_managements').insert(managerManagementIds.map(managementId => ({ manager_id: managerId, management_id: managementId })))
    setSaving(false)
    if (linkError) { setError('No pudimos relacionar el responsable con las áreas seleccionadas.'); return }
    setSelectedUnitCode(managerUnitCode); if (managerUnitCode === 'HU') setSelectedHuGroup(group)
    resetManagerForm(); setNotice('Responsable guardado correctamente.'); await loadCatalogs()
  }

  async function deleteSelected() {
    if (!supabase || !deleteTarget || !canManage) return
    setDeleting(true); setError(''); setNotice('')
    const rpcName = deleteTarget.type === 'manager' ? 'delete_directory_manager' : 'delete_directory_management'
    const args = deleteTarget.type === 'manager' ? { manager_id_input: deleteTarget.id } : { management_id_input: deleteTarget.id }
    const { error: rpcError } = await supabase.rpc(rpcName, args)
    setDeleting(false)
    if (rpcError) { setError('No pudimos eliminar este registro.'); return }
    const deletedName = deleteTarget.name; const deletedType = deleteTarget.type
    setDeleteTarget(null); setNotice(`${deletedType === 'manager' ? 'Responsable' : 'Área'} “${deletedName}” eliminado correctamente.`); await loadCatalogs()
  }

  async function downloadTemplate() {
    try {
      const XLSX = await import(/* @vite-ignore */ XLSX_MODULE_URL)
      const rows = managers.length ? managers.map((manager, index) => ({
        'Cant.': index + 1, UN: manager.directory_group === 'MATRICIAL_HU_VS' ? 'Matricial/HU/VS' : unitLabel(manager.unit_code),
        Grupo: manager.unit_code === 'HU' ? groupLabel(manager.directory_group) : '', Nombre: manager.name, Cargo: manager.cargo || '',
        Área: links.filter(link => link.manager_id === manager.id).map(link => managementById.get(link.management_id)?.name).filter(Boolean).join(' / '),
        Correo: manager.email || '', Estado: manager.active ? 'Activo' : 'Inactivo',
      })) : [{ 'Cant.': 1, UN: 'Departamentos', Grupo: '', Nombre: 'NOMBRE APELLIDO', Cargo: 'GERENTE DE PROYECTOS', Área: 'Operaciones', Correo: '', Estado: 'Activo' }]
      const sheet = XLSX.utils.json_to_sheet(rows); sheet['!cols'] = [{wch:8},{wch:22},{wch:24},{wch:36},{wch:38},{wch:28},{wch:34},{wch:14}]
      const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, sheet, 'Directorio'); XLSX.writeFile(workbook, 'Plantilla_Directorio_Responsables.xlsx')
    } catch { setError('No pudimos generar la plantilla Excel.') }
  }

  async function importCatalogFromExcel(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = ''
    if (!file || !supabase || !canManage) return
    setImporting(true); setError(''); setNotice('')
    try {
      const XLSX = await import(/* @vite-ignore */ XLSX_MODULE_URL)
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' })
      const rows: Record<string, unknown>[] = []
      workbook.SheetNames.forEach(sheetName => rows.push(...recordsFromDetectedHeader(XLSX, workbook.Sheets[sheetName], 'directory')))
      if (!rows.length) throw new Error('FORMAT_NOT_FOUND')

      const parsed = rows.map((row, index) => {
        const location = resolveLocation(valueFromRow(row, ['UN','Unidad','Unidad de negocio']), valueFromRow(row, ['Grupo','Subunidad','Segmento']))
        return {
          row: index + 2, ...location, name: valueFromRow(row, ['Nombre','Responsable','Gerente']), cargo: valueFromRow(row, ['Cargo','Puesto']),
          email: valueFromRow(row, ['Correo','Email','Correo electrónico']).toLowerCase(), areas: splitValues(valueFromRow(row, ['Área','Area','Áreas','Areas','Gerencia','Gerencias'])),
          active: parseActive(valueFromRow(row, ['Estado','Estatus','Activo']) || 'Activo'),
        }
      }).filter(item => item.name)
      if (!parsed.length) throw new Error('NO_ROWS')
      const errors: string[] = []
      parsed.forEach(item => { if (!item.unit_code) errors.push(`Fila ${item.row}: UN no válida.`); if (!item.areas.length) errors.push(`Fila ${item.row}: falta Área.`) })
      if (errors.length) { setError(`Excel no importado: ${errors.slice(0,8).join(' · ')}`); return }

      const workingManagements = [...managements]
      let newAreas = 0
      for (const item of parsed) {
        for (const areaName of item.areas) {
          let area = workingManagements.find(a => a.unit_code === item.unit_code && a.directory_group === item.directory_group && normalize(a.name) === normalize(areaName))
          if (!area) {
            const { data, error: insertError } = await supabase.from('managements_global').insert({ name: areaName, unit_code: item.unit_code, directory_group: item.directory_group, active: true }).select('id,name,unit_code,directory_group,active').single()
            if (insertError || !data) throw insertError || new Error('AREA_INSERT')
            area = data as Management; workingManagements.push(area); newAreas += 1
          }
        }
      }

      let processed = 0
      for (const item of parsed) {
        let manager = managers.find(m => m.unit_code === item.unit_code && m.directory_group === item.directory_group && normalize(m.name) === normalize(item.name))
        let managerId = manager?.id || ''
        const payload = { name: item.name, cargo: item.cargo || null, email: item.email || null, unit_code: item.unit_code, directory_group: item.directory_group, active: item.active }
        if (manager) {
          const { error: updateError } = await supabase.from('managers').update(payload).eq('id', manager.id); if (updateError) throw updateError
        } else {
          const { data, error: insertError } = await supabase.from('managers').insert(payload).select('id').single(); if (insertError || !data) throw insertError || new Error('MANAGER_INSERT'); managerId = String(data.id)
        }
        const areaIds = item.areas.map(name => workingManagements.find(a => a.unit_code === item.unit_code && a.directory_group === item.directory_group && normalize(a.name) === normalize(name))?.id).filter((id): id is string => Boolean(id))
        const { error: deleteError } = await supabase.from('manager_managements').delete().eq('manager_id', managerId); if (deleteError) throw deleteError
        const { error: linkError } = await supabase.from('manager_managements').insert(areaIds.map(managementId => ({ manager_id: managerId, management_id: managementId }))); if (linkError) throw linkError
        processed += 1
      }
      await loadCatalogs(); setSelectedUnitCode(parsed[0].unit_code); if (parsed[0].unit_code === 'HU') setSelectedHuGroup(parsed[0].directory_group)
      setNotice(`Excel importado: ${processed} responsable${processed===1?'':'s'} procesado${processed===1?'':'s'} y ${newAreas} área${newAreas===1?'':'s'} nueva${newAreas===1?'':'s'}.`)
    } catch (e) {
      const message = e instanceof Error ? e.message : ''
      if (message === 'FORMAT_NOT_FOUND') setError('No encontramos una tabla con columnas UN, Nombre, Cargo y Área.')
      else if (message === 'NO_ROWS') setError('El Excel no contiene responsables.')
      else setError(`No pudimos importar el Excel${message ? `: ${message}` : '.'}`)
    } finally { setImporting(false) }
  }

  const rootUnitClass = `catalog-config--${selectedUnitCode.toLowerCase()}`
  const groupTitle = selectedUnitCode === 'HU' ? groupLabel(activeGroup) : (selectedUnit?.name || selectedUnitCode)

  return (
    <div className={`catalog-config ${rootUnitClass}`}>
      <section className="catalog-hero catalog-hero--directory">
        <div><span className="catalog-kicker">Directorio maestro</span><h2>Responsables por unidad</h2><p>UN identifica la unidad, Cargo indica el puesto y Área alimenta la Gerencia Responsable de los lineamientos.</p></div>
        <div className="guideline-actions catalog-hero-actions">
          <button className="catalog-template-button" type="button" onClick={() => void downloadTemplate()}><Download size={16}/> Descargar plantilla</button>
          {canManage && <label className={`catalog-template-button catalog-file-button ${importing ? 'disabled' : ''}`}><Upload size={16}/>{importing ? 'Importando...' : 'Importar Excel'}<input type="file" accept=".xlsx,.xls" onChange={importCatalogFromExcel} disabled={importing}/></label>}
        </div>
      </section>

      <div className="catalog-unit-selector" role="tablist" aria-label="Unidades de negocio">
        {unitOptions.map(unit => <button key={unit.code} type="button" className={selectedUnitCode === unit.code ? 'active' : ''} onClick={() => chooseUnit(unit.code)}><span>{unit.code}</span><small>{unit.name}</small></button>)}
      </div>

      {selectedUnitCode === 'HU' && <div className="catalog-hu-groups" role="tablist" aria-label="División de Habilitación Urbana">
        {huGroups.map(group => <button key={group.code} type="button" className={selectedHuGroup === group.code ? 'active' : ''} onClick={() => chooseHuGroup(group.code)}><strong>{group.short}</strong><small>{group.label}</small></button>)}
      </div>}

      {error && <div className="catalog-message catalog-message--error">{error}</div>}
      {notice && <div className="catalog-message catalog-message--success"><Check size={15}/>{notice}</div>}

      {loading ? <div className="catalog-loading"><LoaderCircle className="spin" size={24}/> Cargando directorio...</div> : <>
        <section className="catalog-area-strip">
          <div className="catalog-area-strip__title"><div><span><Building2 size={17}/></span><div><strong>Áreas de {groupTitle}</strong><small>{selectedManagements.length} registrada{selectedManagements.length===1?'':'s'}</small></div></div>{canManage && <button className="catalog-add" onClick={openNewManagement}><Plus size={15}/> Nueva área</button>}</div>
          <div className="catalog-area-chips">
            {selectedManagements.length === 0 ? <span className="catalog-empty-inline">Aún no hay áreas en esta división.</span> : selectedManagements.map(item => <div className={`catalog-area-chip ${!item.active?'inactive':''}`} key={item.id}><span>{item.name}</span>{canManage && <><button type="button" onClick={() => editManagement(item)} title="Editar"><Pencil size={12}/></button><button type="button" className="danger" onClick={() => setDeleteTarget({type:'management',id:item.id,name:item.name})} title="Eliminar"><Trash2 size={12}/></button></>}</div>)}
          </div>
        </section>

        {managementFormOpen && <form className="catalog-form catalog-inline-editor" onSubmit={saveManagement}>
          <div className="catalog-form-heading"><div><Building2 size={18}/><span>{editingManagementId?'Editar área':'Nueva área'}</span></div><button type="button" onClick={resetManagementForm}><X size={16}/></button></div>
          <div className="catalog-form-grid"><label>Área / Gerencia<input autoFocus value={managementName} onChange={e=>setManagementName(e.target.value)} placeholder="Ej. Operaciones"/></label><label>UN<select value={managementUnitCode} onChange={e=>changeManagementUnit(e.target.value)}>{unitOptions.map(unit=><option key={unit.code} value={unit.code}>{unit.name}</option>)}</select></label></div>
          {managementUnitCode==='HU' && <label>División HU<select value={managementGroup} onChange={e=>setManagementGroup(e.target.value as DirectoryGroup)}>{huGroups.map(group=><option key={group.code} value={group.code}>{group.label}</option>)}</select></label>}
          <label className="catalog-toggle"><input type="checkbox" checked={managementActive} onChange={e=>setManagementActive(e.target.checked)}/><span>Activo</span></label>
          <div><button type="button" className="catalog-cancel" onClick={resetManagementForm}>Cancelar</button><button className="catalog-save" disabled={saving||!managementName.trim()}>{saving?<LoaderCircle className="spin" size={14}/>:<Check size={14}/>} Guardar área</button></div>
        </form>}

        {managerFormOpen && <form className="catalog-form catalog-inline-editor catalog-form--manager" onSubmit={saveManager}>
          <div className="catalog-form-heading"><div><UserRound size={18}/><span>{editingManagerId?'Editar responsable':'Nuevo responsable'}</span></div><button type="button" onClick={resetManagerForm}><X size={16}/></button></div>
          <div className="catalog-form-grid catalog-form-grid--four"><label>Nombre<input autoFocus value={managerName} onChange={e=>setManagerName(e.target.value)}/></label><label>Cargo<input value={managerCargo} onChange={e=>setManagerCargo(e.target.value)}/></label><label>Correo<input type="email" value={managerEmail} onChange={e=>setManagerEmail(e.target.value)}/></label><label>UN<select value={managerUnitCode} onChange={e=>changeManagerUnit(e.target.value)}>{unitOptions.map(unit=><option key={unit.code} value={unit.code}>{unit.name}</option>)}</select></label></div>
          {managerUnitCode==='HU' && <label>División HU<select value={managerGroup} onChange={e=>changeManagerGroup(e.target.value as DirectoryGroup)}>{huGroups.map(group=><option key={group.code} value={group.code}>{group.label}</option>)}</select></label>}
          <fieldset><legend>Área(s) relacionadas · {managerUnitCode==='HU'?groupLabel(managerGroup):unitLabel(managerUnitCode)}</legend><div className="catalog-check-grid">{managerManagementOptions.length===0?<div className="catalog-check-empty">Primero crea un área en esta división.</div>:managerManagementOptions.map(item=><label key={item.id} className={managerManagementIds.includes(item.id)?'selected':''}><input type="checkbox" checked={managerManagementIds.includes(item.id)} onChange={()=>toggleManagerManagement(item.id)}/><span>{item.name}</span></label>)}</div></fieldset>
          <label className="catalog-toggle"><input type="checkbox" checked={managerActive} onChange={e=>setManagerActive(e.target.checked)}/><span>Activo</span></label>
          <div><button type="button" className="catalog-cancel" onClick={resetManagerForm}>Cancelar</button><button className="catalog-save" disabled={saving||!managerName.trim()||!managerManagementIds.length}>{saving?<LoaderCircle className="spin" size={14}/>:<Check size={14}/>} Guardar responsable</button></div>
        </form>}

        <section className="catalog-directory-card">
          <div className="catalog-directory-head"><div><span className="catalog-directory-kicker">Directorio</span><h3>{groupTitle}</h3><p>{filteredManagers.length} de {selectedManagers.length} responsables</p></div>{canManage&&<button className="catalog-add" onClick={openNewManager}><Plus size={15}/> Nuevo responsable</button>}</div>
          <div className="catalog-directory-filters"><label><Search size={15}/><input value={filterName} onChange={e=>setFilterName(e.target.value)} placeholder="Filtrar por nombre"/></label><label><Search size={15}/><input value={filterCargo} onChange={e=>setFilterCargo(e.target.value)} placeholder="Filtrar por cargo"/></label><label><Building2 size={15}/><select value={filterAreaId} onChange={e=>setFilterAreaId(e.target.value)}><option value="">Todas las áreas</option>{selectedManagements.map(area=><option key={area.id} value={area.id}>{area.name}</option>)}</select></label>{(filterName||filterCargo||filterAreaId)&&<button type="button" className="catalog-clear-filters" onClick={clearFilters}><X size={14}/> Limpiar</button>}</div>
          <div className="catalog-directory-scroll"><table className="catalog-directory-table"><thead><tr><th>Cant.</th><th>UN</th><th>Nombre</th><th>Cargo</th><th>Área</th><th>Correo</th><th>Estado</th>{canManage&&<th>Acciones</th>}</tr></thead><tbody>
            {filteredManagers.length===0?<tr><td colSpan={canManage?8:7} className="catalog-directory-empty">No hay responsables que coincidan con esta vista o filtros.</td></tr>:filteredManagers.map((item,index)=>{
              const relatedNames=links.filter(link=>link.manager_id===item.id).map(link=>managementById.get(link.management_id)?.name).filter((name):name is string=>Boolean(name))
              return <tr key={item.id}><td className="catalog-directory-number">{index+1}</td><td><span className="catalog-unit-badge">{item.directory_group==='MATRICIAL_HU_VS'?'M/HU/VS':item.unit_code}</span></td><td className="catalog-directory-name"><strong>{item.name}</strong></td><td>{item.cargo||'Sin registrar'}</td><td>{relatedNames.length?relatedNames.join(' / '):'Sin área'}</td><td>{item.email||'—'}</td><td><span className={`catalog-status ${item.active?'active':'inactive'}`}>{item.active?'Activo':'Inactivo'}</span></td>{canManage&&<td><div className="catalog-row-actions"><button className="catalog-edit" type="button" onClick={()=>editManager(item)} title="Editar"><Pencil size={14}/></button><button className="catalog-delete" type="button" onClick={()=>setDeleteTarget({type:'manager',id:item.id,name:item.name})} title="Eliminar"><Trash2 size={14}/></button></div></td>}</tr>
            })}
          </tbody></table></div>
        </section>
      </>}

      {deleteTarget&&<div className="cg-modal-backdrop" role="presentation" onMouseDown={event=>{if(event.currentTarget===event.target&&!deleting)setDeleteTarget(null)}}><div className="cg-confirm-dialog" role="dialog" aria-modal="true"><button className="cg-modal-close" type="button" onClick={()=>setDeleteTarget(null)} disabled={deleting}><X size={18}/></button><div className="cg-confirm-icon"><Trash2 size={23}/></div><h3>¿Eliminar {deleteTarget.type==='manager'?'responsable':'área'}?</h3><p>Se eliminará “{deleteTarget.name}”. Los lineamientos se conservarán y se limpiarán las relaciones que correspondan.</p><div className="cg-modal-actions"><button type="button" className="cg-modal-secondary" onClick={()=>setDeleteTarget(null)} disabled={deleting}>Cancelar</button><button type="button" className="cg-modal-primary cg-modal-danger" onClick={()=>void deleteSelected()} disabled={deleting}>{deleting&&<LoaderCircle className="spin" size={16}/>} Sí, eliminar</button></div></div></div>}
    </div>
  )
}
