from pathlib import Path
import re
import subprocess

root = Path('.')
path = root / 'src/CentralExcelWorkspace.tsx'
src = path.read_text(encoding='utf-8')

def rep(old, new, label):
    global src
    count = src.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 occurrence, found {count}')
    src = src.replace(old, new, 1)

rep(
    "const [centralSubpointDrafts, setCentralSubpointDrafts] = useState<CentralSubpointDraft[]>([emptyCentralSubpoint()])",
    "const [centralSubpointDrafts, setCentralSubpointDrafts] = useState<CentralSubpointDraft[]>([])",
    'initial subobjective state',
)

rep(
'''  function startNewRow() {
    if (rowFormOpen || !effectiveCanManage) return
    setEditingRowId(null)
    setRowDraft({ ...emptyRow })
    setSelectedRowGuidelineId(null)
    setSelectedResponsibleIds([])
    setResponsiblePickerOpen(false)
    setCentralSubpointDrafts([emptyCentralSubpoint()])
    setRowFormOpen(true); onError(''); onNotice('')
  }
''',
'''  function startNewRowForGuideline(guidelineId: string, guidelineText: string) {
    if (rowFormOpen || !effectiveCanManage) return
    setEditingRowId(null)
    setRowDraft({ ...emptyRow, guideline_id: guidelineId, objective_group: guidelineText })
    setSelectedRowGuidelineId(guidelineId)
    setSelectedResponsibleIds([])
    setResponsiblePickerOpen(false)
    setCentralSubpointDrafts([])
    setExpandedGuidelineKeys(current => { const next = new Set(current); next.add(guidelineId); return next })
    setRowFormOpen(true); onError(''); onNotice('')
  }
''',
    'guideline-scoped new action',
)

rep(
    '    setCentralSubpointDrafts(subpoints.length ? subpoints : [emptyCentralSubpoint()])',
    '    setCentralSubpointDrafts(subpoints)',
    'edit without forced subobjective',
)
rep(
    '    setEditingRowId(null); setRowFormOpen(false); setRowDraft(emptyRow); setSelectedRowGuidelineId(null); setSelectedResponsibleIds([]); setResponsiblePickerOpen(false); setCentralSubpointDrafts([emptyCentralSubpoint()])',
    '    setEditingRowId(null); setRowFormOpen(false); setRowDraft(emptyRow); setSelectedRowGuidelineId(null); setSelectedResponsibleIds([]); setResponsiblePickerOpen(false); setCentralSubpointDrafts([])',
    'cancel without forced subobjective',
)

rep(
'''        <td className="matrix-central-sheet-cell matrix-central-sheet-cell--responsible" rowSpan={sharedRowSpan}><div className="matrix-central-responsible-editor"><div className="matrix-central-responsible-editor-actions"><button type="button" onClick={() => setCentralSubpointDrafts(current => [...current, emptyCentralSubpoint()])}><Plus size={13}/> Añadir subobjetivo</button><button type="button" className="save" data-edit-action="save" onClick={() => void saveRow()} disabled={saving}>{saving && <LoaderCircle className="spin" size={13}/>} Guardar</button><button type="button" data-edit-action="cancel" onClick={cancelRowEdit}>Cancelar</button>{editingRowId && <button type="button" className="danger" data-edit-action="delete" onClick={() => void deleteRow(editingRowId)}><Trash2 size={13}/> Eliminar acción</button>}</div>{renderResponsiblePicker()}</div></td>''',
'''        <td className="matrix-central-sheet-cell matrix-central-sheet-cell--responsible" rowSpan={sharedRowSpan}><div className="matrix-central-responsible-editor">{renderResponsiblePicker()}</div></td>''',
    'move edit actions out of responsible cell',
)

rep(
'''        <td className="matrix-central-sheet-cell matrix-central-subpoint-cell"><div><span className="matrix-central-subpoint-badge">S{index + 1}</span><textarea rows={1} value={subpoint.text} onChange={event => updateCentralSubpoint(index, 'text', event.target.value)} placeholder={`Subpunto ${index + 1}`} aria-label={`Subpunto ${index + 1}`}/><button type="button" title="Eliminar subpunto" disabled={centralSubpointDrafts.length === 1} onClick={() => setCentralSubpointDrafts(current => current.length === 1 ? current : current.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={13}/></button></div></td>''',
'''        <td className="matrix-central-sheet-cell matrix-central-subpoint-cell"><div><span className="matrix-central-subpoint-badge">S{index + 1}</span><textarea rows={1} value={subpoint.text} onChange={event => updateCentralSubpoint(index, 'text', event.target.value)} placeholder={`Subobjetivo ${index + 1}`} aria-label={`Subobjetivo ${index + 1}`}/><button type="button" title="Eliminar subobjetivo" onClick={() => setCentralSubpointDrafts(current => current.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={13}/></button></div></td>''',
    'allow deleting last subobjective',
)

