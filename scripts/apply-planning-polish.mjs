import fs from 'node:fs'

function read(path) { return fs.readFileSync(path, 'utf8') }
function write(path, value) { fs.writeFileSync(path, value) }
function replaceOne(source, search, replacement, label) {
  const count = source.split(search).length - 1
  if (count !== 1) throw new Error(`${label}: expected 1 exact match, found ${count}`)
  return source.replace(search, replacement)
}
function replaceRegexOne(source, regex, replacement, label) {
  const matches = [...source.matchAll(new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : `${regex.flags}g`))]
  if (matches.length !== 1) throw new Error(`${label}: expected 1 regex match, found ${matches.length}`)
  return source.replace(regex, replacement)
}

// Unit matrix: multi-owner header, objective picker, multi-management permission and styled export.
{
  const path = 'src/UnitExcelWorkspace.tsx'
  let source = read(path)
  source = replaceOne(source,
    "import { loadUnitMatrixWorkspaceData } from './lib/planning-query-cache'",
    "import { loadGuidelineMultiRelations, loadUnitMatrixWorkspaceData } from './lib/planning-query-cache'\nimport { exportStyledPlanWorkbook } from './lib/styled-plan-export'",
    'unit imports')

  source = replaceOne(source,
    "  const [selectedResponsibleIds, setSelectedResponsibleIds] = useState<string[]>([])\n  const [areaCanEdit, setAreaCanEdit] = useState(false)",
    "  const [selectedResponsibleIds, setSelectedResponsibleIds] = useState<string[]>([])\n  const [activeGuidelineLabel, setActiveGuidelineLabel] = useState('')\n  const [guidelineManagementNames, setGuidelineManagementNames] = useState<string[]>([])\n  const [guidelineResponsibleNames, setGuidelineResponsibleNames] = useState<string[]>([])\n  const [creatingObjective, setCreatingObjective] = useState(false)\n  const [areaCanEdit, setAreaCanEdit] = useState(false)",
    'unit state')

  source = replaceOne(source,
    "  const zoomStyle = { '--matrix-zoom': zoom } as CSSProperties\n  const firstResponsible = useMemo(() => {",
    "  const zoomStyle = { '--matrix-zoom': zoom } as CSSProperties\n  const availableObjectives = useMemo(() => {\n    const unique = new Map<string, string>()\n    rows.forEach(row => {\n      const value = textValue(row.objective_group)\n      const key = normalizeText(value)\n      if (key && !unique.has(key)) unique.set(key, value)\n    })\n    return [...unique.values()]\n  }, [rows])\n  const firstResponsible = useMemo(() => {",
    'unit objectives memo')

  source = replaceOne(source,
    "  useEffect(() => {\n    if (!selectedAreaId) { setAreaCanEdit(false); return }\n    void loadAreaEditPermission(selectedAreaId)\n  }, [selectedAreaId, unitCode])",
    "  useEffect(() => {\n    if (!selectedAreaId) { setAreaCanEdit(false); return }\n    void loadAreaEditPermission(selectedAreaId, selectedMatrix?.guideline_id || null)\n  }, [selectedAreaId, selectedMatrix?.guideline_id, unitCode])",
    'unit permission effect')

  source = replaceOne(source,
    "  useEffect(() => {\n    if (!selectedMatrix) return\n    const process = processes.find(item => item.id === selectedMatrix.process_id)\n    const managementId = process?.management_id || selectedAreaId\n    if (managementId) onGuidelineContextChange?.({ managementId, guidelineId: selectedMatrix.guideline_id })\n  }, [selectedMatrix, selectedAreaId, processes, onGuidelineContextChange])",
    "  useEffect(() => {\n    if (!selectedMatrix) return\n    const process = processes.find(item => item.id === selectedMatrix.process_id)\n    const managementId = process?.management_id || selectedAreaId\n    if (managementId) onGuidelineContextChange?.({ managementId, guidelineId: selectedMatrix.guideline_id })\n  }, [selectedMatrix, selectedAreaId, processes, onGuidelineContextChange])\n  useEffect(() => {\n    const guidelineId = selectedMatrix?.guideline_id\n    if (!guidelineId || !supabase) {\n      setActiveGuidelineLabel(''); setGuidelineManagementNames([]); setGuidelineResponsibleNames([])\n      return\n    }\n    let cancelled = false\n    void (async () => {\n      const parent = await supabase.from('planning_guidelines').select('guideline_text,management_id,responsible_manager_id').eq('id', guidelineId).maybeSingle()\n      if (cancelled || parent.error || !parent.data) return\n      let managementIds = [String(parent.data.management_id || '')].filter(Boolean)\n      let responsibleIds = [String(parent.data.responsible_manager_id || '')].filter(Boolean)\n      try {\n        const relations = await loadGuidelineMultiRelations([guidelineId])\n        if (relations.managements.length) managementIds = relations.managements.map(item => item.management_id)\n        if (relations.responsibles.length) responsibleIds = relations.responsibles.map(item => item.manager_id)\n      } catch {\n        // Compatibility fallback while a deployment and migration finish rolling out.\n      }\n      if (cancelled) return\n      setActiveGuidelineLabel(String(parent.data.guideline_text || ''))\n      setGuidelineManagementNames(managementIds.map(id => areas.find(area => area.id === id)?.name).filter((name): name is string => Boolean(name)))\n      setGuidelineResponsibleNames(responsibleIds.map(id => managerById.get(id)?.name).filter((name): name is string => Boolean(name)))\n    })()\n    return () => { cancelled = true }\n  }, [selectedMatrix?.guideline_id, areas, managerById])",
    'unit guideline header effect')

  source = replaceRegexOne(source,
    /  async function loadAreaEditPermission\(areaId: string\) \{[\s\S]*?\n  \}\n\n  async function loadRows/,
    `  async function loadAreaEditPermission(areaId: string, guidelineId: string | null) {\n    if (!supabase) return\n    if (guidelineId) {\n      const { data, error } = await supabase.rpc('can_edit_guideline_multi', { guideline_id_input: guidelineId })\n      setAreaCanEdit(!error && Boolean(data))\n      return\n    }\n    const { data, error } = await supabase.rpc('can_edit_management', { management_id_input: areaId, unit_code_input: unitCode })\n    setAreaCanEdit(!error && Boolean(data))\n  }\n\n  async function loadRows`,
    'unit permission function')

  source = replaceOne(source,
    "  function startNewRow() {\n    if (rowFormOpen || !effectiveCanManage) return\n    setEditingRowId(null); setRowDraft({ ...emptyRow }); setSelectedResponsibleIds([]); setRowFormOpen(true); onError(''); onNotice('')\n  }",
    "  function startNewRow() {\n    if (rowFormOpen || !effectiveCanManage) return\n    setEditingRowId(null); setRowDraft({ ...emptyRow, objective_group: availableObjectives[0] || '' }); setSelectedResponsibleIds([]); setCreatingObjective(availableObjectives.length === 0); setRowFormOpen(true); onError(''); onNotice('')\n  }",
    'unit start new')

  source = replaceOne(source,
    "    setSelectedResponsibleIds(responsibleIdsByRow[row.id] || (row.responsible_manager_id ? [row.responsible_manager_id] : []))\n    setRowFormOpen(true); onError(''); onNotice('')",
    "    setSelectedResponsibleIds(responsibleIdsByRow[row.id] || (row.responsible_manager_id ? [row.responsible_manager_id] : []))\n    setCreatingObjective(false)\n    setRowFormOpen(true); onError(''); onNotice('')",
    'unit edit objective state')

  source = replaceOne(source,
    "  function cancelRowEdit() {\n    setEditingRowId(null); setRowFormOpen(false); setRowDraft(emptyRow); setSelectedResponsibleIds([])\n  }",
    "  function cancelRowEdit() {\n    setEditingRowId(null); setRowFormOpen(false); setRowDraft(emptyRow); setSelectedResponsibleIds([]); setCreatingObjective(false)\n  }",
    'unit cancel objective state')

  source = replaceOne(source,
    "  async function saveRow() {\n    if (!supabase || !selectedMatrix || !effectiveCanManage || saving) return\n    setSaving(true); onError(''); onNotice('')",
    "  async function saveRow() {\n    if (!supabase || !selectedMatrix || !effectiveCanManage || saving) return\n    if (!textValue(rowDraft.objective_group)) { onError('Selecciona o escribe el Objetivo general de esta acción.'); return }\n    setSaving(true); onError(''); onNotice('')",
    'unit objective validation')

  source = replaceRegexOne(source,
    /  async function exportExcel\(\) \{[\s\S]*?\n  \}\n\n  async function importExcel/,
    `  async function exportExcel() {\n    if (!selectedMatrix) return\n    setExporting(true); onError('')\n    try {\n      const headers = ['OBJETIVO','ACCIÓN','RESPONSABLE','PRIORIDAD','Hitos / Fechas','KPI','INICIO','FIN','RIESGOS','RESTRICCIONES','SOPORTE','ENTREGABLE','COMITÉ']\n      const exportRows = rows.map(row => {\n        const responsible = (responsibleIdsByRow[row.id] || []).map(id => managerById.get(id)?.name).filter(Boolean).join(', ') || row.responsible_text || ''\n        return [row.objective_group || '', row.objective || '', responsible, row.priority || '', row.milestones || '', row.kpi || '', row.start_date || '', row.end_date || '', row.risks || '', row.restrictions || '', row.support || '', row.deliverables || '', row.committee || '']\n      })\n      await exportStyledPlanWorkbook({\n        year, unitCode, unitName, areaName: selectedArea?.name, guideline: activeGuidelineLabel,\n        managementNames: guidelineManagementNames.length ? guidelineManagementNames : (selectedArea?.name ? [selectedArea.name] : []),\n        responsibleNames: guidelineResponsibleNames.length ? guidelineResponsibleNames : (firstResponsible !== 'Sin asignar' ? [firstResponsible] : []),\n        headers, rows: exportRows,\n      })\n    } catch { onError('No pudimos exportar la matriz a Excel.') } finally { setExporting(false) }\n  }\n\n  async function importExcel`,
    'unit export')

  source = replaceOne(source,
    "        <div className=\"matrix-v5-title\"><span>Matriz de Plan de Acción</span><h2>PLAN DE ACCIÓN {year}</h2></div>",
    "        <div className=\"matrix-unit-plan-header\"><span>PLAN DE ACCIÓN {year}</span><strong>{activeGuidelineLabel || 'Lineamiento estratégico'}</strong><div><small><b>Unidad</b>{unitName}</small><small><b>Gerencia(s) Responsable(s)</b>{guidelineManagementNames.join(', ') || selectedArea?.name || '—'}</small><small><b>Responsable(s)</b>{guidelineResponsibleNames.join(', ') || firstResponsible}</small></div></div>",
    'unit plan header')

  source = replaceOne(source,
    "      <div className=\"matrix-v5-summary\"><div><span>Área</span><strong>{selectedArea?.name || '—'}</strong></div><div><span>Unidad</span><strong>{unitName}</strong></div><div><span>Responsable principal</span><strong>{firstResponsible}</strong></div></div>\n      <div className=\"matrix-unit-excel-note\">Esta matriz pertenece únicamente al lineamiento desde el que ingresaste.</div>",
    "      <div className=\"matrix-v5-summary\"><div><span>Área</span><strong>{selectedArea?.name || '—'}</strong></div><div><span>Unidad</span><strong>{unitName}</strong></div><div><span>Responsable principal</span><strong>{firstResponsible}</strong></div></div>\n      {rowFormOpen && <div className=\"matrix-unit-objective-picker\"><label><span>Objetivo general</span>{availableObjectives.length && !creatingObjective ? <select value={rowDraft.objective_group || ''} onChange={event => { if (event.target.value === '__new__') { updateDraft('objective_group', ''); setCreatingObjective(true) } else updateDraft('objective_group', event.target.value) }}><option value=\"\">Seleccionar objetivo</option>{availableObjectives.map(objective => <option key={objective} value={objective}>{objective}</option>)}<option value=\"__new__\">+ Crear nuevo objetivo</option></select> : <input value={rowDraft.objective_group || ''} onChange={event => updateDraft('objective_group', event.target.value)} placeholder={availableObjectives.length ? 'Escribe el nuevo objetivo general' : 'Escribe el primer objetivo general'} autoFocus={!editingRowId}/>}</label>{creatingObjective && availableObjectives.length > 0 && <button type=\"button\" onClick={() => { setCreatingObjective(false); updateDraft('objective_group', availableObjectives[0] || '') }}>Usar objetivo existente</button>}</div>}\n      <div className=\"matrix-unit-excel-note\">Esta matriz pertenece únicamente al lineamiento desde el que ingresaste.</div>",
    'unit objective picker')

  source = replaceOne(source,
    "            <td className=\"matrix-v5-action-cell\">{row.objective || row.objective_group || '—'}</td>",
    "            <td className=\"matrix-v5-action-cell\"><small className=\"matrix-unit-objective-badge\">{row.objective_group || 'Sin objetivo'}</small><span>{row.objective || '—'}</span></td>",
    'unit persisted objective')

  write(path, source)
}

