import fs from 'node:fs'

function patch(path, transforms) {
  let source = fs.readFileSync(path, 'utf8')
  for (const [from, to] of transforms) {
    if (!source.includes(from)) throw new Error(`Pattern not found in ${path}: ${from.slice(0, 120)}`)
    source = source.replace(from, to)
  }
  fs.writeFileSync(path, source)
}

patch('src/PlanningGuidelines.tsx', [
  [
    "import { invalidatePlanningCache, prefetchMatrixWorkspace } from './lib/planning-query-cache'",
    "import { invalidatePlanningCache, prefetchMatrixWorkspace } from './lib/planning-query-cache'\nimport { prefetchMatrixTargetRows } from './lib/matrix-target-prefetch'",
  ],
  [
    "  function openMatrixForSelectedArea() {\n    if (!selectedArea) return\n    void prefetchMatrixWorkspace(periodId, unit.code).catch(() => undefined)",
    "  useEffect(() => {\n    if (!selectedArea) return\n    void prefetchMatrixTargetRows(periodId, unit.code, selectedArea.id, null).catch(() => undefined)\n  }, [selectedArea, periodId, unit.code])\n\n  function prefetchMatrixForGuideline(managementId: string, guidelineId: string) {\n    void prefetchMatrixTargetRows(periodId, unit.code, managementId, guidelineId).catch(() => undefined)\n  }\n\n  function openMatrixForSelectedArea() {\n    if (!selectedArea) return\n    void prefetchMatrixWorkspace(periodId, unit.code).catch(() => undefined)\n    void prefetchMatrixTargetRows(periodId, unit.code, selectedArea.id, null).catch(() => undefined)",
  ],
  [
    "  function openMatrixForGuideline(managementId: string, guidelineId: string) {\n    void prefetchMatrixWorkspace(periodId, unit.code).catch(() => undefined)",
    "  function openMatrixForGuideline(managementId: string, guidelineId: string) {\n    void prefetchMatrixWorkspace(periodId, unit.code).catch(() => undefined)\n    void prefetchMatrixTargetRows(periodId, unit.code, managementId, guidelineId).catch(() => undefined)",
  ],
  [
    "onSelectGuideline={setSelectedGuideline} onOpenMatrixForGuideline={openMatrixForGuideline}",
    "onSelectGuideline={setSelectedGuideline} onPrefetchMatrixForGuideline={prefetchMatrixForGuideline} onOpenMatrixForGuideline={openMatrixForGuideline}",
  ],
])

patch('src/GuidelineCatalogV2.tsx', [
  [
    "  onSelectGuideline?: (guideline: GuidelineSelection) => void\n  onOpenMatrixForGuideline?: (managementId: string, guidelineId: string) => void",
    "  onSelectGuideline?: (guideline: GuidelineSelection) => void\n  onPrefetchMatrixForGuideline?: (managementId: string, guidelineId: string) => void\n  onOpenMatrixForGuideline?: (managementId: string, guidelineId: string) => void",
  ],
  [
    "export default function GuidelineCatalogV2({ units, canManage, scopePeriodId, scopeUnitCode, selectedGuidelineId, onSelectGuideline, onOpenMatrixForGuideline }: Props)",
    "export default function GuidelineCatalogV2({ units, canManage, scopePeriodId, scopeUnitCode, selectedGuidelineId, onSelectGuideline, onPrefetchMatrixForGuideline, onOpenMatrixForGuideline }: Props)",
  ],
  [
    "<tr key={item.id} className={`${!item.active ? 'inactive-row ' : ''}${isSelected ? 'guideline-selected' : ''}`.trim()} aria-selected={isSelected || undefined} onClick={() => unitCode !== 'CENTRAL' && onSelectGuideline?.({ id: item.id, managementId: item.management_id, label: item.guideline_text })}>",
    "<tr key={item.id} className={`${!item.active ? 'inactive-row ' : ''}${isSelected ? 'guideline-selected' : ''}`.trim()} aria-selected={isSelected || undefined} onPointerEnter={() => unitCode !== 'CENTRAL' && onPrefetchMatrixForGuideline?.(item.management_id, item.id)} onFocus={() => unitCode !== 'CENTRAL' && onPrefetchMatrixForGuideline?.(item.management_id, item.id)} onClick={() => unitCode !== 'CENTRAL' && onSelectGuideline?.({ id: item.id, managementId: item.management_id, label: item.guideline_text })}>",
  ],
])

