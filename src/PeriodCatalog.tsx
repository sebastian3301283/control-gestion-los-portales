import { FormEvent, useEffect, useState } from 'react'
import { CalendarDays, Check, ChevronDown, LoaderCircle, Pencil, Plus, Trash2, X } from 'lucide-react'
import { supabase } from './lib/supabase'
import './period-catalog.css'

type Period = { id: string; year: number; name: string; status: 'DRAFT' | 'OPEN' | 'CLOSED' }
type Props = { canManage: boolean }

export default function PeriodCatalog({ canManage }: Props) {
  const [open, setOpen] = useState(false)
  const [periods, setPeriods] = useState<Period[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Period | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Period | null>(null)
  const [year, setYear] = useState('')
  const [status, setStatus] = useState<Period['status']>('DRAFT')

  useEffect(() => { void loadPeriods() }, [])

  async function loadPeriods() {
    if (!supabase) return
    setLoading(true); setError('')
    const { data, error: queryError } = await supabase.from('planning_periods').select('id,year,name,status').order('year')
    setLoading(false)
    if (queryError) { setError('No pudimos cargar los periodos.'); return }
    setPeriods((data || []) as Period[])
  }

  function openNew() {
    const maxYear = periods.length ? Math.max(...periods.map(item => item.year)) + 1 : new Date().getFullYear()
    setEditing(null); setYear(String(maxYear)); setStatus('DRAFT'); setFormOpen(true); setError(''); setNotice('')
  }
  function openEdit(period: Period) {
    setEditing(period); setYear(String(period.year)); setStatus(period.status); setFormOpen(true); setError(''); setNotice('')
  }
  function closeForm() { if (!saving) { setFormOpen(false); setEditing(null) } }

  function requestDelete(period: Period) {
    if (!canManage || period.status === 'OPEN') return
    setDeleteTarget(period); setError(''); setNotice('')
  }

  async function deletePeriod() {
    if (!supabase || !canManage || !deleteTarget || deleteTarget.status === 'OPEN') return
    setDeleting(true); setError(''); setNotice('')
    const target = deleteTarget
    try {
      const { error: deleteError } = await supabase.from('planning_periods').delete().eq('id', target.id)
      if (deleteError) throw deleteError
      setDeleteTarget(null)
      await loadPeriods()
      setNotice(`Periodo ${target.year} eliminado.`)
      window.dispatchEvent(new CustomEvent('planning-periods-changed'))
    } catch {
      setError('No pudimos eliminar el periodo. Verifica que no tenga información asociada.')
    } finally { setDeleting(false) }
  }

  async function savePeriod(event: FormEvent) {
    event.preventDefault()
    if (!supabase || !canManage) return
    const parsedYear = Number(year)
    if (!Number.isInteger(parsedYear) || parsedYear < 2020 || parsedYear > 2100) { setError('Ingresa un año válido.'); return }
    setSaving(true); setError(''); setNotice('')
    try {
      if (status === 'OPEN') {
        const resetQuery = supabase.from('planning_periods').update({ status: 'DRAFT' }).eq('status', 'OPEN')
        if (editing) resetQuery.neq('id', editing.id)
        const { error: resetError } = await resetQuery
        if (resetError) throw resetError
      }
      if (editing) {
        const { error: updateError } = await supabase.from('planning_periods').update({ year: parsedYear, name: `Periodo ${parsedYear}`, status }).eq('id', editing.id)
        if (updateError) throw updateError
      } else {
        const { error: insertError } = await supabase.from('planning_periods').insert({ year: parsedYear, name: `Periodo ${parsedYear}`, status })
        if (insertError) throw insertError
      }
      setFormOpen(false); setEditing(null); await loadPeriods(); setNotice(editing ? `Periodo ${parsedYear} actualizado.` : `Periodo ${parsedYear} creado.`)
      window.dispatchEvent(new CustomEvent('planning-periods-changed'))
    } catch (cause: unknown) {
      const code = cause && typeof cause === 'object' && 'code' in cause ? String(cause.code) : ''
      setError(code === '23505' ? 'Ese periodo ya existe.' : 'No pudimos guardar el periodo.')
    } finally { setSaving(false) }
  }

  return <section className={`period-config config-accordion ${open ? 'open' : ''}`}>
    <button className="config-accordion-head" type="button" onClick={() => setOpen(value => !value)}>
      <span className="config-accordion-icon"><CalendarDays size={21}/></span>
      <div><small>Configuración de planificación</small><h2>Periodos</h2><p>Crea y edita los años de trabajo desde aquí. En Planificación solo se seleccionará el periodo.</p></div>
      <ChevronDown className={open ? 'rotated' : ''} size={20}/>
    </button>

    {open && <div className="config-accordion-body period-config-body">
      {error && <div className="period-message error">{error}</div>}
      {notice && <div className="period-message success"><Check size={14}/>{notice}</div>}
      <div className="period-toolbar"><div><strong>Periodos de trabajo</strong><small>{periods.length} registrados</small></div>{canManage && <button className="period-add" onClick={openNew}><Plus size={15}/> Nuevo periodo</button>}</div>
      {loading ? <div className="period-loading"><LoaderCircle className="spin" size={22}/> Cargando periodos...</div> : <div className="period-table-scroll"><table className="period-table"><thead><tr><th>Periodo</th><th>Estado</th>{canManage && <th>Acciones</th>}</tr></thead><tbody>{periods.length === 0 ? <tr><td colSpan={canManage ? 3 : 2} className="period-empty">No hay periodos registrados.</td></tr> : periods.map(item => <tr key={item.id}><td><strong>{item.year}</strong><small>{item.name}</small></td><td><span className={`period-status ${item.status.toLowerCase()}`}>{item.status === 'OPEN' ? 'Actual' : item.status === 'CLOSED' ? 'Cerrado' : 'Borrador'}</span></td>{canManage && <td><div className="period-row-actions"><button className="period-edit-button" onClick={() => openEdit(item)}><Pencil size={14}/> Editar</button><button className="period-delete-button" onClick={() => requestDelete(item)} disabled={item.status === 'OPEN'} title={item.status === 'OPEN' ? 'El periodo Actual no se puede eliminar' : `Eliminar periodo ${item.year}`}><Trash2 size={14}/> Eliminar</button></div></td>}</tr>)}</tbody></table></div>}
    </div>}

    {formOpen && <div className="period-modal-backdrop" role="presentation" onMouseDown={event => { if (event.currentTarget === event.target) closeForm() }}><div className="period-modal" role="dialog" aria-modal="true"><button className="period-modal-close" onClick={closeForm} disabled={saving}><X size={18}/></button><div className="period-modal-title"><span><CalendarDays size={18}/></span><div><small>{editing ? 'Editar periodo' : 'Nuevo periodo'}</small><h3>{editing ? `Periodo ${editing.year}` : 'Crear periodo'}</h3></div></div><form onSubmit={savePeriod}><label>Año<input inputMode="numeric" maxLength={4} value={year} onChange={event => setYear(event.target.value.replace(/\D/g, '').slice(0,4))} placeholder="2030"/></label><label>Estado<select value={status} onChange={event => setStatus(event.target.value as Period['status'])}><option value="DRAFT">Borrador</option><option value="OPEN">Periodo actual</option><option value="CLOSED">Cerrado</option></select></label><div className="period-modal-actions"><button type="button" onClick={closeForm} disabled={saving}>Cancelar</button><button className="primary" type="submit" disabled={saving || year.length !== 4}>{saving && <LoaderCircle className="spin" size={15}/>} Guardar</button></div></form></div></div>}

    {deleteTarget && <div className="period-modal-backdrop" role="presentation" onMouseDown={event => { if (event.currentTarget === event.target && !deleting) setDeleteTarget(null) }}><div className="period-modal period-delete-confirm" role="dialog" aria-modal="true" aria-labelledby="period-delete-title"><button className="period-modal-close" onClick={() => setDeleteTarget(null)} disabled={deleting}><X size={18}/></button><div className="period-delete-icon"><Trash2 size={20}/></div><h3 id="period-delete-title">¿Eliminar periodo {deleteTarget.year}?</h3><p>Esta acción eliminará el periodo de la configuración. No se puede deshacer.</p><div className="period-modal-actions"><button type="button" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancelar</button><button className="danger" type="button" onClick={() => void deletePeriod()} disabled={deleting}>{deleting && <LoaderCircle className="spin" size={15}/>} Eliminar</button></div></div></div>}
  </section>
}
