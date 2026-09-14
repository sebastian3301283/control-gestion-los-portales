import { createPortal } from 'react-dom'
import { useEffect, useMemo, useState, type RefObject } from 'react'
import { supabase } from './lib/supabase'
import { filterGerenteManagers } from './unit-excel-model.js'
import './unit-plan-leadership-header.css'

type UnitCode = 'HU' | 'DEP' | 'VS' | 'HOT' | 'CENTRAL'
type Manager = { id: string; name: string; cargo: string | null; unit_code: string; directory_group: string; active?: boolean }
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

export default function UnitPlanLeadershipHeader({ hostRef, matrixId, unitCode, unitName, canManage, onError, onNotice }: Props) {
  const [target, setTarget] = useState<HTMLElement | null>(null)
  const [managers, setManagers] = useState<Manager[]>([])
  const [principalResponsibleId, setPrincipalResponsibleId] = useState('')
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
    if (!supabase || unitCode === 'CENTRAL' || !matrixId) {
      setManagers([])
      setPrincipalResponsibleId('')
      return
    }
    let cancelled = false
    void (async () => {
      const [matrixResult, managerResult] = await Promise.all([
        supabase.from('matrices').select('principal_responsible_manager_id').eq('id', matrixId).maybeSingle(),
        supabase.from('managers').select('id,name,cargo,unit_code,directory_group,active').eq('active', true).order('name'),
      ])
      if (cancelled) return
      if (!matrixResult.error) setPrincipalResponsibleId(String(matrixResult.data?.principal_responsible_manager_id || ''))
      if (!managerResult.error) setManagers((managerResult.data || []) as Manager[])
    })()
    return () => { cancelled = true }
  }, [matrixId, unitCode])

  const gerenteManagers = useMemo(() => {
    const filtered = filterGerenteManagers(managers) as Manager[]
    const selected = managers.find(manager => manager.id === principalResponsibleId)
    if (selected && !filtered.some(manager => manager.id === selected.id)) return [...filtered, selected].sort((a, b) => a.name.localeCompare(b.name, 'es'))
    return filtered.sort((a, b) => a.name.localeCompare(b.name, 'es'))
  }, [managers, principalResponsibleId])

  const principalResponsibleName = managers.find(manager => manager.id === principalResponsibleId)?.name || 'Sin asignar'

  async function savePrincipalResponsible(managerId: string) {
    if (!supabase || !matrixId || !canManage || saving) return
    const nextId = managerId || null
    setSaving(true)
    onError('')
    onNotice('')
    const { error } = await supabase.from('matrices').update({ principal_responsible_manager_id: nextId }).eq('id', matrixId)
    setSaving(false)
    if (error) {
      onError('No pudimos actualizar el Gerente Responsable.')
      return
    }
    setPrincipalResponsibleId(managerId)
    onNotice('Gerente Responsable actualizado.')
  }

  if (unitCode === 'CENTRAL' || !matrixId || !target) return null

  return createPortal(
    <div className="matrix-unit-leadership-grid" data-unit-code={unitCode}>
      <div><b>Unidad</b><span>{unitName}</span></div>
      <div><b>Gerente de Unidad</b><span>{UNIT_MANAGER_NAMES[unitCode]}</span></div>
      <div><b>Gerente Responsable</b>{canManage ? <select aria-label="Gerente Responsable" value={principalResponsibleId} disabled={saving} onChange={event => void savePrincipalResponsible(event.target.value)}><option value="">Sin asignar</option>{gerenteManagers.map(manager => <option key={manager.id} value={manager.id}>{manager.name}</option>)}</select> : <span>{principalResponsibleName}</span>}</div>
    </div>,
    target,
  )
}
