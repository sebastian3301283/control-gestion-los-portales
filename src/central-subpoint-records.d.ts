export type CentralSubpointDraft = {
  id: string | null
  text: string
  milestones: string
  kpi: string
  start_date: string
  end_date: string
}

export type CentralSubpointRecord = {
  id?: string | null
  text?: unknown
  milestones?: unknown
  kpi?: unknown
  start_date?: unknown
  end_date?: unknown
  sort_order?: number | null
}

export function buildCentralSubpointDrafts(records: CentralSubpointRecord[], legacyRow?: Record<string, unknown>): CentralSubpointDraft[]
export function normalizeCentralSubpointRows(drafts: CentralSubpointDraft[]): Array<{ text: string; milestones: string | null; kpi: string | null; start_date: string | null; end_date: string | null; sort_order: number }>
export function actionPlanFromSubpoints(rows: Array<{ text: string }>): string
