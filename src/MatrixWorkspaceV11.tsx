import { BookOpenText, Users } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import MatrixWorkspaceV10 from './MatrixWorkspaceV10'
import { supabase } from './lib/supabase'
import './matrix-workspace-v11.css'
import './matrix-collaboration.css'

type UnitCode = 'HU' | 'DEP' | 'VS' | 'HOT' | 'CENTRAL'
type Props = {
  periodId: string
  year: number
  unitCode: UnitCode
  unitName: string
  canManage: boolean
  onError: (message: string) => void
  onNotice: (message: string) => void
  onViewGuidelines?: () => void
}
type RowLock = {
  row_id: string
  matrix_id: string
  user_id: string
  user_email: string
  display_name: string | null
  expires_at: string
}
type LockAttempt = {
  ok: boolean
  owner_user_id: string
  owner_email: string
  owner_name: string
  expires_at: string
}

function initials(value: string) {
  const parts = value.trim().split(/[\s._@-]+/).filter(Boolean)
  return parts.slice(0, 2).map(part => part[0]?.toUpperCase()).join('') || 'U'
}

export default function MatrixWorkspaceV11(props: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const matrixIdRef = useRef('')
  const areaNameRef = useRef('')
  const rowIdsRef = useRef<string[]>([])
  const locksRef = useRef<RowLock[]>([])
  const currentUserIdRef = useRef('')
  const lockedRowIdRef = useRef<string | null>(null)
  const bypassClickRef = useRef(false)
  const [canRestore, setCanRestore] = useState(false)
  const [revision, setRevision] = useState(0)
  const [matrixId, setMatrixId] = useState('')
  const [locks, setLocks] = useState<RowLock[]>([])
  const [expanded, setExpanded] = useState(false)
  const { onViewGuidelines, ...workspaceProps } = props

  const activeEditors = useMemo(() => {
    const unique = new Map<string, { user_id: string; name: string; email: string; rows: number }>()
    locks.forEach(lock => {
      const current = unique.get(lock.user_id)
      const name = lock.display_name?.trim() || lock.user_email
      if (current) current.rows += 1
      else unique.set(lock.user_id, { user_id: lock.user_id, name, email: lock.user_email, rows: 1 })
    })
    return [...unique.values()]
  }, [locks])

  useEffect(() => {
    let active = true
    async function loadIdentityAndRestorePermission() {
      if (!supabase) return
      const [{ data: userData }, { data: restoreData, error: restoreError }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.rpc('is_global_planning_manager'),
      ])
      if (!active) return
      currentUserIdRef.current = userData.user?.id || ''
      setCanRestore(!restoreError && Boolean(restoreData))
    }
    void loadIdentityAndRestorePermission()
    return () => { active = false }
  }, [])

  async function loadRowsAndLocks(nextMatrixId: string) {
    if (!supabase || !nextMatrixId) return
    const now = new Date().toISOString()
    const [rowResult, lockResult] = await Promise.all([
      supabase.from('matrix_rows').select('id').eq('matrix_id', nextMatrixId).order('sort_order').order('created_at'),
      supabase.from('matrix_row_edit_locks').select('row_id,matrix_id,user_id,user_email,display_name,expires_at').eq('matrix_id', nextMatrixId).gt('expires_at', now).order('locked_at'),
    ])
    if (!rowResult.error) rowIdsRef.current = (rowResult.data || []).map(item => String(item.id))
    if (!lockResult.error) {
      const nextLocks = (lockResult.data || []) as RowLock[]
      locksRef.current = nextLocks
      setLocks(nextLocks)
    }
  }

  async function resolveCurrentMatrix() {
    const root = rootRef.current
    if (!root || !supabase) return
    setExpanded(Boolean(root.querySelector('.matrix-v5--expanded')))
    const areaName = root.querySelector<HTMLElement>('.matrix-v5-summary > div:first-child strong')?.textContent?.trim() || ''
    if (!areaName) {
      areaNameRef.current = ''
      matrixIdRef.current = ''
      rowIdsRef.current = []
      locksRef.current = []
      setMatrixId('')
      setLocks([])
      return
    }

    if (areaName === areaNameRef.current && matrixIdRef.current) {
      await loadRowsAndLocks(matrixIdRef.current)
      return
    }

    if (lockedRowIdRef.current) await releaseLock(lockedRowIdRef.current)
    areaNameRef.current = areaName

    const { data: managementData } = await supabase.from('managements_global').select('id').ilike('name', areaName).eq('active', true)
    const managementIds = (managementData || []).map(item => String(item.id))
    if (!managementIds.length) return

    const { data: processData } = await supabase.from('processes').select('id').eq('unit_code', props.unitCode).eq('active', true).in('management_id', managementIds)
    const processIds = (processData || []).map(item => String(item.id))
    if (!processIds.length) return

    const { data: matrixData } = await supabase.from('matrices').select('id').eq('period_id', props.periodId).eq('unit_code', props.unitCode).eq('active', true).in('process_id', processIds).limit(1).maybeSingle()
    const nextMatrixId = matrixData?.id ? String(matrixData.id) : ''
    matrixIdRef.current = nextMatrixId
    setMatrixId(nextMatrixId)
    if (nextMatrixId) await loadRowsAndLocks(nextMatrixId)
  }

  useEffect(() => {
    let stopped = false
    let running = false
    const tick = async () => {
      if (stopped || running) return
      running = true
      try { await resolveCurrentMatrix() } finally { running = false }
    }
    void tick()
    const timer = window.setInterval(() => void tick(), 3000)
    return () => { stopped = true; window.clearInterval(timer) }
  }, [props.periodId, props.unitCode, revision])

  useEffect(() => {
    const timer = window.setInterval(() => {
      const rowId = lockedRowIdRef.current
      if (!rowId || !supabase) return
      void supabase.rpc('heartbeat_matrix_row_lock', { row_id_input: rowId })
    }, 25000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => () => {
    const rowId = lockedRowIdRef.current
    if (rowId && supabase) void supabase.rpc('release_matrix_row_lock', { row_id_input: rowId })
  }, [])

  async function refreshLocks() {
    if (matrixIdRef.current) await loadRowsAndLocks(matrixIdRef.current)
  }

  async function acquireLock(rowId: string) {
    if (!supabase) return false
    const { data, error } = await supabase.rpc('try_lock_matrix_row', { row_id_input: rowId })
    if (error) {
      props.onError('No pudimos reservar esta fila para edición. Inténtalo nuevamente.')
      return false
    }
    const result = data as LockAttempt | null
    if (!result?.ok) {
      const owner = result?.owner_name || result?.owner_email || 'otro usuario'
      props.onError(`${owner} está editando esta fila. Podrás editarla cuando termine.`)
      await refreshLocks()
      return false
    }
    lockedRowIdRef.current = rowId
    props.onError('')
    await refreshLocks()
    return true
  }

  async function releaseLock(rowId: string) {
    if (!supabase || !rowId) return
    await supabase.rpc('release_matrix_row_lock', { row_id_input: rowId })
    if (lockedRowIdRef.current === rowId) lockedRowIdRef.current = null
    await refreshLocks()
  }

  function rowIdForButton(button: HTMLButtonElement) {
    const root = rootRef.current
    const row = button.closest('tr')
    if (!root || !row) return ''
    const dataRows = Array.from(root.querySelectorAll<HTMLTableRowElement>('.matrix-v5-sheet tbody > tr')).filter(item =>
      !item.classList.contains('matrix-v5-objective-row') &&
      !item.classList.contains('matrix-v5-edit-row') &&
      Boolean(item.querySelector('.matrix-v5-row-actions')),
    )
    const index = dataRows.indexOf(row as HTMLTableRowElement)
    return index >= 0 ? rowIdsRef.current[index] || '' : ''
  }

  function releaseWhenEditorCloses(rowId: string, attempts = 0) {
    window.setTimeout(() => {
      const stillEditing = Boolean(rootRef.current?.querySelector('.matrix-v5-edit-row'))
      if (!stillEditing) { void releaseLock(rowId); return }
      if (attempts < 12) releaseWhenEditorCloses(rowId, attempts + 1)
    }, 450)
  }

  function handleRootClickCapture(event: ReactMouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement
    const button = target.closest<HTMLButtonElement>('.matrix-v5-row-actions button')
    const centralRow = target.closest<HTMLTableRowElement>('tr[data-matrix-row-id]')
    if (!button && !centralRow) return

    if (bypassClickRef.current) {
      bypassClickRef.current = false
      return
    }

    const editingRow = button?.closest('tr.matrix-v5-edit-row')
    if (editingRow) {
      const rowId = lockedRowIdRef.current
      if (rowId) releaseWhenEditorCloses(rowId)
      return
    }

    if (rootRef.current?.querySelector('.matrix-v5-edit-row')) {
      event.preventDefault()
      event.stopPropagation()
      props.onError('Termina o cancela la edición actual antes de editar otra fila.')
      return
    }

    const rowId = centralRow?.dataset.matrixRowId || (button ? rowIdForButton(button) : '')
    if (!rowId) return
    const existing = locksRef.current.find(lock => lock.row_id === rowId)
    if (existing && existing.user_id !== currentUserIdRef.current) {
      event.preventDefault()
      event.stopPropagation()
      props.onError(`${existing.display_name || existing.user_email} está editando esta fila. Espera a que termine.`)
      return
    }

    event.preventDefault()
    event.stopPropagation()
    const deleting = Boolean(button?.classList.contains('danger'))
    void (async () => {
      const ok = await acquireLock(rowId)
      if (!ok) return
      bypassClickRef.current = true
      if (button) button.click()
      else centralRow?.click()
      if (deleting) window.setTimeout(() => void releaseLock(rowId), 1200)
    })()
  }

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const enhanceLayout = () => {
      root.querySelectorAll<HTMLTableElement>('.matrix-v5-sheet').forEach(table => {
        const lastHeader = table.querySelector('thead th:last-child')?.textContent?.trim()
        table.classList.toggle('matrix-v11-actions-table', lastHeader === 'Acciones')
      })
    }

    const enhanceHistory = () => {
      enhanceLayout()
      const articles = Array.from(root.querySelectorAll<HTMLElement>('.matrix-v10-history-list article'))
      articles.forEach((article, index) => {
        const actionLabel = article.querySelector<HTMLElement>('strong')
        if (actionLabel?.textContent?.trim().toLowerCase() === 'restore') actionLabel.textContent = 'Versión restaurada'
        if (!canRestore || index === 0 || article.dataset.restoreEnhanced === 'true') return

        const versionLabel = article.querySelector<HTMLElement>('.matrix-v10-version-number')?.textContent || ''
        const versionNo = Number(versionLabel.replace(/[^0-9]/g, ''))
        if (!Number.isFinite(versionNo) || versionNo <= 0) return

        article.dataset.restoreEnhanced = 'true'
        const actionBox = document.createElement('div')
        actionBox.className = 'matrix-v11-history-actions'
        const button = document.createElement('button')
        button.type = 'button'
        button.className = 'matrix-v11-restore-button'
        button.textContent = 'Restaurar esta versión'
        button.addEventListener('click', async () => {
          if (!supabase) return
          if (locksRef.current.length) {
            props.onError('Hay una fila en edición. Espera a que termine antes de restaurar una versión.')
            return
          }
          const areaName = root.querySelector<HTMLElement>('.matrix-v5-summary > div:first-child strong')?.textContent?.trim() || ''
          if (!areaName) {
            props.onError('No pudimos identificar el área de esta matriz.')
            return
          }
          const confirmed = window.confirm(`¿Restaurar la versión v${versionNo}? La matriz actual quedará registrada en el historial y podrás volver a ella después.`)
          if (!confirmed) return

          button.disabled = true
          button.textContent = 'Restaurando...'
          props.onError('')
          props.onNotice('')
          const { error } = await supabase.rpc('restore_matrix_version_by_context', {
            period_id_input: props.periodId,
            unit_code_input: props.unitCode,
            management_name_input: areaName,
            version_no_input: versionNo,
          })

          if (error) {
            button.disabled = false
            button.textContent = 'Restaurar esta versión'
            props.onError(error.message || 'No pudimos restaurar la versión seleccionada.')
            return
          }

          props.onNotice(`Versión v${versionNo} restaurada correctamente.`)
          setRevision(value => value + 1)
        })
        actionBox.appendChild(button)
        article.appendChild(actionBox)
      })
    }

    const observer = new MutationObserver(enhanceHistory)
    observer.observe(root, { childList: true, subtree: true })
    enhanceHistory()
    return () => observer.disconnect()
  }, [canRestore, props.periodId, props.unitCode, props.onError, props.onNotice])

  return <div ref={rootRef} className="matrix-v11-host" onClickCapture={handleRootClickCapture}>
    {matrixId && <div className={`matrix-collab-presence ${expanded ? 'matrix-collab-presence--expanded' : ''}`}>
      <span className="matrix-collab-icon"><Users size={17}/></span>
      <div className="matrix-collab-copy"><strong>Edición colaborativa</strong><small>{activeEditors.length ? `${activeEditors.length} usuario${activeEditors.length === 1 ? '' : 's'} editando ahora` : 'Ninguna fila está bloqueada'}</small></div>
      {activeEditors.length > 0 && <div className="matrix-collab-editors">{activeEditors.map(editor => <span className="matrix-collab-user" key={editor.user_id} title={editor.email}><i>{initials(editor.name)}</i><b>{editor.name}{editor.user_id === currentUserIdRef.current ? ' (tú)' : ''}</b></span>)}</div>}
    </div>}
    {onViewGuidelines && <div className="matrix-v11-guideline-shortcut"><button type="button" onClick={onViewGuidelines}><BookOpenText size={16}/> Ver lineamientos</button></div>}
    <MatrixWorkspaceV10 key={revision} {...workspaceProps} />
  </div>
}
