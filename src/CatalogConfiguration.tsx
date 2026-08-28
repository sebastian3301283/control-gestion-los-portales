import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react'
import { Briefcase, Building2, Check, Download, LoaderCircle, Mail, Pencil, Plus, Trash2, Upload, UserRound, Users, X } from 'lucide-react'
import { supabase } from './lib/supabase'
import './catalog-configuration.css'

type Unit = { code: string; name: string }

type Management = {
  id: string
  name: string
  unit_code: string
  active: boolean
}

type Manager = {
  id: string
  name: string
  email: string | null
  cargo: string | null
  unit_code: string
  active: boolean
}

type ManagerManagement = {
  manager_id: string
  management_id: string
}

type Props = {
  units?: Unit[]
  canManage: boolean
}

const XLSX_MODULE_URL = 'https://unpkg.com/xlsx@0.18.5/xlsx.mjs'
const fallbackUnits: Unit[] = [
  { code: 'CENTRAL', name: 'Central' },
  { code: 'HU', name: 'Habilitación Urbana' },
  { code: 'DEP', name: 'Departamentos' },
  { code: 'VS', name: 'Vivienda Social' },
  { code: 'HOT', name: 'Hoteles' },
]

function normalize(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('es')
}

function normalizeHeader(value: unknown) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function splitValues(value: string) {
  return value.split(/\s*(?:\/|;|\||\n)\s*/g).map(item => item.trim()).filter(Boolean)
}

function parseActive(value: string) {
  const normalized = normalize(value)
  return !['inactivo', 'inactiva', 'no', '0', 'false'].includes(normalized)
}

function valueFromRow(row: Record<string, unknown>, aliases: string[]) {
  const aliasSet = new Set(aliases.map(normalizeHeader))
  const found = Object.entries(row).find(([key]) => aliasSet.has(normalizeHeader(key)))
  return String(found?.[1] ?? '').trim()
}

