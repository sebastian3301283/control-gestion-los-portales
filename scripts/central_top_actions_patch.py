from pathlib import Path

root = Path('.')
source_path = root / 'src' / 'CentralExcelWorkspace.tsx'
css_path = root / 'src' / 'central-excel-workspace.css'
inline_test_path = root / 'tests' / 'central-guideline-inline-create.test.mjs'
ui_test_path = root / 'tests' / 'central-ui-guideline-flow.test.mjs'

source = source_path.read_text(encoding='utf-8')

replacements = [
(
"  const [expandedGuidelineKeys, setExpandedGuidelineKeys] = useState<Set<string>>(() => new Set())\n",
"  const [expandedGuidelineKeys, setExpandedGuidelineKeys] = useState<Set<string>>(() => new Set())\n  const [activeGuidelineId, setActiveGuidelineId] = useState<string | null>(null)\n"
),
(
"  const highestAreaManagers = useMemo(() => filterHighestAreaManagers(centralManagers), [centralManagers])\n",
"  const highestAreaManagers = useMemo(() => filterHighestAreaManagers(centralManagers), [centralManagers])\n  const activeGuideline = useMemo(() => areaGuidelines.find(item => item.id === activeGuidelineId) || null, [activeGuidelineId, areaGuidelines])\n"
),
(
"    setSelectedAreaId(area.id); setSelectedMatrixId(matrix.id); cancelRowEdit(); setPage('sheet'); onError(''); onNotice('')\n",
"    setSelectedAreaId(area.id); setSelectedMatrixId(matrix.id); setActiveGuidelineId(null); cancelRowEdit(); setPage('sheet'); onError(''); onNotice('')\n"
),
(
"    setEditingRowId(null)\n    setRowDraft({ ...emptyRow, guideline_id: guidelineId, objective_group: guidelineText })\n",
"    setEditingRowId(null)\n    setActiveGuidelineId(guidelineId)\n    setRowDraft({ ...emptyRow, guideline_id: guidelineId, objective_group: guidelineText })\n"
),
(
"    const groupKey = matchedGuidelineId || `legacy:${normalizeText(row.objective_group) || row.id}`\n    setExpandedGuidelineKeys(current => { const next = new Set(current); next.add(groupKey); return next })\n",
"    const groupKey = matchedGuidelineId || `legacy:${normalizeText(row.objective_group) || row.id}`\n    if (matchedGuidelineId) setActiveGuidelineId(matchedGuidelineId)\n    setExpandedGuidelineKeys(current => { const next = new Set(current); next.add(groupKey); return next })\n"
),
(
"  function toggleGuidelineGroup(key: string, groupRows: MatrixRow[]) {\n    setExpandedGuidelineKeys(current => {\n",
"  function startNewRowForActiveGuideline() {\n    if (!activeGuideline) { onNotice('Selecciona primero el lineamiento donde quieres añadir la acción.'); return }\n    startNewRowForGuideline(activeGuideline.id, activeGuideline.guideline_text)\n  }\n\n  function toggleGuidelineGroup(key: string, groupRows: MatrixRow[]) {\n    if (!key.startsWith('legacy:')) setActiveGuidelineId(key)\n    setExpandedGuidelineKeys(current => {\n"
),
(
"      </div></div>\n\n      <div className=\"matrix-v5-title\"><span>Matriz de Plan de Acción</span><h2>PLAN DE ACCIÓN {year}</h2></div>\n      <div className=\"matrix-v5-summary\"><div><span>Área</span><strong>{selectedArea?.name || '—'}</strong></div><div><span>Unidad</span><strong>Central</strong></div><div>{rowFormOpen && <div className=\"matrix-central-summary-edit-actions\"><button type=\"button\" onClick={() => setCentralSubpointDrafts(current => [...current, emptyCentralSubpoint()])}><Plus size={13}/> Añadir subobjetivo</button><button type=\"button\" className=\"save\" data-edit-action=\"save\" onClick={() => void saveRow()} disabled={saving}>{saving && <LoaderCircle className=\"spin\" size={13}/>} Guardar</button><button type=\"button\" data-edit-action=\"cancel\" onClick={cancelRowEdit}>Cancelar</button>{editingRowId && <button type=\"button\" className=\"danger\" data-edit-action=\"delete\" onClick={() => void deleteRow(editingRowId)}><Trash2 size={13}/> Eliminar acción</button>}</div>}<span>Responsable principal</span><label className=\"matrix-central-principal-responsible\"><select value={selectedMatrix.principal_responsible_manager_id || ''} onChange={event => void savePrincipalResponsible(event.target.value)} disabled={!effectiveCanManage || principalSaving}><option value=\"\">Sin asignar</option>{highestAreaManagers.map(manager => <option key={manager.id} value={manager.id}>{manager.name}{manager.cargo ? ` · ${manager.cargo}` : ''}</option>)}</select>{principalSaving && <LoaderCircle className=\"spin\" size={14}/>}</label></div></div>\n",
"      </div></div>\n\n      <div className=\"matrix-central-top-actions\" aria-label=\"Acciones de matriz\">\n        {effectiveCanManage && <button type=\"button\" className=\"add-action\" onClick={startNewRowForActiveGuideline} disabled={rowFormOpen || !activeGuideline} title={activeGuideline ? `Añadir acción en ${activeGuideline.guideline_text}` : 'Selecciona primero un lineamiento'}><Plus size={13}/> Añadir acción</button>}\n        {rowFormOpen && <><button type=\"button\" onClick={() => setCentralSubpointDrafts(current => [...current, emptyCentralSubpoint()])}><Plus size={13}/> Añadir subobjetivo</button><button type=\"button\" className=\"save\" data-edit-action=\"save\" onClick={() => void saveRow()} disabled={saving}>{saving && <LoaderCircle className=\"spin\" size={13}/>} Guardar</button><button type=\"button\" data-edit-action=\"cancel\" onClick={cancelRowEdit}>Cancelar</button>{editingRowId && <button type=\"button\" className=\"danger\" data-edit-action=\"delete\" onClick={() => void deleteRow(editingRowId)}><Trash2 size={13}/> Eliminar acción</button>}</>}\n      </div>\n\n      <div className=\"matrix-v5-title\"><span>Matriz de Plan de Acción</span><h2>PLAN DE ACCIÓN {year}</h2></div>\n      <div className=\"matrix-v5-summary\"><div><span>Área</span><strong>{selectedArea?.name || '—'}</strong></div><div><span>Unidad</span><strong>Central</strong></div><div><span>Responsable principal</span><label className=\"matrix-central-principal-responsible\"><select value={selectedMatrix.principal_responsible_manager_id || ''} onChange={event => void savePrincipalResponsible(event.target.value)} disabled={!effectiveCanManage || principalSaving}><option value=\"\">Sin asignar</option>{highestAreaManagers.map(manager => <option key={manager.id} value={manager.id}>{manager.name}{manager.cargo ? ` · ${manager.cargo}` : ''}</option>)}</select>{principalSaving && <LoaderCircle className=\"spin\" size={14}/>}</label></div></div>\n"
),
(
"    <tr className=\"matrix-v5-objective-row matrix-central-objective-group matrix-central-guideline-bar\"><td colSpan={tableColSpan}><div className=\"matrix-central-guideline-bar-content\"><button type=\"button\" className=\"matrix-central-guideline-toggle\" aria-expanded={groupOpen} onClick={() => toggleGuidelineGroup(group.key, group.rows)}><span aria-hidden=\"true\">{groupOpen ? '▼' : '▶'}</span><strong>{group.code ? `${group.code} · ` : ''}{group.label}</strong><small>{group.rows.length} objetivo{group.rows.length === 1 ? '' : 's'}</small></button>{effectiveCanManage && !group.key.startsWith('legacy:') && <button type=\"button\" className=\"matrix-central-guideline-add-action\" onClick={() => startNewRowForGuideline(group.key, group.label)} disabled={rowFormOpen}><Plus size={13}/> Añadir acción</button>}</div></td></tr>\n",
"    <tr className={`matrix-v5-objective-row matrix-central-objective-group matrix-central-guideline-bar ${activeGuidelineId === group.key ? 'matrix-central-guideline-bar--active' : ''}`}><td colSpan={tableColSpan}><div className=\"matrix-central-guideline-bar-content\"><button type=\"button\" className=\"matrix-central-guideline-toggle\" aria-expanded={groupOpen} onClick={() => toggleGuidelineGroup(group.key, group.rows)}><span aria-hidden=\"true\">{groupOpen ? '▼' : '▶'}</span><strong>{group.code ? `${group.code} · ` : ''}{group.label}</strong><small>{group.rows.length} objetivo{group.rows.length === 1 ? '' : 's'}</small></button></div></td></tr>\n"
),
]

