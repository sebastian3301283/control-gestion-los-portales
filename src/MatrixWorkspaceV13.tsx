import { useEffect, useRef, useState } from 'react'
import MatrixMilestoneDateEnhancer from './MatrixMilestoneDateEnhancer'
import MatrixRealtimeLayer from './MatrixRealtimeLayer'
import MatrixWorkspaceV12 from './MatrixWorkspaceV12'
import UnitPlanLeadershipHeader from './UnitPlanLeadershipHeader'
import './matrix-workspace-v12-unit-theme.css'

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
  const hostRef = useRef<HTMLDivElement>(null)
  const [activeMatrixId, setActiveMatrixId] = useState('')

  useEffect(() => setActiveMatrixId(''), [props.periodId, props.unitCode])

  function handleActiveMatrixChange(matrixId: string) {
    setActiveMatrixId(matrixId)
    props.onActiveMatrixChange?.(matrixId)
  }

  const { onActiveMatrixChange: _onActiveMatrixChange, ...workspaceProps } = props
  return <MatrixRealtimeLayer matrixId={activeMatrixId}>
    <div ref={hostRef} className={`matrix-v12-theme-host matrix-v12--${props.unitCode.toLowerCase()}`}>
      {props.unitCode !== 'CENTRAL' && <UnitPlanLeadershipHeader hostRef={hostRef} matrixId={activeMatrixId} unitCode={props.unitCode} unitName={props.unitName} onError={props.onError} />}
      <MatrixWorkspaceV12 {...workspaceProps} onActiveMatrixChange={handleActiveMatrixChange} />
      <MatrixMilestoneDateEnhancer rootRef={hostRef} />
    </div>
  </MatrixRealtimeLayer>
}
