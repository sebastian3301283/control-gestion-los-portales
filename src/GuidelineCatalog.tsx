import { FormEvent, useEffect, useMemo, useState } from 'react'
import { BookOpenText, Check, ChevronDown, LoaderCircle, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { supabase } from './lib/supabase'
import './guideline-catalog.css'

type Unit = { code: string; name: string }
type Period = { id: string; year: number; name: string; status: 'DRAFT' | 'OPEN' | 'CLOSED' }
type Management = { id: string; name: string; unit_code: string; directory_group: string; active: boolean }
type Manager = { id: string; name: string; cargo: string | null; unit_code: string; directory_group: string; active: boolean }
type ManagerManagement = { manager_id: string; management_id: string }
type Guideline = {
  id: string
  period_id: string
  unit_code: string
  management_id: string
  code: string | null
  guideline_text: string
  responsible_manager_id: string | null
  active: boolean
  sort_order: number
}
type Props = { units?: Unit[]; canManage: boolean }

const fallbackUnits: Unit[] = [
  { code: 'CENTRAL', name: 'Central' },
  { code: 'HU', name: 'Habilitación Urbana' },
  { code: 'DEP', name: 'Departamentos' },
  { code: 'VS', name: 'Vivienda Social' },
  { code: 'HOT', name: 'Hoteles' },
]

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLowerCase()
}

function splitGuideline(value: string, explicitCode?: string | null) {
  const code = (explicitCode || '').trim()
  if (code) {
    const prefix = new RegExp(`^${code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:\\s*`, 'i')
    return { code, text: value.replace(prefix, '').trim() }
  }
  const match = value.match(/^\s*(L\d+)\s*:\s*(.*)$/i)
  return match ? { code: match[1].toUpperCase(), text: match[2].trim() } : { code: '', text: value.trim() }
}

function displayNumber(item: Guideline, index: number) {
  const parsed = splitGuideline(item.guideline_text, item.code)
  const match = parsed.code.match(/L(\d+)/i)
  return match ? Number(match[1]) : index + 1
}

