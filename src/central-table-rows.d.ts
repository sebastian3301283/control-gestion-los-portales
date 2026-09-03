export type CentralTableRowsInput = {
  objective?: unknown
  subpointRecords?: Array<{
    text?: unknown
    milestones?: unknown
    kpi?: unknown
    start_date?: unknown
    end_date?: unknown
  }>
  subpoints?: unknown[]
  milestones?: unknown[]
  kpis?: unknown[]
  startDates?: unknown[]
  endDates?: unknown[]
}

export type CentralTableRow = {
  index: number
  label: string
  objective: string
  subpoint: string
  milestones: string
  kpi: string
  startDate: string
  endDate: string
}

export function buildCentralTableRows(input?: CentralTableRowsInput): CentralTableRow[]
