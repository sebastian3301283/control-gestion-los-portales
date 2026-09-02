import { useEffect, useRef } from 'react'
import GuidelineCatalogV2 from './GuidelineCatalogV2'
import './planning-guidelines.css'

type Unit = { code: string; name: string }
type Props = {
  unit: Unit
  periodId: string
  canManage: boolean
}

export default function PlanningGuidelines({ unit, periodId, canManage }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    let stopped = false
    let opened = false

    const sync = () => {
      if (stopped) return
      const section = root.querySelector<HTMLElement>('.guideline-config')
      const head = root.querySelector<HTMLButtonElement>('.guideline-config > .config-accordion-head')
      if (section && head && !opened && !section.classList.contains('open')) {
        opened = true
        head.click()
        return
      }

      const periodSelect = root.querySelector<HTMLSelectElement>('.guideline-v2-filters > select:first-child')
      if (periodSelect && periodId && Array.from(periodSelect.options).some(option => option.value === periodId) && periodSelect.value !== periodId) {
        periodSelect.value = periodId
        periodSelect.dispatchEvent(new Event('change', { bubbles: true }))
      }
    }

    const observer = new MutationObserver(sync)
    observer.observe(root, { childList: true, subtree: true })
    sync()

    return () => {
      stopped = true
      observer.disconnect()
    }
  }, [periodId])

  return <div ref={rootRef} className="planning-guidelines-host">
    <div className="planning-guidelines-heading">
      <div><span>Lineamientos estratégicos</span><h3>Lineamientos de {unit.name}</h3><p>Periodo activo de planificación. Los lineamientos alimentan directamente las matrices de esta unidad.</p></div>
    </div>
    <GuidelineCatalogV2 units={[unit]} canManage={canManage} />
  </div>
}
