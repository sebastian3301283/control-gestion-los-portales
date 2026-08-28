import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { Bold, Check, ChevronDown, Italic, Pencil, Save, Trash2, Type, Underline as UnderlineIcon, X } from 'lucide-react'
import { supabase } from './lib/supabase'
import './guideline-grid.css'

type UnitCode = 'HU' | 'DEP' | 'VS' | 'HOT' | 'CENTRAL'

type GuidelineRow = {
  id: string
  title: string
  responsible_management: string | null
  responsible_manager: string | null
  status: string
}

type Management = { id: string; name: string }
type Manager = { id: string; name: string }
type ManagerManagement = { manager_id: string; management_id: string }
type GuidelineManagement = { guideline_id: string; management_id: string }
type GuidelineManager = { guideline_id: string; manager_id: string }

type Props = {
  guidelines: GuidelineRow[]
  unitCode: UnitCode
  canManage: boolean
  onChanged: () => void | Promise<void>
  onError: (message: string) => void
  onNotice: (message: string) => void
}

const fonts = ['Arial', 'Calibri', 'Verdana', 'Georgia', 'Times New Roman']

function splitChoices(value: string | null | undefined) {
  return String(value || '')
    .split(/\s*(?:\/|;|\||\n)\s*/g)
    .map(item => item.trim())
    .filter(Boolean)
}

