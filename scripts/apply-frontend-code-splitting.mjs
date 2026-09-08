import fs from 'node:fs'

function patch(path, transforms) {
  let source = fs.readFileSync(path, 'utf8')
  for (const [from, to] of transforms) {
    if (!source.includes(from)) throw new Error(`Pattern not found in ${path}: ${from.slice(0, 140)}`)
    source = source.replace(from, to)
  }
  fs.writeFileSync(path, source)
}

patch('src/App.tsx', [
  [
    "import { FormEvent, useEffect, useState } from 'react'",
    "import { FormEvent, Suspense, lazy, useEffect, useState } from 'react'",
  ],
  [
    "import Dashboard from './DashboardRestricted'\n",
    "",
  ],
  [
    "import { isSupabaseConfigured, supabase } from './lib/supabase'\n",
    "import { isSupabaseConfigured, supabase } from './lib/supabase'\n\nconst Dashboard = lazy(() => import('./DashboardRestricted'))\n\nfunction prefetchDashboardModule() {\n  void import('./DashboardRestricted').catch(() => undefined)\n}\n",
  ],
  [
    "      if (!sessionData.session || !mounted) return\n\n      const { data, error } = await supabase.rpc('current_access')",
    "      if (!sessionData.session || !mounted) return\n\n      prefetchDashboardModule()\n      const { data, error } = await supabase.rpc('current_access')",
  ],
  [
    "    if (error) {\n      setBusy(false)\n      return setStatus('El código no es válido o ya venció. Solicita uno nuevo.', 'error')\n    }\n\n    const { data, error: accessError } = await supabase.rpc('current_access')",
    "    if (error) {\n      setBusy(false)\n      return setStatus('El código no es válido o ya venció. Solicita uno nuevo.', 'error')\n    }\n\n    prefetchDashboardModule()\n    const { data, error: accessError } = await supabase.rpc('current_access')",
  ],
  [
    "    if (error) {\n      setBusy(false)\n      return setStatus('El correo o la contraseña no son válidos.', 'error')\n    }\n\n    const { data, error: accessError } = await supabase.rpc('current_access')",
    "    if (error) {\n      setBusy(false)\n      return setStatus('El correo o la contraseña no son válidos.', 'error')\n    }\n\n    prefetchDashboardModule()\n    const { data, error: accessError } = await supabase.rpc('current_access')",
  ],
  [
    "    return (\n      <Dashboard\n        access={access}\n        onSignOut={async () => {\n          await supabase?.auth.signOut()\n          resetView('chooser')\n        }}\n      />\n    )",
    "    return (\n      <Suspense fallback={<div className=\"module-loading-screen\" role=\"status\">Cargando Control de Gestión...</div>}>\n        <Dashboard\n          access={access}\n          onSignOut={async () => {\n            await supabase?.auth.signOut()\n            resetView('chooser')\n          }}\n        />\n      </Suspense>\n    )",
  ],
])

