import { AlertTriangle } from 'lucide-react'
import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import GuidelineCatalogV2 from './GuidelineCatalogV2'
import './planning-guidelines.css'

type Unit = { code: string; name: string }
type Props = {
  unit: Unit
  periodId: string
  canManage: boolean
}
type PendingDelete = {
  button: HTMLButtonElement
  text: string
}

export default function PlanningGuidelines({ unit, periodId, canManage }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const bypassDeleteRef = useRef(false)
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null)

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

  function handleClickCapture(event: ReactMouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement
    const button = target.closest<HTMLButtonElement>('.guideline-actions .danger')
    if (!button) return

    if (bypassDeleteRef.current) {
      bypassDeleteRef.current = false
      return
    }

    event.preventDefault()
    event.stopPropagation()

    const row = button.closest('tr')
    const text = row?.querySelector<HTMLElement>('.guideline-text-cell')?.textContent?.trim() || 'este lineamiento'
    setPendingDelete({ button, text })
  }

  function confirmDelete() {
    if (!pendingDelete) return
    const button = pendingDelete.button
    setPendingDelete(null)

    const originalConfirm = window.confirm
    try {
      window.confirm = () => true
      bypassDeleteRef.current = true
      button.click()
    } finally {
      window.confirm = originalConfirm
    }
  }

  return <div ref={rootRef} className="planning-guidelines-host" onClickCapture={handleClickCapture}>
    <div className="planning-guidelines-heading">
      <div><span>Lineamientos estratégicos</span><h3>Lineamientos de {unit.name}</h3><p>Periodo activo de planificación. Los lineamientos alimentan directamente las matrices de esta unidad.</p></div>
    </div>
    <GuidelineCatalogV2 units={[unit]} canManage={canManage} />

    {pendingDelete && <div className="planning-delete-backdrop" role="presentation" onMouseDown={event => { if (event.currentTarget === event.target) setPendingDelete(null) }}>
      <section className="planning-delete-dialog" role="dialog" aria-modal="true" aria-labelledby="planning-delete-title">
        <div className="planning-delete-icon"><AlertTriangle size={24}/></div>
        <div className="planning-delete-copy">
          <span>Confirmar eliminación</span>
          <h3 id="planning-delete-title">¿Eliminar este lineamiento?</h3>
          <p>Esta acción eliminará el lineamiento seleccionado de la planificación.</p>
          <div className="planning-delete-preview">{pendingDelete.text}</div>
        </div>
        <div className="planning-delete-actions">
          <button type="button" className="secondary" onClick={() => setPendingDelete(null)}>Cancelar</button>
          <button type="button" className="danger" onClick={confirmDelete}>Sí, eliminar</button>
        </div>
      </section>
    </div>}
  </div>
}