export default function GuidelineCatalog({ units, canManage }: Props) {
  const unitOptions = units?.length ? units : fallbackUnits
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [periods, setPeriods] = useState<Period[]>([])
  const [managements, setManagements] = useState<Management[]>([])
  const [managers, setManagers] = useState<Manager[]>([])
  const [links, setLinks] = useState<ManagerManagement[]>([])
  const [guidelines, setGuidelines] = useState<Guideline[]>([])
  const [periodId, setPeriodId] = useState('')
  const [unitCode, setUnitCode] = useState(unitOptions.find(unit => unit.code === 'CENTRAL')?.code || unitOptions[0]?.code || 'CENTRAL')
  const [areaFilter, setAreaFilter] = useState('')
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formPeriodId, setFormPeriodId] = useState('')
  const [formUnitCode, setFormUnitCode] = useState('CENTRAL')
  const [formAreaId, setFormAreaId] = useState('')
  const [formCode, setFormCode] = useState('')
  const [formText, setFormText] = useState('')
  const [formResponsibleId, setFormResponsibleId] = useState('')
  const [formActive, setFormActive] = useState(true)

  const managerById = useMemo(() => new Map(managers.map(item => [item.id, item])), [managers])
  const managementById = useMemo(() => new Map(managements.map(item => [item.id, item])), [managements])
  const unitByCode = useMemo(() => new Map(unitOptions.map(item => [item.code, item.name])), [unitOptions])

  const uniqueAreas = useMemo(() => {
    const unique = new Map<string, Management>()
    managements.filter(item => item.active).forEach(item => {
      const key = normalize(item.name)
      const current = unique.get(key)
      if (!current || item.unit_code === 'CENTRAL') unique.set(key, item)
    })
    return [...unique.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'))
  }, [managements])

  const filteredGuidelines = useMemo(() => guidelines.filter(item => {
    if (periodId && item.period_id !== periodId) return false
    if (unitCode && item.unit_code !== unitCode) return false
    if (areaFilter) {
      const selectedName = managementById.get(areaFilter)?.name || ''
      const itemName = managementById.get(item.management_id)?.name || ''
      if (normalize(selectedName) !== normalize(itemName)) return false
    }
    if (search.trim() && !normalize(item.guideline_text).includes(normalize(search))) return false
    return true
  }).sort((a, b) => a.sort_order - b.sort_order || a.guideline_text.localeCompare(b.guideline_text, 'es')), [guidelines, periodId, unitCode, areaFilter, search, managementById])

  const responsibleOptions = useMemo(() => {
    if (!formAreaId) return managers.filter(item => item.active).sort((a, b) => a.name.localeCompare(b.name, 'es'))
    const areaName = managementById.get(formAreaId)?.name || ''
    const equivalentIds = new Set(managements.filter(item => item.active && normalize(item.name) === normalize(areaName)).map(item => item.id))
    const linkedManagerIds = new Set(links.filter(link => equivalentIds.has(link.management_id)).map(link => link.manager_id))
    return managers.filter(item => item.active && linkedManagerIds.has(item.id)).sort((a, b) => a.name.localeCompare(b.name, 'es'))
  }, [formAreaId, managements, managers, links, managementById])

  useEffect(() => { void loadAll() }, [])

  async function loadAll() {
    if (!supabase) return
    setLoading(true); setError('')
    const [periodResult, areaResult, managerResult, linkResult, guidelineResult] = await Promise.all([
      supabase.from('planning_periods').select('id,year,name,status').order('year'),
      supabase.from('managements_global').select('id,name,unit_code,directory_group,active').eq('active', true).order('name'),
      supabase.from('managers').select('id,name,cargo,unit_code,directory_group,active').eq('active', true).order('name'),
      supabase.from('manager_managements').select('manager_id,management_id'),
      supabase.from('planning_guidelines').select('id,period_id,unit_code,management_id,code,guideline_text,responsible_manager_id,active,sort_order').order('sort_order').order('created_at'),
    ])
    setLoading(false)
    if (periodResult.error || areaResult.error || managerResult.error || linkResult.error || guidelineResult.error) {
      setError('No pudimos cargar el catálogo de lineamientos.'); return
    }
    const nextPeriods = (periodResult.data || []) as Period[]
    setPeriods(nextPeriods)
    setManagements((areaResult.data || []) as Management[])
    setManagers((managerResult.data || []) as Manager[])
    setLinks((linkResult.data || []) as ManagerManagement[])
    setGuidelines((guidelineResult.data || []) as Guideline[])
    if (!periodId && nextPeriods.length) {
      const preferred = nextPeriods.find(item => item.status === 'OPEN') || nextPeriods[0]
      setPeriodId(preferred.id)
    }
  }

  function openNew() {
    setEditingId(null)
    setFormPeriodId(periodId || periods[0]?.id || '')
    setFormUnitCode(unitCode || 'CENTRAL')
    setFormAreaId(areaFilter || uniqueAreas[0]?.id || '')
    setFormCode('')
    setFormText('')
    setFormResponsibleId('')
    setFormActive(true)
    setFormOpen(true); setError(''); setNotice('')
  }

  function openEdit(item: Guideline) {
    const parsed = splitGuideline(item.guideline_text, item.code)
    setEditingId(item.id)
    setFormPeriodId(item.period_id)
    setFormUnitCode(item.unit_code)
    setFormAreaId(item.management_id)
    setFormCode(parsed.code)
    setFormText(parsed.text)
    setFormResponsibleId(item.responsible_manager_id || '')
    setFormActive(item.active)
    setFormOpen(true); setError(''); setNotice('')
  }

  function closeForm() { setFormOpen(false); setEditingId(null) }

  async function syncMatrix(guidelineId: string, guidelineText: string, nextPeriodId: string, nextUnitCode: string, managementId: string) {
    if (!supabase) return
    if (editingId) await supabase.from('matrices').update({ guideline_id: null, guideline_text: null }).eq('guideline_id', editingId)
    const { data: processData } = await supabase.from('processes').select('id,management_id').eq('unit_code', nextUnitCode).eq('active', true)
    const areaName = managementById.get(managementId)?.name || ''
    const equivalentManagementIds = new Set(managements.filter(item => item.active && normalize(item.name) === normalize(areaName)).map(item => item.id))
    const processIds = (processData || []).filter(item => equivalentManagementIds.has(String(item.management_id))).map(item => String(item.id))
    if (processIds.length) await supabase.from('matrices').update({ guideline_id: guidelineId, guideline_text: guidelineText }).eq('period_id', nextPeriodId).eq('unit_code', nextUnitCode).in('process_id', processIds)
  }

  async function saveGuideline(event: FormEvent) {
    event.preventDefault()
    if (!supabase || !canManage) return
    const text = formText.trim().replace(/\s+/g, ' ')
    const code = formCode.trim().toUpperCase().replace(/\s+/g, '')
    if (!formPeriodId || !formUnitCode || !formAreaId || !text) { setError('Completa periodo, unidad, área y lineamiento.'); return }
    const guidelineText = code ? `${code}: ${text}` : text
    setSaving(true); setError(''); setNotice('')
    try {
      let id = editingId
      if (editingId) {
        const { error: updateError } = await supabase.from('planning_guidelines').update({ period_id: formPeriodId, unit_code: formUnitCode, management_id: formAreaId, code: code || null, guideline_text: guidelineText, responsible_manager_id: formResponsibleId || null, active: formActive }).eq('id', editingId)
        if (updateError) throw updateError
      } else {
        const { data, error: insertError } = await supabase.from('planning_guidelines').insert({ period_id: formPeriodId, unit_code: formUnitCode, management_id: formAreaId, code: code || null, guideline_text: guidelineText, responsible_manager_id: formResponsibleId || null, active: formActive, sort_order: guidelines.filter(item => item.period_id === formPeriodId && item.unit_code === formUnitCode).length }).select('id').single()
        if (insertError || !data) throw insertError || new Error('INSERT')
        id = String(data.id)
      }
      if (id) await syncMatrix(id, guidelineText, formPeriodId, formUnitCode, formAreaId)
      closeForm(); await loadAll(); setPeriodId(formPeriodId); setUnitCode(formUnitCode); setAreaFilter(formAreaId); setNotice(editingId ? 'Lineamiento actualizado y sincronizado con su matriz.' : 'Lineamiento creado y sincronizado con su matriz.')
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : ''
      setError(`No pudimos guardar el lineamiento${message ? `: ${message}` : '.'}`)
    } finally { setSaving(false) }
  }

  async function deleteGuideline(item: Guideline) {
    if (!supabase || !canManage) return
    if (!window.confirm(`¿Eliminar el lineamiento “${item.guideline_text}”?`)) return
    setSaving(true); setError(''); setNotice('')
    const clearResult = await supabase.from('matrices').update({ guideline_id: null, guideline_text: null }).eq('guideline_id', item.id)
    const deleteResult = clearResult.error ? clearResult : await supabase.from('planning_guidelines').delete().eq('id', item.id)
    setSaving(false)
    if (deleteResult.error) { setError('No pudimos eliminar el lineamiento.'); return }
    setNotice('Lineamiento eliminado.'); await loadAll()
  }

  return <section className={`guideline-config config-accordion ${open ? 'open' : ''}`}>
    <button className="config-accordion-head" type="button" onClick={() => setOpen(value => !value)}>
      <span className="config-accordion-icon"><BookOpenText size={21}/></span>
      <div><small>Catálogo de planificación</small><h2>Lineamientos</h2><p>Registra los lineamientos una sola vez y relaciónalos con periodo, unidad, área y un responsable del directorio de Bonistas.</p></div>
      <ChevronDown className={open ? 'rotated' : ''} size={20}/>
    </button>

    {open && <div className="config-accordion-body guideline-config-body">
      {error && <div className="guideline-message error">{error}</div>}
      {notice && <div className="guideline-message success"><Check size={14}/>{notice}</div>}

      <div className="guideline-unit-selector" role="tablist" aria-label="Unidad de lineamientos">
        {unitOptions.map(unit => <button key={unit.code} type="button" className={unitCode === unit.code ? 'active' : ''} onClick={() => { setUnitCode(unit.code); setAreaFilter(''); setError(''); setNotice('') }}><strong>{unit.code}</strong><small>{unit.name}</small></button>)}
      </div>

      <div className="guideline-toolbar">
        <div className="guideline-filters">
          <select value={periodId} onChange={event => setPeriodId(event.target.value)}>{periods.map(item => <option key={item.id} value={item.id}>{item.year}{item.status === 'OPEN' ? ' · Actual' : ''}</option>)}</select>
          <select value={areaFilter} onChange={event => setAreaFilter(event.target.value)}><option value="">Todas las gerencias</option>{uniqueAreas.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
          <label><Search size={15}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar lineamiento"/></label>
        </div>
        {canManage && <button className="guideline-add" onClick={openNew}><Plus size={15}/> Nuevo lineamiento</button>}
      </div>

      {loading ? <div className="guideline-loading"><LoaderCircle className="spin" size={22}/> Cargando lineamientos...</div> : <div className="guideline-table-scroll"><table className="guideline-catalog-table guideline-catalog-table--strategic"><thead><tr><th>N°</th><th>Lineamientos Estratégicos</th><th>Gerencia Responsable</th><th>Gerente Responsable</th>{canManage && <th>Acciones</th>}</tr></thead><tbody>
        {filteredGuidelines.length === 0 ? <tr><td colSpan={canManage ? 5 : 4} className="guideline-empty">No hay lineamientos en esta vista.</td></tr> : filteredGuidelines.map((item, index) => {
          const responsible = item.responsible_manager_id ? managerById.get(item.responsible_manager_id) : null
          const parsed = splitGuideline(item.guideline_text, item.code)
          return <tr key={item.id} className={!item.active ? 'inactive-row' : ''}><td className="guideline-number">{displayNumber(item, index)}</td><td className="guideline-text-cell">{parsed.code && <strong className="guideline-code">{parsed.code}: </strong>}<span>{parsed.text}</span></td><td className="guideline-management">{managementById.get(item.management_id)?.name || '—'}</td><td>{responsible ? <div className="guideline-responsible"><strong>{responsible.name}</strong><small>{responsible.cargo || 'Bonista'}</small></div> : <span className="muted">Sin asignar</span>}</td>{canManage && <td><div className="guideline-actions"><button onClick={() => openEdit(item)} title="Editar"><Pencil size={14}/></button><button className="danger" onClick={() => void deleteGuideline(item)} title="Eliminar"><Trash2 size={14}/></button></div></td>}</tr>
        })}
      </tbody></table></div>}

      {formOpen && <div className="guideline-modal-backdrop" role="presentation" onMouseDown={event => { if (event.currentTarget === event.target && !saving) closeForm() }}><form className="guideline-modal" onSubmit={saveGuideline}>
        <button className="guideline-modal-close" type="button" onClick={closeForm} disabled={saving}><X size={18}/></button>
        <div className="guideline-modal-heading"><span><BookOpenText size={20}/></span><div><small>{editingId ? 'Editar' : 'Nuevo'}</small><h3>Lineamiento estratégico</h3></div></div>
        <div className="guideline-form-grid">
          <label>Periodo<select value={formPeriodId} onChange={event => setFormPeriodId(event.target.value)} required>{periods.map(item => <option key={item.id} value={item.id}>{item.year}</option>)}</select></label>
          <label>Unidad<select value={formUnitCode} onChange={event => setFormUnitCode(event.target.value)} required>{unitOptions.map(item => <option key={item.code} value={item.code}>{item.name}</option>)}</select></label>
          <label>Gerencia responsable<select value={formAreaId} onChange={event => { setFormAreaId(event.target.value); setFormResponsibleId('') }} required><option value="">Seleccionar gerencia</option>{uniqueAreas.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label>Código<input value={formCode} onChange={event => setFormCode(event.target.value)} placeholder="L5"/></label>
          <label className="wide">Lineamiento<textarea value={formText} onChange={event => setFormText(event.target.value)} placeholder="Desarrollar productos alineados..." required/></label>
          <label className="wide">Gerente responsable · Bonistas<select value={formResponsibleId} onChange={event => setFormResponsibleId(event.target.value)}><option value="">Sin responsable</option>{responsibleOptions.map(item => <option key={item.id} value={item.id}>{item.name} · {item.cargo || 'Sin cargo'} · {unitByCode.get(item.unit_code) || item.unit_code}</option>)}</select><small>La lista sale directamente del directorio de Bonistas y se filtra por la gerencia seleccionada.</small></label>
          <label className="guideline-active"><input type="checkbox" checked={formActive} onChange={event => setFormActive(event.target.checked)}/> Activo</label>
        </div>
        <div className="guideline-modal-actions"><button type="button" onClick={closeForm} disabled={saving}>Cancelar</button><button className="primary" type="submit" disabled={saving}>{saving && <LoaderCircle className="spin" size={15}/>} Guardar lineamiento</button></div>
      </form></div>}
    </div>}
  </section>
}