function safeSpanStyle(element: HTMLElement) {
  const styles: string[] = []
  const weight = element.style.fontWeight.toLowerCase()
  if (weight === 'bold' || Number(weight) >= 600) styles.push('font-weight:700')
  if (element.style.fontStyle.toLowerCase() === 'italic') styles.push('font-style:italic')
  if (element.style.textDecoration.toLowerCase().includes('underline')) styles.push('text-decoration:underline')
  const family = element.style.fontFamily.replace(/["']/g, '').trim()
  if (fonts.includes(family)) styles.push(`font-family:${family}`)
  return styles.join(';')
}

function cleanRichHtml(html: string) {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const allowed = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'FONT', 'SPAN', 'BR', 'DIV', 'P'])

  Array.from(doc.body.querySelectorAll('*')).forEach(element => {
    if (!allowed.has(element.tagName)) {
      element.replaceWith(...Array.from(element.childNodes))
      return
    }

    const spanStyle = element.tagName === 'SPAN' ? safeSpanStyle(element as HTMLElement) : ''
    const fontFace = element.tagName === 'FONT' ? (element.getAttribute('face') || '').replace(/["']/g, '').trim() : ''
    Array.from(element.attributes).forEach(attribute => element.removeAttribute(attribute.name))
    if (element.tagName === 'SPAN' && spanStyle) element.setAttribute('style', spanStyle)
    if (element.tagName === 'FONT' && fonts.includes(fontFace)) element.setAttribute('face', fontFace)
  })

  return doc.body.innerHTML
}

function RichTextCell({ initialHtml, initialText, onChange }: {
  initialHtml: string | null
  initialText: string
  onChange: (html: string, text: string) => void
}) {
  const editorRef = useRef<HTMLDivElement>(null)
  const selectionRef = useRef<Range | null>(null)

  useEffect(() => {
    if (!editorRef.current) return
    if (initialHtml) editorRef.current.innerHTML = cleanRichHtml(initialHtml)
    else editorRef.current.textContent = initialText
    onChange(cleanRichHtml(editorRef.current.innerHTML), editorRef.current.innerText)
  }, [initialHtml, initialText])

  function sync() {
    if (!editorRef.current) return
    onChange(cleanRichHtml(editorRef.current.innerHTML), editorRef.current.innerText)
  }

  function rememberSelection() {
    const editor = editorRef.current
    const selection = window.getSelection()
    if (!editor || !selection || selection.rangeCount === 0) return
    const range = selection.getRangeAt(0)
    if (editor.contains(range.commonAncestorContainer)) selectionRef.current = range.cloneRange()
  }

  function restoreSelection() {
    if (!selectionRef.current) return
    const selection = window.getSelection()
    if (!selection) return
    selection.removeAllRanges()
    selection.addRange(selectionRef.current)
  }

  function command(name: string, value?: string) {
    editorRef.current?.focus()
    restoreSelection()
    document.execCommand(name, false, value)
    rememberSelection()
    sync()
  }

  return (
    <div className="rich-cell-editor">
      <div className="rich-cell-toolbar">
        <span className="rich-cell-hint">Selecciona solo las palabras que quieras cambiar</span>
        <div className="rich-cell-tools">
          <button type="button" title="Negrita" onMouseDown={event => { event.preventDefault(); rememberSelection() }} onClick={() => command('bold')}><Bold size={14}/></button>
          <button type="button" title="Cursiva" onMouseDown={event => { event.preventDefault(); rememberSelection() }} onClick={() => command('italic')}><Italic size={14}/></button>
          <button type="button" title="Subrayado" onMouseDown={event => { event.preventDefault(); rememberSelection() }} onClick={() => command('underline')}><UnderlineIcon size={14}/></button>
          <label title="Tipo de letra" onMouseDown={rememberSelection}><Type size={14}/><select defaultValue="Arial" onChange={event => command('fontName', event.target.value)}>{fonts.map(font => <option key={font} value={font}>{font}</option>)}</select></label>
        </div>
      </div>
      <div
        ref={editorRef}
        className="rich-cell-surface"
        contentEditable
        suppressContentEditableWarning
        onInput={sync}
        onMouseUp={rememberSelection}
        onKeyUp={rememberSelection}
        onBlur={sync}
      />
    </div>
  )
}

function RelationMultiSelect({ value, options, placeholder, onChange }: {
  value: string[]
  options: Array<{ id: string; label: string }>
  placeholder: string
  onChange: (ids: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const selectedLabels = value.map(id => options.find(option => option.id === id)?.label).filter((label): label is string => Boolean(label))

  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter(item => item !== id) : [...value, id])
  }

  return (
    <div className="multi-select-cell">
      <button type="button" className={`multi-select-trigger ${open ? 'open' : ''}`} onClick={() => setOpen(current => !current)}>
        <span>{selectedLabels.length ? selectedLabels.join(' / ') : placeholder}</span>
        <ChevronDown size={15}/>
      </button>
      {open && (
        <div className="multi-select-menu">
          {options.length === 0 ? <div className="multi-select-empty">No hay opciones registradas</div> : options.map(option => (
            <button type="button" key={option.id} className={value.includes(option.id) ? 'selected' : ''} onClick={() => toggle(option.id)}>
              <span className="multi-select-check">{value.includes(option.id) && <Check size={13}/>}</span>
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function GuidelineGrid({ guidelines, unitCode, canManage, onChanged, onError, onNotice }: Props) {
  const [richById, setRichById] = useState<Record<string, string | null>>({})
  const [managements, setManagements] = useState<Management[]>([])
  const [managers, setManagers] = useState<Manager[]>([])
  const [managerManagements, setManagerManagements] = useState<ManagerManagement[]>([])
  const [guidelineManagements, setGuidelineManagements] = useState<GuidelineManagement[]>([])
  const [guidelineManagers, setGuidelineManagers] = useState<GuidelineManager[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editHtml, setEditHtml] = useState('')
  const [editText, setEditText] = useState('')
  const [editManagementIds, setEditManagementIds] = useState<string[]>([])
  const [editManagerIds, setEditManagerIds] = useState<string[]>([])
  const [editStatus, setEditStatus] = useState('pendiente')
  const [saving, setSaving] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deletingAll, setDeletingAll] = useState(false)

  const managementById = useMemo(() => new Map(managements.map(item => [item.id, item.name])), [managements])
  const managerById = useMemo(() => new Map(managers.map(item => [item.id, item.name])), [managers])
  const unitManagementIds = useMemo(() => new Set(managements.map(item => item.id)), [managements])

  const managementOptions = useMemo(
    () => managements.map(item => ({ id: item.id, label: item.name })),
    [managements],
  )

  const managerOptions = useMemo(() => {
    const allowedManagerIds = new Set(
      managerManagements
        .filter(link => unitManagementIds.has(link.management_id) && (editManagementIds.length === 0 || editManagementIds.includes(link.management_id)))
        .map(link => link.manager_id),
    )

    editManagerIds.forEach(id => allowedManagerIds.add(id))
    return managers
      .filter(item => allowedManagerIds.has(item.id))
      .map(item => ({ id: item.id, label: item.name }))
  }, [managers, managerManagements, unitManagementIds, editManagementIds, editManagerIds])

  useEffect(() => {
    if (!supabase) return
    if (guidelines.length === 0) {
      setRichById({})
      setGuidelineManagements([])
      setGuidelineManagers([])
      return
    }

    void (async () => {
      const guidelineIds = guidelines.map(row => row.id)
      const [richResult, managementResult, managerResult, managerManagementResult, guidelineManagementResult, guidelineManagerResult] = await Promise.all([
        supabase.from('guidelines').select('id, title_html').in('id', guidelineIds),
        supabase.from('managements').select('id, name').eq('unit_code', unitCode).eq('active', true).order('name'),
        supabase.from('managers').select('id, name').eq('active', true).order('name'),
        supabase.from('manager_managements').select('manager_id, management_id'),
        supabase.from('guideline_managements').select('guideline_id, management_id').in('guideline_id', guidelineIds),
        supabase.from('guideline_managers').select('guideline_id, manager_id').in('guideline_id', guidelineIds),
      ])

      const nextRich: Record<string, string | null> = {}
      ;(richResult.data || []).forEach(row => { nextRich[row.id] = row.title_html ? cleanRichHtml(String(row.title_html)) : null })
      setRichById(nextRich)
      setManagements((managementResult.data || []) as Management[])
      setManagers((managerResult.data || []) as Manager[])
      setManagerManagements((managerManagementResult.data || []) as ManagerManagement[])
      setGuidelineManagements((guidelineManagementResult.data || []) as GuidelineManagement[])
      setGuidelineManagers((guidelineManagerResult.data || []) as GuidelineManager[])
    })()
  }, [guidelines, unitCode])

  function relationManagementIds(row: GuidelineRow) {
    const ids = guidelineManagements.filter(link => link.guideline_id === row.id).map(link => link.management_id)
    if (ids.length) return ids
    const names = splitChoices(row.responsible_management)
    return managements.filter(item => names.includes(item.name)).map(item => item.id)
  }

  function relationManagerIds(row: GuidelineRow) {
    const ids = guidelineManagers.filter(link => link.guideline_id === row.id).map(link => link.manager_id)
    if (ids.length) return ids
    const names = splitChoices(row.responsible_manager)
    return managers.filter(item => names.includes(item.name)).map(item => item.id)
  }

  function relationManagementText(row: GuidelineRow) {
    const names = relationManagementIds(row).map(id => managementById.get(id)).filter((name): name is string => Boolean(name))
    return names.length ? names.join(' / ') : (row.responsible_management || '—')
  }

  function relationManagerText(row: GuidelineRow) {
    const names = relationManagerIds(row).map(id => managerById.get(id)).filter((name): name is string => Boolean(name))
    return names.length ? names.join(' / ') : (row.responsible_manager || '—')
  }

  function startEdit(row: GuidelineRow) {
    setEditingId(row.id)
    setEditHtml(richById[row.id] || row.title)
    setEditText(row.title)
    setEditManagementIds(relationManagementIds(row))
    setEditManagerIds(relationManagerIds(row))
    setEditStatus(row.status || 'pendiente')
    onError('')
    onNotice('')
  }

  function cancelEdit() {
    setEditingId(null)
    setEditHtml('')
    setEditText('')
    setEditManagementIds([])
    setEditManagerIds([])
    setEditStatus('pendiente')
  }

  async function saveEdit() {
    if (!supabase || !editingId || !editText.trim()) return
    setSaving(true)
    onError('')
    onNotice('')

    const managementNames = editManagementIds.map(id => managementById.get(id)).filter((name): name is string => Boolean(name))
    const managerNames = editManagerIds.map(id => managerById.get(id)).filter((name): name is string => Boolean(name))
    const safeHtml = cleanRichHtml(editHtml)

    const { error } = await supabase.from('guidelines').update({
      title: editText.trim(),
      title_html: safeHtml || null,
      responsible_management: managementNames.length ? managementNames.join(' / ') : null,
      responsible_manager: managerNames.length ? managerNames.join(' / ') : null,
      status: editStatus || 'pendiente',
    }).eq('id', editingId)

    setSaving(false)
    if (error) {
      onError('No pudimos actualizar el lineamiento.')
      return
    }

    cancelEdit()
    onNotice('Lineamiento actualizado correctamente.')
    await onChanged()
  }

  async function deleteAllGuidelines() {
    if (!supabase || !canManage || guidelines.length === 0) return
    setDeletingAll(true)
    onError('')
    onNotice('')

    const ids = guidelines.map(row => row.id)
    const { error } = await supabase.from('guidelines').delete().in('id', ids)

    setDeletingAll(false)
    if (error) {
      onError('No pudimos eliminar los lineamientos. Inténtalo nuevamente.')
      return
    }

    cancelEdit()
    setDeleteConfirmOpen(false)
    onNotice(`${ids.length} lineamiento${ids.length === 1 ? '' : 's'} eliminado${ids.length === 1 ? '' : 's'} correctamente.`)
    await onChanged()
  }

  return (
    <div className={`guideline-grid-theme guideline-grid-theme--${unitCode.toLowerCase()}`}>
      {canManage && guidelines.length > 0 && (
        <div className="guideline-bulk-actions">
          <button type="button" className="delete-all-guidelines" onClick={() => setDeleteConfirmOpen(true)} disabled={deletingAll || Boolean(editingId)}>
            <Trash2 size={15}/> Eliminar todos
          </button>
        </div>
      )}

      <div className="guideline-table-wrap guideline-table-wrap--rich">
        <table className={`guideline-table guideline-table--rich guideline-table--${unitCode.toLowerCase()}`}>
          <thead><tr><th>N°</th><th>Lineamientos Estratégicos</th><th>Gerencia Responsable</th><th>Gerente Responsable</th><th>Estatus</th>{canManage && <th>Acciones</th>}</tr></thead>
          <tbody>
            {guidelines.map((row, index) => {
              const isEditing = editingId === row.id
              return (
                <Fragment key={row.id}>
                  <tr className={isEditing ? 'guideline-row--editing' : ''}>
                    <td className="guideline-table__number">{index + 1}</td>
                    <td className="guideline-table__title">{isEditing ? <RichTextCell initialHtml={richById[row.id] || null} initialText={row.title} onChange={(html, text) => { setEditHtml(html); setEditText(text) }} /> : richById[row.id] ? <div className="guideline-rich-display" dangerouslySetInnerHTML={{ __html: richById[row.id] || '' }} /> : row.title}</td>
                    <td>{isEditing ? <RelationMultiSelect value={editManagementIds} options={managementOptions} placeholder="Seleccionar gerencia" onChange={setEditManagementIds} /> : relationManagementText(row)}</td>
                    <td>{isEditing ? <RelationMultiSelect value={editManagerIds} options={managerOptions} placeholder="Seleccionar gerente" onChange={setEditManagerIds} /> : relationManagerText(row)}</td>
                    <td>{isEditing ? <select className="guideline-cell-input guideline-cell-select" value={editStatus} onChange={event => setEditStatus(event.target.value)}><option value="pendiente">Pendiente</option><option value="enviado">Enviado</option><option value="observado">Observado</option><option value="aprobado">Aprobado</option></select> : <span className={`guideline-status guideline-status--${row.status.toLowerCase().replace(/[^a-z0-9]/g, '')}`}>{row.status || 'pendiente'}</span>}</td>
                    {canManage && <td className="guideline-table__actions">{!isEditing && <button type="button" onClick={() => startEdit(row)} disabled={Boolean(editingId)}><Pencil size={14}/> Editar</button>}</td>}
                  </tr>
                  {isEditing && canManage && (
                    <tr className="inline-edit-action-row">
                      <td colSpan={6} className="inline-edit-bar-cell">
                        <div className="inline-edit-bar">
                          <span>Edición activa</span>
                          <div>
                            <button className="inline-cancel" type="button" onClick={cancelEdit} disabled={saving}><X size={14}/> Cancelar</button>
                            <button className="inline-save" type="button" onClick={() => void saveEdit()} disabled={saving || !editText.trim()}><Save size={14}/> {saving ? 'Guardando…' : 'Guardar'}</button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      {deleteConfirmOpen && (
        <div className="delete-guidelines-backdrop" role="presentation" onMouseDown={event => { if (event.currentTarget === event.target && !deletingAll) setDeleteConfirmOpen(false) }}>
          <div className="delete-guidelines-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-all-guidelines-title">
            <button type="button" className="delete-guidelines-close" onClick={() => setDeleteConfirmOpen(false)} disabled={deletingAll} aria-label="Cerrar"><X size={18}/></button>
            <span className="delete-guidelines-icon"><Trash2 size={22}/></span>
            <h3 id="delete-all-guidelines-title">¿Eliminar todos los lineamientos?</h3>
            <p>Se eliminarán los <strong>{guidelines.length}</strong> lineamientos que ves en esta unidad y periodo. Esta acción no se puede deshacer.</p>
            <div className="delete-guidelines-actions">
              <button type="button" className="delete-guidelines-cancel" onClick={() => setDeleteConfirmOpen(false)} disabled={deletingAll}>Cancelar</button>
              <button type="button" className="delete-guidelines-confirm" onClick={() => void deleteAllGuidelines()} disabled={deletingAll}>
                <Trash2 size={15}/> {deletingAll ? 'Eliminando…' : 'Sí, eliminar todos'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