// Central: keep its distinct model, only share the polished Excel writer.
{
  const path = 'src/CentralExcelWorkspace.tsx'
  let source = read(path)
  source = replaceOne(source,
    "import { loadCentralMatrixWorkspaceData } from './lib/planning-query-cache'",
    "import { loadCentralMatrixWorkspaceData } from './lib/planning-query-cache'\nimport { exportStyledPlanWorkbook } from './lib/styled-plan-export'",
    'central export import')
  source = source.replace("const XLSX_MODULE_URL = 'https://unpkg.com/xlsx@0.18.5/xlsx.mjs'\n", '')
  source = replaceRegexOne(source,
    /  async function exportExcel\(\) \{[\s\S]*?\n  \}\n\n\n  async function openHistory/,
    `  async function exportExcel() {\n    if (!selectedMatrix) return\n    setExporting(true); onError('')\n    try {\n      const headers = ['ACCIÓN','RESPONSABLE','PRIORIDAD','Hitos / Fechas','KPI (Cuantitativo)','INICIO','FIN','RIESGOS DE NO EJECUTAR','RESTRICCIONES','SOPORTE','ENTREGABLE','COMITÉ']\n      const exportRows: Array<Array<string | null>> = []\n      let previousGroup = ''\n      rows.forEach(row => {\n        const group = textValue(row.objective_group)\n        if (group && group !== previousGroup) { exportRows.push([group, '', '', '', '', '', '', '', '', '', '', '']); previousGroup = group }\n        const responsible = (centralResponsibleIdsByRow[row.id] || []).map(id => managerById.get(id)?.name).filter(Boolean).join(', ') || row.responsible_text || ''\n        exportRows.push([row.objective || '', responsible, row.priority || '', row.milestones || '', row.kpi || '', row.start_date || '', row.end_date || '', row.risks || '', row.restrictions || '', row.support || '', row.deliverables || '', row.committee || ''])\n        buildCentralSubpointDrafts(centralSubpointsByRow[row.id] || [], row).forEach((subpoint, index) => {\n          exportRows.push([\`S\${index + 1}: \${subpoint.text}\`, '', '', subpoint.milestones, subpoint.kpi, subpoint.start_date, subpoint.end_date, '', '', '', '', ''])\n        })\n      })\n      await exportStyledPlanWorkbook({ year, unitCode: 'CENTRAL', unitName: 'Central', areaName: selectedArea?.name, responsibleNames: principalResponsibleName === 'Sin asignar' ? [] : [principalResponsibleName], headers, rows: exportRows, central: true, fileName: \`Plan_de_Accion_Central_\${selectedArea?.name || 'Area'}_\${year}.xlsx\` })\n    } catch { onError('No pudimos exportar la matriz a Excel.') } finally { setExporting(false) }\n  }\n\n\n  async function openHistory`,
    'central export')
  write(path, source)
}

