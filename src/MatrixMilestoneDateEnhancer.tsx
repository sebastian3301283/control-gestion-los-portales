import { useEffect, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import MatrixMilestoneDateField from './MatrixMilestoneDateField'
import { formatMilestoneDate, milestoneDateInputValue } from './matrix-milestone-date.js'

type Props = { rootRef: RefObject<HTMLDivElement> }
type DateTarget = { textarea: HTMLTextAreaElement; mount: HTMLDivElement; value: string; ariaLabel: string }

function normalizeHeader(value: string | null | undefined) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/\s+/g, ' ')
}

function setNativeTextareaValue(textarea: HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set
  if (setter) setter.call(textarea, value)
  else textarea.value = value
  textarea.dispatchEvent(new Event('input', { bubbles: true }))
  textarea.dispatchEvent(new Event('change', { bubbles: true }))
}

function formatPersistedMilestones(root: HTMLDivElement) {
  root.querySelectorAll<HTMLTableElement>('.matrix-v5-sheet').forEach(table => {
    const headers = Array.from(table.querySelectorAll<HTMLTableCellElement>('thead th')).map(cell => normalizeHeader(cell.textContent))
    const milestoneIndex = headers.findIndex(header => header === 'fechas' || header.includes('hitos / fechas') || header === 'hitos' || header.includes('hitos fechas'))
    if (milestoneIndex < 0) return

    table.querySelectorAll<HTMLTableRowElement>('tbody tr[data-matrix-row-id]').forEach(row => {
      if (row.classList.contains('matrix-v5-edit-row') || row.classList.contains('matrix-v5-objective-row')) return
      const cells = Array.from(row.children) as HTMLTableCellElement[]
      const cell = row.classList.contains('matrix-central-subpoint-row') ? cells[1] : cells[milestoneIndex]
      if (!cell) return
      const raw = String(cell.textContent || '').trim()
      if (!milestoneDateInputValue(raw)) return
      const formatted = formatMilestoneDate(raw)
      if (formatted !== raw) cell.textContent = formatted
    })
  })
}

export default function MatrixMilestoneDateEnhancer({ rootRef }: Props) {
  const [targets, setTargets] = useState<DateTarget[]>([])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const scan = () => {
      formatPersistedMilestones(root)
      const next = Array.from(root.querySelectorAll<HTMLTextAreaElement>('textarea[aria-label="Hitos o fechas"], textarea[aria-label^="Hito del subpunto"]')).map(textarea => {
        const cell = textarea.closest<HTMLTableCellElement>('td')
        if (!cell) return null
        textarea.style.display = 'none'
        let mount = cell.querySelector<HTMLDivElement>(':scope > .matrix-milestone-date-react-root')
        if (!mount) {
          mount = document.createElement('div')
          mount.className = 'matrix-milestone-date-react-root'
          cell.appendChild(mount)
        }
        return { textarea, mount, value: textarea.value, ariaLabel: textarea.getAttribute('aria-label') || 'Hitos / Fechas' }
      }).filter((item): item is DateTarget => Boolean(item))

      setTargets(current => {
        const currentSignature = current.map(item => `${item.textarea.isConnected}:${item.textarea.value}:${item.mount.isConnected}`).join('|')
        const nextSignature = next.map(item => `${item.textarea.isConnected}:${item.textarea.value}:${item.mount.isConnected}`).join('|')
        return currentSignature === nextSignature && current.length === next.length ? current : next
      })
    }

    scan()
    const observer = new MutationObserver(scan)
    observer.observe(root, { childList: true, subtree: true })
    return () => {
      observer.disconnect()
      root.querySelectorAll<HTMLTextAreaElement>('textarea[aria-label="Hitos o fechas"], textarea[aria-label^="Hito del subpunto"]').forEach(textarea => { textarea.style.display = '' })
      root.querySelectorAll('.matrix-milestone-date-react-root').forEach(mount => mount.remove())
    }
  }, [rootRef])

  return <>{targets.map(target => createPortal(
    <MatrixMilestoneDateField
      key={target.ariaLabel}
      value={target.value}
      ariaLabel={target.ariaLabel}
      onChange={value => {
        setNativeTextareaValue(target.textarea, value)
        setTargets(current => current.map(item => item.textarea === target.textarea ? { ...item, value } : item))
      }}
    />,
    target.mount,
  ))}</>
}
