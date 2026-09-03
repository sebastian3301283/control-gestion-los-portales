import { Users } from 'lucide-react'
import { useEffect, useRef, useState, type FocusEvent as ReactFocusEvent, type ReactNode } from 'react'
import { supabase } from './lib/supabase'
import { collaborationLocationLabel, flattenPresenceState, type CollaborationLocation, type MatrixPresenceUser } from './matrix-realtime-presence.js'
import './matrix-realtime-layer.css'

type UnitCode = 'HU' | 'DEP' | 'VS' | 'HOT' | 'CENTRAL'
type Props = { children: ReactNode; periodId: string; unitCode: UnitCode }
type PresencePayload = MatrixPresenceUser & { online_at: string }

function initials(value: string) {
  const parts = value.trim().split(/[\s._@-]+/).filter(Boolean)
  return parts.slice(0, 2).map(part => part[0]?.toUpperCase()).join('') || 'U'
}

function editableTarget(target: EventTarget | null) {
  return target instanceof HTMLElement ? target.closest<HTMLElement>('input,textarea,select,[contenteditable="true"]') : null
}

function locationFromTarget(target: HTMLElement): CollaborationLocation | null {
  const editable = target.closest<HTMLElement>('input,textarea,select,[contenteditable="true"]')
  if (!editable) return null

  const subpointRow = editable.closest<HTMLElement>('.matrix-v12-subpoint-row:not(.matrix-v12-subpoint-row--head)')
  if (subpointRow) {
    const parent = subpointRow.parentElement
    const rows = parent ? Array.from(parent.querySelectorAll<HTMLElement>('.matrix-v12-subpoint-row:not(.matrix-v12-subpoint-row--head)')) : []
    const index = Math.max(0, rows.indexOf(subpointRow))
    const children = Array.from(subpointRow.children)
    const column = Math.max(0, children.indexOf(editable))
    const fields = ['Subpunto', 'Hitos / Fechas', 'KPI', 'Inicio', 'Fin']
    return { field: fields[column] || 'Subpunto', subpoint: `S${index + 1}` }
  }

  const label = editable.closest('label')
  const labelText = label?.querySelector('span')?.textContent?.trim()
  if (labelText) return { field: labelText }

  const cell = editable.closest<HTMLTableCellElement>('td')
  const row = editable.closest<HTMLTableRowElement>('tr')
  const table = editable.closest<HTMLTableElement>('table')
  if (cell && row && table) {
    const header = table.querySelectorAll<HTMLTableCellElement>('thead th')[cell.cellIndex]?.textContent?.trim() || 'Campo'
    const rowNumber = row.cells[0]?.textContent?.trim() || ''
    const subpoint = row.querySelector<HTMLElement>('.matrix-v14-subpoint-line small')?.textContent?.trim() || ''
    return { field: header, ...(subpoint ? { subpoint } : {}), ...(rowNumber ? { row: rowNumber } : {}) }
  }

  return { field: editable.getAttribute('aria-label') || editable.getAttribute('placeholder') || 'Campo' }
}