patch('src/Dashboard.tsx', [
  [
    "import { useEffect, useMemo, useRef, useState } from 'react'",
    "import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'",
  ],
  [
    "import CatalogConfiguration from './CatalogConfiguration'\nimport MatrixWorkspace from './MatrixWorkspace'\nimport PlanningGuidelines from './PlanningGuidelines'\n",
    "",
  ],
  [
    "import './interaction-fixes.css'\n",
    "import './interaction-fixes.css'\n\nconst CatalogConfiguration = lazy(() => import('./CatalogConfiguration'))\nconst PlanningGuidelines = lazy(() => import('./PlanningGuidelines'))\nconst MatrixWorkspace = lazy(() => import('./MatrixWorkspace'))\n\nfunction prefetchCatalogConfigurationModule() { void import('./CatalogConfiguration').catch(() => undefined) }\nfunction prefetchPlanningGuidelinesModule() { void import('./PlanningGuidelines').catch(() => undefined) }\nfunction prefetchMatrixWorkspaceModule() { void import('./MatrixWorkspace').catch(() => undefined) }\n\nfunction ModuleLoading({ label = 'Cargando módulo...' }: { label?: string }) {\n  return <div className=\"planning-loading\" role=\"status\"><LoaderCircle className=\"spin\" size={24}/>{label}</div>\n}\n",
  ],
  [
    "  function navigate(next: Section) {\n    if (next === 'planificacion') setPlanningEntry(null)\n    setSection(next)",
    "  function navigate(next: Section) {\n    if (next === 'planificacion') { setPlanningEntry(null); prefetchPlanningGuidelinesModule() }\n    if (next === 'configuracion') prefetchCatalogConfigurationModule()\n    setSection(next)",
  ],
  [
    "            {section === 'configuracion' && <CatalogConfiguration units={units.map(unit => ({ code: unit.code, name: unit.name }))} canManage={access.global_role === 'GESTION_ESTRATEGICA'} />}",
    "            {section === 'configuracion' && <Suspense fallback={<ModuleLoading label=\"Cargando configuración...\"/>}><CatalogConfiguration units={units.map(unit => ({ code: unit.code, name: unit.name }))} canManage={access.global_role === 'GESTION_ESTRATEGICA'} /></Suspense>}",
  ],
  [
    "  function openMatrixFromGuidelines(managementId: string, guidelineId?: string | null) {\n    if (!selectedPeriod || !selectedPlanningUnit) return\n    void prefetchMatrixWorkspace(selectedPeriod.id, selectedPlanningUnit.code).catch(() => undefined)",
    "  function openMatrixFromGuidelines(managementId: string, guidelineId?: string | null) {\n    if (!selectedPeriod || !selectedPlanningUnit) return\n    prefetchMatrixWorkspaceModule()\n    void prefetchMatrixWorkspace(selectedPeriod.id, selectedPlanningUnit.code).catch(() => undefined)",
  ],
  [
    "    void prefetchGuidelineWorkspace(period.id, unit.code).catch(() => undefined)\n    setStep('guidelines')",
    "    prefetchPlanningGuidelinesModule()\n    void prefetchGuidelineWorkspace(period.id, unit.code).catch(() => undefined)\n    setStep('guidelines')",
  ],
  [
    "onClick={() => { void prefetchGuidelineWorkspace(selectedPeriod.id, selectedPlanningUnit.code).catch(() => undefined); setStep('guidelines'); setError(''); setNotice('') }}",
    "onClick={() => { prefetchPlanningGuidelinesModule(); void prefetchGuidelineWorkspace(selectedPeriod.id, selectedPlanningUnit.code).catch(() => undefined); setStep('guidelines'); setError(''); setNotice('') }}",
  ],
  [
    "    {step === 'guidelines' && selectedPeriod && selectedPlanningUnit && <section className=\"planning-panel planning-panel--wide\"><PlanningGuidelines unit={{ code: selectedPlanningUnit.code, name: selectedPlanningUnit.name }} periodId={selectedPeriod.id} canManage={canManage} onOpenMatrixForArea={openMatrixFromGuidelines} /></section>}",
    "    {step === 'guidelines' && selectedPeriod && selectedPlanningUnit && <section className=\"planning-panel planning-panel--wide\"><Suspense fallback={<ModuleLoading label=\"Cargando lineamientos...\"/>}><PlanningGuidelines unit={{ code: selectedPlanningUnit.code, name: selectedPlanningUnit.name }} periodId={selectedPeriod.id} canManage={canManage} onOpenMatrixForArea={openMatrixFromGuidelines} /></Suspense></section>}",
  ],
  [
    "    {step === 'matrices' && selectedPeriod && selectedPlanningUnit && <section className=\"planning-panel planning-panel--wide\"><MatrixWorkspace periodId={selectedPeriod.id} year={selectedPeriod.year} unitCode={selectedPlanningUnit.code} unitName={selectedPlanningUnit.name} canManage={canManage} onError={setError} onNotice={setNotice} onViewGuidelines={target => { void openGuidelinesFromMatrix(target) }} /></section>}",
    "    {step === 'matrices' && selectedPeriod && selectedPlanningUnit && <section className=\"planning-panel planning-panel--wide\"><Suspense fallback={<ModuleLoading label=\"Cargando matriz...\"/>}><MatrixWorkspace periodId={selectedPeriod.id} year={selectedPeriod.year} unitCode={selectedPlanningUnit.code} unitName={selectedPlanningUnit.name} canManage={canManage} onError={setError} onNotice={setNotice} onViewGuidelines={target => { void openGuidelinesFromMatrix(target) }} /></Suspense></section>}",
  ],
])

console.log('Applied frontend code splitting patches')
