from pathlib import Path

root = Path('.')
central_path = root / 'src' / 'CentralExcelWorkspace.tsx'
v11_path = root / 'src' / 'MatrixWorkspaceV11.tsx'
css_path = root / 'src' / 'central-excel-workspace.css'
ui_test_path = root / 'tests' / 'central-ui-guideline-flow.test.mjs'
inline_test_path = root / 'tests' / 'central-guideline-inline-create.test.mjs'
zoom_test_path = root / 'tests' / 'central-fullscreen-zoom-lock-release.test.mjs'

central = central_path.read_text(encoding='utf-8')
central = central.replace('  const tableColSpan = 12\n', '  const tableColSpan = 9\n', 1)

start = central.index('  function renderSpreadsheetDraftRows(key: string) {')
end = central.index('  function startNewRowForActiveGuideline()', start)
new_draft = '''  function renderSpreadsheetDraftRows(key: string) {
    const sharedRowSpan = centralSubpointDrafts.length + 1
    return <>
      {editingRowId && <tr className="matrix-v5-edit-row matrix-central-objective-editor-row" key={`${key}-group`}><td colSpan={tableColSpan}>{renderObjectiveGroupEditor()}</td></tr>}
      <tr className="matrix-v5-edit-row matrix-v10-central-excel-row matrix-v10-central-excel-row--editing matrix-central-in-grid-draft" key={`${key}-row`} onKeyDown={handleEditKeyDown}>
        <td className="matrix-central-sheet-cell matrix-central-sheet-cell--action"><textarea rows={1} value={rowDraft.objective || ''} onChange={event => updateDraft('objective', event.target.value)} placeholder="Acción" aria-label="Acción" autoFocus/></td>
        <td className="matrix-central-sheet-cell matrix-central-sheet-cell--responsible" rowSpan={sharedRowSpan}><div className="matrix-central-responsible-editor">{renderResponsiblePicker()}</div></td>
        <td className="matrix-central-sheet-cell" rowSpan={sharedRowSpan}><select value={rowDraft.priority || ''} onChange={event => updateDraft('priority', event.target.value)} aria-label="Prioridad"><option value="">—</option><option>Alta</option><option>Media</option><option>Baja</option></select></td>
        <td className="matrix-central-sheet-cell"><textarea rows={1} value={rowDraft.milestones || ''} onChange={event => updateDraft('milestones', event.target.value)} placeholder="Hito o fecha" aria-label="Hitos o fechas"/></td>
        <td className="matrix-central-sheet-cell" rowSpan={sharedRowSpan}><textarea rows={1} value={rowDraft.deliverables || ''} onChange={event => updateDraft('deliverables', event.target.value)} placeholder="Entregable" aria-label="Entregable"/></td>
        <td className="matrix-central-sheet-cell" rowSpan={sharedRowSpan}><textarea rows={1} value={rowDraft.risks || ''} onChange={event => updateDraft('risks', event.target.value)} placeholder="Riesgos" aria-label="Riesgos de no ejecutar"/></td>
        <td className="matrix-central-sheet-cell" rowSpan={sharedRowSpan}><textarea rows={1} value={rowDraft.restrictions || ''} onChange={event => updateDraft('restrictions', event.target.value)} placeholder="Restricciones" aria-label="Restricciones"/></td>
        <td className="matrix-central-sheet-cell" rowSpan={sharedRowSpan}><textarea rows={1} value={rowDraft.support || ''} onChange={event => updateDraft('support', event.target.value)} placeholder="Soporte" aria-label="Soporte"/></td>
        <td className="matrix-central-sheet-cell" rowSpan={sharedRowSpan}><textarea rows={1} value={rowDraft.committee || ''} onChange={event => updateDraft('committee', event.target.value)} placeholder="Comité" aria-label="Comité"/></td>
      </tr>
      {centralSubpointDrafts.map((subpoint, index) => <tr className="matrix-v5-edit-row matrix-central-subpoint-row matrix-central-subpoint-row--editing" key={`${key}-subpoint-${subpoint.id || 'new'}-${index}`} onKeyDown={handleEditKeyDown}>
        <td className="matrix-central-sheet-cell matrix-central-subpoint-cell"><div><span className="matrix-central-subpoint-badge">S{index + 1}</span><textarea rows={1} value={subpoint.text} onChange={event => updateCentralSubpoint(index, 'text', event.target.value)} placeholder={`Subobjetivo ${index + 1}`} aria-label={`Subobjetivo ${index + 1}`}/><button type="button" title="Eliminar subobjetivo" onClick={() => setCentralSubpointDrafts(current => current.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={13}/></button></div></td>
        <td className="matrix-central-sheet-cell"><textarea rows={1} value={subpoint.milestones} onChange={event => updateCentralSubpoint(index, 'milestones', event.target.value)} placeholder="Hito o fecha" aria-label={`Hito del subpunto ${index + 1}`}/></td>
      </tr>)}
    </>
  }

'''
central = central[:start] + new_draft + central[end:]

