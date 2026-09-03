import { useEffect, useMemo, useState } from 'react'
import { BookOpenText, Check, LoaderCircle, Pencil, Search, Trash2, X } from 'lucide-react'
import { supabase } from './lib/supabase'
import './central-guideline-workspace.css'

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
type Management = { id: string; name: string }
type Manager = { id: string; name: string; cargo: string | null }
type Props = {
  periodId: string
  canManage: boolean
  onAreaChange?: (area: { id: string; name: string } | null) => void
}

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

function splitGuideline(value: string, explicitCode?: string | null) {
  const code = (explicitCode || '').trim()
  if (code) {
    const escaped = code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return { code, text: value.replace(new RegExp(`^${escaped}\\s*:\\s*`, 'i'), '').trim() }
  }
  const match = value.match(/^\s*(L\d+)\s*:\s*(.*)$/i)
  return match ? { code: match[1].toUpperCase(), text: match[2].trim() } : { code: '', text: value.trim() }
}

export default function CentralGuidelineWorkspace({ periodId, canManage, onAreaChange }: Props) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [guidelines, setGuidelines] = useState<Guideline[]>([])
  const [managements, setManagements] = useState<Management[]>([])
  const [managers, setManagers] = useState<Manager[]>([])
  const [selectedAreaId, setSelectedAreaId] = useState('')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Guideline | null>(null)
  const [editCode, setEditCode] = useState('')
  const [editText, setEditText] = useState('')
  const [editManagerId, setEditManagerId] = useState('')
  const [pendingDelete, setPendingDelete] = useState<Guideline | null>(null)

  const managementById = useMemo(() => new Map(managements.map(item => [item.id, item])), [managements])
  const managerById = useMemo(() => new Map(managers.map(item => [item.id, item])), [managers])

  const areas = useMemo(() => {
    const counts = new Map<string, number>()
    guidelines.forEach(item => counts.set(item.management_id, (counts.get(item.management_id) || 0) + 1))
    return managements
      .filter(item => counts.has(item.id))
      .map(item => ({ ...item, count: counts.get(item.id) || 0 }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'))
  }, [guidelines, managements])

  const selectedArea = useMemo(() => areas.find(item => item.id === selectedAreaId) || null, [areas, selectedAreaId])

  const visibleGuidelines = useMemo(() => {
    return guidelines
      .filter(item => item.management_id === selectedAreaId)
      .filter(item => !search.trim() || normalize(item.guideline_text).includes(normalize(search)))
      .sort((a, b) => a.sort_order - b.sort_order || a.guideline_text.localeCompare(b.guideline_text, 'es'))
  }, [guidelines, selectedAreaId, search])

  useEffect(() => { void load() }, [periodId])

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
    const [guidelineResult, managementResult, managerResult] = await Promise.all([
      supabase.from('planning_guidelines').select('id,period_id,unit_code,management_id,code,guideline_text,responsible_manager_id,active,sort_order').eq('period_id', periodId).eq('unit_code', 'CENTRAL').order('sort_order').order('created_at'),
      supabase.from('managements_global').select('id,name').eq('active', true).order('name'),
      supabase.from('managers').select('id,name,cargo').eq('active', true).order('name'),
    ])
    setLoading(false)
    if (guidelineResult.error || managementResult.error || managerResult.error) {
      setError('No pudimos cargar los lineamientos de Central.')
      return
    }
    const nextGuidelines = (guidelineResult.data || []) as Guideline[]
    const permittedIds = new Set(nextGuidelines.map(item => item.management_id))
    setGuidelines(nextGuidelines)
    setManagements(((managementResult.data || []) as Management[]).filter(item => permittedIds.has(item.id)))
    setManagers((managerResult.data || []) as Manager[])
  }

  function beginEdit(item: Guideline) {
    const parsed = splitGuideline(item.guideline_text, item.code)
    setEditing(item)
    setEditCode(parsed.code)
    setEditText(parsed.text)
    setEditManagerId(item.responsible_manager_id || '')
    setError('')
    setNotice('')
  }

  async function saveEdit() {
    if (!supabase || !canManage || !editing) return
    const text = editText.trim().replace(/\s+/g, ' ')
    if (!text) { setError('El lineamiento no puede estar vacío.'); return }
    const code = editCode.trim().toUpperCase().replace(/\s+/g, '')
    const guidelineText = code ? `${code}: ${text}` : text
    setSaving(true)
    setError('')
    const update = await supabase.from('planning_guidelines').update({ code: code || null, guideline_text: guidelineText, responsible_manager_id: editManagerId || null }).eq('id', editing.id)
    if (!update.error) await supabase.from('matrices').update({ guideline_text: guidelineText }).eq('guideline_id', editing.id)
    setSaving(false)
    if (update.error) { setError('No pudimos actualizar el lineamiento.'); return }
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
    if (result.error) { setError('No pudimos eliminar el lineamiento.'); return }
    setPendingDelete(null)
    setNotice('Lineamiento eliminado.')
    await load()
  }

  if (loading) return <div className="central-guideline-loading"><LoaderCircle className="spin" size={22}/> Cargando lineamientos de Central...</div>

  return <div className="central-guideline-workspace">
    {error && <div className="central-guideline-message error">{error}</div>}
    {notice && <div className="central-guideline-message success"><Check size={15}/>{notice}</div>}

    <div className="central-guideline-filters">
      <label className="central-guideline-area-select"><span>Área</span><select value={selectedAreaId} onChange={event => setSelectedAreaId(event.target.value)}><option value="">Selecciona un área</option>{areas.map(area => <option key={area.id} value={area.id}>{area.name}</option>)}</select></label>
      <label className="central-guideline-search"><Search size={17}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar lineamiento por palabra clave..."/></label>
      <button type="button" className="central-guideline-clear" onClick={() => setSearch('')}>Limpiar filtros</button>
    </div>

    <div className="central-guideline-layout">
      <aside className="central-guideline-sidebar">
        <div className="central-guideline-sidebar-title"><span>Áreas de Central</span><strong>{areas.length}</strong></div>
        <label className="central-guideline-sidebar-search"><Search size={15}/><input placeholder="Buscar área..." onChange={event => {
          const query = normalize(event.target.value)
          document.querySelectorAll<HTMLElement>('[data-central-area-name]').forEach(node => {
            node.hidden = Boolean(query) && !normalize(node.dataset.centralAreaName || '').includes(query)
          })
        }}/></label>
        <div className="central-guideline-area-list">
          {areas.map(area => <button key={area.id} type="button" data-central-area-name={area.name} className={selectedAreaId === area.id ? 'active' : ''} onClick={() => setSelectedAreaId(area.id)}><BookOpenText size={17}/><span>{area.name}</span><strong>{area.count}</strong></button>)}
        </div>
      </aside>

      <section className="central-guideline-main">
        <div className="central-guideline-main-heading"><div><span>Lineamientos de Central</span><h3>{selectedArea?.name || 'Selecciona un área'}</h3></div><small>{visibleGuidelines.length} lineamiento{visibleGuidelines.length === 1 ? '' : 's'}</small></div>
        <div className="central-guideline-table-wrap">
          <table className="central-guideline-table">
            <thead><tr><th>N°</th><th>Lineamiento estratégico</th><th>Gerencia responsable</th><th>Gerente responsable</th><th>Estado</th>{canManage && <th>Acciones</th>}</tr></thead>
            <tbody>
              {visibleGuidelines.length === 0 ? <tr><td colSpan={canManage ? 6 : 5} className="central-guideline-empty">No hay lineamientos para esta área.</td></tr> : visibleGuidelines.map((item, index) => {
                const parsed = splitGuideline(item.guideline_text, item.code)
                const manager = item.responsible_manager_id ? managerById.get(item.responsible_manager_id) : null
                return <tr key={item.id}>
                  <td className="central-guideline-number">{String(index + 1).padStart(2, '0')}</td>
                  <td className="central-guideline-text"><strong>{parsed.code ? `${parsed.code}: ` : ''}</strong>{parsed.text}</td>
                  <td>{managementById.get(item.management_id)?.name || selectedArea?.name || 'Sin área'}</td>
                  <td>{manager?.name || 'Sin asignar'}</td>
                  <td><span className={`central-guideline-status ${item.active ? 'active' : 'inactive'}`}>{item.active ? 'Activo' : 'Inactivo'}</span></td>
                  {canManage && <td><div className="central-guideline-actions"><button type="button" title="Editar" onClick={() => beginEdit(item)}><Pencil size={15}/></button><button type="button" className="danger" title="Eliminar" onClick={() => setPendingDelete(item)}><Trash2 size={15}/></button></div></td>}
                </tr>
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>

    {editing && <div className="central-guideline-modal-backdrop" role="presentation" onMouseDown={event => { if (event.currentTarget === event.target && !saving) setEditing(null) }}><section className="central-guideline-modal" role="dialog" aria-modal="true"><button className="central-guideline-modal-close" type="button" onClick={() => setEditing(null)}><X size={18}/></button><span>Editar lineamiento</span><h3>{selectedArea?.name}</h3><label>Código<input value={editCode} onChange={event => setEditCode(event.target.value)} placeholder="L1"/></label><label>Lineamiento<textarea value={editText} onChange={event => setEditText(event.target.value)} rows={5}/></label><label>Gerente responsable<select value={editManagerId} onChange={event => setEditManagerId(event.target.value)}><option value="">Sin asignar</option>{managers.map(manager => <option key={manager.id} value={manager.id}>{manager.name}{manager.cargo ? ` · ${manager.cargo}` : ''}</option>)}</select></label><div className="central-guideline-modal-actions"><button type="button" onClick={() => setEditing(null)}>Cancelar</button><button type="button" className="primary" onClick={() => void saveEdit()} disabled={saving}>{saving && <LoaderCircle className="spin" size={15}/>} Guardar cambios</button></div></section></div>}

    {pendingDelete && <div className="central-guideline-modal-backdrop" role="presentation" onMouseDown={event => { if (event.currentTarget === event.target && !saving) setPendingDelete(null) }}><section className="central-guideline-confirm" role="dialog" aria-modal="true"><h3>¿Eliminar este lineamiento?</h3><p>{pendingDelete.guideline_text}</p><div className="central-guideline-modal-actions"><button type="button" onClick={() => setPendingDelete(null)}>Cancelar</button><button type="button" className="danger-solid" onClick={() => void confirmDelete()} disabled={saving}>Sí, eliminar</button></div></section></div>}
  </div>
}
