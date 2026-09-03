from pathlib import Path

# MatrixWorkspaceV10: render Central directly in the real table columns.
path = Path('src/MatrixWorkspaceV10.tsx')
source = path.read_text()

for validation in [
    "    if (!String(rowDraft.objective_group || '').trim()) { onError('Selecciona el lineamiento antes de guardar.'); return }\n",
    "    if (!String(rowDraft.objective || '').trim()) { onError('Escribe el objetivo general antes de guardar.'); return }\n",
    "    if (!detailRows.length) { onError('Añade al menos un subpunto antes de guardar.'); return }\n",
]:
    source = source.replace(validation, '')

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
if old_insert not in source:
    raise SystemExit('Central insert block not found')
source = source.replace(old_insert, new_insert, 1)

source = source.replace(
    "  const tableColSpan = 12 + (unitCode === 'CENTRAL' ? 1 : 0) + (showNumberColumn ? 1 : 0) + (effectiveCanManage ? 1 : 0)",
    "  const tableColSpan = 12 + (showNumberColumn ? 1 : 0) + (effectiveCanManage ? 1 : 0)",
    1,
)
source = source.replace("{unitCode === 'CENTRAL' && <th>Subpunto</th>}", '', 1)

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
if old_display not in source:
    raise SystemExit('Central normal display block not found')
source = source.replace(old_display, new_display, 1)
path.write_text(source)

# CSS for the native editor.
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

# V11 no longer needs to clone/move controls: V10 now emits the approved table structure itself.
v11_path = Path('src/MatrixWorkspaceV11.tsx')
v11 = v11_path.read_text()
clone_start = v11.index('    const cloneInlineFieldCell')
layout_start = v11.index('    const enhanceLayout = () => {', clone_start)
v11 = v11[:clone_start] + v11[layout_start:]
v11 = v11.replace('      enhanceCentralInlineLayout()\n', '')
v11_path.write_text(v11)

v11_css_path = Path('src/matrix-workspace-v11.css')
v11_css = v11_css_path.read_text()
v11_css = v11_css.replace(
'''.matrix-v11-host .matrix-v10.matrix-v5--central .matrix-v5-sheet thead th:first-child,
.matrix-v11-host .matrix-v10.matrix-v5--central .matrix-v5-sheet tbody td.matrix-v5-number,
.matrix-v11-host .matrix-v10.matrix-v5--central .matrix-v5-sheet tbody tr.matrix-v5-edit-row > td:first-child{
  display:none!important;
}''',
'''.matrix-v11-host .matrix-v10.matrix-v5--central .matrix-v5-sheet thead th:first-child,
.matrix-v11-host .matrix-v10.matrix-v5--central .matrix-v5-sheet tbody td.matrix-v5-number{
  display:none!important;
}''',
1)
proxy_start = v11_css.find('.matrix-v11-central-subpoint-header-hidden')
if proxy_start >= 0:
    proxy_end = v11_css.find('\n\n.matrix-v11-guideline-shortcut', proxy_start)
    if proxy_end < 0:
        raise SystemExit('V11 proxy CSS end not found')
    v11_css = v11_css[:proxy_start] + v11_css[proxy_end + 2:]
v11_css_path.write_text(v11_css)
