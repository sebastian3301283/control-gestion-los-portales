from pathlib import Path

path = Path('src/MatrixWorkspaceV10.tsx')
source = path.read_text()
original = source

source = source.replace("    if (!String(rowDraft.objective_group || '').trim()) { onError('Selecciona el lineamiento antes de guardar.'); return }\n", "")
source = source.replace("    if (!String(rowDraft.objective || '').trim()) { onError('Escribe el objetivo general antes de guardar.'); return }\n", "")
source = source.replace("    if (!detailRows.length) { onError('Añade al menos un subpunto antes de guardar.'); return }\n", "")

old_insert = """      const insertResult = await supabase.from('matrix_row_subpoints').insert(detailRows.map(item => ({ ...item, matrix_row_id: rowId })))
      if (insertResult.error) {
        if (previousDetails.length) {
          await supabase.from('matrix_row_subpoints').insert(previousDetails.map(({ id: _id, ...item }) => item))
        }
        if (created) await supabase.from('matrix_rows').delete().eq('id', rowId)
        setSaving(false); onError('No pudimos guardar el detalle de los subpuntos.'); return
      }
"""
new_insert = """      if (detailRows.length) {
        const insertResult = await supabase.from('matrix_row_subpoints').insert(detailRows.map(item => ({ ...item, matrix_row_id: rowId })))
        if (insertResult.error) {
          if (previousDetails.length) {
            await supabase.from('matrix_row_subpoints').insert(previousDetails.map(({ id: _id, ...item }) => item))
          }
          if (created) await supabase.from('matrix_rows').delete().eq('id', rowId)
          setSaving(false); onError('No pudimos guardar el detalle de los subpuntos.'); return
        }
      }
"""
if old_insert in source:
    source = source.replace(old_insert, new_insert, 1)

source = source.replace(
    "  const tableColSpan = 12 + (unitCode === 'CENTRAL' ? 1 : 0) + (showNumberColumn ? 1 : 0) + (effectiveCanManage ? 1 : 0)",
    "  const tableColSpan = 12 + (showNumberColumn ? 1 : 0) + (effectiveCanManage ? 1 : 0)",
    1,
)
source = source.replace("{unitCode === 'CENTRAL' && <th>Subpunto</th>}", "", 1)

if 'matrix-v10-central-inline-objective\" colSpan={2}' in source:
    start = source.index('  function renderCentralInlineEditor')
    end = source.index('\n\n  return <div className=', start)
    replacement = r'''  function renderCentralInlineEditor(rowNumber: number, editorKey: string) {
    const rowSpan = centralSubpointDrafts.length
    const totalRowSpan = rowSpan + 1
    return <Fragment key={editorKey}>
      <tr className="matrix-v5-edit-row matrix-v10-central-inline-header-row">
        <td className="matrix-v5-number" rowSpan={totalRowSpan}>{rowNumber}</td>
        <td className="matrix-v10-central-inline-objective"><div className="matrix-v10-inline-objective-editor">
          <div className="matrix-v10-inline-objective-head">
            <small>Objetivo general</small>
            <div className="matrix-v10-inline-top-actions">
              <button type="button" className="cancel" title="Cancelar" onClick={cancelRowEdit}><X size={14}/> Cancelar</button>
              <button type="button" className="save" title="Guardar" onClick={() => void saveRow()} disabled={saving}>{saving ? <LoaderCircle className="spin" size={14}/> : <Check size={14}/>} {saving ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </div>
          <small>Lineamiento</small>
          <select value={rowDraft.objective_group || ''} onChange={event => updateDraft('objective_group', event.target.value)}><option value="">Selecciona un lineamiento</option>{centralGuidelineGroups.map(lineamiento => <option key={lineamiento} value={lineamiento}>{lineamiento}</option>)}</select>
          <small>Objetivo general</small>
          <textarea value={rowDraft.objective || ''} onChange={event => updateDraft('objective', event.target.value)} placeholder="Escribe el objetivo general"/>
          <button type="button" className="matrix-v10-add-subpoint" onClick={event => { event.stopPropagation(); setCentralSubpointDrafts(current => [...current, emptyCentralSubpoint()]) }}><Plus size={14}/> Añadir subpunto</button>
        </div></td>
        <td className="matrix-v10-central-inline-owner" rowSpan={totalRowSpan}><select value={rowDraft.responsible_manager_id || ''} onChange={event => updateDraft('responsible_manager_id', event.target.value || null)}><option value="">Seleccionar responsable</option>{managers.map(manager => <option key={manager.id} value={manager.id}>{manager.name}{manager.directory_group === 'MATRICIAL_HU_VS' ? ' · Matricial' : ''}</option>)}</select></td>
        <td className="matrix-v10-central-inline-priority" rowSpan={totalRowSpan}><select value={rowDraft.priority || ''} onChange={event => updateDraft('priority', event.target.value)}><option value="">—</option><option>Alta</option><option>Media</option><option>Baja</option></select></td>
        <td className="matrix-v10-central-inline-detail-placeholder"/>
        <td className="matrix-v10-central-inline-detail-placeholder"/>
        <td className="matrix-v10-central-inline-detail-placeholder"/>
        <td className="matrix-v10-central-inline-detail-placeholder"/>
        <td rowSpan={totalRowSpan}><textarea value={rowDraft.risks || ''} onChange={event => updateDraft('risks', event.target.value)} placeholder="Riesgos"/></td>
        <td rowSpan={totalRowSpan}><textarea value={rowDraft.restrictions || ''} onChange={event => updateDraft('restrictions', event.target.value)} placeholder="Restricciones"/></td>
        <td rowSpan={totalRowSpan}><textarea value={rowDraft.support || ''} onChange={event => updateDraft('support', event.target.value)} placeholder="Soporte"/></td>
        <td rowSpan={totalRowSpan}><textarea value={rowDraft.deliverables || ''} onChange={event => updateDraft('deliverables', event.target.value)} placeholder="Entregable"/></td>
        <td rowSpan={totalRowSpan}><textarea value={rowDraft.committee || ''} onChange={event => updateDraft('committee', event.target.value)} placeholder="Comité"/></td>
        {effectiveCanManage && <td className="matrix-v10-central-inline-actions-spacer" rowSpan={totalRowSpan}/>} 
      </tr>
      {centralSubpointDrafts.map((detail, detailIndex) => <tr className="matrix-v5-edit-row matrix-v10-central-inline-editor-row" key={`${editorKey}-${detail.id || 'new'}-${detailIndex}`}>
        <td className="matrix-v10-central-inline-subpoint-cell"><div className="matrix-v10-inline-subpoint"><span className="matrix-v10-subpoint-badge">S{detailIndex + 1}</span><textarea value={detail.text} onChange={event => updateCentralSubpoint(detailIndex, 'text', event.target.value)} placeholder={`Subpunto ${detailIndex + 1}`}/><button type="button" title="Eliminar subpunto" disabled={centralSubpointDrafts.length === 1} onClick={event => { event.stopPropagation(); setCentralSubpointDrafts(current => current.length === 1 ? current : current.filter((_, index) => index !== detailIndex)) }}><Trash2 size={13}/></button></div></td>
        <td><textarea value={detail.milestones} onChange={event => updateCentralSubpoint(detailIndex, 'milestones', event.target.value)} placeholder="Hito o fecha"/></td>
        <td><textarea value={detail.kpi} onChange={event => updateCentralSubpoint(detailIndex, 'kpi', event.target.value)} placeholder="KPI"/></td>
        <td><input type="date" value={detail.start_date} onChange={event => updateCentralSubpoint(detailIndex, 'start_date', event.target.value)}/></td>
        <td><input type="date" value={detail.end_date} onChange={event => updateCentralSubpoint(detailIndex, 'end_date', event.target.value)}/></td>
      </tr>)}
    </Fragment>
  }'''
    source = source[:start] + replacement + source[end:]

