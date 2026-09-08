import { supabase } from './supabase'

export const PLANNING_CACHE_TTL_MS = 15_000

type CacheEntry<T> = {
  expiresAt: number
  data?: T
  promise?: Promise<T>
}

type PlanningPeriod = { id: string; year: number; name: string; status: 'DRAFT' | 'OPEN' | 'CLOSED' }
type Management = { id: string; name: string; unit_code: string; directory_group: string; active?: boolean }
type Manager = { id: string; name: string; cargo: string | null; unit_code: string; directory_group: string; active?: boolean }
type Process = { id: string; management_id: string; unit_code: string }
type Matrix = { id: string; name: string; process_id: string; status: string; guideline_id: string | null; principal_responsible_manager_id?: string | null }
type Guideline = {
  id: string
  period_id?: string
  unit_code?: string
  management_id: string
  category?: string | null
  code: string | null
  guideline_text: string
  responsible_manager_id: string | null
  active?: boolean
  sort_order?: number
}
type ManagerManagement = { manager_id: string; management_id: string }
type AreaLink = { management_id: string }

const planningGetCache = new Map<string, CacheEntry<unknown>>()

export function cachedPlanningGet<T>(key: string, loader: () => Promise<T>, force = false): Promise<T> {
  const now = Date.now()
  const existing = planningGetCache.get(key) as CacheEntry<T> | undefined
  if (!force && existing?.promise) return existing.promise
  if (!force && existing?.data !== undefined && existing.expiresAt > now) return Promise.resolve(existing.data)

  const promise = loader()
    .then(data => {
      planningGetCache.set(key, { data, expiresAt: Date.now() + PLANNING_CACHE_TTL_MS })
      return data
    })
    .catch(error => {
      const current = planningGetCache.get(key) as CacheEntry<T> | undefined
      if (current?.promise === promise) planningGetCache.delete(key)
      throw error
    })
  planningGetCache.set(key, { promise, expiresAt: now + PLANNING_CACHE_TTL_MS })
  return promise
}

export function invalidatePlanningCache(...prefixes: string[]) {
  if (!prefixes.length) {
    planningGetCache.clear()
    return
  }
  for (const key of planningGetCache.keys()) {
    if (prefixes.some(prefix => key.startsWith(prefix))) planningGetCache.delete(key)
  }
}

function requireSupabase() {
  if (!supabase) throw new Error('SUPABASE_UNAVAILABLE')
  return supabase
}

async function rowsOrThrow<T>(query: PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const result = await query
  if (result.error) throw result.error
  return result.data || []
}

export function loadPlanningPeriods(force = false) {
  return cachedPlanningGet<PlanningPeriod[]>('planning-periods', () => {
    const client = requireSupabase()
    return rowsOrThrow<PlanningPeriod>(client.from('planning_periods').select('id,year,name,status').order('year', { ascending: true }))
  }, force)
}

export function loadScopedManagements(unitCode: string, force = false) {
  return cachedPlanningGet<Management[]>(`managements:${unitCode}`, () => {
    const client = requireSupabase()
    return rowsOrThrow<Management>(client.from('managements_global').select('id,name,unit_code,directory_group,active').eq('unit_code', unitCode).eq('active', true).order('name'))
  }, force)
}

export function loadScopedManagers(unitCode: string, force = false) {
  return cachedPlanningGet<Manager[]>(`managers:${unitCode}`, () => {
    const client = requireSupabase()
    return rowsOrThrow<Manager>(client.from('managers').select('id,name,cargo,unit_code,directory_group,active').eq('unit_code', unitCode).eq('active', true).order('name'))
  }, force)
}

export function loadPlanningGuidelines(periodId: string, unitCode: string, force = false) {
  return cachedPlanningGet<Guideline[]>(`planning-guidelines:${periodId}:${unitCode}`, () => {
    const client = requireSupabase()
    return rowsOrThrow<Guideline>(client.from('planning_guidelines')
      .select('id,period_id,unit_code,management_id,category,code,guideline_text,responsible_manager_id,active,sort_order')
      .eq('period_id', periodId)
      .eq('unit_code', unitCode)
      .order('sort_order')
      .order('created_at'))
  }, force)
}

export function loadMatrixAreaCatalog(unitCode: string, force = false) {
  return cachedPlanningGet<AreaLink[]>(`matrix-area-catalog:${unitCode}`, () => {
    const client = requireSupabase()
    return rowsOrThrow<AreaLink>(client.from('matrix_unit_area_catalog').select('management_id').eq('unit_code', unitCode).order('created_at'))
  }, force)
}

