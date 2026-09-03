import MatrixWorkspaceV11 from './MatrixWorkspaceV11'

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

export default function MatrixWorkspaceV12(props: Props) {
  return <MatrixWorkspaceV11 {...props} />
}
