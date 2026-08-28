import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { Bold, Italic, Pencil, Type, Underline as UnderlineIcon } from 'lucide-react'
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

type Props = {
  guidelines: GuidelineRow[]
  unitCode: UnitCode
  canManage: boolean
  onChanged: () => void | Promise<void>
  onError: (message: string) => void
  onNotice: (message: string) => void
}

const fonts = ['Arial', 'Calibri', 'Verdana', 'Georgia', 'Times New Roman']

function cleanRichHtml(html: string) {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const allowed = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'FONT', 'BR', 'DIV', 'P'])

  Array.from(doc.body.querySelectorAll('*')).forEach(element => {
    if (!allowed.has(element.tagName)) {
      element.replaceWith(...Array.from(element.childNodes))
      return
    }

    Array.from(element.attributes).forEach(attribute => {
      if (element.tagName === 'FONT' && attribute.name.toLowerCase() === 'face' && fonts.includes(attribute.value)) return
      element.removeAttribute(attribute.name)
    })
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
        <button type="button" title="Negrita" onMouseDown={event => { event.preventDefault(); rememberSelection() }} onClick={() => command('bold')}><Bold size={14}/></button>
        <button type="button" title="Cursiva" onMouseDown={event => { event.preventDefault(); rememberSelection() }} onClick={() => command('italic')}><Italic size={14}/></button>
        <button type="button" title="Subrayado" onMouseDown={event => { event.preventDefault(); rememberSelection() }} onClick={() => command('underline')}><UnderlineIcon size={14}/></button>
        <label title="Tipo de letra" onMouseDown={rememberSelection}><Type size={14}/><select defaultValue="Arial" onFocus={rememberSelection} onChange={event => command('fontName', event.target.value)}>{fonts.map(font => <option key={font} value={font}>{font}</option>)}</select></label>
        <span className="rich-cell-hint">Selecciona solo las palabras que quieras cambiar</span>
      </div>
      <div
        ref={editorRef}
        className="rich-cell-surface"
        contentEditable
        suppressContentEditableWarning
        onInput={sync}
        onMouseUp={rememberSelection}
        onKeyUp={rememberSelection}
        onFocus={rememberSelection}
        onBlur={sync}
      />
    </div>
  )
}