export default function MatrixRealtimeLayer({ children, periodId, unitCode }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const channelRef = useRef<ReturnType<NonNullable<typeof supabase>['channel']> | null>(null)
  const identityRef = useRef<{ user_id: string; name: string; email: string } | null>(null)
  const clearLocationTimerRef = useRef<number | null>(null)
  const pendingRefreshRef = useRef(false)
  const [matrixId, setMatrixId] = useState('')
  const [users, setUsers] = useState<MatrixPresenceUser[]>([])
  const [currentUserId, setCurrentUserId] = useState('')
  const [connected, setConnected] = useState(false)
  const [refreshRevision, setRefreshRevision] = useState(0)

  function localEditorOpen() {
    const root = rootRef.current
    return Boolean(root?.querySelector('.matrix-v12-editor,.matrix-v5-edit-row'))
  }

  function requestRefresh() {
    if (localEditorOpen()) { pendingRefreshRef.current = true; return }
    pendingRefreshRef.current = false
    setRefreshRevision(value => value + 1)
  }

  useEffect(() => {
    if (!supabase) return
    const root = rootRef.current
    if (!root) return
    let stopped = false
    let running = false

    const resolveMatrix = async () => {
      if (stopped || running) return
      const areaName = root.querySelector<HTMLElement>('.matrix-v5-summary > div:first-child strong')?.textContent?.trim() || ''
      if (!areaName) { setMatrixId(''); return }
      running = true
      try {
        const { data: managementData } = await supabase.from('managements_global').select('id').eq('unit_code', unitCode).eq('active', true).ilike('name', areaName)
        const managementIds = (managementData || []).map(item => String(item.id))
        if (!managementIds.length) return
        const { data: processData } = await supabase.from('processes').select('id').eq('unit_code', unitCode).eq('active', true).in('management_id', managementIds)
        const processIds = (processData || []).map(item => String(item.id))
        if (!processIds.length) return
        const { data: matrixData } = await supabase.from('matrices').select('id').eq('period_id', periodId).eq('unit_code', unitCode).eq('active', true).in('process_id', processIds).limit(1).maybeSingle()
        const next = matrixData?.id ? String(matrixData.id) : ''
        setMatrixId(current => current === next ? current : next)
      } finally { running = false }
    }

    void resolveMatrix()
    const timer = window.setInterval(() => void resolveMatrix(), 1200)
    return () => { stopped = true; window.clearInterval(timer) }
  }, [periodId, unitCode, refreshRevision])

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (pendingRefreshRef.current && !localEditorOpen()) requestRefresh()
    }, 250)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!supabase || !matrixId) { setUsers([]); setConnected(false); return }
    let cancelled = false
    let channel: ReturnType<typeof supabase.channel> | null = null

    void (async () => {
      const { data: authData } = await supabase.auth.getUser()
      const user = authData.user
      if (!user || cancelled) return
      const { data: profile } = await supabase.from('profiles').select('email,full_name').eq('user_id', user.id).maybeSingle()
      if (cancelled) return
      const email = String(profile?.email || user.email || '')
      const name = String(profile?.full_name || email.split('@')[0] || 'Usuario')
      identityRef.current = { user_id: user.id, name, email }
      setCurrentUserId(user.id)

      const sessionKey = `${user.id}:${typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Date.now()}`
      channel = supabase.channel(`matrix-collab:${matrixId}`, { config: { presence: { key: sessionKey } } })
      channelRef.current = channel

      channel
        .on('presence', { event: 'sync' }, () => {
          if (!channel) return
          setUsers(flattenPresenceState(channel.presenceState() as unknown as Record<string, unknown[]>))
        })
        .on('broadcast', { event: 'editing-location' }, ({ payload }) => {
          const incoming = payload as { user_id?: string; location?: CollaborationLocation | null }
          if (!incoming.user_id) return
          setUsers(current => current.map(item => item.user_id === incoming.user_id ? { ...item, location: incoming.location || null } : item))
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'matrix_rows', filter: `matrix_id=eq.${matrixId}` }, () => requestRefresh())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'matrix_row_edit_locks', filter: `matrix_id=eq.${matrixId}` }, () => {
          window.dispatchEvent(new CustomEvent('matrix-realtime-lock-change', { detail: { matrixId } }))
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'matrix_row_subpoints' }, payload => {
          const record = (payload.new && Object.keys(payload.new).length ? payload.new : payload.old) as Record<string, unknown>
          const rowId = String(record?.matrix_row_id || '')
          if (!rowId) { requestRefresh(); return }
          void supabase.from('matrix_rows').select('matrix_id').eq('id', rowId).maybeSingle().then(({ data }) => {
            if (String(data?.matrix_id || '') === matrixId) requestRefresh()
          })
        })
        .subscribe(async status => {
          if (cancelled || !channel) return
          const online = status === 'SUBSCRIBED'
          setConnected(online)
          if (online && identityRef.current) {
            const presence: PresencePayload = { ...identityRef.current, location: null, online_at: new Date().toISOString() }
            await channel.track(presence)
          }
        })
    })()

    return () => {
      cancelled = true
      setConnected(false)
      setUsers([])
      identityRef.current = null
      if (channel) void supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [matrixId])

  async function publishLocation(location: CollaborationLocation | null) {
    const channel = channelRef.current
    const identity = identityRef.current
    if (!channel || !identity) return
    const presence: PresencePayload = { ...identity, location, online_at: new Date().toISOString() }
    await channel.track(presence)
    await channel.send({ type: 'broadcast', event: 'editing-location', payload: { user_id: identity.user_id, location } })
  }

  function handleFocusCapture(event: ReactFocusEvent<HTMLDivElement>) {
    const editable = editableTarget(event.target)
    if (!editable) return
    if (clearLocationTimerRef.current) window.clearTimeout(clearLocationTimerRef.current)
    void publishLocation(locationFromTarget(editable))
  }

  function handleBlurCapture() {
    if (clearLocationTimerRef.current) window.clearTimeout(clearLocationTimerRef.current)
    clearLocationTimerRef.current = window.setTimeout(() => {
      const root = rootRef.current
      if (!root || !editableTarget(document.activeElement) || !root.contains(document.activeElement)) void publishLocation(null)
    }, 120)
  }

  const otherUsers = users.filter(user => user.user_id !== currentUserId)

  return <div ref={rootRef} className="matrix-realtime-host" onFocusCapture={handleFocusCapture} onBlurCapture={handleBlurCapture}>
    {matrixId && <div className="matrix-realtime-bar">
      <span className={`matrix-realtime-status ${connected ? 'is-online' : ''}`}><Users size={16}/></span>
      <div className="matrix-realtime-copy"><strong>Colaboración en tiempo real</strong><small>{connected ? `${Math.max(users.length, 1)} conectado${Math.max(users.length, 1) === 1 ? '' : 's'} · cambios automáticos` : 'Conectando...'}</small></div>
      <div className="matrix-realtime-users">
        {otherUsers.length === 0 ? <span className="matrix-realtime-empty">Solo tú por ahora</span> : otherUsers.map(user => {
          const location = collaborationLocationLabel(user.location)
          return <span className="matrix-realtime-user" key={user.user_id} title={user.email}>
            <i>{initials(user.name)}</i><span><b>{user.name}</b><small>{location || 'Viendo la matriz'}</small></span>
          </span>
        })}
      </div>
    </div>}
    <div className="matrix-realtime-content" key={refreshRevision}>{children}</div>
  </div>
}