rep(
'''        {effectiveCanManage && <button className="matrix-v5-primary" onClick={startNewRow}><Plus size={16}/> Nueva fila</button>}
''',
    '',
    'remove global new row button',
)

rep(
'''      <div className="matrix-v5-summary"><div><span>Área</span><strong>{selectedArea?.name || '—'}</strong></div><div><span>Unidad</span><strong>Central</strong></div><div><span>Responsable principal</span><label className="matrix-central-principal-responsible"><select value={selectedMatrix.principal_responsible_manager_id || ''} onChange={event => void savePrincipalResponsible(event.target.value)} disabled={!effectiveCanManage || principalSaving}><option value="">Sin asignar</option>{highestAreaManagers.map(manager => <option key={manager.id} value={manager.id}>{manager.name}{manager.cargo ? ` · ${manager.cargo}` : ''}</option>)}</select>{principalSaving && <LoaderCircle className="spin" size={14}/>}</label></div></div>
''',
'''      <div className="matrix-v5-summary"><div><span>Área</span><strong>{selectedArea?.name || '—'}</strong></div><div><span>Unidad</span><strong>Central</strong></div><div>{rowFormOpen && <div className="matrix-central-summary-edit-actions"><button type="button" onClick={() => setCentralSubpointDrafts(current => [...current, emptyCentralSubpoint()])}><Plus size={13}/> Añadir subobjetivo</button><button type="button" className="save" data-edit-action="save" onClick={() => void saveRow()} disabled={saving}>{saving && <LoaderCircle className="spin" size={13}/>} Guardar</button><button type="button" data-edit-action="cancel" onClick={cancelRowEdit}>Cancelar</button>{editingRowId && <button type="button" className="danger" data-edit-action="delete" onClick={() => void deleteRow(editingRowId)}><Trash2 size={13}/> Eliminar acción</button>}</div>}<span>Responsable principal</span><label className="matrix-central-principal-responsible"><select value={selectedMatrix.principal_responsible_manager_id || ''} onChange={event => void savePrincipalResponsible(event.target.value)} disabled={!effectiveCanManage || principalSaving}><option value="">Sin asignar</option>{highestAreaManagers.map(manager => <option key={manager.id} value={manager.id}>{manager.name}{manager.cargo ? ` · ${manager.cargo}` : ''}</option>)}</select>{principalSaving && <LoaderCircle className="spin" size={14}/>}</label></div></div>
''',
    'summary edit actions',
)

rep(
'''        {rowsLoading ? <tr><td colSpan={tableColSpan} className="matrix-v5-table-empty"><LoaderCircle className="spin" size={20}/> Cargando matriz...</td></tr> : guidelineGroups.length === 0 && !rowFormOpen ? <tr><td colSpan={tableColSpan} className="matrix-v5-table-empty">La matriz está lista. Presiona “Nueva fila” para comenzar.</td></tr> : <>
''',
'''        {rowsLoading ? <tr><td colSpan={tableColSpan} className="matrix-v5-table-empty"><LoaderCircle className="spin" size={20}/> Cargando matriz...</td></tr> : guidelineGroups.length === 0 && !rowFormOpen ? <tr><td colSpan={tableColSpan} className="matrix-v5-table-empty">Aún no hay lineamientos disponibles para esta área.</td></tr> : <>
''',
    'empty matrix message',
)

