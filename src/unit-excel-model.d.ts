export type UnitExcelManager = {
  id: string
  name: string
  cargo?: string | null
  active?: boolean
}

export type UnitObjectiveRow = {
  objective_group?: string | null
}

export type UnitObjectiveGroup<T extends UnitObjectiveRow> = {
  objective: string
  rows: T[]
}

export function filterGerenteManagers<T extends UnitExcelManager>(managers: T[]): T[]
export function toggleResponsibleId(currentIds: string[], managerId: string): string[]
export function groupRowsByObjective<T extends UnitObjectiveRow>(rows: T[]): UnitObjectiveGroup<T>[]
