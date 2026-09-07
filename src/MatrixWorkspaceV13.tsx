import { useEffect, useState } from 'react'
import MatrixRealtimeLayer from './MatrixRealtimeLayer'
import MatrixWorkspaceV12 from './MatrixWorkspaceV12'

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

export default function MatrixWorkspaceV13(props: Props) {
  const [activeMatrixId, setActiveMatrixId] = useState('')

  useEffect(() => setActiveMatrixId(''), [props.periodId, props.unitCode])

  function handleActiveMatrixChange(matrixId: string) {
    setActiveMatrixId(matrixId)
    props.onActiveMatrixChange?.(matrixId)
  }

  const { onActiveMatrixChange: _onActiveMatrixChange, ...workspaceProps } = props
  return <MatrixRealtimeLayer matrixId={activeMatrixId}>
    <MatrixWorkspaceV12 {...workspaceProps} onActiveMatrixChange={handleActiveMatrixChange} />
  </MatrixRealtimeLayer>
}