rep(
'''    <tr className="matrix-v5-objective-row matrix-central-objective-group matrix-central-guideline-bar"><td colSpan={tableColSpan}><button type="button" className="matrix-central-guideline-toggle" aria-expanded={groupOpen} onClick={() => toggleGuidelineGroup(group.key, group.rows)}><span aria-hidden="true">{groupOpen ? '▼' : '▶'}</span><strong>{group.code ? `${group.code} · ` : ''}{group.label}</strong><small>{group.rows.length} objetivo{group.rows.length === 1 ? '' : 's'}</small></button></td></tr>
    {groupOpen && group.rows.map(row => <Fragment key={row.id}>{editingRowId === row.id ? renderSpreadsheetDraftRows(`edit-${row.id}`) : renderPersistedRow(row)}</Fragment>)}
''',
'''    <tr className="matrix-v5-objective-row matrix-central-objective-group matrix-central-guideline-bar"><td colSpan={tableColSpan}><div className="matrix-central-guideline-bar-content"><button type="button" className="matrix-central-guideline-toggle" aria-expanded={groupOpen} onClick={() => toggleGuidelineGroup(group.key, group.rows)}><span aria-hidden="true">{groupOpen ? '▼' : '▶'}</span><strong>{group.code ? `${group.code} · ` : ''}{group.label}</strong><small>{group.rows.length} objetivo{group.rows.length === 1 ? '' : 's'}</small></button>{effectiveCanManage && !group.key.startsWith('legacy:') && <button type="button" className="matrix-central-guideline-add-action" onClick={() => startNewRowForGuideline(group.key, group.label)} disabled={rowFormOpen}><Plus size={13}/> Añadir acción</button>}</div></td></tr>
    {rowFormOpen && !editingRowId && selectedRowGuidelineId === group.key && <Fragment key={`new-${group.key}`}>{renderSpreadsheetDraftRows(`new-${group.key}`)}</Fragment>}
    {groupOpen && group.rows.map(row => <Fragment key={row.id}>{editingRowId === row.id ? renderSpreadsheetDraftRows(`edit-${row.id}`) : renderPersistedRow(row)}</Fragment>)}
''',
    'guideline-scoped editor',
)

rep(
'''{rowFormOpen && !editingRowId && <Fragment key="new-central-action">{renderSpreadsheetDraftRows('new-central-action')}</Fragment>}
''',
    '',
    'remove global editor row',
)

rep(
'''      <tr className="matrix-v5-edit-row matrix-central-objective-editor-row" key={`${key}-group`}><td colSpan={tableColSpan}>{renderObjectiveGroupEditor()}</td></tr>
''',
'''      {editingRowId && <tr className="matrix-v5-edit-row matrix-central-objective-editor-row" key={`${key}-group`}><td colSpan={tableColSpan}>{renderObjectiveGroupEditor()}</td></tr>}
''',
    'hide redundant guideline selector for new action',
)

src = src.replace(
    'Escribe el texto del subpunto S${incompleteSubpointIndex + 1} antes de guardar.',
    'Escribe el texto del subobjetivo S${incompleteSubpointIndex + 1} antes de guardar.',
)
path.write_text(src, encoding='utf-8')

css_path = root / 'src/central-excel-workspace.css'
css = css_path.read_text(encoding='utf-8')
append = '''
.matrix-central-summary-edit-actions{display:flex;flex-wrap:wrap;align-items:center;gap:5px;margin-bottom:7px}
.matrix-central-summary-edit-actions button{display:inline-flex;align-items:center;justify-content:center;gap:4px;min-height:30px;border:1px solid #b8cddd;border-radius:6px;background:#fff;color:#31566f;padding:0 9px;font-size:10px;font-weight:850;cursor:pointer}
.matrix-central-summary-edit-actions button.save{background:#1f6fae;border-color:#1f6fae;color:#fff}
.matrix-central-summary-edit-actions button.danger{border-color:#efb7b7;color:#b33434;background:#fff8f8}
.matrix-central-summary-edit-actions button:disabled{opacity:.55;cursor:wait}
.matrix-central-guideline-bar-content{display:flex;align-items:center;gap:8px;width:100%}
.matrix-central-guideline-bar-content .matrix-central-guideline-toggle{flex:1;min-width:0;width:auto}
.matrix-central-guideline-add-action{display:inline-flex;align-items:center;justify-content:center;gap:5px;flex:0 0 auto;margin-right:10px;min-height:30px;border:1px solid #78a9cf;border-radius:6px;background:#fff;color:#175c92;padding:0 10px;font-size:10px;font-weight:850;cursor:pointer}
.matrix-central-guideline-add-action:hover{background:#f5fbff}
.matrix-central-guideline-add-action:disabled{opacity:.45;cursor:not-allowed}
'''
if '.matrix-central-summary-edit-actions{' not in css:
    css += '\n' + append.strip() + '\n'
css = re.sub(r'\n\.matrix-central-responsible-editor-actions\{[^}]*\}\n\.matrix-central-responsible-editor-actions button\{[^}]*\}\n\.matrix-central-responsible-editor-actions button\.save\{[^}]*\}\n\.matrix-central-responsible-editor-actions button\.danger\{[^}]*\}\n\.matrix-central-responsible-editor-actions button:disabled\{[^}]*\}', '', css)
css_path.write_text(css, encoding='utf-8')

subprocess.run(['bash', '-lc', 'node --test tests/*.test.mjs'], check=True)
subprocess.run(['npm', 'run', 'check'], check=True)
subprocess.run(['npm', 'run', 'build'], check=True)
