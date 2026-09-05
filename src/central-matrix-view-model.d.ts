export type CentralAreaManager = { id: string; name: string; cargo?: string | null }
export type CentralHistoryVersion = { id: string; action: string; changed_email: string | null; created_at: string; [key: string]: unknown }
export type CentralHistoryGroup<T extends CentralHistoryVersion = CentralHistoryVersion> = {
  key: string
  email: string | null
  name: string
  versions: T[]
}
export function managementRank(cargo?: string | null): number
export function filterHighestAreaManagers<T extends CentralAreaManager>(managers: T[]): T[]
export function historyActionLabel(value: string): string
export function groupHistoryByPerson<T extends CentralHistoryVersion>(versions: T[], namesByEmail?: Record<string, string>): CentralHistoryGroup<T>[]
