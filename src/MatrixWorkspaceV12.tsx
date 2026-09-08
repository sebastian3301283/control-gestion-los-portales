import { LoaderCircle, RotateCcw, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { createPortal } from 'react-dom'
import MatrixWorkspaceV11 from './MatrixWorkspaceV11'
import { supabase } from './lib/supabase'
import { summarizeMatrixVersionChanges } from './lib/matrix-history-diff.js'
import './matrix-workspace-v12.css'

type UnitCode = 'HU' | 'DEP' | 'VS' | 'HOT' | 'CENTRAL'
type Props = {
  periodId: string
  year: number
  unitCode: UnitCode
  unitName: string
  canManage: boolean
  onError: (message: string) => void
  onNotice: (message: string) => void
  onViewGuidelines?: (target?: { managementId: string; guidelineId: string | null }) => void
  onActiveMatrixChange?: (matrixId: string) => void
}
type HistoryVersion = {
  id: string
  version_no: number
  action: string
  changed_email: string | null
  created_at: string
}
type HistoryChange = { label: string; before: string; after: string }
type HistoryDetail = { loading: boolean; summary: string; changes: HistoryChange[] }
type SummaryRow = {
  key: string
  action: string
  responsible: string
  date: string
  deliverable: string
}

const HISTORY_PAGE_SIZE = 20
const CENTRAL_COLUMN_ORDER = [0, 1, 2, 3, 4, 7, 8, 5, 6]

function text(value: string | null | undefined) {
  return String(value || '').trim() || '—'
}
function normalizeHeader(value: string | null | undefined) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}
function findHeaderIndex(headers: string[], candidates: string[]) {
  return headers.findIndex(header => candidates.some(candidate => header === candidate || header.includes(candidate)))
}
function formatDateTime(value: string) {
  try { return new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) } catch { return value }
}
function historyActionLabel(value: string) {
  if (value === 'BASELINE') return 'Versión inicial'
  if (value === 'ROW_INSERT') return 'Acción agregada'
  if (value === 'ROW_UPDATE') return 'Acción actualizada'
  if (value === 'ROW_DELETE') return 'Acción eliminada'
  if (value === 'SUBPOINT_INSERT') return 'Subobjetivo agregado'
  if (value === 'SUBPOINT_DELETE') return 'Subobjetivo eliminado'
  if (value === 'MATRIX_UPDATE') return 'Matriz actualizada'
  if (value === 'RESTORE') return 'Versión restaurada'
  return String(value || '').replaceAll('_', ' ').toLowerCase()
}
function fallbackName(email: string) {
  const local = email.split('@')[0] || email
  return local.replace(/[._-]+/g, ' ').replace(/\b\w/g, character => character.toUpperCase()) || 'Sistema'
}