start = central.index('  function renderPersistedRow(row: MatrixRow) {')
end = central.index('  return <div className=', start)
new_persisted = '''  function renderPersistedRow(row: MatrixRow) {
    const responsibleIds = centralResponsibleIdsByRow[row.id] || (row.responsible_manager_id ? [row.responsible_manager_id] : [])
    const responsibleNames = responsibleIds.map(id => managerById.get(id)?.name).filter(Boolean)
    const subpoints = buildCentralSubpointDrafts(centralSubpointsByRow[row.id] || [], row)
    const sharedRowSpan = subpoints.length + 1
    return <>
      <tr data-matrix-row-id={row.id} className={`matrix-v10-central-excel-row ${effectiveCanManage ? 'matrix-v10-central-excel-row--editable' : ''}`} onClick={() => startEditRow(row)}>
        <td className="matrix-v5-action-cell">{row.objective || '—'}</td>
        <td rowSpan={sharedRowSpan}>{responsibleNames.length ? <div className="matrix-central-responsible-chips">{responsibleNames.map(name => <span key={name}>{name}</span>)}</div> : row.responsible_text || '—'}</td>
        <td rowSpan={sharedRowSpan}>{row.priority ? <span className={`matrix-v5-priority matrix-v5-priority--${priorityClass(row.priority)}`}>{row.priority}</span> : '—'}</td>
        <td>{row.milestones || '—'}</td>
        <td rowSpan={sharedRowSpan}>{row.deliverables || '—'}</td>
        <td rowSpan={sharedRowSpan}>{row.risks || '—'}</td>
        <td rowSpan={sharedRowSpan}>{row.restrictions || '—'}</td>
        <td rowSpan={sharedRowSpan}>{row.support || '—'}</td>
        <td rowSpan={sharedRowSpan}>{row.committee || '—'}</td>
      </tr>
      {subpoints.map((subpoint, subpointIndex) => <tr data-matrix-row-id={row.id} className={`matrix-central-subpoint-row ${effectiveCanManage ? 'matrix-central-subpoint-row--editable' : ''}`} onClick={() => startEditRow(row)} key={`${row.id}-subpoint-${subpoint.id || subpointIndex}`}>
        <td className="matrix-v5-action-cell matrix-central-subpoint-cell"><div><span className="matrix-central-subpoint-badge">S{subpointIndex + 1}</span><span>{subpoint.text || '—'}</span></div></td>
        <td>{subpoint.milestones || '—'}</td>
      </tr>)}
    </>
  }

'''
central = central[:start] + new_persisted + central[end:]

