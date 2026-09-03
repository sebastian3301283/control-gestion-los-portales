import { useEffect, useRef } from 'react'
import MatrixWorkspaceV11 from './MatrixWorkspaceV11'
import { supabase } from './lib/supabase'
import './matrix-workspace-v6.css'
import './matrix-workspace-v9.css'
import './matrix-workspace-v10.css'
import './matrix-workspace-v11.css'

type UnitCode = 'HU' | 'DEP' | 'VS' | 'HOT' | 'CENTRAL'
type Props = {
  periodId: string
  year: number
  unitCode: UnitCode
  unitName: string
  canManage: boolean
  onError: (message: string) => void
  onNotice: (message: string) => void
  onViewGuidelines?: () => void
}
type MatrixTarget = {
  periodId: string
  unitCode: string
  managementId: string
  createdAt: number
}

export default function MatrixWorkspace(props: Props) {
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!supabase) return
    let target: MatrixTarget | null = null
    try {
      const raw = sessionStorage.getItem('cg:matrix-target-management')
      if (raw) target = JSON.parse(raw) as MatrixTarget
    } catch {
      sessionStorage.removeItem('cg:matrix-target-management')
    }

    if (!target || target.periodId !== props.periodId || target.unitCode !== props.unitCode || Date.now() - target.createdAt > 30000) return

    let stopped = false
    let observer: MutationObserver | null = null
    let timeout = 0

    void (async () => {
      const { data, error } = await supabase.from('managements_global').select('name').eq('id', target!.managementId).maybeSingle()
      if (stopped || error || !data?.name) return
      const targetName = String(data.name).trim().toLocaleLowerCase('es')

      const tryOpen = () => {
        const root = hostRef.current
        if (!root) return false
        const cards = Array.from(root.querySelectorAll<HTMLButtonElement>('.matrix-v5-area-card'))
        const card = cards.find(item => item.querySelector('strong')?.textContent?.trim().toLocaleLowerCase('es') === targetName)
        if (!card) return false
        sessionStorage.removeItem('cg:matrix-target-management')
        card.click()
        return true
      }

      if (tryOpen()) return
      const root = hostRef.current
      if (!root) return
      observer = new MutationObserver(() => {
        if (tryOpen()) observer?.disconnect()
      })
      observer.observe(root, { childList: true, subtree: true })
      timeout = window.setTimeout(() => observer?.disconnect(), 7000)
    })()

    return () => {
      stopped = true
      observer?.disconnect()
      if (timeout) window.clearTimeout(timeout)
    }
  }, [props.periodId, props.unitCode])

  return <div ref={hostRef}><MatrixWorkspaceV11 {...props}/></div>
}