export default function CatalogConfiguration({ units, canManage }: Props) {
  const unitOptions = units?.length ? units : fallbackUnits
  const defaultUnitCode = unitOptions.find(unit => unit.code === 'CENTRAL')?.code || unitOptions[0]?.code || 'CENTRAL'

  const [managements, setManagements] = useState<Management[]>([])
  const [managers, setManagers] = useState<Manager[]>([])
  const [links, setLinks] = useState<ManagerManagement[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [resetOpen, setResetOpen] = useState(false)
  const [resetting, setResetting] = useState(false)

  const [managementFormOpen, setManagementFormOpen] = useState(false)
  const [editingManagementId, setEditingManagementId] = useState<string | null>(null)
  const [managementName, setManagementName] = useState('')
  const [managementUnitCode, setManagementUnitCode] = useState(defaultUnitCode)
  const [managementActive, setManagementActive] = useState(true)

  const [managerFormOpen, setManagerFormOpen] = useState(false)
  const [editingManagerId, setEditingManagerId] = useState<string | null>(null)
  const [managerName, setManagerName] = useState('')
  const [managerEmail, setManagerEmail] = useState('')
  const [managerCargo, setManagerCargo] = useState('')
  const [managerUnitCode, setManagerUnitCode] = useState(defaultUnitCode)
  const [managerActive, setManagerActive] = useState(true)
  const [managerManagementIds, setManagerManagementIds] = useState<string[]>([])

  const managementById = useMemo(() => new Map(managements.map(item => [item.id, item])), [managements])
  const unitByCode = useMemo(() => new Map(unitOptions.map(unit => [unit.code, unit.name])), [unitOptions])
  const managerManagementOptions = useMemo(
    () => managements.filter(item => item.unit_code === managerUnitCode && (item.active || managerManagementIds.includes(item.id))),
    [managements, managerUnitCode, managerManagementIds],
  )

  useEffect(() => {
    void loadCatalogs()
  }, [])

  async function loadCatalogs() {
    if (!supabase) return
    setLoading(true)
    setError('')
    const [managementResult, managerResult, linkResult] = await Promise.all([
      supabase.from('managements_global').select('id, name, unit_code, active').order('unit_code').order('name'),
      supabase.from('managers').select('id, name, email, cargo, unit_code, active').order('unit_code').order('name'),
      supabase.from('manager_managements').select('manager_id, management_id'),
    ])
    setLoading(false)
    if (managementResult.error || managerResult.error || linkResult.error) {
      setError('No pudimos cargar la configuración de responsables.')
      return
    }
    setManagements((managementResult.data || []) as Management[])
    setManagers((managerResult.data || []) as Manager[])
    setLinks((linkResult.data || []) as ManagerManagement[])
  }

  function unitLabel(code: string) {
    return unitByCode.get(code) || code
  }

  function resolveUnitCode(value: string) {
    const normalized = normalizeHeader(value)
    const aliases: Record<string, string> = {
      central: 'CENTRAL', cen: 'CENTRAL',
      hu: 'HU', habilitacionurbana: 'HU',
      dep: 'DEP', departamentos: 'DEP', departamento: 'DEP',
      vs: 'VS', viviendasocial: 'VS',
      hot: 'HOT', hoteles: 'HOT', hotel: 'HOT',
    }
    const direct = unitOptions.find(unit => normalizeHeader(unit.code) === normalized || normalizeHeader(unit.name) === normalized)?.code
    return direct || aliases[normalized] || ''
  }

  function resetManagementForm() {
    setManagementFormOpen(false)
    setEditingManagementId(null)
    setManagementName('')
    setManagementUnitCode(defaultUnitCode)
    setManagementActive(true)
  }

  function resetManagerForm() {
    setManagerFormOpen(false)
    setEditingManagerId(null)
    setManagerName('')
    setManagerEmail('')
    setManagerCargo('')
    setManagerUnitCode(defaultUnitCode)
    setManagerActive(true)
    setManagerManagementIds([])
  }

  function openNewManagement() {
    resetManagementForm()
    setManagementFormOpen(true)
    setNotice('')
    setError('')
  }

  function editManagement(item: Management) {
    setEditingManagementId(item.id)
    setManagementName(item.name)
    setManagementUnitCode(item.unit_code)
    setManagementActive(item.active)
    setManagementFormOpen(true)
    setNotice('')
    setError('')
  }

  async function saveManagement(event: FormEvent) {
    event.preventDefault()
    if (!supabase || !canManage) return
    const name = managementName.trim().replace(/\s+/g, ' ')
    if (!name) {
      setError('Escribe el nombre de la gerencia o área responsable.')
      return
    }
    if (!managementUnitCode) {
      setError('Selecciona la unidad de negocio de esta gerencia.')
      return
    }

    setSaving(true)
    setError('')
    setNotice('')

    const duplicate = managements.find(item => item.unit_code === managementUnitCode && normalize(item.name) === normalize(name) && item.id !== editingManagementId)
    if (duplicate) {
      setSaving(false)
      setError(`La gerencia “${duplicate.name}” ya existe en ${unitLabel(managementUnitCode)}.`)
      return
    }

    const result = editingManagementId
      ? await supabase.from('managements_global').update({ name, unit_code: managementUnitCode, active: managementActive }).eq('id', editingManagementId)
      : await supabase.from('managements_global').insert({ name, unit_code: managementUnitCode, active: managementActive })

    setSaving(false)
    if (result.error) {
      setError(result.error.message.includes('UNIT_VALIDATION') ? result.error.message : 'No pudimos guardar la gerencia. Verifica el nombre y la unidad seleccionada.')
      return
    }

    resetManagementForm()
    setNotice(`Gerencia guardada correctamente en ${unitLabel(managementUnitCode)}.`)
    await loadCatalogs()
  }

  function openNewManager() {
    resetManagerForm()
    setManagerFormOpen(true)
    setNotice('')
    setError('')
  }

  function editManager(item: Manager) {
    const selectedLinks = links.filter(link => link.manager_id === item.id).map(link => link.management_id)
    setEditingManagerId(item.id)
    setManagerName(item.name)
    setManagerEmail(item.email || '')
    setManagerCargo(item.cargo || '')
    setManagerUnitCode(item.unit_code)
    setManagerActive(item.active)
    setManagerManagementIds(selectedLinks)
    setManagerFormOpen(true)
    setNotice('')
    setError('')
  }

  function toggleManagerManagement(id: string) {
    setManagerManagementIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id])
  }

  function changeManagerUnit(code: string) {
    setManagerUnitCode(code)
    setManagerManagementIds(current => current.filter(id => managementById.get(id)?.unit_code === code))
  }

  async function saveManager(event: FormEvent) {
    event.preventDefault()
    if (!supabase || !canManage) return
    const name = managerName.trim().replace(/\s+/g, ' ')
    const email = managerEmail.trim().toLowerCase()
    const cargo = managerCargo.trim().replace(/\s+/g, ' ')

    if (!name) {
      setError('Escribe el nombre del responsable.')
      return
    }
    if (!managerUnitCode) {
      setError('Selecciona la unidad del responsable.')
      return
    }
    if (managerManagementIds.length === 0) {
      setError('Selecciona al menos una gerencia para este responsable.')
      return
    }
    if (managerManagementIds.some(id => managementById.get(id)?.unit_code !== managerUnitCode)) {
      setError('Las gerencias relacionadas deben pertenecer a la misma unidad del responsable.')
      return
    }

    setSaving(true)
    setError('')
    setNotice('')

    let managerId = editingManagerId
    if (managerId) {
      const { error: updateError } = await supabase.from('managers').update({ name, email: email || null, cargo: cargo || null, unit_code: managerUnitCode, active: managerActive }).eq('id', managerId)
      if (updateError) {
        setSaving(false)
        setError('No pudimos actualizar el responsable. Revisa que el correo no esté repetido.')
        return
      }
    } else {
      const existing = managers.find(item => item.unit_code === managerUnitCode && normalize(item.name) === normalize(name))
      if (existing) {
        managerId = existing.id
        const { error: updateError } = await supabase.from('managers').update({ email: email || existing.email, cargo: cargo || existing.cargo, active: managerActive }).eq('id', managerId)
        if (updateError) {
          setSaving(false)
          setError('No pudimos actualizar el responsable existente.')
          return
        }
      } else {
        const { data, error: insertError } = await supabase.from('managers').insert({ name, email: email || null, cargo: cargo || null, unit_code: managerUnitCode, active: managerActive }).select('id').single()
        if (insertError || !data) {
          setSaving(false)
          setError('No pudimos crear el responsable. Revisa que el correo no esté repetido.')
          return
        }
        managerId = data.id as string
      }
    }

    const { error: deleteError } = await supabase.from('manager_managements').delete().eq('manager_id', managerId)
    if (deleteError) {
      setSaving(false)
      setError('No pudimos actualizar las relaciones del responsable.')
      return
    }

    const { error: linkError } = await supabase.from('manager_managements').insert(
      managerManagementIds.map(managementId => ({ manager_id: managerId, management_id: managementId })),
    )

    setSaving(false)
    if (linkError) {
      setError(linkError.message.includes('UNIT_VALIDATION') ? linkError.message : 'El responsable fue guardado, pero no pudimos asociarlo a las gerencias.')
      return
    }

    resetManagerForm()
    setNotice('Responsable, cargo, unidad y relaciones guardados correctamente.')
    await loadCatalogs()
  }

  async function resetAllCatalog() {
    if (!supabase || !canManage) return
    setResetting(true)
    setError('')
    setNotice('')

    const { data, error: resetError } = await supabase.rpc('reset_responsibility_catalog')
    setResetting(false)
    if (resetError) {
      setError('No pudimos borrar el catálogo maestro.')
      return
    }

    setResetOpen(false)
    resetManagementForm()
    resetManagerForm()
    const result = data as { managements_deleted?: number; managers_deleted?: number } | null
    setNotice(`Catálogo reiniciado. Se eliminaron ${result?.managements_deleted ?? 0} gerencias y ${result?.managers_deleted ?? 0} responsables.`)
    await loadCatalogs()
  }

  async function downloadTemplate() {
    try {
      const XLSX = await import(/* @vite-ignore */ XLSX_MODULE_URL)
      const firstManagement = managements.find(item => item.active)
      const firstManager = firstManagement
        ? managers.find(manager => manager.active && links.some(link => link.manager_id === manager.id && link.management_id === firstManagement.id))
        : null

      const lineamientos = XLSX.utils.aoa_to_sheet([
        ['N°', 'Lineamientos Estratégicos', 'Gerencia Responsable', 'Gerente Responsable', 'Estatus'],
        [1, 'Ejemplo de lineamiento', firstManagement?.name || '', firstManager?.name || '', 'pendiente'],
      ])
      lineamientos['!cols'] = [{ wch: 6 }, { wch: 65 }, { wch: 30 }, { wch: 30 }, { wch: 16 }]

      const gerenciasRows = managements.length ? managements.map(item => ({
        Gerencia: item.name,
        Unidad: item.unit_code,
        Estado: item.active ? 'Activo' : 'Inactivo',
      })) : [{ Gerencia: 'TI', Unidad: 'CENTRAL', Estado: 'Activo' }]
      const gerencias = XLSX.utils.json_to_sheet(gerenciasRows)
      gerencias['!cols'] = [{ wch: 30 }, { wch: 16 }, { wch: 14 }]

      const responsablesRows = managers.length ? managers.map(manager => ({
        Responsable: manager.name,
        Correo: manager.email || '',
        Cargo: manager.cargo || '',
        Unidad: manager.unit_code,
        Gerencias: links
          .filter(link => link.manager_id === manager.id)
          .map(link => managementById.get(link.management_id)?.name)
          .filter(Boolean)
          .join(' / '),
        Estado: manager.active ? 'Activo' : 'Inactivo',
      })) : [{ Responsable: 'Nombre Apellido', Correo: 'correo@empresa.com', Cargo: 'Gerente', Unidad: 'CENTRAL', Gerencias: 'TI', Estado: 'Activo' }]
      const responsables = XLSX.utils.json_to_sheet(responsablesRows)
      responsables['!cols'] = [{ wch: 28 }, { wch: 32 }, { wch: 24 }, { wch: 16 }, { wch: 36 }, { wch: 14 }]

      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, lineamientos, 'Lineamientos')
      XLSX.utils.book_append_sheet(workbook, gerencias, 'Gerencias')
      XLSX.utils.book_append_sheet(workbook, responsables, 'Responsables')
      XLSX.writeFile(workbook, 'Plantilla_Lineamientos_Catalogo.xlsx')
    } catch {
      setError('No pudimos generar la plantilla Excel.')
    }
  }

  async function importCatalogFromExcel(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !supabase || !canManage) return

    setImporting(true)
    setError('')
    setNotice('')

    try {
      const XLSX = await import(/* @vite-ignore */ XLSX_MODULE_URL)
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' })
      const findSheet = (aliases: string[]) => workbook.SheetNames.find(name => aliases.some(alias => normalizeHeader(name) === normalizeHeader(alias)))
      const managementSheetName = findSheet(['Gerencias', 'Gerencias válidas', 'Areas', 'Áreas'])
      const managerSheetName = findSheet(['Responsables', 'Responsables válidos', 'Gerentes'])

      if (!managementSheetName && !managerSheetName) throw new Error('SHEETS_NOT_FOUND')

      const managementRowsRaw = managementSheetName
        ? XLSX.utils.sheet_to_json(workbook.Sheets[managementSheetName], { defval: '' }) as Record<string, unknown>[]
        : []
      const managerRowsRaw = managerSheetName
        ? XLSX.utils.sheet_to_json(workbook.Sheets[managerSheetName], { defval: '' }) as Record<string, unknown>[]
        : []

      const parsedManagements = managementRowsRaw.map((row, index) => ({
        row: index + 2,
        name: valueFromRow(row, ['Gerencia', 'Área', 'Area', 'Nombre']),
        unit_code: resolveUnitCode(valueFromRow(row, ['Unidad', 'Unidad de negocio', 'Unidad Negocio'])),
        active: parseActive(valueFromRow(row, ['Estado', 'Estatus', 'Activo']) || 'Activo'),
      })).filter(item => item.name)

      const parsedManagers = managerRowsRaw.map((row, index) => ({
        row: index + 2,
        name: valueFromRow(row, ['Responsable', 'Gerente', 'Nombre']),
        email: valueFromRow(row, ['Correo', 'Email', 'Correo electrónico', 'Correo electronico']).toLowerCase(),
        cargo: valueFromRow(row, ['Cargo', 'Puesto']),
        unit_code: resolveUnitCode(valueFromRow(row, ['Unidad', 'Unidad de negocio', 'Unidad Negocio'])),
        managementNames: splitValues(valueFromRow(row, ['Gerencias', 'Gerencia', 'Áreas', 'Areas'])),
        active: parseActive(valueFromRow(row, ['Estado', 'Estatus', 'Activo']) || 'Activo'),
      })).filter(item => item.name)

      if (!parsedManagements.length && !parsedManagers.length) throw new Error('NO_ROWS')

      const validationErrors: string[] = []
      parsedManagements.forEach(item => {
        if (!item.unit_code) validationErrors.push(`Gerencias, fila ${item.row}: unidad no válida.`)
      })

      const availableManagementKeys = new Set(
        managements.map(item => `${item.unit_code}|${normalize(item.name)}`),
      )
      parsedManagements.forEach(item => {
        if (item.unit_code) availableManagementKeys.add(`${item.unit_code}|${normalize(item.name)}`)
      })

      parsedManagers.forEach(item => {
        if (!item.unit_code) validationErrors.push(`Responsables, fila ${item.row}: unidad no válida.`)
        if (!item.managementNames.length) validationErrors.push(`Responsables, fila ${item.row}: agrega al menos una gerencia.`)
        item.managementNames.forEach(name => {
          if (item.unit_code && !availableManagementKeys.has(`${item.unit_code}|${normalize(name)}`)) {
            validationErrors.push(`Responsables, fila ${item.row}: la gerencia “${name}” no existe en ${item.unit_code}.`)
          }
        })
      })

      if (validationErrors.length) {
        setError(`Excel no importado. Corrige primero: ${validationErrors.slice(0, 8).join(' · ')}${validationErrors.length > 8 ? ` · y ${validationErrors.length - 8} error(es) más.` : ''}`)
        return
      }

      const workingManagements = [...managements]
      let managementCount = 0
      for (const row of parsedManagements) {
        const existing = workingManagements.find(item => item.unit_code === row.unit_code && normalize(item.name) === normalize(row.name))
        if (existing) {
          const { error: updateError } = await supabase.from('managements_global').update({ name: row.name, active: row.active }).eq('id', existing.id)
          if (updateError) throw updateError
          existing.name = row.name
          existing.active = row.active
        } else {
          const { data, error: insertError } = await supabase.from('managements_global').insert({ name: row.name, unit_code: row.unit_code, active: row.active }).select('id, name, unit_code, active').single()
          if (insertError || !data) throw insertError || new Error('MANAGEMENT_INSERT')
          workingManagements.push(data as Management)
        }
        managementCount += 1
      }

      const workingManagers = [...managers]
      let managerCount = 0
      for (const row of parsedManagers) {
        const existing = workingManagers.find(item => item.unit_code === row.unit_code && normalize(item.name) === normalize(row.name))
        let managerId = existing?.id || ''
        if (existing) {
          const { error: updateError } = await supabase.from('managers').update({ name: row.name, email: row.email || null, cargo: row.cargo || null, active: row.active }).eq('id', existing.id)
          if (updateError) throw updateError
          existing.name = row.name
          existing.email = row.email || null
          existing.cargo = row.cargo || null
          existing.active = row.active
        } else {
          const { data, error: insertError } = await supabase.from('managers').insert({ name: row.name, email: row.email || null, cargo: row.cargo || null, unit_code: row.unit_code, active: row.active }).select('id, name, email, cargo, unit_code, active').single()
          if (insertError || !data) throw insertError || new Error('MANAGER_INSERT')
          const inserted = data as Manager
          workingManagers.push(inserted)
          managerId = inserted.id
        }

        const managementIds = row.managementNames.map(name => workingManagements.find(item => item.unit_code === row.unit_code && normalize(item.name) === normalize(name))?.id).filter((id): id is string => Boolean(id))
        const { error: deleteError } = await supabase.from('manager_managements').delete().eq('manager_id', managerId)
        if (deleteError) throw deleteError
        const { error: linkError } = await supabase.from('manager_managements').insert(managementIds.map(managementId => ({ manager_id: managerId, management_id: managementId })))
        if (linkError) throw linkError
        managerCount += 1
      }

      await loadCatalogs()
      setNotice(`Excel importado correctamente: ${managementCount} gerencia${managementCount === 1 ? '' : 's'} y ${managerCount} responsable${managerCount === 1 ? '' : 's'} procesado${managerCount === 1 ? '' : 's'}.`)
    } catch (importError) {
      const message = importError instanceof Error ? importError.message : ''
      if (message === 'SHEETS_NOT_FOUND') setError('No encontramos las hojas “Gerencias” o “Responsables”. Descarga la plantilla para usar el formato correcto.')
      else if (message === 'NO_ROWS') setError('El Excel no contiene gerencias ni responsables para importar.')
      else setError(`No pudimos importar el Excel${message ? `: ${message}` : '.'}`)
    } finally {
      setImporting(false)
    }
  }

  const catalogHasData = managements.length > 0 || managers.length > 0

  return (
    <div className="catalog-config catalog-config--central">
      <section className="catalog-hero">
        <div>
          <span className="catalog-kicker">Catálogo por unidad de negocio</span>
          <h2>Gerencias y responsables</h2>
          <p>Cada gerencia y cada responsable queda identificado por su unidad: Central, HU, Departamentos, Vivienda Social o Hoteles. Los responsables también pueden registrar su cargo y relacionarse con una o más gerencias de su misma unidad.</p>
        </div>
        <div className="guideline-actions catalog-hero-actions">
          <button className="catalog-template-button" type="button" onClick={() => void downloadTemplate()}><Download size={16}/> Descargar plantilla Excel</button>
          {canManage && <label className={`catalog-template-button catalog-file-button ${importing ? 'disabled' : ''}`}><Upload size={16}/>{importing ? 'Importando...' : 'Importar Excel'}<input type="file" accept=".xlsx,.xls" onChange={importCatalogFromExcel} disabled={importing} /></label>}
          {canManage && catalogHasData && <button className="catalog-template-button" type="button" onClick={() => setResetOpen(true)}><Trash2 size={16}/> Borrar todo</button>}
        </div>
      </section>

      <div className="catalog-message catalog-message--success"><Check size={15}/> La unidad se registra tanto en Gerencias / Áreas como en Gerentes / Responsables.</div>

      {error && <div className="catalog-message catalog-message--error">{error}</div>}
      {notice && <div className="catalog-message catalog-message--success"><Check size={15}/>{notice}</div>}

      {loading ? (
        <div className="catalog-loading"><LoaderCircle className="spin" size={24}/> Cargando catálogo...</div>
      ) : (
        <div className="catalog-columns">
          <section className="catalog-panel">
            <div className="catalog-panel-head">
              <div><span><Users size={17}/></span><div><h3>Gerencias / Áreas</h3><p>{managements.length} registradas · identificadas por unidad</p></div></div>
              {canManage && <button className="catalog-add" onClick={openNewManagement}><Plus size={15}/> Nueva gerencia</button>}
            </div>

            {managementFormOpen && (
              <form className="catalog-form" onSubmit={saveManagement}>
                <div className="catalog-form-grid">
                  <label>Nombre<input autoFocus value={managementName} onChange={event => setManagementName(event.target.value)} placeholder="Ej. TI" /></label>
                  <label>Unidad<select value={managementUnitCode} onChange={event => setManagementUnitCode(event.target.value)}>{unitOptions.map(unit => <option key={unit.code} value={unit.code}>{unit.code} · {unit.name}</option>)}</select></label>
                </div>
                <label className="catalog-toggle"><input type="checkbox" checked={managementActive} onChange={event => setManagementActive(event.target.checked)} /><span>Activo</span></label>
                <div><button type="button" className="catalog-cancel" onClick={resetManagementForm}><X size={14}/> Cancelar</button><button className="catalog-save" disabled={saving || !managementName.trim() || !managementUnitCode}>{saving ? <LoaderCircle className="spin" size={14}/> : <Check size={14}/>} Guardar</button></div>
              </form>
            )}

            <div className="catalog-list">
              {managements.length === 0 ? <div className="catalog-empty">Aún no hay gerencias configuradas.</div> : managements.map(item => (
                <div className="catalog-row" key={item.id}>
                  <span className="catalog-row-icon"><Building2 size={17}/></span>
                  <div><strong>{item.name}</strong><small><span className="catalog-unit-badge">{item.unit_code}</span> {unitLabel(item.unit_code)}</small></div>
                  <span className={`catalog-status ${item.active ? 'active' : 'inactive'}`}>{item.active ? 'Activo' : 'Inactivo'}</span>
                  {canManage && <button className="catalog-edit" onClick={() => editManagement(item)} aria-label={`Editar ${item.name}`}><Pencil size={14}/></button>}
                </div>
              ))}
            </div>
          </section>

          <section className="catalog-panel">
            <div className="catalog-panel-head">
              <div><span><UserRound size={17}/></span><div><h3>Gerentes / Responsables</h3><p>{managers.length} registrados · unidad, cargo y gerencias</p></div></div>
              {canManage && <button className="catalog-add" onClick={openNewManager}><Plus size={15}/> Nuevo responsable</button>}
            </div>

            {managerFormOpen && (
              <form className="catalog-form catalog-form--manager" onSubmit={saveManager}>
                <div className="catalog-form-grid">
                  <label>Nombre<input autoFocus value={managerName} onChange={event => setManagerName(event.target.value)} placeholder="Nombre y apellido" /></label>
                  <label>Correo<input type="email" value={managerEmail} onChange={event => setManagerEmail(event.target.value)} placeholder="correo@empresa.com" /></label>
                  <label>Cargo<input value={managerCargo} onChange={event => setManagerCargo(event.target.value)} placeholder="Ej. Gerente de TI" /></label>
                  <label>Unidad<select value={managerUnitCode} onChange={event => changeManagerUnit(event.target.value)}>{unitOptions.map(unit => <option key={unit.code} value={unit.code}>{unit.code} · {unit.name}</option>)}</select></label>
                </div>
                <fieldset>
                  <legend>Gerencia(s) relacionadas · {unitLabel(managerUnitCode)}</legend>
                  <div className="catalog-check-grid">
                    {managerManagementOptions.length === 0 ? <div className="catalog-check-empty">No hay gerencias registradas en esta unidad.</div> : managerManagementOptions.map(item => (
                      <label key={item.id} className={managerManagementIds.includes(item.id) ? 'selected' : ''}>
                        <input type="checkbox" checked={managerManagementIds.includes(item.id)} onChange={() => toggleManagerManagement(item.id)} />
                        <span>{item.name}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <label className="catalog-toggle"><input type="checkbox" checked={managerActive} onChange={event => setManagerActive(event.target.checked)} /><span>Activo</span></label>
                <div><button type="button" className="catalog-cancel" onClick={resetManagerForm}><X size={14}/> Cancelar</button><button className="catalog-save" disabled={saving || !managerName.trim() || !managerUnitCode || managerManagementIds.length === 0}>{saving ? <LoaderCircle className="spin" size={14}/> : <Check size={14}/>} Guardar</button></div>
              </form>
            )}

            <div className="catalog-list">
              {managers.length === 0 ? <div className="catalog-empty">Aún no hay responsables registrados.</div> : managers.map(item => {
                const relatedNames = links
                  .filter(link => link.manager_id === item.id)
                  .map(link => managementById.get(link.management_id)?.name)
                  .filter((name): name is string => Boolean(name))
                return (
                  <div className="catalog-row catalog-row--manager" key={item.id}>
                    <span className="catalog-row-icon"><UserRound size={17}/></span>
                    <div>
                      <strong>{item.name}</strong>
                      <small><span className="catalog-unit-badge">{item.unit_code}</span> {unitLabel(item.unit_code)} · {relatedNames.join(' · ') || 'Sin gerencia'}</small>
                      {item.cargo ? <small className="catalog-detail-line"><Briefcase size={11}/> <b>Cargo:</b> {item.cargo}</small> : <small className="catalog-detail-line"><Briefcase size={11}/> <b>Cargo:</b> Sin registrar</small>}
                      {item.email ? <small className="catalog-detail-line"><Mail size={11}/> {item.email}</small> : null}
                    </div>
                    <span className={`catalog-status ${item.active ? 'active' : 'inactive'}`}>{item.active ? 'Activo' : 'Inactivo'}</span>
                    {canManage && <button className="catalog-edit" onClick={() => editManager(item)} aria-label={`Editar ${item.name}`}><Pencil size={14}/></button>}
                  </div>
                )
              })}
            </div>
          </section>
        </div>
      )}

      {resetOpen && (
        <div className="cg-modal-backdrop" role="presentation" onMouseDown={event => { if (event.currentTarget === event.target && !resetting) setResetOpen(false) }}>
          <div className="cg-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="reset-catalog-title">
            <button className="cg-modal-close" type="button" onClick={() => setResetOpen(false)} disabled={resetting} aria-label="Cerrar"><X size={18}/></button>
            <div className="cg-confirm-icon"><Trash2 size={23}/></div>
            <h3 id="reset-catalog-title">¿Borrar todo el catálogo?</h3>
            <p>Se eliminarán todas las gerencias, responsables y sus relaciones. Los lineamientos no se borrarán, pero sus campos de Gerencia Responsable y Gerente Responsable quedarán vacíos. Esta acción no se puede deshacer.</p>
            <div className="cg-modal-actions">
              <button type="button" className="cg-modal-secondary" onClick={() => setResetOpen(false)} disabled={resetting}>Cancelar</button>
              <button type="button" className="cg-modal-primary" onClick={() => void resetAllCatalog()} disabled={resetting}>{resetting && <LoaderCircle className="spin" size={16}/>} Sí, borrar todo</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
