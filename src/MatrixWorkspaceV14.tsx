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

// Alias de compatibilidad: las filas reales ahora se renderizan en React desde V10.
export default function MatrixWorkspaceV14(props: Props) {
  return <MatrixWorkspaceV12 {...props} />
}
