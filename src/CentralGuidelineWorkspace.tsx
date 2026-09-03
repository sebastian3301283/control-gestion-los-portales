import { useEffect, useMemo, useState } from 'react'
import { Check, LoaderCircle, Pencil, Plus, Trash2, X } from 'lucide-react'
import { supabase } from './lib/supabase'
import './central-guideline-workspace.css'

type Guideline = {
  id: string
  period_id: string
  unit_code: string
  management_id: string
  category: string | null
  code: string | null
  guideline_text: string
  responsible_manager_id: string | null
  active: boolean
  sort_order: number
}
type Management = { id: string; name: string }
type GuidelineAreaLink = { management_id: string }
type Props = {
  periodId: string
  canManage: boolean
  onAreaChange?: (area: { id: string; name: string } | null) => void
}

export default function CentralGuidelineWorkspace({ periodId, canManage, onAreaChange }: Props) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [guidelines, setGuidelines] = useState<Guideline[]>([])
  const [managements, setManagements] = useState<Management[]>([])
  const [selectedAreaId, setSelectedAreaId] = useState('')
  const [editing, setEditing] = useState<Guideline | null>(null)
  const [creating, setCreating] = useState(false)
  const [formCategory, setFormCategory] = useState('')
  const [formCode, setFormCode] = useState('')
  const [formText, setFormText] = useState('')
  const [pendingDelete, setPendingDelete] = useState<Guideline | null>(null)

  const areas = useMemo(() => [...managements].sort((a, b) => a.name.localeCompare(b.name, 'es')), [managements])
  const selectedArea = useMemo(() => areas.find(item => item.id === selectedAreaId) || null, [areas, selectedAreaId])
  const visibleGuidelines = useMemo(() => guidelines
    .filter(item => item.management_id === selectedAreaId)
    .sort((a, b) => a.sort_order - b.sort_order || (a.code || '').localeCompare(b.code || '', 'es')),
  [guidelines, selectedAreaId])

  useEffect(() => { void load() }, [periodId, canManage])

  useEffect(() => {
    if (!selectedAreaId && areas.length) setSelectedAreaId(areas[0].id)
    if (selectedAreaId && !areas.some(item => item.id === selectedAreaId)) setSelectedAreaId(areas[0]?.id || '')
  }, [areas, selectedAreaId])

  useEffect(() => {
    onAreaChange?.(selectedArea ? { id: selectedArea.id, name: selectedArea.name } : null)
  }, [selectedArea?.id, selectedArea?.name, onAreaChange])

  async function load() {
    if (!supabase) return
    setLoading(true)
    setError('')
    const [guidelineResult, catalogResult, managementResult] = await Promise.all([
      supabase.from('planning_guidelines').select('id,period_id,unit_code,management_id,category,code,guideline_text,responsible_manager_id,active,sort_order').eq('period_id', periodId).eq('unit_code', 'CENTRAL').order('sort_order').order('created_at'),
      supabase.from('guideline_unit_area_catalog').select('management_id').eq('unit_code', 'CENTRAL').order('created_at'),
      supabase.from('managements_global').select('id,name').eq('active', true).order('name'),
    ])
    if (guidelineResult.error || catalogResult.error || managementResult.error) {
      setLoading(false)
      setError('No pudimos cargar los lineamientos de Central.')
      return
    }

    const nextGuidelines = (guidelineResult.data || []) as Guideline[]
    const allAreas = (managementResult.data || []) as Management[]
    const allAreaById = new Map(allAreas.map(area => [area.id, area]))
    const configuredIds = ((catalogResult.data || []) as GuidelineAreaLink[]).map(item => item.management_id)
    let configuredAreas = configuredIds.map(id => allAreaById.get(id)).filter((item): item is Management => Boolean(item))

    if (!configuredAreas.length) configuredAreas = allAreas.filter(area => nextGuidelines.some(item => item.management_id === area.id))

    let visibleAreas = configuredAreas
    if (!canManage) {
      const permissionChecks = await Promise.all(configuredAreas.map(async area => {
        const { data } = await supabase.rpc('can_access_management', { management_id_input: area.id, unit_code_input: 'CENTRAL' })
        return data ? area : null
      }))
      visibleAreas = permissionChecks.filter((item): item is Management => Boolean(item))
    }

    const uniqueVisibleAreas = new Map<string, Management>()
    visibleAreas.forEach(area => {
      const key = area.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
      if (!uniqueVisibleAreas.has(key)) uniqueVisibleAreas.set(key, area)
    })

    setGuidelines(nextGuidelines)
    setManagements([...uniqueVisibleAreas.values()])
    setLoading(false)
  }

  function openCreate() {
    if (!selectedAreaId) {
      setError('Selecciona un área antes de crear un lineamiento.')
      return
    }
    setCreating(true)
    setEditing(null)
    setFormCategory('')
    setFormCode('')
    setFormText('')
    setError('')
    setNotice('')
  }

  function beginEdit(item: Guideline) {
    setCreating(false)
    setEditing(item)
    setFormCategory(item.category || '')
    setFormCode(item.code || '')
    setFormText(item.guideline_text || '')
    setError('')
    setNotice('')
  }

  function closeForm() {
    if (saving) return
    setCreating(false)
    setEditing(null)
  }

  async function saveForm() {
    if (!supabase || !canManage || !selectedAreaId) return
    setSaving(true)
    setError('')

    const payload = {
      category: formCategory.trim() || null,
      code: formCode.trim() || null,
      guideline_text: formText.trim(),
    }

    if (creating) {
      const nextSort = visibleGuidelines.reduce((max, item) => Math.max(max, item.sort_order || 0), 0) + 1
      const result = await supabase.from('planning_guidelines').insert({
        period_id: periodId,
        unit_code: 'CENTRAL',
        management_id: selectedAreaId,
        ...payload,
        responsible_manager_id: null,
        active: true,
        sort_order: nextSort,
      })
      setSaving(false)
      if (result.error) {
        setError(`No pudimos crear el lineamiento: ${result.error.message}`)
        return
      }
      setCreating(false)
      setNotice('Lineamiento creado correctamente.')
      await load()
      return
    }

    if (!editing) {
      setSaving(false)
      return
    }

    const update = await supabase.from('planning_guidelines').update(payload).eq('id', editing.id)
    if (!update.error) await supabase.from('matrices').update({ guideline_text: payload.guideline_text }).eq('guideline_id', editing.id)
    setSaving(false)
    if (update.error) {
      setError(`No pudimos actualizar el lineamiento: ${update.error.message}`)
      return
    }
    setEditing(null)
    setNotice('Lineamiento actualizado correctamente.')
    await load()
  }

  async function confirmDelete() {
    if (!supabase || !canManage || !pendingDelete) return
    setSaving(true)
    const clear = await supabase.from('matrices').update({ guideline_id: null, guideline_text: null }).eq('guideline_id', pendingDelete.id)
    const result = clear.error ? clear : await supabase.from('planning_guidelines').delete().eq('id', pendingDelete.id)
    setSaving(false)
    if (result.error) {
      setError('No pudimos eliminar el lineamiento.')
      return
    }
    setPendingDelete(null)
    setNotice('Lineamiento eliminado.')
    await load()
  }

  if (loading) return <div className="central-guideline-loading"><LoaderCircle className="spin" size={22}/> Cargando áreas y lineamientos de Central...</div>

  return <div className="central-guideline-workspace central-guideline-workspace--simple">
    {error && <div className="central-guideline-message error">{error}</div>}
    {notice && <div className="central-guideline-message success"><Check size={15}/>{notice}</div>}

    <div className="central-guideline-filters central-guideline-filters--simple">
      <label className="central-guideline-area-select"><span>Área</span><select value={selectedAreaId} onChange={event => setSelectedAreaId(event.target.value)}><option value="">Selecciona un área</option>{areas.map(area => <option key={area.id} value={area.id}>{area.name}</option>)}</select></label>
      {canManage && <button type="button" className="central-guideline-create" onClick={openCreate}><Plus size={16}/> Nuevo lineamiento</button>}
    </div>

    <section className="central-guideline-main central-guideline-main--full">
      <div className="central-guideline-main-heading"><div><span>Lineamientos de Central</span><h3>{selectedArea?.name || 'Selecciona un área'}</h3></div><small>{visibleGuidelines.length} lineamiento{visibleGuidelines.length === 1 ? '' : 's'}</small></div>
      <div className="central-guideline-table-wrap">
        <table className="central-guideline-table central-guideline-table--simple">
          <thead><tr><th>Categoría</th><th>N°</th><th>Lineamientos</th></tr></thead>
          <tbody>
            {visibleGuidelines.length === 0 ? <tr><td colSpan={3} className="central-guideline-empty">No hay lineamientos para esta área.</td></tr> : visibleGuidelines.map(item => <tr key={item.id}>
              <td className="central-guideline-category">{item.category || ''}</td>
              <td className="central-guideline-number">{item.code || ''}</td>
              <td className="central-guideline-text central-guideline-text-with-actions"><span>{item.guideline_text || ''}</span>{canManage && <div className="central-guideline-inline-actions"><button type="button" title="Editar" onClick={() => beginEdit(item)}><Pencil size={15}/></button><button type="button" className="danger" title="Eliminar" onClick={() => setPendingDelete(item)}><Trash2 size={15}/></button></div>}</td>
            </tr>)}
          </tbody>
        </table>
      </div>
    </section>

    {(creating || editing) && <div className="central-guideline-modal-backdrop" role="presentation" onMouseDown={event => { if (event.currentTarget === event.target) closeForm() }}><section className="central-guideline-modal" role="dialog" aria-modal="true"><button className="central-guideline-modal-close" type="button" onClick={closeForm}><X size={18}/></button><span>{creating ? 'Nuevo lineamiento' : 'Editar lineamiento'}</span><h3>{selectedArea?.name}</h3><p className="central-guideline-form-help">Puedes dejar cualquier campo en blanco y guardar igualmente.</p><label>Categoría<input value={formCategory} onChange={event => setFormCategory(event.target.value)} placeholder="Ej. Estratégico"/></label><label>N°<input value={formCode} onChange={event => setFormCode(event.target.value)} placeholder="Ej. 1 o L1"/></label><label>Lineamiento<textarea value={formText} onChange={event => setFormText(event.target.value)} rows={5} placeholder="Escribe el lineamiento..."/></label><div className="central-guideline-modal-actions"><button type="button" onClick={closeForm}>Cancelar</button><button type="button" className="primary" onClick={() => void saveForm()} disabled={saving}>{saving && <LoaderCircle className="spin" size={15}/>} Guardar</button></div></section></div>}

    {pendingDelete && <div className="central-guideline-modal-backdrop" role="presentation" onMouseDown={event => { if (event.currentTarget === event.target && !saving) setPendingDelete(null) }}><section className="central-guideline-confirm" role="dialog" aria-modal="true"><h3>¿Eliminar este lineamiento?</h3><p>{pendingDelete.guideline_text || 'Lineamiento sin texto'}</p><div className="central-guideline-modal-actions"><button type="button" onClick={() => setPendingDelete(null)}>Cancelar</button><button type="button" className="danger-solid" onClick={() => void confirmDelete()} disabled={saving}>Sí, eliminar</button></div></section></div>}
  </div>
}