for old, new in replacements:
    if old not in source:
        raise SystemExit(f'Missing source replacement:\n{old[:180]}')
    source = source.replace(old, new, 1)

source_path.write_text(source, encoding='utf-8')

css = css_path.read_text(encoding='utf-8')
old_css = ".matrix-central-summary-edit-actions{display:flex;flex-wrap:wrap;align-items:center;gap:5px;margin-bottom:7px}\n.matrix-central-summary-edit-actions button{display:inline-flex;align-items:center;justify-content:center;gap:4px;min-height:30px;border:1px solid #b8cddd;border-radius:6px;background:#fff;color:#31566f;padding:0 9px;font-size:10px;font-weight:850;cursor:pointer}\n.matrix-central-summary-edit-actions button.save{background:#1f6fae;border-color:#1f6fae;color:#fff}\n.matrix-central-summary-edit-actions button.danger{border-color:#efb7b7;color:#b33434;background:#fff8f8}\n.matrix-central-summary-edit-actions button:disabled{opacity:.55;cursor:wait}\n.matrix-central-guideline-bar-content{display:flex;align-items:center;gap:8px;width:100%}\n.matrix-central-guideline-bar-content .matrix-central-guideline-toggle{flex:1;min-width:0;width:auto}\n.matrix-central-guideline-add-action{display:inline-flex;align-items:center;justify-content:center;gap:5px;flex:0 0 auto;margin-right:10px;min-height:30px;border:1px solid #78a9cf;border-radius:6px;background:#fff;color:#175c92;padding:0 10px;font-size:10px;font-weight:850;cursor:pointer}\n.matrix-central-guideline-add-action:hover{background:#f5fbff}\n.matrix-central-guideline-add-action:disabled{opacity:.45;cursor:not-allowed}\n"
new_css = ".matrix-central-top-actions{display:flex;flex-wrap:wrap;align-items:center;justify-content:flex-end;gap:6px;padding:8px 4px 6px;min-height:38px}\n.matrix-central-top-actions button{display:inline-flex;align-items:center;justify-content:center;gap:4px;min-height:32px;border:1px solid #b8cddd;border-radius:6px;background:#fff;color:#31566f;padding:0 10px;font-size:10px;font-weight:850;cursor:pointer}\n.matrix-central-top-actions button.add-action{border-color:#78a9cf;color:#175c92}\n.matrix-central-top-actions button.add-action:hover:not(:disabled){background:#f5fbff}\n.matrix-central-top-actions button.save{background:#1f6fae;border-color:#1f6fae;color:#fff}\n.matrix-central-top-actions button.danger{border-color:#efb7b7;color:#b33434;background:#fff8f8}\n.matrix-central-top-actions button:disabled{opacity:.45;cursor:not-allowed}\n.matrix-central-guideline-bar-content{display:flex;align-items:center;width:100%}\n.matrix-central-guideline-bar-content .matrix-central-guideline-toggle{flex:1;min-width:0;width:auto}\n.matrix-central-guideline-bar--active>td{box-shadow:inset 4px 0 0 #1f6fae}\n@media(max-width:720px){.matrix-central-top-actions{justify-content:flex-start;padding-inline:0}}\n"
if old_css not in css:
    raise SystemExit('Missing old Central action CSS block')
