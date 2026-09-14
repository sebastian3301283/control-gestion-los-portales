import { AlertTriangle, ClipboardList, Download, FileSpreadsheet } from 'lucide-react'
import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import GuidelineCatalogV2 from './GuidelineCatalogV2'
import GuidelineMultiImport from './GuidelineMultiImport'
import GuidelinePptPanel from './GuidelinePptPanel'
import CentralGuidelineWorkspace from './CentralGuidelineWorkspace'
import { supabase } from './lib/supabase'
import { exportStyledGuidelineWorkbook } from './lib/styled-guideline-export'
import { invalidatePlanningCache, prefetchMatrixWorkspace } from './lib/planning-query-cache'
import { prefetchMatrixTargetRows } from './lib/matrix-target-prefetch'
import './planning-guidelines.css'
import './guideline-unit-layout-overrides.css'

type Unit = { code: string; name: string }
type Props = {
  unit: Unit
  periodId: string
  canManage: boolean
  onOpenMatrixForArea?: (managementId: string, guidelineId?: string | null) => void
}
type PendingDelete = {
  button: HTMLButtonElement
  text: string
}
type AreaOption = { id: string; name: string }
type SelectedArea = AreaOption | null
type SelectedGuideline = { id: string; managementId: string; label: string } | null
type GuidelineTarget = { periodId: string; unitCode: string; managementId: string; guidelineId: string | null; createdAt: number }

function cleanCellText(cell?: Element | null) {
  if (!cell) return ''
  const clone = cell.cloneNode(true) as HTMLElement
  clone.querySelectorAll('button,.guideline-actions,.central-guideline-inline-actions').forEach(node => node.remove())
  return (clone.textContent || '').replace(/\s+/g, ' ').trim()
}

function chipLabels(cell?: Element | null) {
  if (!cell) return [] as string[]
  const chips = Array.from(cell.querySelectorAll<HTMLElement>('.guideline-multi-chip')).map(item => item.textContent?.replace(/\s+/g, ' ').trim() || '').filter(Boolean)
  if (chips.length) return chips
  const text = cleanCellText(cell)
  return text && text !== 'Sin asignar' ? [text] : []
}

function uniqueLabels(values: string[]) {
  const unique = new Map<string, string>()
  values.forEach(value => {
    const cleaned = value.replace(/\s+/g, ' ').trim()
    const key = cleaned.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    if (cleaned && !unique.has(key)) unique.set(key, cleaned)
  })
  return [...unique.values()]
}

