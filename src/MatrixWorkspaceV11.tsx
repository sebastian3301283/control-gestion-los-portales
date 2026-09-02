import { useEffect, useRef, useState } from 'react'
import MatrixWorkspaceV10 from './MatrixWorkspaceV10'
import { supabase } from './lib/supabase'
import './matrix-workspace-v11.css'

type UnitCode = 'HU' | 'DEP' | 'VS' | 'HOT' | 'CENTRAL'
type Props = {
  periodId: string
  year: number
  unitCode: UnitCode
  unitName: string
  canManage: boolean
  onError: (message: string) => void
  onNotice: (message: string) => void
}

export default function MatrixWorkspaceV11(props: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [canRestore, setCanRestore] = useState(false)
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    let active = true
    async function loadRestorePermission() {
      if (!supabase) return
      const { data, error } = await supabase.rpc('is_global_planning_manager')
      if (active) setCanRestore(!error && Boolean(data))
    }
    void loadRestorePermission()
    return () => { active = false }
  }, [])

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

  return <div ref={rootRef} className="matrix-v11-host">
    <MatrixWorkspaceV10 key={revision} {...props} />
  </div>
}
