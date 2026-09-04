import MatrixWorkspaceV11 from './MatrixWorkspaceV11'
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
  onViewGuidelines?: () => void
  onActiveMatrixChange?: (matrixId: string) => void
}

export default function MatrixWorkspaceV12(props: Props) {
  return <div className="matrix-v12-host"><MatrixWorkspaceV11 {...props} /></div>
}
