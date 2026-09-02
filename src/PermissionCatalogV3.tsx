import { useEffect, useRef } from 'react'
import PermissionCatalogV2 from './PermissionCatalogV2'
import './permission-catalog-v3.css'

type Unit = { code: string; name: string }
type Props = { units?: Unit[]; canManage: boolean }

export default function PermissionCatalogV3(props: Props) {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    let frame = 0

    const enhance = () => {
      frame = 0
      const section = root.querySelector<HTMLElement>('.permission-v2')
      if (!section) return

      const eyebrow = section.querySelector<HTMLElement>('.config-accordion-head small')
      const title = section.querySelector<HTMLElement>('.config-accordion-head h2')
      const description = section.querySelector<HTMLElement>('.config-accordion-head p')

      if (eyebrow && eyebrow.textContent !== 'SEGURIDAD Y ACCESO') eyebrow.textContent = 'SEGURIDAD Y ACCESO'
      if (title && title.textContent !== 'Panel de Control de Permisos por Rol y Área') title.textContent = 'Panel de Control de Permisos por Rol y Área'
      if (description && description.textContent !== 'Asignación individual y masiva de accesos por usuario, unidad y área.') {
        description.textContent = 'Asignación individual y masiva de accesos por usuario, unidad y área.'
      }

      const toolbar = section.querySelector<HTMLElement>('.permission-v2-toolbar')
      if (toolbar && !section.querySelector('.permission-v3-toolbar-label')) {
        const label = document.createElement('div')
        label.className = 'permission-v3-toolbar-label'
        label.innerHTML = '<strong>Asignación masiva</strong><span>Selecciona usuarios y aplica permisos a un área.</span>'
        toolbar.before(label)
      }

      const context = section.querySelector<HTMLElement>('.permission-v2-context')
      if (context && !context.querySelector('.permission-v3-selection-chip')) {
        const chip = document.createElement('div')
        chip.className = 'permission-v3-selection-chip'
        chip.innerHTML = '<strong>Área objetivo</strong><span>Usa los filtros superiores para cambiarla.</span>'
        context.prepend(chip)
      }
    }

    const scheduleEnhance = () => {
      if (frame) return
      frame = window.requestAnimationFrame(enhance)
    }

    const observer = new MutationObserver(scheduleEnhance)
    observer.observe(root, { childList: true, subtree: true })
    scheduleEnhance()

    return () => {
      observer.disconnect()
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [])

  return <div ref={rootRef} className="permission-v3-host"><PermissionCatalogV2 {...props} /></div>
}