sheet_marker = '    {page === \'sheet\' && selectedMatrix && <section className="matrix-v5-plan-shell">\n'
start = central.index(sheet_marker) + len(sheet_marker)
summary_marker = '      <div className="matrix-v5-summary">'
end = central.index(summary_marker, start)
new_head = '''      <div className="matrix-central-page-head">
        <div className="matrix-v5-title"><span>Matriz de Plan de Acción</span><h2>PLAN DE ACCIÓN {year}</h2></div>
        <div className="matrix-central-commandbar" aria-label="Controles de matriz">
          <div className="matrix-central-commandbar-primary">
            <button className="matrix-v5-secondary" onClick={() => setExpanded(value => !value)}>{expanded ? <Minimize2 size={16}/> : <Maximize2 size={16}/>} {expanded ? 'Salir de pantalla completa' : 'Expandir matriz'}</button>
            <button className="matrix-v5-secondary" onClick={() => void openHistory()}><History size={16}/> Historial</button>
            <button className="matrix-v5-secondary" onClick={() => void exportExcel()} disabled={exporting}><Download size={16}/>{exporting ? 'Exportando...' : 'Exportar Excel'}</button>
            {effectiveCanManage && <button type="button" className="matrix-central-add-action" onClick={startNewRowForActiveGuideline} disabled={rowFormOpen || !activeGuideline} title={activeGuideline ? `Añadir acción en ${activeGuideline.guideline_text}` : 'Selecciona primero un lineamiento'}><Plus size={14}/> Añadir acción</button>}
          </div>
          {rowFormOpen && <div className="matrix-central-commandbar-context">
            <button type="button" onClick={() => setCentralSubpointDrafts(current => [...current, emptyCentralSubpoint()])}><Plus size={13}/> Añadir subobjetivo</button>
            <button type="button" className="save" data-edit-action="save" onClick={() => void saveRow()} disabled={saving}>{saving && <LoaderCircle className="spin" size={13}/>} Guardar</button>
            <button type="button" data-edit-action="cancel" onClick={cancelRowEdit}>Cancelar</button>
            {editingRowId && <button type="button" className="danger" data-edit-action="delete" onClick={() => void deleteRow(editingRowId)}><Trash2 size={13}/> Eliminar acción</button>}
          </div>}
        </div>
      </div>

'''
central = central[:start] + new_head + central[end:]

old_header = '<thead><tr><th>Acción</th><th>Responsable</th><th>Prioridad</th><th>Hitos / Fechas</th><th>KPI (Cuantitativo)</th><th>Inicio</th><th>Fin</th><th>Riesgos de no ejecutar</th><th>Restricciones</th><th>Soporte</th><th>Entregable</th><th>Comité</th></tr></thead>'
new_header = '<thead><tr><th>Acción</th><th>Responsable</th><th>Prioridad</th><th>Hitos / Fechas</th><th>Entregable</th><th>Riesgos de no ejecutar</th><th>Restricciones</th><th>Soporte</th><th>Comité</th></tr></thead>'
if old_header not in central:
    raise SystemExit('Central table header marker not found')
central = central.replace(old_header, new_header, 1)
central_path.write_text(central, encoding='utf-8')

v11 = v11_path.read_text(encoding='utf-8')
v11 = v11.replace("'.matrix-central-top-actions button[data-edit-action], .matrix-central-responsible-editor-actions button'", "'.matrix-central-commandbar-context button[data-edit-action], .matrix-central-responsible-editor-actions button'", 1)
v11 = v11.replace("? '.matrix-v5-edit-row button[data-edit-action=\"save\"], .matrix-v5-edit-row button[title^=\"Guardar\"]'\n      : '.matrix-v5-edit-row button[data-edit-action=\"cancel\"], .matrix-v5-edit-row button[title=\"Cancelar\"]'", "? '.matrix-central-commandbar-context button[data-edit-action=\"save\"], .matrix-v5-edit-row button[data-edit-action=\"save\"], .matrix-v5-edit-row button[title^=\"Guardar\"]'\n      : '.matrix-central-commandbar-context button[data-edit-action=\"cancel\"], .matrix-v5-edit-row button[data-edit-action=\"cancel\"], .matrix-v5-edit-row button[title=\"Cancelar\"]'", 1)
v11_path.write_text(v11, encoding='utf-8')