// Light lazy-loading surface: avoids a dark/unstyled flash on cold module loads.
{
  const appPath = 'src/App.tsx'
  let source = read(appPath)
  source = replaceOne(source, 'className="module-loading-screen"', 'className="module-loading-surface"', 'app loading class')
  write(appPath, source)

  const dashboardPath = 'src/Dashboard.tsx'
  source = read(dashboardPath)
  source = replaceOne(source, 'return <div className="planning-loading" role="status"><LoaderCircle className="spin" size={24}/>{label}</div>', 'return <div className="module-loading-surface module-loading-surface--module" role="status"><LoaderCircle className="spin" size={24}/>{label}</div>', 'dashboard loading class')
  write(dashboardPath, source)

  const stylesPath = 'src/styles.css'
  source = read(stylesPath)
  if (!source.includes('.module-loading-surface{')) source += `\n.module-loading-surface{min-height:100vh;display:grid;place-items:center;align-content:center;gap:10px;padding:24px;box-sizing:border-box;background:#f8fafc;color:#33536b;font-size:13px;font-weight:750}.module-loading-surface--module{min-height:260px;width:100%;border:1px solid #dce6ed;border-radius:14px;background:#fff}.module-loading-surface .spin{color:#176fb3}\n`
  write(stylesPath, source)
}

