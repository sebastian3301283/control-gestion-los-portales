import { useEffect, useRef } from 'react'
import CatalogConfigurationLegacy from './CatalogConfigurationLegacy'
import PeriodCatalog from './PeriodCatalog'
import PermissionCatalogV4 from './PermissionCatalogV4'
import GuidelineAreaCatalog from './GuidelineAreaCatalog'
import './configuration-area-filter.css'

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
        const button = section.querySelector<HTMLButtonElement>('.config-accordion-head')
        if (button) {
          closed.add(title)
          button.click()
        }
      })
      if (closed.size === targets.size) observer.disconnect()
    }

    const observer = new MutationObserver(closeLegacyAccordionsOnce)
    observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] })
    closeLegacyAccordionsOnce()

    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    let currentFilter = 'ALL'

    const getMatrixAreaSection = () => [...root.querySelectorAll<HTMLElement>('.config-accordion')]
      .find(section => section.querySelector('h2')?.textContent?.trim() === 'Activar áreas por unidad') || null

    const applyStatusFilter = () => {
      const section = getMatrixAreaSection()
      if (!section) return
      section.querySelectorAll<HTMLElement>('.matrix-area-source-card').forEach(card => {
        const active = Boolean(card.querySelector('.matrix-area-visibility.on'))
        const visible = currentFilter === 'ALL' || (currentFilter === 'ACTIVE' && active) || (currentFilter === 'INACTIVE' && !active)
        card.style.display = visible ? '' : 'none'
      })
    }

    const ensureStatusFilter = () => {
      const section = getMatrixAreaSection()
      const toolbar = section?.querySelector<HTMLElement>('.area-editor-toolbar')
      if (!toolbar) return

      let select = toolbar.querySelector<HTMLSelectElement>('.matrix-area-status-filter')
      if (!select) {
        select = document.createElement('select')
        select.className = 'matrix-area-status-filter'
        select.setAttribute('aria-label', 'Filtrar áreas por estado')
        select.innerHTML = '<option value="ALL">Todas</option><option value="ACTIVE">Activas</option><option value="INACTIVE">No activas</option>'
        select.value = currentFilter
        select.addEventListener('change', () => {
          currentFilter = select?.value || 'ALL'
          applyStatusFilter()
        })
        toolbar.appendChild(select)
      }
      applyStatusFilter()
    }

    const observer = new MutationObserver(ensureStatusFilter)
    observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] })
    ensureStatusFilter()

    return () => observer.disconnect()
  }, [])

  return <div ref={rootRef} className="configuration-catalog-stack" style={{ display: 'grid', gap: 16 }}>
    <PeriodCatalog canManage={props.canManage} />
    <CatalogConfigurationLegacy {...props} />
    <GuidelineAreaCatalog {...props} />
    <PermissionCatalogV4 {...props} />
  </div>
}
