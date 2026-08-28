import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Building2, Check, Download, LoaderCircle, Mail, Pencil, Plus, UserRound, Users, X } from 'lucide-react'
import { supabase } from './lib/supabase'
import './catalog-configuration.css'

type UnitCode = 'HU' | 'DEP' | 'VS' | 'HOT' | 'CENTRAL'

type Unit = {
  code: UnitCode
  name: string
}

type Management = {
  id: string
  unit_code: UnitCode
  name: string
  active: boolean
}

type Manager = {
  id: string
  name: string
  email: string | null
  active: boolean
}

type ManagerManagement = {
  manager_id: string
  management_id: string
}

type Props = {
  units: Unit[]
  canManage: boolean
}

const XLSX_MODULE_URL = 'https://unpkg.com/xlsx@0.18.5/xlsx.mjs'

function normalize(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('es')
}

function unitLabel(code: UnitCode) {
  if (code === 'HU') return 'Habilitación Urbana'
  if (code === 'DEP') return 'Departamentos'
  if (code === 'VS') return 'Vivienda Social'
  if (code === 'HOT') return 'Hoteles'
  return 'Central'
}

export default function CatalogConfiguration({ units, canManage }: Props) {
  const availableUnits = useMemo(() => units.length ? units : [
    { code: 'CENTRAL' as UnitCode, name: 'Central' },
    { code: 'HU' as UnitCode, name: 'Habilitación Urbana' },
    { code: 'DEP' as UnitCode, name: 'Departamentos' },
    { code: 'VS' as UnitCode, name: 'Vivienda Social' },
    { code: 'HOT' as UnitCode, name: 'Hoteles' },
  ], [units])

  const [selectedUnit, setSelectedUnit] = useState<UnitCode>(availableUnits[0]?.code || 'CENTRAL')
  const [managements, setManagements] = useState<Management[]>([])
  const [managers, setManagers] = useState<Manager[]>([])
  const [links, setLinks] = useState<ManagerManagement[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  const [managementFormOpen, setManagementFormOpen] = useState(false)
  const [editingManagementId, setEditingManagementId] = useState<string | null>(null)
  const [managementName, setManagementName] = useState('')
  const [managementActive, setManagementActive] = useState(true)

  const [managerFormOpen, setManagerFormOpen] = useState(false)
  const [editingManagerId, setEditingManagerId] = useState<string | null>(null)
  const [managerName, setManagerName] = useState('')
  const [managerEmail, setManagerEmail] = useState('')
  const [managerActive, setManagerActive] = useState(true)
  const [managerManagementIds, setManagerManagementIds] = useState<string[]>([])

  const unitManagementIds = useMemo(() => new Set(managements.map(item => item.id)), [managements])
  const visibleManagers = useMemo(() => {
    const ids = new Set(links.filter(link => unitManagementIds.has(link.management_id)).map(link => link.manager_id))
    return managers.filter(manager => ids.has(manager.id))
  }, [links, managers, unitManagementIds])

  const managementById = useMemo(() => new Map(managements.map(item => [item.id, item.name])), [managements])

  useEffect(() => {
    void loadCatalogs()
  }, [selectedUnit])

  async function loadCatalogs() {
    if (!supabase) return
    setLoading(true)
    setError('')
    const [managementResult, managerResult, linkResult] = await Promise.all([
      supabase.from('managements').select('id, unit_code, name, active').eq('unit_code', selectedUnit).order('name'),
      supabase.from('managers').select('id, name, email, active').order('name'),
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

  function resetManagementForm() {
    setManagementFormOpen(false)
    setEditingManagementId(null)
    setManagementName('')
    setManagementActive(true)
  }

  function resetManagerForm() {
    setManagerFormOpen(false)
    setEditingManagerId(null)
    setManagerName('')
    setManagerEmail('')
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

    setSaving(true)
    setError('')
    setNotice('')
    const duplicate = managements.find(item => normalize(item.name) === normalize(name) && item.id !== editingManagementId)

    if (duplicate) {
      const { error: updateError } = await supabase.from('managements').update({ name, active: managementActive }).eq('id', duplicate.id)
      setSaving(false)
      if (updateError) {
        setError('No pudimos actualizar la gerencia existente.')
        return
      }
      resetManagementForm()
      setNotice(`${name} ya existía y fue actualizado.`)
      await loadCatalogs()
      return
    }

    const result = editingManagementId
      ? await supabase.from('managements').update({ name, active: managementActive }).eq('id', editingManagementId)
      : await supabase.from('managements').insert({ unit_code: selectedUnit, name, active: managementActive })

    setSaving(false)
    if (result.error) {
      setError('No pudimos guardar la gerencia. Verifica que el nombre no esté duplicado.')
      return
    }
    resetManagementForm()
    setNotice('Gerencia guardada correctamente.')
    await loadCatalogs()
  }

  function openNewManager() {
    resetManagerForm()
    setManagerFormOpen(true)
    setNotice('')
    setError('')
  }

  function editManager(item: Manager) {
    const selectedLinks = links
      .filter(link => link.manager_id === item.id && unitManagementIds.has(link.management_id))
      .map(link => link.management_id)
    setEditingManagerId(item.id)
    setManagerName(item.name)
    setManagerEmail(item.email || '')
    setManagerActive(item.active)
    setManagerManagementIds(selectedLinks)
    setManagerFormOpen(true)
    setNotice('')
    setError('')
  }

  function toggleManagerManagement(id: string) {
    setManagerManagementIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id])
  }

  async function saveManager(event: FormEvent) {
    event.preventDefault()
    if (!supabase || !canManage) return
    const name = managerName.trim().replace(/\s+/g, ' ')
    const email = managerEmail.trim().toLowerCase()
    if (!name) {
      setError('Escribe el nombre del responsable.')
      return
    }
    if (managerManagementIds.length === 0) {
      setError('Selecciona al menos una gerencia para este responsable.')
      return
    }

    setSaving(true)
    setError('')
    setNotice('')

    let managerId = editingManagerId
    if (managerId) {
      const { error: updateError } = await supabase.from('managers').update({ name, email: email || null, active: managerActive }).eq('id', managerId)
      if (updateError) {
        setSaving(false)
        setError('No pudimos actualizar el responsable.')
        return
      }
    } else {
      const existing = managers.find(item => normalize(item.name) === normalize(name))
      if (existing) {
        managerId = existing.id
        const { error: updateError } = await supabase.from('managers').update({ email: email || existing.email, active: managerActive }).eq('id', managerId)
        if (updateError) {
          setSaving(false)
          setError('No pudimos vincular el responsable existente.')
          return
        }
      } else {
        const { data, error: insertError } = await supabase.from('managers').insert({ name, email: email || null, active: managerActive }).select('id').single()
        if (insertError || !data) {
          setSaving(false)
          setError('No pudimos crear el responsable.')
          return
        }
        managerId = data.id as string
      }
    }

    const currentUnitIds = managements.map(item => item.id)
    if (currentUnitIds.length) {
      const { error: deleteError } = await supabase.from('manager_managements').delete().eq('manager_id', managerId).in('management_id', currentUnitIds)
      if (deleteError) {
        setSaving(false)
        setError('No pudimos actualizar las relaciones del responsable.')
        return
      }
    }

    const { error: linkError } = await supabase.from('manager_managements').insert(
      managerManagementIds.map(managementId => ({ manager_id: managerId, management_id: managementId })),
    )
    setSaving(false)
    if (linkError) {
      setError('El responsable fue guardado, pero no pudimos asociarlo a las gerencias.')
      return
    }

    resetManagerForm()
    setNotice('Responsable y relaciones guardados correctamente.')
    await loadCatalogs()
  }

  async function downloadTemplate() {
    try {
      const XLSX = await import(/* @vite-ignore */ XLSX_MODULE_URL)
      const lineamientos = XLSX.utils.aoa_to_sheet([
        ['N°', 'Lineamientos Estratégicos', 'Gerencia Responsable', 'Gerente Responsable', 'Estatus'],
        [1, 'Ejemplo de lineamiento', managements.find(item => item.active)?.name || '', visibleManagers.find(item => item.active)?.name || '', 'pendiente'],
      ])
      lineamientos['!cols'] = [{ wch: 6 }, { wch: 65 }, { wch: 30 }, { wch: 30 }, { wch: 16 }]

      const gerencias = XLSX.utils.json_to_sheet(managements.map(item => ({
        Unidad: unitLabel(selectedUnit),
        Gerencia: item.name,
        Estado: item.active ? 'Activo' : 'Inactivo',
      })))

      const responsables = XLSX.utils.json_to_sheet(visibleManagers.map(manager => ({
        Responsable: manager.name,
        Correo: manager.email || '',
        Gerencias: links
          .filter(link => link.manager_id === manager.id && unitManagementIds.has(link.management_id))
          .map(link => managementById.get(link.management_id))
          .filter(Boolean)
          .join(' / '),
        Estado: manager.active ? 'Activo' : 'Inactivo',
      })))

      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, lineamientos, 'Lineamientos')
      XLSX.utils.book_append_sheet(workbook, gerencias, 'Gerencias válidas')
      XLSX.utils.book_append_sheet(workbook, responsables, 'Responsables válidos')
      XLSX.writeFile(workbook, `Plantilla_Lineamientos_${selectedUnit}.xlsx`)
    } catch {
      setError('No pudimos generar la plantilla Excel.')
    }
  }

  return (
    <div className={`catalog-config catalog-config--${selectedUnit.toLowerCase()}`}>
      <section className="catalog-hero">
        <div>
          <span className="catalog-kicker">Catálogo maestro</span>
          <h2>Gerencias y responsables</h2>
          <p>Configura primero quién pertenece a cada gerencia. Estos datos serán los únicos permitidos en los lineamientos y en los Excel.</p>
        </div>
        <button className="catalog-template-button" type="button" onClick={() => void downloadTemplate()}><Download size={16}/> Descargar plantilla Excel</button>
      </section>

      <div className="catalog-unit-tabs" role="tablist" aria-label="Unidad de negocio">
        {availableUnits.map(unit => (
          <button key={unit.code} className={selectedUnit === unit.code ? 'active' : ''} onClick={() => { setSelectedUnit(unit.code); resetManagementForm(); resetManagerForm() }}>
            <Building2 size={15}/><span>{unit.code}</span><small>{unit.name}</small>
          </button>
        ))}
      </div>

      {error && <div className="catalog-message catalog-message--error">{error}</div>}
      {notice && <div className="catalog-message catalog-message--success"><Check size={15}/>{notice}</div>}

      {loading ? (
        <div className="catalog-loading"><LoaderCircle className="spin" size={24}/> Cargando configuración...</div>
      ) : (
        <div className="catalog-columns">
          <section className="catalog-panel">
            <div className="catalog-panel-head">
              <div><span><Users size={17}/></span><div><h3>Gerencias / Áreas</h3><p>{managements.length} registradas en {unitLabel(selectedUnit)}</p></div></div>
              {canManage && <button className="catalog-add" onClick={openNewManagement}><Plus size={15}/> Nueva gerencia</button>}
            </div>

            {managementFormOpen && (
              <form className="catalog-form" onSubmit={saveManagement}>
                <label>Nombre<input autoFocus value={managementName} onChange={event => setManagementName(event.target.value)} placeholder="Ej. Comercial" /></label>
                <label className="catalog-toggle"><input type="checkbox" checked={managementActive} onChange={event => setManagementActive(event.target.checked)} /><span>Activo</span></label>
                <div><button type="button" className="catalog-cancel" onClick={resetManagementForm}><X size={14}/> Cancelar</button><button className="catalog-save" disabled={saving || !managementName.trim()}>{saving ? <LoaderCircle className="spin" size={14}/> : <Check size={14}/>} Guardar</button></div>
              </form>
            )}

            <div className="catalog-list">
              {managements.length === 0 ? <div className="catalog-empty">Aún no hay gerencias configuradas.</div> : managements.map(item => (
                <div className="catalog-row" key={item.id}>
                  <span className="catalog-row-icon"><Building2 size={17}/></span>
                  <div><strong>{item.name}</strong><small>{item.active ? 'Activo' : 'Inactivo'}</small></div>
                  <span className={`catalog-status ${item.active ? 'active' : 'inactive'}`}>{item.active ? 'Activo' : 'Inactivo'}</span>
                  {canManage && <button className="catalog-edit" onClick={() => editManagement(item)} aria-label={`Editar ${item.name}`}><Pencil size={14}/></button>}
                </div>
              ))}
            </div>
          </section>

          <section className="catalog-panel">
            <div className="catalog-panel-head">
              <div><span><UserRound size={17}/></span><div><h3>Gerentes / Responsables</h3><p>{visibleManagers.length} vinculados a esta unidad</p></div></div>
              {canManage && <button className="catalog-add" onClick={openNewManager}><Plus size={15}/> Nuevo responsable</button>}
            </div>

            {managerFormOpen && (
              <form className="catalog-form catalog-form--manager" onSubmit={saveManager}>
                <div className="catalog-form-grid">
                  <label>Nombre<input autoFocus value={managerName} onChange={event => setManagerName(event.target.value)} placeholder="Nombre y apellido" /></label>
                  <label>Correo<input type="email" value={managerEmail} onChange={event => setManagerEmail(event.target.value)} placeholder="correo@empresa.com" /></label>
                </div>
                <fieldset>
                  <legend>Gerencia(s) relacionadas</legend>
                  <div className="catalog-check-grid">
                    {managements.filter(item => item.active || managerManagementIds.includes(item.id)).map(item => (
                      <label key={item.id} className={managerManagementIds.includes(item.id) ? 'selected' : ''}>
                        <input type="checkbox" checked={managerManagementIds.includes(item.id)} onChange={() => toggleManagerManagement(item.id)} />
                        <span>{item.name}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <label className="catalog-toggle"><input type="checkbox" checked={managerActive} onChange={event => setManagerActive(event.target.checked)} /><span>Activo</span></label>
                <div><button type="button" className="catalog-cancel" onClick={resetManagerForm}><X size={14}/> Cancelar</button><button className="catalog-save" disabled={saving || !managerName.trim() || managerManagementIds.length === 0}>{saving ? <LoaderCircle className="spin" size={14}/> : <Check size={14}/>} Guardar</button></div>
              </form>
            )}

            <div className="catalog-list">
              {visibleManagers.length === 0 ? <div className="catalog-empty">Aún no hay responsables relacionados con esta unidad.</div> : visibleManagers.map(item => {
                const relatedNames = links
                  .filter(link => link.manager_id === item.id && unitManagementIds.has(link.management_id))
                  .map(link => managementById.get(link.management_id))
                  .filter((name): name is string => Boolean(name))
                return (
                  <div className="catalog-row catalog-row--manager" key={item.id}>
                    <span className="catalog-row-icon"><UserRound size={17}/></span>
                    <div><strong>{item.name}</strong><small>{relatedNames.join(' · ') || 'Sin gerencia'}{item.email ? <><br/><Mail size={11}/> {item.email}</> : null}</small></div>
                    <span className={`catalog-status ${item.active ? 'active' : 'inactive'}`}>{item.active ? 'Activo' : 'Inactivo'}</span>
                    {canManage && <button className="catalog-edit" onClick={() => editManager(item)} aria-label={`Editar ${item.name}`}><Pencil size={14}/></button>}
                  </div>
                )
              })}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
