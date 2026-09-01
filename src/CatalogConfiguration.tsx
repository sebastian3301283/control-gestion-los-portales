import { useEffect, useRef } from 'react'
import CatalogConfigurationLegacy from './CatalogConfigurationLegacy'
import GuidelineCatalog from './GuidelineCatalog'
import PeriodCatalog from './PeriodCatalog'

type Unit = { code: string; name: string }
type Props = { units?: Unit[]; canManage: boolean }

export default function CatalogConfiguration(props: Props) {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const targets = new Set(['Bonistas', 'Activar áreas por unidad'])
    const closed = new Set<string>()

    const closeLegacyAccordionsOnce = () => {
      root.querySelectorAll<HTMLElement>('.config-accordion.open').forEach(section => {
        const title = section.querySelector('h2')?.textContent?.trim() || ''
        if (!targets.has(title) || closed.has(title)) return
        const button = section.querySelector<HTMLButtonElement>(':scope > .config-accordion-head')
        if (button) {
          closed.add(title)
          button.click()
        }
      })
      if (closed.size === targets.size) observer.disconnect()
    }

    const observer = new MutationObserver(closeLegacyAccordionsOnce)
    observer.observe(root, { childList: true, subtree: true })
    closeLegacyAccordionsOnce()

    return () => observer.disconnect()
  }, [])

  return <div ref={rootRef} style={{ display: 'grid', gap: 16 }}>
    <PeriodCatalog canManage={props.canManage} />
    <CatalogConfigurationLegacy {...props} />
    <GuidelineCatalog {...props} />
  </div>
}
