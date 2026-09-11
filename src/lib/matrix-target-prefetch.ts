import { supabase } from './supabase'
import { loadMatrices, loadProcesses } from './planning-query-cache'

export const MATRIX_TARGET_PREFETCH_TTL_MS = 10_000

type PrefetchedRow = Record<string, unknown> & { id: string }
type PrefetchedResponsible = { row_id: string; manager_id: string; sort_order: number }
type PrefetchedSubpoint = {
  id: string
  matrix_row_id: string
  text: string | null
  milestones: string | null
  kpi: string | null
  start_date: string | null
  end_date: string | null
  sort_order: number
}

export type PrefetchedMatrixRows = {
  rows: PrefetchedRow[]
  responsibles: PrefetchedResponsible[]
  subpoints: PrefetchedSubpoint[]
}

type PrefetchEntry = {
  expiresAt: number
  promise: Promise<PrefetchedMatrixRows>
}

const prefetches = new Map<string, PrefetchEntry>()

function prefetchKey(matrixId: string, includeSubpoints: boolean) {
  return `${matrixId}:${includeSubpoints ? 'central' : 'unit'}`
}

async function fetchMatrixRows(matrixId: string, includeSubpoints: boolean): Promise<PrefetchedMatrixRows> {
  if (!supabase) throw new Error('SUPABASE_UNAVAILABLE')

  const rowResult = await supabase
    .from('matrix_rows')
    .select('*')
    .eq('matrix_id', matrixId)
    .order('sort_order')
    .order('created_at')
  if (rowResult.error) throw rowResult.error

  const rows = (rowResult.data || []) as PrefetchedRow[]
  const rowIds = rows.map(row => row.id)
  if (!rowIds.length) return { rows, responsibles: [], subpoints: [] }

  const responsibleQuery = supabase
    .from('matrix_row_responsibles')
    .select('row_id,manager_id,sort_order')
    .in('row_id', rowIds)
    .order('sort_order')

  if (!includeSubpoints) {
    const responsibleResult = await responsibleQuery
    if (responsibleResult.error) throw responsibleResult.error
    return {
      rows,
      responsibles: (responsibleResult.data || []) as PrefetchedResponsible[],
      subpoints: [],
    }
  }

  const [responsibleResult, subpointResult] = await Promise.all([
    responsibleQuery,
    supabase
      .from('matrix_row_subpoints')
      .select('id,matrix_row_id,text,milestones,kpi,start_date,end_date,sort_order')
      .in('matrix_row_id', rowIds)
      .order('sort_order')
      .order('created_at'),
  ])
  if (responsibleResult.error) throw responsibleResult.error
  if (subpointResult.error) throw subpointResult.error

  return {
    rows,
    responsibles: (responsibleResult.data || []) as PrefetchedResponsible[],
    subpoints: (subpointResult.data || []) as PrefetchedSubpoint[],
  }
}

function prefetchMatrixRows(matrixId: string, includeSubpoints: boolean) {
  const key = prefetchKey(matrixId, includeSubpoints)
  const now = Date.now()
  const existing = prefetches.get(key)
  if (existing && existing.expiresAt > now) return existing.promise

  const entry: PrefetchEntry = {
    expiresAt: now + MATRIX_TARGET_PREFETCH_TTL_MS,
    promise: fetchMatrixRows(matrixId, includeSubpoints),
  }
  prefetches.set(key, entry)
  void entry.promise.catch(() => {
    if (prefetches.get(key) === entry) prefetches.delete(key)
  })
  window.setTimeout(() => {
    if (prefetches.get(key) === entry && entry.expiresAt <= Date.now()) prefetches.delete(key)
  }, MATRIX_TARGET_PREFETCH_TTL_MS + 50)
  return entry.promise
}

export async function prefetchMatrixTargetRows(
  periodId: string,
  unitCode: string,
  managementId: string,
  guidelineId?: string | null,
) {
  let matrixId = ''

  if (unitCode !== 'CENTRAL' && guidelineId) {
    const matrices = await loadMatrices(periodId, unitCode)
    matrixId = matrices.find(matrix => matrix.guideline_id === guidelineId)?.id || ''
  } else {
    const [matrices, processes] = await Promise.all([
      loadMatrices(periodId, unitCode),
      loadProcesses(unitCode),
    ])
    const processIds = new Set(processes.filter(process => process.management_id === managementId).map(process => process.id))
    matrixId = matrices.find(matrix => processIds.has(matrix.process_id))?.id || ''
  }

  if (!matrixId) return
  await prefetchMatrixRows(matrixId, unitCode === 'CENTRAL')
}

export async function takePrefetchedMatrixRows(matrixId: string, includeSubpoints: boolean): Promise<PrefetchedMatrixRows | null> {
  const key = prefetchKey(matrixId, includeSubpoints)
  const entry = prefetches.get(key)
  if (!entry || entry.expiresAt <= Date.now()) {
    prefetches.delete(key)
    return null
  }

  try {
    return await entry.promise
  } catch {
    return null
  } finally {
    if (prefetches.get(key) === entry) prefetches.delete(key)
  }
}
