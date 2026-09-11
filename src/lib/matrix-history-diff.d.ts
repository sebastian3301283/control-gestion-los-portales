export type MatrixHistoryChange = { label: string; before: string; after: string }
export type MatrixHistorySummary = { summary: string; changes: MatrixHistoryChange[] }
export function summarizeMatrixVersionChanges(currentSnapshot: unknown, previousSnapshot: unknown): MatrixHistorySummary
