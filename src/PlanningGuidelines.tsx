import { AlertTriangle, ClipboardList, FileImage, FileSpreadsheet, LoaderCircle, Presentation } from 'lucide-react'
import { useEffect, useRef, useState, type ChangeEvent, type MouseEvent as ReactMouseEvent } from 'react'
import GuidelineCatalogV2 from './GuidelineCatalogV2'
import GuidelineDocumentImport from './GuidelineDocumentImport'
import GuidelinePptPanel from './GuidelinePptPanel'
import CentralGuidelineWorkspace from './CentralGuidelineWorkspace'
import { supabase } from './lib/supabase'
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

function safeName(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
}

function supportContentType(file: File) {
  const lower = file.name.toLowerCase()
  if (lower.endsWith('.pdf')) return 'application/pdf'
  if (lower.endsWith('.pptx')) return 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  if (lower.endsWith('.ppt')) return 'application/vnd.ms-powerpoint'
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  return file.type || 'application/octet-stream'
}

export default function PlanningGuidelines({ unit, periodId, canManage }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const supportInputRef = useRef<HTMLInputElement>(null)
  const bypassDeleteRef = useRef(false)
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [importMenuOpen, setImportMenuOpen] = useState(false)
  const [supportUploading, setSupportUploading] = useState(false)
  const [catalogRevision, setCatalogRevision] = useState(0)
  const [documentRevision, setDocumentRevision] = useState(0)
  const [importNotice, setImportNotice] = useState('')
  const [fullscreen, setFullscreen] = useState(false)
  const [selectedArea, setSelectedArea] = useState<SelectedArea>(null)
  const isCentral = unit.code === 'CENTRAL'

  useEffect(() => {
    setSelectedArea(null)
    setImportMenuOpen(false)
  }, [periodId, unit.code])

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

  useEffect(() => {
    if (!importMenuOpen) return
    const close = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('.planning-guideline-import-wrap')) setImportMenuOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [importMenuOpen])

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

  function openMatrixForSelectedArea() {
    if (!isCentral || !selectedArea) return
    sessionStorage.setItem('cg:matrix-target-management', JSON.stringify({
      periodId,
      unitCode: unit.code,
      managementId: selectedArea.id,
      createdAt: Date.now(),
    }))
    setFullscreen(false)
    setImportMenuOpen(false)

    const flow = rootRef.current?.closest<HTMLElement>('.planning-flow')
    const backButton = flow?.querySelector<HTMLButtonElement>('.planning-back')
    if (!flow || !backButton) return

    const openMatrixChoice = () => {
      const matrixButton = flow.querySelector<HTMLButtonElement>('.planning-module-choice--matrices')
      if (!matrixButton) return false
      matrixButton.click()
      return true
    }

    const observer = new MutationObserver(() => {
      if (openMatrixChoice()) observer.disconnect()
    })
    observer.observe(flow, { childList: true, subtree: true })
    backButton.click()
    window.setTimeout(() => {
      if (openMatrixChoice()) observer.disconnect()
    }, 80)
    window.setTimeout(() => observer.disconnect(), 2500)
  }

  async function uploadSupportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    setImportMenuOpen(false)
    if (!file || !supabase || !canManage) return
    if (!selectedArea) {
      setImportNotice('Selecciona primero un área de Central para guardar el PowerPoint o la imagen.')
      return
    }
    if (!/\.(pptx?|pdf|png|jpe?g|webp)$/i.test(file.name)) {
      setImportNotice('Formato no permitido. Usa PowerPoint, PDF, PNG, JPG, JPEG o WEBP.')
      return
    }
    if (file.size > 50 * 1024 * 1024) {
      setImportNotice('El archivo supera 50 MB.')
      return
    }

    setSupportUploading(true)
    setImportNotice('')
    const folder = `${unit.code}/${periodId}/${selectedArea.id}`
    const fallback = /\.(png|jpe?g|webp)$/i.test(file.name) ? 'imagen.png' : 'documento.pptx'
    const name = `${Date.now()}-${safeName(file.name) || fallback}`
    const { error } = await supabase.storage.from('planning-ppts').upload(`${folder}/${name}`, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: supportContentType(file),
    })
    setSupportUploading(false)
    if (error) {
      setImportNotice(`No pudimos guardar el archivo: ${error.message}`)
      return
    }
    setDocumentRevision(value => value + 1)
    setImportNotice(`${file.name} se guardó como documento de soporte de ${selectedArea.name}.`)
  }

  return <div ref={rootRef} className={`planning-guidelines-host ${fullscreen ? 'planning-guidelines-host--fullscreen' : ''} ${isCentral ? 'planning-guidelines-host--central' : ''}`} onClickCapture={handleClickCapture}>
    <div className="planning-guidelines-heading">
      <div><span>Lineamientos estratégicos</span><h3>Lineamientos de {unit.name}</h3><p>{isCentral ? 'Selecciona un área de Central para revisar sus lineamientos y documentos de soporte.' : 'Los lineamientos y documentos de soporte quedan reunidos dentro de la planificación de esta unidad.'}</p></div>
      <div className="planning-guidelines-heading-actions">
        {isCentral && selectedArea && <button className="planning-guideline-matrix-button" type="button" onClick={openMatrixForSelectedArea}><ClipboardList size={17}/> Ir a matriz de {selectedArea.name}</button>}
        {isCentral && <button className="planning-guideline-fullscreen-button" type="button" onClick={() => setFullscreen(value => !value)}><span aria-hidden="true">{fullscreen ? '↙' : '↗'}</span>{fullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}</button>}
        {canManage && (isCentral ? <div className="planning-guideline-import-wrap">
          <button className="planning-guideline-import-button" type="button" onClick={() => setImportMenuOpen(value => !value)} disabled={supportUploading}>{supportUploading ? <LoaderCircle className="spin" size={17}/> : <FileSpreadsheet size={17}/>} Importar Excel / PPT / Imagen</button>
          {importMenuOpen && <div className="planning-guideline-import-menu">
            <button type="button" onClick={() => { setImportMenuOpen(false); setImportNotice(''); setImportOpen(true) }}><FileSpreadsheet size={18}/><span><strong>Excel</strong><small>Importar lineamientos desde XLSX o XLS.</small></span></button>
            <button type="button" onClick={() => supportInputRef.current?.click()} disabled={!selectedArea}><Presentation size={18}/><span><strong>PowerPoint / PDF</strong><small>Guardar como soporte del área seleccionada.</small></span></button>
            <button type="button" onClick={() => supportInputRef.current?.click()} disabled={!selectedArea}><FileImage size={18}/><span><strong>Imagen</strong><small>PNG, JPG, JPEG o WEBP.</small></span></button>
          </div>}
          <input ref={supportInputRef} type="file" accept=".ppt,.pptx,.pdf,.png,.jpg,.jpeg,.webp,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,image/png,image/jpeg,image/webp" hidden onChange={event => void uploadSupportFile(event)} />
        </div> : <button className="planning-guideline-import-button" type="button" onClick={() => { setImportNotice(''); setImportOpen(true) }}><FileSpreadsheet size={17}/> Importar Excel</button>)}
      </div>
    </div>

    {canManage && <div className="planning-guideline-admin-note"><strong>Administración de lineamientos</strong><span>Crear, importar, editar y eliminar lineamientos está disponible únicamente para Gestión Estratégica / Control de Gestión.</span></div>}
    {importNotice && <div className="planning-guideline-import-notice">{importNotice}</div>}

    {isCentral ? <CentralGuidelineWorkspace key={catalogRevision} periodId={periodId} canManage={canManage} onAreaChange={setSelectedArea} /> : <GuidelineCatalogV2 key={catalogRevision} units={[unit]} canManage={canManage} />}

    <GuidelinePptPanel key={`${periodId}-${selectedArea?.id || 'unit'}-${documentRevision}`} unit={unit} periodId={periodId} canManage={canManage} managementId={isCentral ? selectedArea?.id : null} managementName={isCentral ? selectedArea?.name : null} />

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