// Non-Central matrix visual polish.
{
  const path = 'src/unit-excel-workspace.css'
  let source = read(path)
  if (!source.includes('.matrix-unit-plan-header{')) source += `\n.matrix-unit-plan-header{display:grid;gap:0;min-width:0;border:1px solid color-mix(in srgb,var(--unit) 28%,#d6e2ea);border-radius:10px;overflow:hidden;background:#fff}.matrix-unit-plan-header>span{display:block;padding:8px 12px 5px;color:var(--unit);font-size:12px;font-weight:950;letter-spacing:.04em}.matrix-unit-plan-header>strong{display:block;padding:8px 12px;background:var(--unit);color:#fff;font-size:13px;line-height:1.35}.matrix-unit-plan-header>div{display:grid;grid-template-columns:.8fr 1.2fr 1.2fr;border-top:1px solid color-mix(in srgb,var(--unit) 24%,#dce6ed)}.matrix-unit-plan-header>div small{display:grid;gap:3px;padding:8px 11px;border-right:1px solid #dce6ed;color:#294960;font-size:9.5px;line-height:1.35}.matrix-unit-plan-header>div small:last-child{border-right:0}.matrix-unit-plan-header>div b{color:#708594;font-size:8px;text-transform:uppercase;letter-spacing:.06em}.matrix-unit-objective-picker{display:flex;align-items:end;gap:9px;margin:0 0 10px;padding:10px 12px;border:1px solid color-mix(in srgb,var(--unit) 24%,#d7e3eb);border-radius:9px;background:color-mix(in srgb,var(--unit) 5%,#fff)}.matrix-unit-objective-picker label{display:grid;gap:5px;flex:1;min-width:0}.matrix-unit-objective-picker label>span{color:#35546a;font-size:9px;font-weight:900;text-transform:uppercase}.matrix-unit-objective-picker select,.matrix-unit-objective-picker input{width:100%;min-height:38px;padding:0 10px;box-sizing:border-box;border:1px solid #cbd9e3;border-radius:7px;background:#fff;color:#24455d;font:inherit;font-size:10.5px;outline:0}.matrix-unit-objective-picker select:focus,.matrix-unit-objective-picker input:focus{border-color:var(--unit);box-shadow:0 0 0 2px color-mix(in srgb,var(--unit) 12%,transparent)}.matrix-unit-objective-picker>button{min-height:38px;padding:0 11px;border:1px solid #c9d7e1;border-radius:7px;background:#fff;color:#4e687a;font-size:9.5px;font-weight:850}.matrix-v5-action-cell{display:grid;gap:5px}.matrix-unit-objective-badge{display:inline-flex;width:max-content;max-width:100%;padding:3px 6px;border-radius:999px;background:color-mix(in srgb,var(--unit) 10%,#fff);color:var(--unit);font-size:8px;font-weight:900;line-height:1.2}.matrix-v5-action-cell>span{color:#23445b;line-height:1.4}@media(max-width:900px){.matrix-unit-plan-header>div{grid-template-columns:1fr}.matrix-unit-plan-header>div small{border-right:0;border-bottom:1px solid #e1e9ee}.matrix-unit-plan-header>div small:last-child{border-bottom:0}.matrix-unit-objective-picker{align-items:stretch;flex-direction:column}}\n`
  write(path, source)
}

console.log('Planning polish patch applied successfully.')
