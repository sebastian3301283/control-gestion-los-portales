import { useEffect, useState } from 'react'
import MatrixRealtimeLayer from './MatrixRealtimeLayer'
import MatrixWorkspaceV11 from './MatrixWorkspaceV11'
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
  onViewGuidelines?: () => void
}

export default function MatrixWorkspaceV13(props: Props) {
  const [activeMatrixId, setActiveMatrixId] = useState('')

  useEffect(() => setActiveMatrixId(''), [props.periodId, props.unitCode])

  return <MatrixRealtimeLayer matrixId={activeMatrixId}>{props.unitCode === 'CENTRAL'
    ? <MatrixWorkspaceV12 {...props} onActiveMatrixChange={setActiveMatrixId} />
    : <MatrixWorkspaceV11 {...props} onActiveMatrixChange={setActiveMatrixId} />}
  </MatrixRealtimeLayer>
}