export function loadGuidelineAreaCatalog(unitCode: string, force = false) {
  return cachedPlanningGet<AreaLink[]>(`guideline-area-catalog:${unitCode}`, () => {
    const client = requireSupabase()
    return rowsOrThrow<AreaLink>(client.from('guideline_unit_area_catalog').select('management_id').eq('unit_code', unitCode).order('created_at'))
  }, force)
}

export function loadProcesses(unitCode: string, force = false) {
  return cachedPlanningGet<Process[]>(`processes:${unitCode}`, () => {
    const client = requireSupabase()
    return rowsOrThrow<Process>(client.from('processes').select('id,management_id,unit_code').eq('unit_code', unitCode).eq('active', true).order('created_at'))
  }, force)
}

export function loadMatrices(periodId: string, unitCode: string, force = false) {
  const centralFields = unitCode === 'CENTRAL' ? ',principal_responsible_manager_id' : ''
  return cachedPlanningGet<Matrix[]>(`matrices:${periodId}:${unitCode}`, () => {
    const client = requireSupabase()
    return rowsOrThrow<Matrix>(client.from('matrices')
      .select(`id,name,process_id,status,guideline_id${centralFields}`)
      .eq('period_id', periodId)
      .eq('unit_code', unitCode)
      .eq('active', true)
      .order('created_at'))
  }, force)
}

export function loadManagerManagements(managementIds: string[], force = false) {
  const normalizedIds = [...new Set(managementIds.filter(Boolean))].sort()
  if (!normalizedIds.length) return Promise.resolve([] as ManagerManagement[])
  return cachedPlanningGet<ManagerManagement[]>(`manager-managements:${normalizedIds.join(',')}`, () => {
    const client = requireSupabase()
    return rowsOrThrow<ManagerManagement>(client.from('manager_managements').select('manager_id,management_id').in('management_id', normalizedIds))
  }, force)
}

export async function loadScopedGuidelineData(periodId: string, unitCode: string) {
  const [periods, managements, managers, guidelines] = await Promise.all([
    loadPlanningPeriods(),
    loadScopedManagements(unitCode),
    loadScopedManagers(unitCode),
    loadPlanningGuidelines(periodId, unitCode),
  ])
  return { periods, managements, managers, guidelines }
}

export async function loadCentralGuidelineData(periodId: string) {
  const [guidelines, catalog, managements] = await Promise.all([
    loadPlanningGuidelines(periodId, 'CENTRAL'),
    loadGuidelineAreaCatalog('CENTRAL'),
    loadScopedManagements('CENTRAL'),
  ])
  return { guidelines, catalog, managements }
}

export async function loadUnitMatrixWorkspaceData(periodId: string, unitCode: string) {
  const [catalog, managements, processes, matrices, managers] = await Promise.all([
    loadMatrixAreaCatalog(unitCode),
    loadScopedManagements(unitCode),
    loadProcesses(unitCode),
    loadMatrices(periodId, unitCode),
    loadScopedManagers(unitCode),
  ])
  return { catalog, managements, processes, matrices, managers }
}

export async function loadCentralMatrixWorkspaceData(periodId: string) {
  const [catalog, managements, processes, matrices, managers, guidelines] = await Promise.all([
    loadMatrixAreaCatalog('CENTRAL'),
    loadScopedManagements('CENTRAL'),
    loadProcesses('CENTRAL'),
    loadMatrices(periodId, 'CENTRAL'),
    loadScopedManagers('CENTRAL'),
    loadPlanningGuidelines(periodId, 'CENTRAL'),
  ])
  const managementIds = managements.map(item => item.id)
  const managerManagements = await loadManagerManagements(managementIds)
  return { catalog, managements, processes, matrices, managers, managerManagements, guidelines }
}

export async function prefetchGuidelineWorkspace(periodId: string, unitCode: string) {
  if (unitCode === 'CENTRAL') {
    await loadCentralGuidelineData(periodId)
    return
  }
  const data = await loadScopedGuidelineData(periodId, unitCode)
  void loadManagerManagements(data.managements.map(item => item.id)).catch(() => undefined)
}

export async function prefetchMatrixWorkspace(periodId: string, unitCode: string) {
  if (unitCode === 'CENTRAL') {
    await loadCentralMatrixWorkspaceData(periodId)
    return
  }
  await loadUnitMatrixWorkspaceData(periodId, unitCode)
}