export default function MatrixWorkspaceV12(props: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [revision, setRevision] = useState(0)
  const [matrixId, setMatrixId] = useState('')
  const [sheetReady, setSheetReady] = useState(false)
  const [viewMode, setViewMode] = useState<'matrix' | 'summary'>('matrix')
  const [summaryRows, setSummaryRows] = useState<SummaryRow[]>([])
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyLoadingMore, setHistoryLoadingMore] = useState(false)
  const [historyVersions, setHistoryVersions] = useState<HistoryVersion[]>([])
  const [historyHasMore, setHistoryHasMore] = useState(false)
  const [historyNamesByEmail, setHistoryNamesByEmail] = useState<Record<string, string>>({})
  const [historyDetails, setHistoryDetails] = useState<Record<number, HistoryDetail>>({})
  const [expandedHistoryVersionNo, setExpandedHistoryVersionNo] = useState<number | null>(null)
  const [canRestore, setCanRestore] = useState(false)
  const [restoringVersionNo, setRestoringVersionNo] = useState<number | null>(null)

  const handleActiveMatrixChange = useCallback((nextMatrixId: string) => {
    setMatrixId(nextMatrixId)
    props.onActiveMatrixChange?.(nextMatrixId)
  }, [props.onActiveMatrixChange])

  function refreshMatrixSummary() {
    const root = hostRef.current
    if (!root) return
    const sheet = root.querySelector<HTMLTableElement>('.matrix-v5-sheet')
    const ready = Boolean(root.querySelector('.matrix-v5-plan-shell') && sheet)
    setSheetReady(ready)
    if (!ready || !sheet) { setSummaryRows([]); return }

    const headers = Array.from(sheet.querySelectorAll<HTMLTableCellElement>('thead th')).map(cell => normalizeHeader(cell.textContent))
    const actionIndex = findHeaderIndex(headers, ['accion'])
    const responsibleIndex = findHeaderIndex(headers, ['responsable'])
    const dateIndex = findHeaderIndex(headers, ['fechas', 'hitos / fechas', 'hitos'])
    const deliverableIndex = findHeaderIndex(headers, ['entregable'])

    if ([actionIndex, responsibleIndex, dateIndex, deliverableIndex].some(index => index < 0)) {
      setSummaryRows([])
      return
    }

    const nextRows = Array.from(sheet.querySelectorAll<HTMLTableRowElement>('tbody tr[data-matrix-row-id]'))
      .filter(row =>
        !row.classList.contains('matrix-v5-edit-row') &&
        !row.classList.contains('matrix-central-subpoint-row') &&
        !row.classList.contains('matrix-v5-objective-row'))
      .map(row => {
        const cells = Array.from(row.children) as HTMLTableCellElement[]
        return {
          key: row.dataset.matrixRowId || `${cells[actionIndex]?.textContent}-${cells[responsibleIndex]?.textContent}`,
          action: text(cells[actionIndex]?.textContent),
          responsible: text(cells[responsibleIndex]?.textContent),
          date: text(cells[dateIndex]?.textContent),
          deliverable: text(cells[deliverableIndex]?.textContent),
        }
      })
    setSummaryRows(nextRows)
  }

  // Alias kept as a regression-safe bridge for Central-specific callers/tests.
  function refreshCentralSummary() {
    refreshMatrixSummary()
  }

  async function loadHistoryPage(offset: number, append: boolean) {
    if (!supabase || !matrixId) return
    append ? setHistoryLoadingMore(true) : setHistoryLoading(true)
    const { data, error } = await supabase.from('matrix_versions')
      .select('id,version_no,action,changed_email,created_at')
      .eq('matrix_id', matrixId)
      .order('version_no', { ascending: false })
      .range(offset, offset + HISTORY_PAGE_SIZE)

    if (error) {
      append ? setHistoryLoadingMore(false) : setHistoryLoading(false)
      props.onError('No pudimos cargar el historial de la matriz.')
      return
    }

    const fetched = (data || []) as HistoryVersion[]
    const page = fetched.slice(0, HISTORY_PAGE_SIZE)
    const nextVersions = append ? [...historyVersions, ...page] : page
    const emails = [...new Set(nextVersions.map(version => String(version.changed_email || '').trim().toLowerCase()).filter(Boolean))]
    const missingEmails = emails.filter(email => !historyNamesByEmail[email])
    let nextNames = historyNamesByEmail
    if (missingEmails.length) {
      const profiles = await supabase.from('profiles').select('email,full_name').in('email', missingEmails)
      if (!profiles.error) {
        nextNames = { ...historyNamesByEmail }
        ;(profiles.data || []).forEach(profile => {
          const email = String(profile.email || '').trim().toLowerCase()
          const fullName = String(profile.full_name || '').trim()
          if (email && fullName) nextNames[email] = fullName
        })
      }
    }

    setHistoryNamesByEmail(nextNames)
    setHistoryVersions(nextVersions)
    setHistoryHasMore(fetched.length > HISTORY_PAGE_SIZE)
    append ? setHistoryLoadingMore(false) : setHistoryLoading(false)
  }

  async function loadHistoryDetail(version: HistoryVersion) {
    if (!supabase || !matrixId) return
    if (expandedHistoryVersionNo === version.version_no) {
      setExpandedHistoryVersionNo(null)
      return
    }
    setExpandedHistoryVersionNo(version.version_no)
    if (historyDetails[version.version_no]) return

    setHistoryDetails(current => ({ ...current, [version.version_no]: { loading: true, summary: historyActionLabel(version.action), changes: [] } }))
    const wanted = [version.version_no]
    if (version.version_no > 1) wanted.push(version.version_no - 1)
    const snapshotResult = await supabase.from('matrix_versions')
      .select('version_no,snapshot')
      .eq('matrix_id', matrixId)
      .in('version_no', wanted)
    if (snapshotResult.error) {
      setHistoryDetails(current => ({ ...current, [version.version_no]: { loading: false, summary: 'No pudimos cargar el detalle de esta versión.', changes: [] } }))
      return
    }
    const snapshots = snapshotResult.data || []
    const currentSnapshot = snapshots.find(item => Number(item.version_no) === version.version_no)?.snapshot || { rows: [] }
    const previousSnapshot = snapshots.find(item => Number(item.version_no) === version.version_no - 1)?.snapshot || { rows: [] }
    const detail = summarizeMatrixVersionChanges(currentSnapshot, previousSnapshot)
    setHistoryDetails(current => ({ ...current, [version.version_no]: { loading: false, summary: detail.summary, changes: detail.changes } }))
  }

  async function restoreVersion(version: HistoryVersion) {
    if (!supabase || restoringVersionNo !== null) return
    if (hostRef.current?.querySelector('.matrix-collab-user')) {
      props.onError('Hay una fila en edición. Espera a que termine antes de restaurar una versión.')
      return
    }
    const areaName = hostRef.current?.querySelector<HTMLElement>('.matrix-v5-summary > div:first-child strong')?.textContent?.trim() || ''
    if (!areaName) { props.onError('No pudimos identificar el área de esta matriz.'); return }
    if (!window.confirm(`¿Restaurar la versión v${version.version_no}? La matriz actual quedará registrada en el historial y podrás volver a ella después.`)) return

    setRestoringVersionNo(version.version_no)
    props.onError(''); props.onNotice('')
    const { error } = await supabase.rpc('restore_matrix_version_by_context', {
      period_id_input: props.periodId,
      unit_code_input: props.unitCode,
      management_name_input: areaName,
      version_no_input: version.version_no,
    })
    setRestoringVersionNo(null)
    if (error) { props.onError(error.message || 'No pudimos restaurar la versión seleccionada.'); return }

    setHistoryOpen(false)
    setViewMode('matrix')
    props.onNotice(`Versión v${version.version_no} restaurada correctamente.`)
    setRevision(value => value + 1)
  }

  async function openHistory() {
    if (!matrixId) return
    setHistoryOpen(true)
    setHistoryVersions([])
    setHistoryNamesByEmail({})
    setHistoryDetails({})
    setExpandedHistoryVersionNo(null)
    setHistoryHasMore(false)
    props.onError('')
    if (supabase) {
      const permission = await supabase.rpc('is_global_planning_manager')
      setCanRestore(!permission.error && Boolean(permission.data))
    }
    await loadHistoryPage(0, false)
  }

  function enhanceCommonControls() {
    const root = hostRef.current
    if (!root) return

    const historyButton = Array.from(root.querySelectorAll<HTMLButtonElement>('button'))
      .find(button => button.textContent?.trim() === 'Historial' && !button.closest('.matrix-v12-history-dialog'))
    if (historyButton) historyButton.setAttribute('data-matrix-history-trigger', 'true')

    if (props.unitCode !== 'CENTRAL') {
      const toolbar = root.querySelector<HTMLElement>('.matrix-v5-toolbar')
      const toolbarActions = root.querySelector<HTMLElement>('.matrix-v5-toolbar-actions')
      toolbar?.classList.add('matrix-central-commandbar', 'matrix-v12-unit-commandbar')
      toolbarActions?.classList.add('matrix-central-commandbar-primary')

      const addButton = Array.from(root.querySelectorAll<HTMLButtonElement>('button'))
        .find(button => button.textContent?.trim() === 'Nueva fila')
      if (addButton) {
        addButton.setAttribute('data-matrix-add-action', 'true')
        const textNode = Array.from(addButton.childNodes).find(node => node.nodeType === Node.TEXT_NODE && node.textContent?.includes('Nueva fila'))
        if (textNode) textNode.textContent = ' Añadir acción'
        else addButton.setAttribute('aria-label', 'Añadir acción')
      }
    }
  }

  function enhanceCentralTable() {
    const root = hostRef.current
    if (!root || props.unitCode !== 'CENTRAL') return
    const table = root.querySelector<HTMLTableElement>('.matrix-v5-sheet.matrix-central-spreadsheet-grid')
    if (!table) return

    const headerRow = table.querySelector<HTMLTableRowElement>('thead tr')
    if (headerRow && headerRow.children.length === CENTRAL_COLUMN_ORDER.length && headerRow.dataset.centralColumnsOrdered !== 'true') {
      const headerCells = Array.from(headerRow.children) as HTMLTableCellElement[]
      const dateHeader = headerCells[3]
      if (dateHeader) dateHeader.textContent = 'Fechas'
      CENTRAL_COLUMN_ORDER.forEach(index => headerRow.appendChild(headerCells[index]))
      headerRow.dataset.centralColumnsOrdered = 'true'
    }

    table.querySelectorAll<HTMLTableRowElement>('tbody tr').forEach(row => {
      if (row.children.length !== CENTRAL_COLUMN_ORDER.length || row.dataset.centralColumnsOrdered === 'true') return
      const cells = Array.from(row.children) as HTMLTableCellElement[]
      CENTRAL_COLUMN_ORDER.forEach(index => row.appendChild(cells[index]))
      row.dataset.centralColumnsOrdered = 'true'
    })
  }

  function enhanceMatrixExperience() {
    enhanceCommonControls()
    enhanceCentralTable()
    refreshMatrixSummary()
  }

  function handleRootClickCapture(event: ReactMouseEvent<HTMLDivElement>) {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button')
    if (!button || button.closest('.matrix-v12-history-dialog')) return
    const isHistoryTrigger = button.matches('[data-matrix-history-trigger]') || button.textContent?.trim() === 'Historial'
    if (!isHistoryTrigger) return
    event.preventDefault()
    event.stopPropagation()
    void openHistory()
  }

  useEffect(() => {
    setViewMode('matrix')
    setHistoryOpen(false)
    setHistoryVersions([])
    setHistoryDetails({})
  }, [matrixId])

  useEffect(() => {
    const root = hostRef.current
    if (!root) return
    const observer = new MutationObserver(() => enhanceMatrixExperience())
    observer.observe(root, { childList: true, subtree: true })
    enhanceMatrixExperience()
    return () => observer.disconnect()
  }, [revision, props.unitCode])

  const historyGroups = useMemo(() => {
    const groups: Array<{ key: string; name: string; versions: HistoryVersion[] }> = []
    const byKey = new Map<string, { key: string; name: string; versions: HistoryVersion[] }>()
    historyVersions.forEach(version => {
      const email = String(version.changed_email || '').trim().toLowerCase()
      const key = email || '__system__'
      let group = byKey.get(key)
      if (!group) {
        group = { key, name: email ? (historyNamesByEmail[email] || fallbackName(email)) : 'Sistema', versions: [] }
        byKey.set(key, group)
        groups.push(group)
      }
      group.versions.push(version)
    })
    return groups
  }, [historyNamesByEmail, historyVersions])

  const historyLayer = historyOpen ? <div className="matrix-v10-history-backdrop matrix-v12-history-portal" role="presentation" onMouseDown={event => { if (event.currentTarget === event.target) setHistoryOpen(false) }}>
    <section className="matrix-v10-history-dialog matrix-v12-history-dialog" role="dialog" aria-modal="true">
      <header><div><span>Historial de versiones</span><h3>{props.unitName} · {props.year}</h3><small>Resumen por persona y guardado. Expande una versión para ver únicamente los cambios relevantes.</small></div><button type="button" onClick={() => setHistoryOpen(false)}><X size={18}/></button></header>
      {historyLoading ? <div className="matrix-v10-history-loading"><LoaderCircle className="spin" size={20}/> Cargando historial...</div> : historyGroups.length === 0 ? <div className="matrix-v10-history-empty">Todavía no hay versiones registradas.</div> : <div className="matrix-v10-history-list matrix-v12-history-list">{historyGroups.map(group => <section className="matrix-v12-history-person" key={group.key}><strong className="matrix-v12-history-person-name">{group.name}</strong>{group.versions.map(version => {
        const globalIndex = historyVersions.findIndex(item => item.id === version.id)
        const expanded = expandedHistoryVersionNo === version.version_no
        const detail = historyDetails[version.version_no]
        return <article className={`matrix-v12-history-version ${expanded ? 'expanded' : ''}`} key={version.id}>
          <button type="button" className="matrix-v12-history-version-main" onClick={() => void loadHistoryDetail(version)} aria-expanded={expanded}>
            <span className="matrix-v10-version-number">v{version.version_no}</span>
            <span className="matrix-v12-history-version-copy"><strong>{detail?.summary || historyActionLabel(version.action)}</strong><small>{formatDateTime(version.created_at)}</small></span>
            <span className="matrix-v12-history-expand">{expanded ? 'Ocultar detalle' : 'Ver detalle'}</span>
          </button>
          {expanded && <div className="matrix-v12-history-detail">{detail?.loading ? <div className="matrix-v12-history-detail-loading"><LoaderCircle className="spin" size={16}/> Preparando cambios...</div> : <>{detail && <strong className="matrix-v12-history-detail-summary">{detail.summary}</strong>}{detail?.changes.length ? <div className="matrix-v12-history-diff"><div className="matrix-v12-history-diff-head"><span>Campo</span><span>Anterior</span><span>Nuevo</span></div>{detail.changes.map((change, index) => <div className="matrix-v12-history-diff-row" key={`${version.id}-${change.label}-${index}`}><strong>{change.label}</strong><span>{change.before}</span><span>{change.after}</span></div>)}</div> : <small className="matrix-v12-history-no-diff">No hay diferencias de contenido que mostrar para esta versión.</small>}</>}</div>}
          {canRestore && globalIndex > 0 && <div className="matrix-v12-history-actions"><button type="button" onClick={() => void restoreVersion(version)} disabled={restoringVersionNo !== null}>{restoringVersionNo === version.version_no ? <><LoaderCircle className="spin" size={13}/> Restaurando...</> : <><RotateCcw size={13}/> Restaurar esta versión</>}</button></div>}
        </article>
      })}</section>)}</div>}
      {historyHasMore && <footer className="matrix-v12-history-footer"><button type="button" onClick={() => void loadHistoryPage(historyVersions.length, true)} disabled={historyLoadingMore}>{historyLoadingMore && <LoaderCircle className="spin" size={13}/>} Cargar más</button></footer>}
    </section>
  </div> : null

  return <div ref={hostRef} className="matrix-v12-host" onClickCapture={handleRootClickCapture}>
    {sheetReady && <div className="matrix-v12-view-toggle" role="group" aria-label="Vista de matriz">
      <button type="button" className={viewMode === 'matrix' ? 'active' : ''} onClick={() => setViewMode('matrix')}>Matriz</button>
      <button type="button" className={viewMode === 'summary' ? 'active' : ''} onClick={() => { refreshMatrixSummary(); setViewMode('summary') }}>Resumen</button>
    </div>}

    {sheetReady && viewMode === 'summary' && <section className="matrix-v12-summary" aria-label="Vista Resumen">
      <header><div><span>Vista Resumen</span><h3>Plan de acción {props.year}</h3></div><small>{summaryRows.length} acción{summaryRows.length === 1 ? '' : 'es'}</small></header>
      <div className="matrix-v12-summary-scroll"><table className="matrix-v12-summary-table"><thead><tr><th>Acción</th><th>Responsable</th><th>Fecha</th><th>Entregable</th></tr></thead><tbody>
        {summaryRows.length ? summaryRows.map(row => <tr key={row.key}><td>{row.action}</td><td>{row.responsible}</td><td>{row.date}</td><td>{row.deliverable}</td></tr>) : <tr><td colSpan={4}>Todavía no hay acciones para resumir.</td></tr>}
      </tbody></table></div>
    </section>}

    <div className={`matrix-v12-matrix-layer ${viewMode === 'summary' ? 'matrix-v12-matrix-layer--hidden' : ''}`}>
      <MatrixWorkspaceV11 key={revision} {...props} onActiveMatrixChange={handleActiveMatrixChange} />
    </div>

    {historyLayer && createPortal(historyLayer, document.body)}
  </div>
}