css = css_path.read_text(encoding='utf-8')
old_widths = '''.matrix-v10-central-excel{border-collapse:separate;border-spacing:0;min-width:1940px;width:max(100%,1940px);table-layout:fixed}
.matrix-v10-central-excel thead th{position:sticky;top:0;z-index:6;background:#1f6fae;color:#fff;border-right:1px solid rgba(255,255,255,.35);white-space:normal;text-align:center;font-size:12px;font-weight:850;padding:10px 8px}
.matrix-v10-central-excel thead th:nth-child(1){width:470px}
.matrix-v10-central-excel thead th:nth-child(2){width:230px}
.matrix-v10-central-excel thead th:nth-child(3){width:120px}
.matrix-v10-central-excel thead th:nth-child(4){width:220px}
.matrix-v10-central-excel thead th:nth-child(5){width:220px}
.matrix-v10-central-excel thead th:nth-child(6),.matrix-v10-central-excel thead th:nth-child(7){width:135px}
.matrix-v10-central-excel thead th:nth-child(8){width:240px}
.matrix-v10-central-excel thead th:nth-child(9){width:210px}
.matrix-v10-central-excel thead th:nth-child(10){width:210px}
.matrix-v10-central-excel thead th:nth-child(11){width:200px}
.matrix-v10-central-excel thead th:nth-child(12){width:190px}
'''
new_widths = '''.matrix-v10-central-excel{border-collapse:separate;border-spacing:0;min-width:1580px;width:max(100%,1580px);table-layout:fixed}
.matrix-v10-central-excel thead th{position:sticky;top:0;z-index:6;background:#1f6fae;color:#fff;border-right:1px solid rgba(255,255,255,.35);white-space:normal;text-align:center;font-size:12px;font-weight:850;padding:10px 8px}
.matrix-v10-central-excel thead th:nth-child(1){width:320px}
.matrix-v10-central-excel thead th:nth-child(2){width:200px}
.matrix-v10-central-excel thead th:nth-child(3){width:95px}
.matrix-v10-central-excel thead th:nth-child(4){width:170px}
.matrix-v10-central-excel thead th:nth-child(5){width:190px}
.matrix-v10-central-excel thead th:nth-child(6){width:185px}
.matrix-v10-central-excel thead th:nth-child(7){width:165px}
.matrix-v10-central-excel thead th:nth-child(8){width:155px}
.matrix-v10-central-excel thead th:nth-child(9){width:150px}
'''
if old_widths not in css:
    raise SystemExit('Central width block not found')
css = css.replace(old_widths, new_widths, 1)
css += '''

/* Compact Central matrix header */
.matrix-central-page-head{display:flex;align-items:flex-end;justify-content:space-between;gap:18px;padding:2px 0 12px}
.matrix-central-page-head .matrix-v5-title{margin:0;min-width:260px}
.matrix-central-page-head .matrix-v5-title h2{margin:2px 0 0;line-height:1.05}
.matrix-central-commandbar{display:flex;flex-direction:column;align-items:flex-end;gap:7px;min-width:0}
.matrix-central-commandbar-primary,.matrix-central-commandbar-context{display:flex;align-items:center;justify-content:flex-end;gap:7px;flex-wrap:wrap}
.matrix-central-commandbar-primary button,.matrix-central-commandbar-context button{display:inline-flex;align-items:center;justify-content:center;gap:5px;min-height:34px;border:1px solid #c8d8e5;border-radius:8px;background:#fff;color:#31566f;padding:0 11px;font-size:10px;font-weight:850;cursor:pointer;white-space:nowrap}
.matrix-central-commandbar-primary button:hover:not(:disabled),.matrix-central-commandbar-context button:hover:not(:disabled){background:#f4f9fd;border-color:#9dbfd8}
.matrix-central-commandbar-primary .matrix-central-add-action{background:#1f6fae;border-color:#1f6fae;color:#fff;box-shadow:0 4px 10px rgba(31,111,174,.12)}
.matrix-central-commandbar-primary .matrix-central-add-action:hover:not(:disabled){background:#185f97;border-color:#185f97}
.matrix-central-commandbar-context{padding:6px 7px;border:1px solid #d8e5ef;border-radius:10px;background:#f7fbfe;box-shadow:0 3px 10px rgba(18,59,91,.05)}
.matrix-central-commandbar-context button.save{background:#1f6fae;border-color:#1f6fae;color:#fff}
.matrix-central-commandbar-context button.danger{border-color:#efb7b7;color:#b33434;background:#fff8f8}
.matrix-central-commandbar-primary button:disabled,.matrix-central-commandbar-context button:disabled{opacity:.45;cursor:not-allowed}
.matrix-v5--central .matrix-v5-summary{margin-top:0;border-radius:10px;overflow:hidden}
.matrix-v5--central .matrix-v5-sheet-card{margin-top:10px}
@media(max-width:980px){.matrix-central-page-head{align-items:stretch;flex-direction:column}.matrix-central-commandbar{align-items:flex-start}.matrix-central-commandbar-primary,.matrix-central-commandbar-context{justify-content:flex-start}}
'''
css_path.write_text(css, encoding='utf-8')

for path in (ui_test_path, inline_test_path, zoom_test_path):
    text = path.read_text(encoding='utf-8')
    text = text.replace('matrix-central-top-actions', 'matrix-central-commandbar-context')
    path.write_text(text, encoding='utf-8')
