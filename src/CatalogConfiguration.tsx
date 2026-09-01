import { useEffect } from 'react'
import CatalogConfigurationLegacy from './CatalogConfigurationLegacy'
import GuidelineCatalog from './GuidelineCatalog'
import PeriodCatalog from './PeriodCatalog'

type Unit = { code: string; name: string }
type Props = { units?: Unit[]; canManage: boolean }

export default function CatalogConfiguration(props: Props) {
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      document.querySelectorAll<HTMLButtonElement>('.config-accordion.open > .config-accordion-head').forEach(button => button.click())
    })
    return () => window.cancelAnimationFrame(frame)
  }, [])

  return <div style={{ display: 'grid', gap: 16 }}>
    <PeriodCatalog canManage={props.canManage} />
    <CatalogConfigurationLegacy {...props} />
    <GuidelineCatalog {...props} />
  </div>
}
