import { createPortal } from 'react-dom'
import { useEffect, useState, type KeyboardEvent, type RefObject } from 'react'
import { supabase } from './lib/supabase'
import './unit-plan-leadership-header.css'

type UnitCode = 'HU' | 'DEP' | 'VS' | 'HOT' | 'CENTRAL'
type PrincipalResponsibleLabel = { label: string; sort_order: number }
type Props = {
  hostRef: RefObject<HTMLDivElement | null>
  matrixId: string
  unitCode: UnitCode
  unitName: string
  canManage: boolean
  onError: (message: string) => void
  onNotice: (message: string) => void
}

export const UNIT_MANAGER_NAMES: Record<Exclude<UnitCode, 'CENTRAL'>, string> = {
  HU: 'J.P. Le Bienvenu V.',
  VS: 'Juan Carlos Campana',
  HOT: 'Lucienne Freundt',
  DEP: 'Diego Abarca',
}

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLowerCase()
}

function splitLabels(value: string) {
  const unique = new Map<string, string>()
  value.split(/[\n;,]+/).map(item => item.replace(/\s+/g, ' ').trim()).filter(Boolean).forEach(label => {
    const key = normalize(label)
    if (!unique.has(key)) unique.set(key, label)
  })
  return [...unique.values()]
}

export default function UnitPlanLeadershipHeader({ hostRef, matrixId, unitCode, unitName, canManage, onError, onNotice }: Props) {
  const [target, setTarget] = useState<HTMLElement | null>(null)
  const [responsibleLabels, setResponsibleLabels] = useState<string[]>([])
  const [responsibleDraft, setResponsibleDraft] = useState('')
  const [editingResponsibles, setEditingResponsibles] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (unitCode === 'CENTRAL') { setTarget(null); return }
    const root = hostRef.current
    if (!root) return
    let currentTarget: HTMLElement | null = null
    const syncTarget = () => {
      const next = root.querySelector<HTMLElement>('.matrix-unit-plan-header')
      if (next === currentTarget) return
      currentTarget?.classList.remove('matrix-unit-plan-header--leadership')
      currentTarget = next
      currentTarget?.classList.add('matrix-unit-plan-header--leadership')
      setTarget(next)
    }
    const observer = new MutationObserver(syncTarget)
    observer.observe(root, { childList: true, subtree: true })
    syncTarget()
    return () => {
      observer.disconnect()
      currentTarget?.classList.remove('matrix-unit-plan-header--leadership')
    }
  }, [hostRef, unitCode, matrixId])

  useEffect(() => {
    setEditingResponsibles(false)
    setResponsibleDraft('')
    if (!supabase || unitCode === 'CENTRAL' || !matrixId) {
      setResponsibleLabels([])
      return
    }
    let cancelled = false
    void supabase
      .from('matrix_principal_responsible_labels')
      .select('label,sort_order')
      .eq('matrix_id', matrixId)
      .order('sort_order')
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          onError('No pudimos cargar los Gerentes Responsables.')
          return
        }
        setResponsibleLabels(((data || []) as PrincipalResponsibleLabel[]).map(item => item.label).filter(Boolean))
      })
    return () => { cancelled = true }
  }, [matrixId, unitCode, onError])

  async function addResponsibleLabels() {
    if (!supabase || !matrixId || !canManage || saving) return
    const additions = splitLabels(responsibleDraft).filter(label => !responsibleLabels.some(current => normalize(current) === normalize(label)))
    if (!additions.length) {
      setResponsibleDraft('')
      return
    }
    setSaving(true)
    onError('')
    onNotice('')
    const payload = additions.map((label, index) => ({ matrix_id: matrixId, label, sort_order: responsibleLabels.length + index }))
    const { error } = await supabase.from('matrix_principal_responsible_labels').insert(payload)
    setSaving(false)
    if (error) {
      onError('No pudimos agregar el Gerente Responsable.')
      return
    }
    setResponsibleLabels(current => [...current, ...additions])
    setResponsibleDraft('')
    onNotice(additions.length === 1 ? 'Gerente Responsable agregado.' : 'Gerentes Responsables agregados.')
  }

  async function removeResponsibleLabel(label: string) {
    if (!supabase || !matrixId || !canManage || saving) return
    setSaving(true)
    onError('')
    onNotice('')
    const { error } = await supabase.from('matrix_principal_responsible_labels').delete().eq('matrix_id', matrixId).eq('label', label)
    setSaving(false)
    if (error) {
      onError('No pudimos quitar el Gerente Responsable.')
      return
    }
    setResponsibleLabels(current => current.filter(item => item !== label))
    onNotice('Gerente Responsable actualizado.')
  }

  function handleDraftKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    void addResponsibleLabels()
  }

  if (unitCode === 'CENTRAL' || !matrixId || !target) return null

  return createPortal(
    <div className="matrix-unit-leadership-grid" data-unit-code={unitCode}>
      <div><b>Unidad</b><span>{unitName}</span></div>
      <div><b>Gerente de Unidad</b><span>{UNIT_MANAGER_NAMES[unitCode]}</span></div>
      <div className="matrix-unit-principal-responsibles">
        <b>Gerente Responsable</b>
        {canManage ? editingResponsibles ? <div className="matrix-unit-principal-editor">
          <div className="matrix-unit-principal-entry">
            <input aria-label="Agregar Gerente Responsable" value={responsibleDraft} disabled={saving} onChange={event => setResponsibleDraft(event.target.value)} onKeyDown={handleDraftKeyDown} placeholder="Escribe un responsable"/>
            <button type="button" disabled={saving || !responsibleDraft.trim()} onClick={() => void addResponsibleLabels()}>Agregar responsable</button>
          </div>
          <div className="matrix-unit-principal-chips">
            {responsibleLabels.length ? responsibleLabels.map(label => <span key={normalize(label)}>{label}<button type="button" disabled={saving} aria-label={`Quitar ${label}`} onClick={() => void removeResponsibleLabel(label)}>×</button></span>) : <small>Sin asignar</small>}
          </div>
          <div className="matrix-unit-principal-editor-actions"><button type="button" className="done" disabled={saving} onClick={() => { setResponsibleDraft(''); setEditingResponsibles(false) }}>Listo</button></div>
        </div> : <div className="matrix-unit-principal-display">
          <div className="matrix-unit-principal-display-chips">{responsibleLabels.length ? responsibleLabels.map(label => <span key={normalize(label)}>{label}</span>) : <small>Sin asignar</small>}</div>
          <button type="button" className="edit" onClick={() => setEditingResponsibles(true)}>{responsibleLabels.length ? 'Editar' : 'Agregar responsables'}</button>
        </div> : <span className="matrix-unit-principal-readonly">{responsibleLabels.length ? responsibleLabels.join(', ') : 'Sin asignar'}</span>}
      </div>
    </div>,
    target,
  )
}
