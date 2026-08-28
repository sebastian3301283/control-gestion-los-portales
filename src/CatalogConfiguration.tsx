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

function recordsFromDetectedHeader(XLSX: any, sheet: any, kind: 'directory' | 'areas') {
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false }) as unknown[][]
  const nameAliases = kind === 'directory'
    ? new Set(['nombre', 'responsable', 'gerente', 'gerenteresponsable'])
    : new Set(['area', 'areas', 'gerencia', 'gerencias'])
  const areaAliases = new Set(['area', 'areas', 'gerencia', 'gerencias'])
  const unitAliases = new Set(['un', 'unidad', 'unidadnegocio', 'unidaddenegocio'])

  const headerIndex = matrix.findIndex(row => {
    const headers = row.map(normalizeHeader)
    const hasName = headers.some(header => nameAliases.has(header))
    const hasUnit = headers.some(header => unitAliases.has(header))
    if (kind === 'areas') return hasName && hasUnit
    const hasArea = headers.some(header => areaAliases.has(header))
    return hasName && hasUnit && hasArea
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
  const selectedUnit = unitOptions.find(unit => unit.code === selectedUnitCode) || unitOptions[0]
  const selectedManagements = useMemo(
    () => managements.filter(item => item.unit_code === selectedUnitCode),
    [managements, selectedUnitCode],
  )
  const selectedManagers = useMemo(
    () => managers.filter(item => item.unit_code === selectedUnitCode),
    [managers, selectedUnitCode],
  )
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

  function chooseUnit(code: string) {
    setSelectedUnitCode(code)
    setManagementFormOpen(false)
    setManagerFormOpen(false)
    setError('')
    setNotice('')
  }

  function resetManagementForm(unitCode = selectedUnitCode) {
    setManagementFormOpen(false)
    setEditingManagementId(null)
    setManagementName('')
    setManagementUnitCode(unitCode)
    setManagementActive(true)
  }

  function resetManagerForm(unitCode = selectedUnitCode) {
    setManagerFormOpen(false)
    setEditingManagerId(null)
    setManagerName('')
    setManagerEmail('')
    setManagerCargo('')
    setManagerUnitCode(unitCode)
    setManagerActive(true)
    setManagerManagementIds([])
  }

  function openNewManagement() {
    resetManagementForm(selectedUnitCode)
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
    setManagerFormOpen(false)
    setNotice('')
    setError('')
  }

  async function saveManagement(event: FormEvent) {
    event.preventDefault()
    if (!supabase || !canManage) return
    const name = managementName.trim().replace(/\s+/g, ' ')
    if (!name) { setError('Escribe el nombre del área o gerencia.'); return }
    if (!managementUnitCode) { setError('Selecciona la unidad de negocio de esta área.'); return }

    setSaving(true)
    setError('')
    setNotice('')

    const duplicate = managements.find(item => item.unit_code === managementUnitCode && normalize(item.name) === normalize(name) && item.id !== editingManagementId)
    if (duplicate) {
      setSaving(false)
      setError(`El área “${duplicate.name}” ya existe en ${unitLabel(managementUnitCode)}.`)
      return
    }

    const result = editingManagementId
      ? await supabase.from('managements_global').update({ name, unit_code: managementUnitCode, active: managementActive }).eq('id', editingManagementId)
      : await supabase.from('managements_global').insert({ name, unit_code: managementUnitCode, active: managementActive })

    setSaving(false)
    if (result.error) {
      setError(result.error.message.includes('UNIT_VALIDATION') ? result.error.message : 'No pudimos guardar el área. Verifica el nombre y la unidad.')
      return
    }

    const savedUnit = managementUnitCode
    resetManagementForm(savedUnit)
    setSelectedUnitCode(savedUnit)
    setNotice(`Área guardada correctamente en ${unitLabel(savedUnit)}.`)
    await loadCatalogs()
  }

  function openNewManager() {
    resetManagerForm(selectedUnitCode)
    setManagerFormOpen(true)
    setManagementFormOpen(false)
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
    setManagementFormOpen(false)
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

    if (!name) { setError('Escribe el nombre del responsable.'); return }
    if (!managerUnitCode) { setError('Selecciona la unidad del responsable.'); return }
    if (managerManagementIds.length === 0) { setError('Selecciona al menos un área para este responsable.'); return }
    if (managerManagementIds.some(id => managementById.get(id)?.unit_code !== managerUnitCode)) {
      setError('Las áreas relacionadas deben pertenecer a la misma unidad del responsable.')
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
      setError(linkError.message.includes('UNIT_VALIDATION') ? linkError.message : 'El responsable fue guardado, pero no pudimos asociarlo a sus áreas.')
      return
    }

    const savedUnit = managerUnitCode
    resetManagerForm(savedUnit)
    setSelectedUnitCode(savedUnit)
    setNotice('Responsable, cargo, unidad y área guardados correctamente.')
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
    setNotice(`Catálogo reiniciado. Se eliminaron ${result?.managements_deleted ?? 0} áreas y ${result?.managers_deleted ?? 0} responsables.`)
    await loadCatalogs()
  }

  async function downloadTemplate() {
    try {
      const XLSX = await import(/* @vite-ignore */ XLSX_MODULE_URL)
      const directoryRows = managers.length ? managers.map((manager, index) => ({
        'Cant.': index + 1,
        UN: unitLabel(manager.unit_code),
        Nombre: manager.name,
        Cargo: manager.cargo || '',
        Área: links
          .filter(link => link.manager_id === manager.id)
          .map(link => managementById.get(link.management_id)?.name)
          .filter(Boolean)
          .join(' / '),
        Correo: manager.email || '',
        Estado: manager.active ? 'Activo' : 'Inactivo',
      })) : [{ 'Cant.': 1, UN: 'Departamentos', Nombre: 'NOMBRE APELLIDO', Cargo: 'GERENTE DE PROYECTOS', Área: 'Operaciones', Correo: '', Estado: 'Activo' }]

      const directory = XLSX.utils.json_to_sheet(directoryRows)
      directory['!cols'] = [{ wch: 8 }, { wch: 22 }, { wch: 36 }, { wch: 38 }, { wch: 28 }, { wch: 34 }, { wch: 14 }]

      const areaRows = managements.length ? managements.map(item => ({
        UN: unitLabel(item.unit_code),
        Área: item.name,
        Estado: item.active ? 'Activo' : 'Inactivo',
      })) : [{ UN: 'Departamentos', Área: 'Operaciones', Estado: 'Activo' }]
      const areas = XLSX.utils.json_to_sheet(areaRows)
      areas['!cols'] = [{ wch: 22 }, { wch: 30 }, { wch: 14 }]

      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, directory, 'Directorio')
      XLSX.utils.book_append_sheet(workbook, areas, 'Areas')
      XLSX.writeFile(workbook, 'Plantilla_Directorio_Responsables.xlsx')
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
      const directoryRowsRaw: Record<string, unknown>[] = []
      const areaRowsRaw: Record<string, unknown>[] = []

      workbook.SheetNames.forEach(sheetName => {
        const sheet = workbook.Sheets[sheetName]
        const directoryRows = recordsFromDetectedHeader(XLSX, sheet, 'directory')
        if (directoryRows.length) {
          directoryRowsRaw.push(...directoryRows)
          return
        }
        const areaRows = recordsFromDetectedHeader(XLSX, sheet, 'areas')
        if (areaRows.length) areaRowsRaw.push(...areaRows)
      })

      if (!directoryRowsRaw.length && !areaRowsRaw.length) throw new Error('FORMAT_NOT_FOUND')

      const parsedAreas = areaRowsRaw.map((row, index) => ({
        row: index + 2,
        name: valueFromRow(row, ['Área', 'Area', 'Gerencia', 'Gerencias', 'Nombre']),
        unit_code: resolveUnitCode(valueFromRow(row, ['UN', 'Unidad', 'Unidad de negocio', 'Unidad Negocio'])),
        active: parseActive(valueFromRow(row, ['Estado', 'Estatus', 'Activo']) || 'Activo'),
      })).filter(item => item.name)

      const parsedManagers = directoryRowsRaw.map((row, index) => ({
        row: index + 2,
        name: valueFromRow(row, ['Nombre', 'Responsable', 'Gerente']),
        email: valueFromRow(row, ['Correo', 'Email', 'Correo electrónico', 'Correo electronico']).toLowerCase(),
        cargo: valueFromRow(row, ['Cargo', 'Puesto']),
        unit_code: resolveUnitCode(valueFromRow(row, ['UN', 'Unidad', 'Unidad de negocio', 'Unidad Negocio'])),
        managementNames: splitValues(valueFromRow(row, ['Área', 'Area', 'Áreas', 'Areas', 'Gerencia', 'Gerencias'])),
        active: parseActive(valueFromRow(row, ['Estado', 'Estatus', 'Activo']) || 'Activo'),
      })).filter(item => item.name)

      if (!parsedAreas.length && !parsedManagers.length) throw new Error('NO_ROWS')

      const validationErrors: string[] = []
      parsedAreas.forEach(item => {
        if (!item.unit_code) validationErrors.push(`Áreas, fila ${item.row}: la UN no es válida.`)
      })
      parsedManagers.forEach(item => {
        if (!item.unit_code) validationErrors.push(`Directorio, fila ${item.row}: la UN no es válida.`)
        if (!item.managementNames.length) validationErrors.push(`Directorio, fila ${item.row}: falta el Área.`)
      })

      if (validationErrors.length) {
        setError(`Excel no importado. Corrige primero: ${validationErrors.slice(0, 8).join(' · ')}${validationErrors.length > 8 ? ` · y ${validationErrors.length - 8} error(es) más.` : ''}`)
        return
      }

      const workingManagements = [...managements]
      const allAreaRows = [
        ...parsedAreas,
        ...parsedManagers.flatMap(item => item.managementNames.map(name => ({ row: item.row, name, unit_code: item.unit_code, active: true }))),
      ]

      let managementCount = 0
      for (const row of allAreaRows) {
        if (!row.unit_code || !row.name) continue
        const existing = workingManagements.find(item => item.unit_code === row.unit_code && normalize(item.name) === normalize(row.name))
        if (existing) {
          if (!existing.active && row.active) {
            const { error: updateError } = await supabase.from('managements_global').update({ active: true }).eq('id', existing.id)
            if (updateError) throw updateError
            existing.active = true
          }
        } else {
          const { data, error: insertError } = await supabase.from('managements_global').insert({ name: row.name, unit_code: row.unit_code, active: row.active }).select('id, name, unit_code, active').single()
          if (insertError || !data) throw insertError || new Error('AREA_INSERT')
          workingManagements.push(data as Management)
          managementCount += 1
        }
      }

      const workingManagers = [...managers]
      let managerCount = 0
      for (const row of parsedManagers) {
        const existing = workingManagers.find(item => item.unit_code === row.unit_code && normalize(item.name) === normalize(row.name))
        let managerId = existing?.id || ''
        if (existing) {
          const { error: updateError } = await supabase.from('managers').update({ name: row.name, email: row.email || existing.email, cargo: row.cargo || existing.cargo, active: row.active }).eq('id', existing.id)
          if (updateError) throw updateError
          existing.name = row.name
          existing.email = row.email || existing.email
          existing.cargo = row.cargo || existing.cargo
          existing.active = row.active
        } else {
          const { data, error: insertError } = await supabase.from('managers').insert({ name: row.name, email: row.email || null, cargo: row.cargo || null, unit_code: row.unit_code, active: row.active }).select('id, name, email, cargo, unit_code, active').single()
          if (insertError || !data) throw insertError || new Error('RESPONSIBLE_INSERT')
          const inserted = data as Manager
          workingManagers.push(inserted)
          managerId = inserted.id
        }

        const managementIds = row.managementNames
          .map(name => workingManagements.find(item => item.unit_code === row.unit_code && normalize(item.name) === normalize(name))?.id)
          .filter((id): id is string => Boolean(id))

        const { error: deleteError } = await supabase.from('manager_managements').delete().eq('manager_id', managerId)
        if (deleteError) throw deleteError
        if (managementIds.length) {
          const { error: linkError } = await supabase.from('manager_managements').insert(managementIds.map(managementId => ({ manager_id: managerId, management_id: managementId })))
          if (linkError) throw linkError
        }
        managerCount += 1
      }

      await loadCatalogs()
      if (parsedManagers[0]?.unit_code) setSelectedUnitCode(parsedManagers[0].unit_code)
      setNotice(`Excel importado correctamente: ${managerCount} responsable${managerCount === 1 ? '' : 's'} procesado${managerCount === 1 ? '' : 's'} y ${managementCount} área${managementCount === 1 ? '' : 's'} nueva${managementCount === 1 ? '' : 's'}.`)
    } catch (importError) {
      const message = importError instanceof Error ? importError.message : ''
      if (message === 'FORMAT_NOT_FOUND') setError('No encontramos una tabla con columnas UN, Nombre, Cargo y Área. Puedes importar directamente un Excel como el de tu ejemplo.')
      else if (message === 'NO_ROWS') setError('El Excel no contiene responsables ni áreas para importar.')
      else setError(`No pudimos importar el Excel${message ? `: ${message}` : '.'}`)
    } finally {
      setImporting(false)
    }
  }

  const catalogHasData = managements.length > 0 || managers.length > 0
  const rootUnitClass = `catalog-config--${selectedUnitCode.toLowerCase()}`

  return (
    <div className={`catalog-config ${rootUnitClass}`}>
      <section className="catalog-hero catalog-hero--directory">
        <div>
          <span className="catalog-kicker">Directorio maestro</span>
          <h2>Responsables por unidad</h2>
          <p>Esta vista funciona como tu Excel: UN identifica la unidad, Nombre es el responsable, Cargo indica su puesto y Área alimenta la Gerencia Responsable de los lineamientos.</p>
        </div>
        <div className="guideline-actions catalog-hero-actions">
          <button className="catalog-template-button" type="button" onClick={() => void downloadTemplate()}><Download size={16}/> Descargar plantilla</button>
          {canManage && <label className={`catalog-template-button catalog-file-button ${importing ? 'disabled' : ''}`}><Upload size={16}/>{importing ? 'Importando...' : 'Importar Excel'}<input type="file" accept=".xlsx,.xls" onChange={importCatalogFromExcel} disabled={importing} /></label>}
          {canManage && catalogHasData && <button className="catalog-template-button" type="button" onClick={() => setResetOpen(true)}><Trash2 size={16}/> Borrar todo</button>}
        </div>
      </section>

      <div className="catalog-unit-selector" role="tablist" aria-label="Unidades de negocio">
        {unitOptions.map(unit => (
          <button key={unit.code} type="button" className={selectedUnitCode === unit.code ? 'active' : ''} onClick={() => chooseUnit(unit.code)}>
            <span>{unit.code}</span><small>{unit.name}</small>
          </button>
        ))}
      </div>

      {error && <div className="catalog-message catalog-message--error">{error}</div>}
      {notice && <div className="catalog-message catalog-message--success"><Check size={15}/>{notice}</div>}

      {loading ? (
        <div className="catalog-loading"><LoaderCircle className="spin" size={24}/> Cargando directorio...</div>
      ) : (
        <>
          <section className="catalog-area-strip">
            <div className="catalog-area-strip__title">
              <div><span><Building2 size={17}/></span><div><strong>Áreas de {selectedUnit?.name || selectedUnitCode}</strong><small>{selectedManagements.length} registrada{selectedManagements.length === 1 ? '' : 's'}</small></div></div>
              {canManage && <button className="catalog-add" onClick={openNewManagement}><Plus size={15}/> Nueva área</button>}
            </div>
            <div className="catalog-area-chips">
              {selectedManagements.length === 0 ? <span className="catalog-empty-inline">Aún no hay áreas en esta unidad.</span> : selectedManagements.map(item => (
                <button key={item.id} type="button" className={!item.active ? 'inactive' : ''} onClick={() => canManage && editManagement(item)}>
                  <span>{item.name}</span>{canManage && <Pencil size={12}/>} {!item.active && <small>Inactiva</small>}
                </button>
              ))}
            </div>
          </section>

          {managementFormOpen && (
            <form className="catalog-form catalog-inline-editor" onSubmit={saveManagement}>
              <div className="catalog-form-heading"><div><Building2 size={18}/><span>{editingManagementId ? 'Editar área' : 'Nueva área'}</span></div><button type="button" onClick={() => resetManagementForm()}><X size={16}/></button></div>
              <div className="catalog-form-grid">
                <label>Área / Gerencia<input autoFocus value={managementName} onChange={event => setManagementName(event.target.value)} placeholder="Ej. Operaciones" /></label>
                <label>UN<select value={managementUnitCode} onChange={event => setManagementUnitCode(event.target.value)}>{unitOptions.map(unit => <option key={unit.code} value={unit.code}>{unit.name}</option>)}</select></label>
              </div>
              <label className="catalog-toggle"><input type="checkbox" checked={managementActive} onChange={event => setManagementActive(event.target.checked)} /><span>Activo</span></label>
              <div><button type="button" className="catalog-cancel" onClick={() => resetManagementForm()}><X size={14}/> Cancelar</button><button className="catalog-save" disabled={saving || !managementName.trim()}>{saving ? <LoaderCircle className="spin" size={14}/> : <Check size={14}/>} Guardar área</button></div>
            </form>
          )}

          {managerFormOpen && (
            <form className="catalog-form catalog-inline-editor catalog-form--manager" onSubmit={saveManager}>
              <div className="catalog-form-heading"><div><UserRound size={18}/><span>{editingManagerId ? 'Editar responsable' : 'Nuevo responsable'}</span></div><button type="button" onClick={() => resetManagerForm()}><X size={16}/></button></div>
              <div className="catalog-form-grid catalog-form-grid--four">
                <label>Nombre<input autoFocus value={managerName} onChange={event => setManagerName(event.target.value)} placeholder="Nombre y apellido" /></label>
                <label>Cargo<input value={managerCargo} onChange={event => setManagerCargo(event.target.value)} placeholder="Ej. Gerente Comercial" /></label>
                <label>Correo<input type="email" value={managerEmail} onChange={event => setManagerEmail(event.target.value)} placeholder="correo@empresa.com" /></label>
                <label>UN<select value={managerUnitCode} onChange={event => changeManagerUnit(event.target.value)}>{unitOptions.map(unit => <option key={unit.code} value={unit.code}>{unit.name}</option>)}</select></label>
              </div>
              <fieldset>
                <legend>Área(s) relacionadas · {unitLabel(managerUnitCode)}</legend>
                <div className="catalog-check-grid">
                  {managerManagementOptions.length === 0 ? <div className="catalog-check-empty">Primero crea un área para esta unidad.</div> : managerManagementOptions.map(item => (
                    <label key={item.id} className={managerManagementIds.includes(item.id) ? 'selected' : ''}>
                      <input type="checkbox" checked={managerManagementIds.includes(item.id)} onChange={() => toggleManagerManagement(item.id)} />
                      <span>{item.name}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <label className="catalog-toggle"><input type="checkbox" checked={managerActive} onChange={event => setManagerActive(event.target.checked)} /><span>Activo</span></label>
              <div><button type="button" className="catalog-cancel" onClick={() => resetManagerForm()}><X size={14}/> Cancelar</button><button className="catalog-save" disabled={saving || !managerName.trim() || managerManagementIds.length === 0}>{saving ? <LoaderCircle className="spin" size={14}/> : <Check size={14}/>} Guardar responsable</button></div>
            </form>
          )}

          <section className="catalog-directory-card">
            <div className="catalog-directory-head">
              <div><span className="catalog-directory-kicker">Directorio</span><h3>{selectedUnit?.name || selectedUnitCode}</h3><p>{selectedManagers.length} responsable{selectedManagers.length === 1 ? '' : 's'} registrado{selectedManagers.length === 1 ? '' : 's'}</p></div>
              {canManage && <button className="catalog-add" onClick={openNewManager}><Plus size={15}/> Nuevo responsable</button>}
            </div>

            <div className="catalog-directory-scroll">
              <table className="catalog-directory-table">
                <thead><tr><th>Cant.</th><th>UN</th><th>Nombre</th><th>Cargo</th><th>Área</th><th>Correo</th><th>Estado</th>{canManage && <th>Acciones</th>}</tr></thead>
                <tbody>
                  {selectedManagers.length === 0 ? (
                    <tr><td colSpan={canManage ? 8 : 7} className="catalog-directory-empty">Aún no hay responsables registrados en {selectedUnit?.name || selectedUnitCode}. Puedes agregarlos manualmente o importar el Excel.</td></tr>
                  ) : selectedManagers.map((item, index) => {
                    const relatedNames = links
                      .filter(link => link.manager_id === item.id)
                      .map(link => managementById.get(link.management_id)?.name)
                      .filter((name): name is string => Boolean(name))
                    return (
                      <tr key={item.id}>
                        <td className="catalog-directory-number">{index + 1}</td>
                        <td><span className="catalog-unit-badge">{item.unit_code}</span></td>
                        <td className="catalog-directory-name"><strong>{item.name}</strong></td>
                        <td>{item.cargo || 'Sin registrar'}</td>
                        <td>{relatedNames.length ? relatedNames.join(' / ') : 'Sin área'}</td>
                        <td>{item.email || '—'}</td>
                        <td><span className={`catalog-status ${item.active ? 'active' : 'inactive'}`}>{item.active ? 'Activo' : 'Inactivo'}</span></td>
                        {canManage && <td><button className="catalog-edit" type="button" onClick={() => editManager(item)}><Pencil size={14}/><span>Editar</span></button></td>}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {resetOpen && (
        <div className="cg-modal-backdrop" role="presentation" onMouseDown={event => { if (event.currentTarget === event.target && !resetting) setResetOpen(false) }}>
          <div className="cg-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="reset-catalog-title">
            <button className="cg-modal-close" type="button" onClick={() => setResetOpen(false)} disabled={resetting} aria-label="Cerrar"><X size={18}/></button>
            <div className="cg-confirm-icon"><Trash2 size={23}/></div>
            <h3 id="reset-catalog-title">¿Borrar todo el directorio?</h3>
            <p>Se eliminarán todas las áreas, responsables y sus relaciones. Los lineamientos no se borrarán, pero sus campos de Gerencia Responsable y Gerente Responsable quedarán vacíos. Esta acción no se puede deshacer.</p>
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
