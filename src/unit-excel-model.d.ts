export type UnitExcelManager = {
  id: string
  name: string
  cargo?: string | null
  active?: boolean
  [key: string]: unknown
}

export function filterGerenteManagers<T extends UnitExcelManager>(managers: T[]): T[]
export function toggleResponsibleId(currentIds: string[], managerId: string): string[]
