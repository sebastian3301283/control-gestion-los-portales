import { createPortal } from 'react-dom'
import { useEffect, useState, type RefObject } from 'react'
import { supabase } from './lib/supabase'
import './unit-plan-leadership-header.css'

type UnitCode = 'HU' | 'DEP' | 'VS' | 'HOT' | 'CENTRAL'
type PrincipalResponsibleLabel = { label: string; sort_order: number }
type Props = {
  hostRef: RefObject<HTMLDivElement | null>
  matrixId: string
  unitCode: UnitCode
  unitName: string
  onError: (message: string) => void
}

export const UNIT_MANAGER_NAMES: Record<Exclude<UnitCode, 'CENTRAL'>, string> = {
  HU: 'J.P. Le Bienvenu V.',
  VS: 'Juan Carlos Campana',
  HOT: 'Lucienne Freundt',
  DEP: 'Diego Abarca',
}

export default function UnitPlanLeadershipHeader({ hostRef, matrixId, unitCode, unitName, onError }: Props) {
  const [target, setTarget] = useState<HTMLElement | null>(null)
  const [responsibleLabels, setResponsibleLabels] = useState<string[]>([])

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
    setResponsibleLabels([])
    if (!supabase || unitCode === 'CENTRAL' || !matrixId) return
    let cancelled = false
    void (async () => {
      const matrixResult = await supabase.from('matrices').select('guideline_id').eq('id', matrixId).maybeSingle()
      if (cancelled) return
      if (matrixResult.error) {
        onError('No pudimos identificar el lineamiento de esta matriz.')
        return
      }
      const guidelineId = String(matrixResult.data?.guideline_id || '')
      if (!guidelineId) return
      const labelResult = await supabase.from('planning_guideline_principal_responsible_labels')
        .select('label,sort_order')
        .eq('guideline_id', guidelineId)
        .order('sort_order')
      if (cancelled) return
      if (labelResult.error) {
        onError('No pudimos cargar los Gerentes Responsables.')
        return
      }
      setResponsibleLabels(((labelResult.data || []) as PrincipalResponsibleLabel[]).map(item => item.label).filter(Boolean))
    })()
    return () => { cancelled = true }
  }, [matrixId, unitCode, onError])

  if (unitCode === 'CENTRAL' || !matrixId || !target) return null

  return createPortal(
    <div className="matrix-unit-leadership-grid" data-unit-code={unitCode}>
      <div><b>Unidad</b><span>{unitName}</span></div>
      <div><b>Gerente de Unidad</b><span>{UNIT_MANAGER_NAMES[unitCode]}</span></div>
      <div className="matrix-unit-principal-responsibles">
        <b>Gerente Responsable</b>
        <span className="matrix-unit-principal-readonly">{responsibleLabels.length ? responsibleLabels.join(' / ') : 'Sin asignar'}</span>
      </div>
    </div>,
    target,
  )
}
