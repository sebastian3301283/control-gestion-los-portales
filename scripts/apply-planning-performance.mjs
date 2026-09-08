import { readFile, writeFile } from 'node:fs/promises'

async function patch(path, transform) {
  const before = await readFile(path, 'utf8')
  const after = transform(before)
  if (after === before) throw new Error(`No changes applied to ${path}`)
  await writeFile(path, after)
}

function addImport(source, anchor, addition) {
  if (source.includes(addition.trim())) return source
  if (!source.includes(anchor)) throw new Error(`Import anchor not found: ${anchor}`)
  return source.replace(anchor, `${anchor}${addition}`)
}

function replaceOne(source, pattern, replacement, label) {
  const matches = source.match(pattern)
  if (!matches) throw new Error(`Pattern not found: ${label}`)
  return source.replace(pattern, replacement)
}

await patch('src/UnitExcelWorkspace.tsx', source => {
  let next = addImport(source, "import { supabase } from './lib/supabase'\n", "import { loadUnitMatrixWorkspaceData } from './lib/planning-query-cache'\n")
  next = replaceOne(next,
    /      const \[catalogResult, areaResult, processResult, matrixResult, managerResult\] = await Promise\.all\(\[\n[\s\S]*?      setManagers\(\(managerResult\.data \|\| \[\]\) as Manager\[\]\)\n/,
    `      const workspaceData = await loadUnitMatrixWorkspaceData(periodId, unitCode)\n      const allAreas = workspaceData.managements as Area[]\n      const processData = workspaceData.processes as Process[]\n      const matrixData = workspaceData.matrices as Matrix[]\n      const allowedByCatalog = new Set(workspaceData.catalog.map(item => String(item.management_id)))\n      const allowedByProcess = new Set(processData.map(item => item.management_id))\n      const uniqueAreas = new Map<string, Area>()\n      allAreas.forEach(area => {\n        if (!allowedByCatalog.has(area.id) || !allowedByProcess.has(area.id)) return\n        const key = normalizeText(area.name)\n        if (!uniqueAreas.has(key)) uniqueAreas.set(key, area)\n      })\n      const areaData = [...uniqueAreas.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'))\n      setAreas(areaData)\n      setProcesses(processData)\n      setMatrices(matrixData)\n      setManagers(workspaceData.managers as Manager[])\n`,
    'UnitExcelWorkspace loadWorkspace')
  return next
})

await patch('src/CentralExcelWorkspace.tsx', source => {
  let next = addImport(source, "import { supabase } from './lib/supabase'\n", "import { loadCentralMatrixWorkspaceData } from './lib/planning-query-cache'\n")
  next = replaceOne(next,
    /      const \[catalogResult, areaResult, processResult, matrixResult, managerResult, mappingResult, guidelineResult\] = await Promise\.all\(\[\n[\s\S]*?      setGuidelines\(\(guidelineResult\.data \|\| \[\]\) as Guideline\[\]\)\n/,
    `      const workspaceData = await loadCentralMatrixWorkspaceData(periodId)\n      const allAreas = workspaceData.managements as Area[]\n      const processData = workspaceData.processes as Process[]\n      const allowedByCatalog = new Set(workspaceData.catalog.map(item => String(item.management_id)))\n      const allowedByProcess = new Set(processData.map(item => item.management_id))\n      setAreas(allAreas.filter(area => allowedByCatalog.has(area.id) && allowedByProcess.has(area.id)))\n      setProcesses(processData)\n      setMatrices(workspaceData.matrices as Matrix[])\n      setManagers(workspaceData.managers as Manager[])\n      setManagerManagements(workspaceData.managerManagements as ManagerManagement[])\n      setGuidelines(workspaceData.guidelines as Guideline[])\n`,
    'CentralExcelWorkspace loadWorkspace')
  return next
})

await patch('src/MatrixWorkspace.tsx', source => {
  let next = addImport(source, "import { supabase } from './lib/supabase'\n", "import { loadScopedManagements } from './lib/planning-query-cache'\n")
  next = replaceOne(next,
    /      const \{ data, error \} = await supabase\.from\('managements_global'\)\.select\('name'\)\.eq\('id', target!\.managementId\)\.maybeSingle\(\)\n      if \(stopped \|\| error \|\| !data\?\.name\) return\n      const targetName = String\(data\.name\)\.trim\(\)\.toLocaleLowerCase\('es'\)/,
    `      const managements = await loadScopedManagements(props.unitCode)\n      const management = managements.find(item => item.id === target!.managementId)\n      if (stopped || !management?.name) return\n      const targetName = String(management.name).trim().toLocaleLowerCase('es')`,
    'MatrixWorkspace target management lookup')
  return next
})

await patch('src/Dashboard.tsx', source => {
  let next = addImport(source, "import { supabase } from './lib/supabase'\n", "import { loadPlanningPeriods, prefetchGuidelineWorkspace, prefetchMatrixWorkspace } from './lib/planning-query-cache'\n")

  next = replaceOne(next,
    /  async function loadDashboardPeriods\(\) \{\n    if \(!supabase\) return\n    const \{ data \} = await supabase\.from\('planning_periods'\)\.select\('id, year, name, status'\)\.order\('year', \{ ascending: true \}\)\n    const next = \(data \|\| \[\]\) as PlanningPeriod\[\]\n    setPeriods\(next\)\n    if \(next\.length && !next\.some\(period => period\.year === selectedHomeYear\)\) \{\n      const preferred = next\.find\(period => period\.status === 'OPEN'\) \|\| next\[0\]\n      setSelectedHomeYear\(preferred\.year\)\n    \}\n  \}/,
    `  async function loadDashboardPeriods() {\n    if (!supabase) return\n    try {\n      const next = await loadPlanningPeriods() as PlanningPeriod[]\n      setPeriods(next)\n      if (next.length && !next.some(period => period.year === selectedHomeYear)) {\n        const preferred = next.find(period => period.status === 'OPEN') || next[0]\n        setSelectedHomeYear(preferred.year)\n      }\n    } catch {\n      // The planning view owns the visible error state; keep the dashboard usable here.\n    }\n  }`,
    'Dashboard period loader')

  next = replaceOne(next,
    /  async function loadPeriodContext\(\) \{\n    if \(!supabase\) return\n    setLoading\(true\); setError\(''\)\n    const \{ data, error: queryError \} = await supabase\.from\('planning_periods'\)\.select\('id, year, name, status'\)\.order\('year', \{ ascending: true \}\)\n    setLoading\(false\)\n    if \(queryError\) \{ setError\('No pudimos cargar el periodo configurado\.'\); return \}\n    const available = \(data \|\| \[\]\) as PlanningPeriod\[\]\n/,
    `  async function loadPeriodContext() {\n    if (!supabase) return\n    setLoading(true); setError('')\n    let available: PlanningPeriod[] = []\n    try {\n      available = await loadPlanningPeriods() as PlanningPeriod[]\n    } catch {\n      setLoading(false)\n      setError('No pudimos cargar el periodo configurado.')\n      return\n    }\n    setLoading(false)\n`,
    'PlanningView period loader')

  next = replaceOne(next,
    /  function openMatrixFromGuidelines\(managementId: string, guidelineId\?: string \| null\) \{\n    if \(!selectedPeriod \|\| !selectedPlanningUnit\) return\n/,
    `  function openMatrixFromGuidelines(managementId: string, guidelineId?: string | null) {\n    if (!selectedPeriod || !selectedPlanningUnit) return\n    void prefetchMatrixWorkspace(selectedPeriod.id, selectedPlanningUnit.code).catch(() => undefined)\n`,
    'matrix prefetch navigation')

  next = replaceOne(next,
    /    if \(resolvedTarget\?\.managementId\) \{[\s\S]*?    \}\n    setStep\('guidelines'\)/,
    match => `${match.slice(0, match.lastIndexOf("    setStep('guidelines')"))}    void prefetchGuidelineWorkspace(period.id, unit.code).catch(() => undefined)\n    setStep('guidelines')`,
    'guideline return prefetch')

  next = replaceOne(next,
    /onClick=\{\(\) => \{ setStep\('guidelines'\); setError\(''\); setNotice\(''\) \}\}/,
    `onClick={() => { void prefetchGuidelineWorkspace(selectedPeriod.id, selectedPlanningUnit.code).catch(() => undefined); setStep('guidelines'); setError(''); setNotice('') }}`,
    'guideline module prefetch')

  return next
})

console.log('Planning performance patches applied.')