export default function PlanningGuidelines({ unit, periodId, canManage, onOpenMatrixForArea }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const bypassDeleteRef = useRef(false)
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [catalogRevision, setCatalogRevision] = useState(0)
  const [importNotice, setImportNotice] = useState('')
  const [fullscreen, setFullscreen] = useState(false)
  const [selectedArea, setSelectedArea] = useState<SelectedArea>(null)
  const [selectedGuideline, setSelectedGuideline] = useState<SelectedGuideline>(null)
  const [guidelineTarget, setGuidelineTarget] = useState<GuidelineTarget | null>(null)
  const [exporting, setExporting] = useState(false)
  const isCentral = unit.code === 'CENTRAL'

  useEffect(() => { setSelectedArea(null); setSelectedGuideline(null) }, [periodId, unit.code])
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('cg:guideline-target')
      const target = raw ? JSON.parse(raw) as GuidelineTarget : null
      if (target && target.periodId === periodId && target.unitCode === unit.code && Date.now() - target.createdAt <= 30000) setGuidelineTarget(target)
      else setGuidelineTarget(null)
    } catch { setGuidelineTarget(null) }
    finally { sessionStorage.removeItem('cg:guideline-target') }
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
    return () => { stopped = true; observer.disconnect() }
  }, [periodId, catalogRevision, isCentral])

  useEffect(() => {
    if (unit.code !== 'HOT' && unit.code !== 'DEP') return
    const root = rootRef.current
    if (!root) return
    const isHotel = unit.code === 'HOT'

    const enhanceUnitTable = () => {
      root.querySelectorAll<HTMLTableElement>('.guideline-v2-table').forEach(table => {
        table.classList.toggle('guideline-v2-table--hot', isHotel)
        table.classList.toggle('guideline-v2-table--dep', !isHotel)
        const headers = Array.from(table.querySelectorAll<HTMLTableCellElement>('thead th'))
        if (headers.length < 5) return

        const setHeader = (index: number, label: string) => {
          if (headers[index] && headers[index].textContent !== label) headers[index].textContent = label
        }

        setHeader(1, 'Categoría')
        setHeader(2, 'Lineamiento')
        if (isHotel) {
          setHeader(3, 'Áreas')
        } else {
          setHeader(3, 'Áreas Matricial')
          setHeader(4, 'Gerencia Central')
          if (headers[3].colSpan !== 1) headers[3].colSpan = 1
        }

        table.querySelectorAll<HTMLTableRowElement>('tbody tr').forEach(row => {
          const cells = Array.from(row.cells)
          if (cells.length < 5 || cells.some(cell => cell.classList.contains('guideline-empty'))) return
          if (!isHotel) return

          const unitAreaCell = cells[3]
          const centralAreaCell = cells[4]
          if (!unitAreaCell || !centralAreaCell) return
          if (unitAreaCell.colSpan !== 1) unitAreaCell.colSpan = 1
          const signature = centralAreaCell.textContent?.trim() || ''
          const currentCopy = unitAreaCell.querySelector<HTMLElement>('.guideline-hot-central-copy')
          if (currentCopy?.dataset.signature === signature) return
          currentCopy?.remove()
          if (!signature || signature === 'Sin asignar') return
          const copy = document.createElement('div')
          copy.className = 'guideline-hot-central-copy'
          copy.dataset.signature = signature
          Array.from(centralAreaCell.childNodes).forEach(node => copy.appendChild(node.cloneNode(true)))
          unitAreaCell.appendChild(copy)
        })
      })
    }

    const observer = new MutationObserver(enhanceUnitTable)
    observer.observe(root, { childList: true, subtree: true, characterData: true })
    enhanceUnitTable()
    return () => observer.disconnect()
  }, [catalogRevision, canManage, periodId, unit.code])

  useEffect(() => {
    if (unit.code !== 'HOT') return
    const root = rootRef.current
    if (!root) return

    const enhanceHotelForm = () => {
      const fields = Array.from(root.querySelectorAll<HTMLElement>('.guideline-modal .guideline-multi-field'))
      if (fields.length < 2) return
      const areasField = fields[0]
      const centralSource = fields[1]
      areasField.classList.add('guideline-hot-areas-field')
      centralSource.classList.add('guideline-hot-central-source')
      const title = areasField.querySelector<HTMLElement>(':scope > span:first-child')
      if (title && title.textContent !== 'Áreas') title.textContent = 'Áreas'
      const help = areasField.querySelector<HTMLElement>(':scope > small')
      if (help && help.textContent !== 'Escribe las áreas manualmente. Puedes agregar varias.') help.textContent = 'Escribe las áreas manualmente. Puedes agregar varias.'
      const centralChips = centralSource.querySelector<HTMLElement>('.guideline-editable-chips')
      centralSource.classList.toggle('guideline-hot-central-source--empty', !centralChips?.children.length)
    }

    const observer = new MutationObserver(enhanceHotelForm)
    observer.observe(root, { childList: true, subtree: true, characterData: true })
    enhanceHotelForm()
    return () => observer.disconnect()
  }, [catalogRevision, unit.code])

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
    const row = target.closest<HTMLTableRowElement>('.guideline-v2-table tbody tr')
    const button = target.closest<HTMLButtonElement>('.guideline-actions .danger')
    if (!button) return
    if (bypassDeleteRef.current) {
      bypassDeleteRef.current = false
      return
    }
    event.preventDefault()
    event.stopPropagation()
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

  useEffect(() => {
    if (!selectedArea) return
    void prefetchMatrixTargetRows(periodId, unit.code, selectedArea.id, null).catch(() => undefined)
  }, [selectedArea, periodId, unit.code])

  function prefetchMatrixForGuideline(managementId: string, guidelineId: string) {
    void prefetchMatrixTargetRows(periodId, unit.code, managementId, guidelineId).catch(() => undefined)
  }

  function openMatrixForSelectedArea() {
    if (!selectedArea) return
    void prefetchMatrixWorkspace(periodId, unit.code).catch(() => undefined)
    void prefetchMatrixTargetRows(periodId, unit.code, selectedArea.id, null).catch(() => undefined)
    setFullscreen(false)
    onOpenMatrixForArea?.(selectedArea.id, null)
  }

  function openMatrixForGuideline(managementId: string, guidelineId: string) {
    void prefetchMatrixWorkspace(periodId, unit.code).catch(() => undefined)
    void prefetchMatrixTargetRows(periodId, unit.code, managementId, guidelineId).catch(() => undefined)
    setFullscreen(false)
    onOpenMatrixForArea?.(managementId, guidelineId)
    sessionStorage.setItem('cg:matrix-target-management', JSON.stringify({
      periodId,
      unitCode: unit.code,
      managementId,
      guidelineId,
      createdAt: Date.now(),
    }))
  }

  async function downloadGuidelines() {
    if (!canManage || !rootRef.current || exporting) return
    setExporting(true)
    setImportNotice('')
    try {
      let year = new Date().getFullYear()
      if (supabase) {
        const { data } = await supabase.from('planning_periods').select('year').eq('id', periodId).maybeSingle()
        const parsedYear = Number(data?.year)
        if (Number.isFinite(parsedYear) && parsedYear > 2000) year = parsedYear
      }

      let headers: string[] = []
      let rows: string[][] = []
      if (isCentral) {
        const table = rootRef.current.querySelector<HTMLTableElement>('.central-guideline-table')
        if (table) {
          headers = ['Categoría', 'N°', 'Lineamiento']
          rows = Array.from(table.querySelectorAll<HTMLTableRowElement>('tbody tr')).filter(row => !row.querySelector('.central-guideline-empty')).map(row => {
            const cells = Array.from(row.cells)
            return [cleanCellText(cells[0]), cleanCellText(cells[1]), cleanCellText(cells[2])]
          })
        }
      } else {
        const table = rootRef.current.querySelector<HTMLTableElement>('.guideline-v2-table')
        if (table) {
          const sourceRows = Array.from(table.querySelectorAll<HTMLTableRowElement>('tbody tr')).filter(row => !row.querySelector('.guideline-empty'))
          if (unit.code === 'HOT') {
            headers = ['N°', 'Categoría', 'Lineamiento', 'Áreas']
            rows = sourceRows.map(row => {
              const cells = Array.from(row.cells)
              const areas = uniqueLabels([...chipLabels(cells[3]), ...chipLabels(cells[4])]).join(', ')
              return [cleanCellText(cells[0]), cleanCellText(cells[1]), cleanCellText(cells[2]), areas]
            })
          } else {
            headers = unit.code === 'DEP'
              ? ['N°', 'Categoría', 'Lineamiento', 'Áreas Matricial', 'Gerencia Central']
              : ['N°', 'Categoría', 'Lineamientos Estratégicos', 'Áreas de Unidad', 'Áreas de Central']
            rows = sourceRows.map(row => {
              const cells = Array.from(row.cells)
              return [cleanCellText(cells[0]), cleanCellText(cells[1]), cleanCellText(cells[2]), chipLabels(cells[3]).join(', '), chipLabels(cells[4]).join(', ')]
            })
          }
        }
      }

      if (!rows.length) {
        setImportNotice(isCentral && !selectedArea ? 'Selecciona un área de Central antes de descargar el Excel.' : 'No hay lineamientos para descargar en esta vista.')
        return
      }

      await exportStyledGuidelineWorkbook({
        year,
        unitCode: unit.code,
        unitName: unit.name,
        areaName: isCentral ? selectedArea?.name : null,
        headers,
        rows,
      })
      setImportNotice(`Excel de lineamientos de ${unit.name} descargado correctamente.`)
    } catch {
      setImportNotice('No pudimos generar el Excel de lineamientos. Inténtalo nuevamente.')
    } finally {
      setExporting(false)
    }
  }

  return <div ref={rootRef} className={`planning-guidelines-host ${fullscreen ? 'planning-guidelines-host--fullscreen' : ''} ${isCentral ? 'planning-guidelines-host--central' : ''} ${unit.code === 'HOT' ? 'planning-guidelines-host--hot' : ''}`} onClickCapture={handleClickCapture}>
    <div className="planning-guidelines-heading">
      <div><span>Lineamientos estratégicos</span><h3>Lineamientos de {unit.name}</h3><p>{isCentral ? 'Selecciona un área de Central para revisar sus lineamientos y documentos de soporte.' : canManage ? 'Selecciona un lineamiento para revisar sus soportes o usa la flecha para abrir su matriz exclusiva.' : 'Selecciona un lineamiento para revisar sus documentos de soporte.'}</p></div>
      <div className="planning-guidelines-heading-actions">
        {isCentral && selectedArea && <button className="planning-guideline-matrix-button" type="button" onClick={openMatrixForSelectedArea}><ClipboardList size={17}/> Ir a matriz de {selectedArea.name}</button>}
        <button className="planning-guideline-fullscreen-button" type="button" onClick={() => setFullscreen(value => !value)}><span aria-hidden="true">{fullscreen ? '↙' : '↗'}</span>{fullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}</button>
        {canManage && <button className="planning-guideline-import-button" type="button" disabled={exporting} onClick={() => void downloadGuidelines()}><Download size={17}/>{exporting ? 'Generando Excel...' : 'Descargar Excel'}</button>}
        {canManage && <button className="planning-guideline-import-button" type="button" onClick={() => { setImportNotice(''); setImportOpen(true) }}><FileSpreadsheet size={17}/> Importar lineamientos</button>}
      </div>
    </div>

    {canManage && <div className="planning-guideline-admin-note"><strong>Administración de lineamientos</strong><span>Puedes importar lineamientos desde Excel, PDF, PowerPoint o imagen; cada lineamiento de HU/DEP/VS/HOT crea automáticamente su propia matriz.</span></div>}
    {importNotice && <div className="planning-guideline-import-notice">{importNotice}</div>}

    {isCentral ? <CentralGuidelineWorkspace key={catalogRevision} periodId={periodId} canManage={canManage} initialAreaId={guidelineTarget?.managementId} focusGuidelineId={guidelineTarget?.guidelineId} onAreaChange={setSelectedArea} /> : <GuidelineCatalogV2 key={catalogRevision} units={[unit]} canManage={canManage} scopePeriodId={periodId} scopeUnitCode={unit.code} selectedGuidelineId={selectedGuideline?.id || guidelineTarget?.guidelineId || null} onSelectGuideline={setSelectedGuideline} onPrefetchMatrixForGuideline={canManage ? prefetchMatrixForGuideline : undefined} onOpenMatrixForGuideline={canManage ? openMatrixForGuideline : undefined} />}

    <GuidelinePptPanel unit={unit} periodId={periodId} canManage={canManage} managementId={isCentral ? selectedArea?.id : null} managementName={isCentral ? selectedArea?.name : null} guidelineId={selectedGuideline?.id || null} guidelineLabel={selectedGuideline?.label || null} />

    <GuidelineMultiImport
      unit={unit}
      periodId={periodId}
      open={importOpen}
      defaultManagementId={isCentral ? selectedArea?.id : null}
      onClose={() => setImportOpen(false)}
      onImported={count => {
        invalidatePlanningCache(`planning-guidelines:${periodId}:${unit.code}`)
        setSelectedGuideline(null)
        setCatalogRevision(value => value + 1)
        setImportNotice(`${count} lineamiento${count === 1 ? '' : 's'} importado${count === 1 ? '' : 's'} correctamente en este periodo.`)
      }}
    />

    {pendingDelete && <div className="planning-delete-backdrop" role="presentation" onMouseDown={event => { if (event.currentTarget === event.target) setPendingDelete(null) }}>
      <section className="planning-delete-dialog" role="dialog" aria-modal="true" aria-labelledby="planning-delete-title">
        <div className="planning-delete-icon"><AlertTriangle size={24}/></div>
        <div className="planning-delete-copy">
          <span>Confirmar eliminación</span>
          <h3 id="planning-delete-title">¿Eliminar este lineamiento?</h3>
          <p>En HU, DEP, VS y HOT también se eliminarán su matriz exclusiva y sus documentos de soporte.</p>
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