patch('src/UnitExcelWorkspace.tsx', [
  [
    "import { loadUnitMatrixWorkspaceData } from './lib/planning-query-cache'",
    "import { loadUnitMatrixWorkspaceData } from './lib/planning-query-cache'\nimport { takePrefetchedMatrixRows } from './lib/matrix-target-prefetch'",
  ],
  [
    "    if (!keepEditor) setRowsLoading(true)\n    const rowResult = await supabase.from('matrix_rows').select('*').eq('matrix_id', matrixId).order('sort_order').order('created_at')\n    if (requestId !== loadRowsRequestRef.current) return\n    if (rowResult.error) { setRowsLoading(false); onError('No pudimos cargar la matriz.'); return }\n    const nextRows = (rowResult.data || []) as MatrixRow[]\n    const grouped: Record<string, string[]> = {}\n    if (nextRows.length) {\n      const linksResult = await supabase.from('matrix_row_responsibles').select('row_id,manager_id,sort_order').in('row_id', nextRows.map(row => row.id)).order('sort_order')\n      if (requestId !== loadRowsRequestRef.current) return\n      if (linksResult.error) {\n        setRowsLoading(false)\n        onError('No pudimos cargar los responsables sin riesgo de perder información.')\n        return\n      }\n      ;((linksResult.data || []) as RowResponsible[]).forEach(link => {",
    "    if (!keepEditor) setRowsLoading(true)\n    const prefetched = keepEditor ? null : await takePrefetchedMatrixRows(matrixId, false)\n    let nextRows: MatrixRow[]\n    let responsibleRows: RowResponsible[]\n    if (prefetched) {\n      nextRows = prefetched.rows as MatrixRow[]\n      responsibleRows = prefetched.responsibles as RowResponsible[]\n    } else {\n      const rowResult = await supabase.from('matrix_rows').select('*').eq('matrix_id', matrixId).order('sort_order').order('created_at')\n      if (requestId !== loadRowsRequestRef.current) return\n      if (rowResult.error) { setRowsLoading(false); onError('No pudimos cargar la matriz.'); return }\n      nextRows = (rowResult.data || []) as MatrixRow[]\n      responsibleRows = []\n      if (nextRows.length) {\n        const linksResult = await supabase.from('matrix_row_responsibles').select('row_id,manager_id,sort_order').in('row_id', nextRows.map(row => row.id)).order('sort_order')\n        if (requestId !== loadRowsRequestRef.current) return\n        if (linksResult.error) {\n          setRowsLoading(false)\n          onError('No pudimos cargar los responsables sin riesgo de perder información.')\n          return\n        }\n        responsibleRows = (linksResult.data || []) as RowResponsible[]\n      }\n    }\n    if (requestId !== loadRowsRequestRef.current) return\n    const grouped: Record<string, string[]> = {}\n    if (nextRows.length) {\n      ;responsibleRows.forEach(link => {",
  ],
])

patch('src/CentralExcelWorkspace.tsx', [
  [
    "import { loadCentralMatrixWorkspaceData } from './lib/planning-query-cache'",
    "import { loadCentralMatrixWorkspaceData } from './lib/planning-query-cache'\nimport { takePrefetchedMatrixRows } from './lib/matrix-target-prefetch'",
  ],
  [
    "    if (!keepEditor) setRowsLoading(true)\n    const rowResult = await supabase.from('matrix_rows').select('*').eq('matrix_id', matrixId).order('sort_order').order('created_at')\n    if (requestId !== loadRowsRequestRef.current) return\n    if (rowResult.error) { setRowsLoading(false); onError('No pudimos cargar la matriz.'); return }\n    const nextRows = (rowResult.data || []) as MatrixRow[]\n    const rowIds = nextRows.map(row => row.id)\n    const [linksResult, subpointsResult] = rowIds.length\n      ? await Promise.all([\n          supabase.from('matrix_row_responsibles').select('row_id,manager_id,sort_order').in('row_id', rowIds).order('sort_order'),\n          supabase.from('matrix_row_subpoints').select('id,matrix_row_id,text,milestones,kpi,start_date,end_date,sort_order').in('matrix_row_id', rowIds).order('sort_order').order('created_at'),\n        ])\n      : [{ data: [], error: null }, { data: [], error: null }]\n    if (requestId !== loadRowsRequestRef.current) return\n    if (linksResult.error || subpointsResult.error) {\n      setRowsLoading(false)\n      onError('No pudimos cargar responsables y subpuntos sin riesgo de perder información.')\n      return\n    }\n\n    const groupedResponsibleIds: Record<string, string[]> = {}\n    ;((linksResult.data || []) as RowResponsible[]).forEach(link => {",
    "    if (!keepEditor) setRowsLoading(true)\n    const prefetched = keepEditor ? null : await takePrefetchedMatrixRows(matrixId, true)\n    let nextRows: MatrixRow[]\n    let responsibleRows: RowResponsible[]\n    let subpointRows: PersistedCentralSubpoint[]\n    if (prefetched) {\n      nextRows = prefetched.rows as MatrixRow[]\n      responsibleRows = prefetched.responsibles as RowResponsible[]\n      subpointRows = prefetched.subpoints as PersistedCentralSubpoint[]\n    } else {\n      const rowResult = await supabase.from('matrix_rows').select('*').eq('matrix_id', matrixId).order('sort_order').order('created_at')\n      if (requestId !== loadRowsRequestRef.current) return\n      if (rowResult.error) { setRowsLoading(false); onError('No pudimos cargar la matriz.'); return }\n      nextRows = (rowResult.data || []) as MatrixRow[]\n      const rowIds = nextRows.map(row => row.id)\n      const [linksResult, subpointsResult] = rowIds.length\n        ? await Promise.all([\n            supabase.from('matrix_row_responsibles').select('row_id,manager_id,sort_order').in('row_id', rowIds).order('sort_order'),\n            supabase.from('matrix_row_subpoints').select('id,matrix_row_id,text,milestones,kpi,start_date,end_date,sort_order').in('matrix_row_id', rowIds).order('sort_order').order('created_at'),\n          ])\n        : [{ data: [], error: null }, { data: [], error: null }]\n      if (requestId !== loadRowsRequestRef.current) return\n      if (linksResult.error || subpointsResult.error) {\n        setRowsLoading(false)\n        onError('No pudimos cargar responsables y subpuntos sin riesgo de perder información.')\n        return\n      }\n      responsibleRows = (linksResult.data || []) as RowResponsible[]\n      subpointRows = (subpointsResult.data || []) as PersistedCentralSubpoint[]\n    }\n    if (requestId !== loadRowsRequestRef.current) return\n\n    const groupedResponsibleIds: Record<string, string[]> = {}\n    ;responsibleRows.forEach(link => {",
  ],
  [
    ";((subpointsResult.data || []) as PersistedCentralSubpoint[]).forEach(item => {",
    ";subpointRows.forEach(item => {",
  ],
])

console.log('Applied exact matrix target prefetch patches')