css = css.replace(old_css, new_css, 1)
css_path.write_text(css, encoding='utf-8')

inline_test = inline_test_path.read_text(encoding='utf-8')
old = "test('Central row edit actions live above Responsable principal instead of inside the spreadsheet responsible cell', () => {\n  assert.match(source, /matrix-central-summary-edit-actions/)\n  assert.match(source, /Responsable principal/)\n  assert.match(source, /Guardar/)\n  assert.match(source, /Cancelar/)\n})"
new = "test('Central row edit actions live outside the area summary and below the main toolbar', () => {\n  assert.match(source, /matrix-central-top-actions/)\n  assert.doesNotMatch(source, /matrix-central-summary-edit-actions/)\n  assert.match(source, /Responsable principal/)\n  assert.match(source, /Guardar/)\n  assert.match(source, /Cancelar/)\n})"
if old not in inline_test:
    raise SystemExit('Missing inline-create test block')
inline_test_path.write_text(inline_test.replace(old, new, 1), encoding='utf-8')

ui_test = ui_test_path.read_text(encoding='utf-8')
ui_test = ui_test.replace("test('Central simplifica la toolbar y ubica las acciones de edición sobre Responsable principal', () => {", "test('Central simplifica la toolbar y ubica las acciones de edición fuera del resumen', () => {")
if "assert.match(central, /matrix-central-summary-edit-actions/)" not in ui_test:
    raise SystemExit('Missing UI summary action assertion')
ui_test = ui_test.replace("assert.match(central, /matrix-central-summary-edit-actions/)", "assert.match(central, /matrix-central-top-actions/)\n  assert.doesNotMatch(central, /matrix-central-summary-edit-actions/)", 1)
ui_test_path.write_text(ui_test, encoding='utf-8')

print('Central top action bar patch applied')