export default function GuidelineGrid({ guidelines, unitCode, canManage, onChanged, onError, onNotice }: Props) {
  const [richById, setRichById] = useState<Record<string, string | null>>({})
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editHtml, setEditHtml] = useState('')
  const [editText, setEditText] = useState('')
  const [editManagement, setEditManagement] = useState('')
  const [editManager, setEditManager] = useState('')
  const [editStatus, setEditStatus] = useState('pendiente')
  const [saving, setSaving] = useState(false)

  const managementOptions = useMemo(() => Array.from(new Set(guidelines.map(row => row.responsible_management?.trim()).filter((value): value is string => Boolean(value)))).sort(), [guidelines])
  const managerOptions = useMemo(() => Array.from(new Set(guidelines.map(row => row.responsible_manager?.trim()).filter((value): value is string => Boolean(value)))).sort(), [guidelines])

  useEffect(() => {
    if (!supabase || guidelines.length === 0) return
    void (async () => {
      const { data } = await supabase.from('guidelines').select('id, title_html').in('id', guidelines.map(row => row.id))
      const next: Record<string, string | null> = {}
      ;(data || []).forEach(row => { next[row.id] = row.title_html ? cleanRichHtml(String(row.title_html)) : null })
      setRichById(next)
    })()
  }, [guidelines])

  function startEdit(row: GuidelineRow) {
    setEditingId(row.id)
    setEditHtml(richById[row.id] || row.title)
    setEditText(row.title)
    setEditManagement(row.responsible_management || '')
    setEditManager(row.responsible_manager || '')
    setEditStatus(row.status || 'pendiente')
    onError('')
    onNotice('')
  }

  function cancelEdit() {
    setEditingId(null)
    setEditHtml('')
    setEditText('')
    setEditManagement('')
    setEditManager('')
    setEditStatus('pendiente')
  }

  async function saveEdit() {
    if (!supabase || !editingId || !editText.trim()) return
    setSaving(true)
    onError('')
    onNotice('')

    const safeHtml = cleanRichHtml(editHtml)
    const { error } = await supabase.from('guidelines').update({
      title: editText.trim(),
      title_html: safeHtml || null,
      responsible_management: editManagement || null,
      responsible_manager: editManager || null,
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

  return (
    <div className={`guideline-grid-theme guideline-grid-theme--${unitCode.toLowerCase()}`}>
      <div className="guideline-table-wrap guideline-table-wrap--rich">
        <table className="guideline-table guideline-table--rich">
          <thead><tr><th>N°</th><th>Lineamientos Estratégicos</th><th>Gerencia Responsable</th><th>Gerente Responsable</th><th>Estatus</th>{canManage && <th>Acciones</th>}</tr></thead>
          <tbody>
            {guidelines.map((row, index) => {
              const isEditing = editingId === row.id
              const columnCount = canManage ? 6 : 5
              return (
                <Fragment key={row.id}>
                  <tr className={isEditing ? 'guideline-row--editing' : ''}>
                    <td className="guideline-table__number">{index + 1}</td>
                    <td className="guideline-table__title">{isEditing ? <RichTextCell initialHtml={richById[row.id] || null} initialText={row.title} onChange={(html, text) => { setEditHtml(html); setEditText(text) }} /> : richById[row.id] ? <div className="guideline-rich-display" dangerouslySetInnerHTML={{ __html: richById[row.id] || '' }} /> : row.title}</td>
                    <td>{isEditing ? <select className="guideline-cell-input guideline-cell-select" value={editManagement} onChange={event => setEditManagement(event.target.value)}><option value="">Seleccionar gerencia</option>{editManagement && !managementOptions.includes(editManagement) && <option value={editManagement}>{editManagement}</option>}{managementOptions.map(value => <option key={value} value={value}>{value}</option>)}</select> : (row.responsible_management || '—')}</td>
                    <td>{isEditing ? <select className="guideline-cell-input guideline-cell-select" value={editManager} onChange={event => setEditManager(event.target.value)}><option value="">Seleccionar gerente</option>{editManager && !managerOptions.includes(editManager) && <option value={editManager}>{editManager}</option>}{managerOptions.map(value => <option key={value} value={value}>{value}</option>)}</select> : (row.responsible_manager || '—')}</td>
                    <td>{isEditing ? <select className="guideline-cell-input guideline-cell-select" value={editStatus} onChange={event => setEditStatus(event.target.value)}><option value="pendiente">Pendiente</option><option value="enviado">Enviado</option><option value="observado">Observado</option><option value="aprobado">Aprobado</option></select> : <span className={`guideline-status guideline-status--${row.status.toLowerCase().replace(/[^a-z0-9]/g, '')}`}>{row.status || 'pendiente'}</span>}</td>
                    {canManage && <td className="guideline-table__actions">{isEditing ? <span className="editing-label">Editando</span> : <button type="button" onClick={() => startEdit(row)} disabled={Boolean(editingId)}><Pencil size={14}/> Editar</button>}</td>}
                  </tr>
                  {isEditing && (
                    <tr className="guideline-edit-footer-row">
                      <td colSpan={columnCount}>
                        <div className="guideline-edit-footer">
                          <span>Termina de editar y guarda los cambios.</span>
                          <div className="inline-edit-actions">
                            <button className="inline-cancel" type="button" onClick={cancelEdit} disabled={saving}>Cancelar</button>
                            <button className="inline-save" type="button" onClick={() => void saveEdit()} disabled={saving || !editText.trim()}>{saving ? 'Guardando…' : 'Guardar cambios'}</button>
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
    </div>
  )
}