old_display = '''              {detailIndex === 0 && <td className="matrix-v5-action-cell matrix-v10-central-objective" rowSpan={rowSpan}><strong>{row.objective || '—'}</strong></td>}
              <td><div className="matrix-v10-central-subpoint"><span className="matrix-v10-subpoint-badge">{detail.label}</span><span>{detail.subpoint}</span></div></td>'''
new_display = '''              <td className="matrix-v5-action-cell matrix-v10-central-objective"><div className="matrix-v10-central-objective-stack">{detailIndex === 0 && <strong>{row.objective || '—'}</strong>}<div className="matrix-v10-central-subpoint"><span className="matrix-v10-subpoint-badge">{detail.label}</span><span>{detail.subpoint}</span></div></div></td>'''
if old_display in source:
    source = source.replace(old_display, new_display, 1)

if source == original:
    raise SystemExit('MatrixWorkspaceV10.tsx did not change')
path.write_text(source)

css_path = Path('src/matrix-subpoints.css')
css = css_path.read_text()
if '.matrix-v10-central-inline-owner' not in css:
    css += r'''

.matrix-v10-central-inline-owner,.matrix-v10-central-inline-priority{vertical-align:top!important;padding-top:10px!important}
.matrix-v10-central-inline-detail-placeholder{background:#f8fbfe!important}
.matrix-v10-central-inline-header-row td[rowspan]{vertical-align:top}
.matrix-v10-central-objective-stack{display:grid;gap:8px}
.matrix-v10-central-objective-stack>strong{display:block;margin-bottom:2px}
'''
    css_path.write_text(css)

v11_path = Path('src/matrix-workspace-v11.css')
v11 = v11_path.read_text()
old_rule = '''.matrix-v11-host .matrix-v10.matrix-v5--central .matrix-v5-edit-row td:nth-child(2){
  width:360px!important;
  min-width:360px!important;
  padding:10px!important;
}'''
new_rule = '''.matrix-v11-host .matrix-v10.matrix-v5--central .matrix-v10-central-inline-objective,
.matrix-v11-host .matrix-v10.matrix-v5--central .matrix-v10-central-inline-subpoint-cell{
  width:360px!important;
  min-width:360px!important;
  padding:10px!important;
}'''
if old_rule not in v11:
    raise SystemExit('V11 Central width rule not found')
v11_path.write_text(v11.replace(old_rule, new_rule, 1))
