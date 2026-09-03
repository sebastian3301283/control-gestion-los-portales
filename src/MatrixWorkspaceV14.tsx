import { useEffect, useRef } from 'react'
import MatrixWorkspaceV12 from './MatrixWorkspaceV12'
import { buildCentralTableRows, type CentralTableRow } from './central-table-rows.js'
import './matrix-workspace-v14.css'

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

function valuesFrom(cell: HTMLTableCellElement | undefined) {
  if (!cell) return []
  return Array.from(cell.querySelectorAll<HTMLElement>('.matrix-v12-detail-stack span')).map(item => item.textContent?.trim() || '')
}

function renderSubpointRow(tr: HTMLTableRowElement, item: CentralTableRow, first: boolean) {
  const cells = Array.from(tr.cells)
  if (cells.length < 8) return

  const objectiveCell = cells[1]
  let wrap = objectiveCell.querySelector<HTMLElement>('.matrix-v12-objective-stack')
  if (!wrap) {
    wrap = document.createElement('div')
    wrap.className = 'matrix-v12-objective-stack'
    objectiveCell.textContent = ''
    objectiveCell.appendChild(wrap)
  }
  wrap.classList.add('matrix-v14-subpoint-main')
  wrap.textContent = ''

  if (first) {
    const objective = document.createElement('strong')
    objective.textContent = item.objective || '—'
    wrap.appendChild(objective)
  }

  const line = document.createElement('div')
  line.className = 'matrix-v14-subpoint-line'
  const badge = document.createElement('small')
  badge.textContent = item.label
  const text = document.createElement('span')
  text.textContent = item.subpoint
  line.append(badge, text)
  wrap.appendChild(line)

  cells[4].textContent = item.milestones
  cells[5].textContent = item.kpi
  cells[6].textContent = item.startDate
  cells[7].textContent = item.endDate
}

export default function MatrixWorkspaceV14(props: Props) {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (props.unitCode !== 'CENTRAL') return
    const root = rootRef.current
    if (!root) return

    const enhance = () => {
      const baseRows = Array.from(root.querySelectorAll<HTMLTableRowElement>('.matrix-v5-sheet tbody > tr')).filter(tr =>
        !tr.classList.contains('matrix-v14-subpoint-row') &&
        Boolean(tr.querySelector('.matrix-v12-objective-stack')) &&
        Boolean(tr.querySelector('.matrix-v5-row-actions')),
      )

      baseRows.forEach((tr, rowIndex) => {
        const cells = Array.from(tr.cells)
        if (cells.length < 8) return
        const stack = cells[1].querySelector<HTMLElement>('.matrix-v12-objective-stack')
        const subpoints = Array.from(stack?.querySelectorAll('ol li') || []).map(item => item.textContent?.trim() || '')
        if (!subpoints.length) return

        const objective = stack?.querySelector('strong')?.textContent?.trim() || ''
        const input = {
          objective,
          subpoints,
          milestones: valuesFrom(cells[4]),
          kpis: valuesFrom(cells[5]),
          startDates: valuesFrom(cells[6]),
          endDates: valuesFrom(cells[7]),
        }
        const displayRows = buildCentralTableRows(input)
        if (!displayRows.length) return

        const groupId = tr.dataset.v14Group || `central-${rowIndex}-${tr.cells[0]?.textContent?.trim() || rowIndex + 1}`
        tr.dataset.v14Group = groupId
        const signature = JSON.stringify(input)
        root.querySelectorAll<HTMLTableRowElement>(`.matrix-v14-subpoint-row[data-v14-parent="${groupId}"]`).forEach(item => item.remove())

        renderSubpointRow(tr, displayRows[0], true)
        tr.dataset.v14Signature = signature
        tr.classList.add('matrix-v14-subpoint-first')

        let cursor: HTMLTableRowElement = tr
        displayRows.slice(1).forEach(item => {
          const clone = tr.cloneNode(true) as HTMLTableRowElement
          clone.classList.remove('matrix-v14-subpoint-first')
          clone.classList.add('matrix-v14-subpoint-row')
          clone.dataset.v14Parent = groupId
          clone.dataset.v14Signature = signature
          clone.removeAttribute('data-v14-group')
          renderSubpointRow(clone, item, false)
          const actionCell = Array.from(clone.cells).find(cell => Boolean(cell.querySelector('.matrix-v5-row-actions')))
          if (actionCell) actionCell.textContent = ''
          cursor.insertAdjacentElement('afterend', clone)
          cursor = clone
        })
      })
    }

    const observer = new MutationObserver(enhance)
    observer.observe(root, { childList: true, subtree: true })
    enhance()
    return () => observer.disconnect()
  }, [props.unitCode, props.periodId])

  return <div ref={rootRef}><MatrixWorkspaceV12 {...props} /></div>
}
