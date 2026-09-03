import { AlertTriangle, FileSpreadsheet } from 'lucide-react'
import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import GuidelineCatalogV2 from './GuidelineCatalogV2'
import GuidelineDocumentImport from './GuidelineDocumentImport'
import GuidelinePptPanel from './GuidelinePptPanel'
import CentralGuidelineWorkspace from './CentralGuidelineWorkspace'
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
type SelectedArea = { id: string; name: string } | null

export default function PlanningGuidelines({ unit, periodId, canManage }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const bypassDeleteRef = useRef(false)
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [catalogRevision, setCatalogRevision] = useState(0)
  const [importNotice, setImportNotice] = useState('')
  const [fullscreen, setFullscreen] = useState(false)
  const [selectedArea, setSelectedArea] = useState<SelectedArea>(null)
  const isCentral = unit.code === 'CENTRAL'

  useEffect(() => {
    if (isCentral) return
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
  }, [periodId, catalogRevision, isCentral])

  useEffect(() => {
    if (!fullscreen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setFullscreen(false) }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [fullscreen])

  function handleClickCapture(event: ReactMouseEvent<HTMLDivElement>) {
    if (isCentral) return
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

  return <div ref={rootRef} className={`planning-guidelines-host ${fullscreen ? 'planning-guidelines-host--fullscreen' : ''} ${isCentral ? 'planning-guidelines-host--central' : ''}`} onClickCapture={handleClickCapture}>
    <div className="planning-guidelines-heading">
      <div><span>Lineamientos estratégicos</span><h3>Lineamientos de {unit.name}</h3><p>{isCentral ? 'Selecciona un área de Central para revisar sus lineamientos y documentos de soporte.' : 'Los lineamientos y documentos de soporte quedan reunidos dentro de la planificación de esta unidad.'}</p></div>
      <div className="planning-guidelines-heading-actions">
        {isCentral && <button className="planning-guideline-fullscreen-button" type="button" onClick={() => setFullscreen(value => !value)}><span aria-hidden="true">{fullscreen ? '↙' : '↗'}</span>{fullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}</button>}
        {canManage && <button className="planning-guideline-import-button" type="button" onClick={() => { setImportNotice(''); setImportOpen(true) }}><FileSpreadsheet size={17}/> Importar Excel</button>}
      </div>
    </div>

    {canManage && <div className="planning-guideline-admin-note"><strong>Administración de lineamientos</strong><span>Crear, importar, editar y eliminar lineamientos está disponible únicamente para Gestión Estratégica / Control de Gestión.</span></div>}
    {importNotice && <div className="planning-guideline-import-notice">{importNotice}</div>}

    {isCentral ? <CentralGuidelineWorkspace key={catalogRevision} periodId={periodId} canManage={canManage} onAreaChange={setSelectedArea} /> : <GuidelineCatalogV2 key={catalogRevision} units={[unit]} canManage={canManage} />}

    <GuidelinePptPanel unit={unit} periodId={periodId} canManage={canManage} managementId={isCentral ? selectedArea?.id : null} managementName={isCentral ? selectedArea?.name : null} />

    <GuidelineDocumentImport
      unit={unit}
      periodId={periodId}
      open={importOpen}
      defaultManagementId={isCentral ? selectedArea?.id : null}
      onClose={() => setImportOpen(false)}
      onImported={count => {
        setCatalogRevision(value => value + 1)
        setImportNotice(`${count} lineamiento${count === 1 ? '' : 's'} importado${count === 1 ? '' : 's'} correctamente desde Excel.`)
      }}
    />

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
