import MatrixRealtimeLayer from './MatrixRealtimeLayer'
import MatrixWorkspaceV11 from './MatrixWorkspaceV11'
import MatrixWorkspaceV14 from './MatrixWorkspaceV14'

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
  return <MatrixRealtimeLayer periodId={props.periodId} unitCode={props.unitCode}>{props.unitCode === 'CENTRAL' ? <MatrixWorkspaceV14 {...props} /> : <MatrixWorkspaceV11 {...props} />}</MatrixRealtimeLayer>
}
