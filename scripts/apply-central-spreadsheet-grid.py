from pathlib import Path
import re

# Rerun after tightening the focused regression assertion.

def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'No se encontró: {label}')
    return text.replace(old, new, 1)

path = Path('src/CentralExcelWorkspace.tsx')
source = path.read_text()

pattern = re.compile(r"  function renderEditRows\(key: string\) \{.*?\n  \}\n\n  return <div", re.S)
replacement = '''  function renderSpreadsheetDraftRows(key: string) {
    return <>
      <tr className="matrix-v5-edit-row matrix-central-objective-editor-row" key={`${key}-group`}><td colSpan={tableColSpan}>{renderObjectiveGroupEditor()}</td></tr>
      <tr className="matrix-v5-edit-row matrix-v10-central-excel-row matrix-v10-central-excel-row--editing matrix-central-in-grid-draft" key={`${key}-row`} onKeyDown={handleEditKeyDown}>
        <td className="matrix-central-sheet-cell matrix-central-sheet-cell--action"><textarea rows={1} value={rowDraft.objective || ''} onChange={event => updateDraft('objective', event.target.value)} placeholder="Acción" aria-label="Acción" autoFocus/></td>
        <td className="matrix-central-sheet-cell matrix-central-sheet-cell--responsible">{renderResponsiblePicker()}</td>
        <td className="matrix-central-sheet-cell"><select value={rowDraft.priority || ''} onChange={event => updateDraft('priority', event.target.value)} aria-label="Prioridad"><option value="">—</option><option>Alta</option><option>Media</option><option>Baja</option></select></td>
        <td className="matrix-central-sheet-cell"><textarea rows={1} value={rowDraft.milestones || ''} onChange={event => updateDraft('milestones', event.target.value)} placeholder="Hito o fecha" aria-label="Hitos o fechas"/></td>
        <td className="matrix-central-sheet-cell"><textarea rows={1} value={rowDraft.kpi || ''} onChange={event => updateDraft('kpi', event.target.value)} placeholder="KPI" aria-label="KPI cuantitativo"/></td>
        <td className="matrix-central-sheet-cell"><input type="date" value={rowDraft.start_date || ''} onChange={event => updateDraft('start_date', event.target.value)} aria-label="Inicio"/></td>
        <td className="matrix-central-sheet-cell"><input type="date" value={rowDraft.end_date || ''} onChange={event => updateDraft('end_date', event.target.value)} aria-label="Fin"/></td>
        <td className="matrix-central-sheet-cell"><textarea rows={1} value={rowDraft.risks || ''} onChange={event => updateDraft('risks', event.target.value)} placeholder="Riesgos" aria-label="Riesgos de no ejecutar"/></td>
        <td className="matrix-central-sheet-cell"><textarea rows={1} value={rowDraft.restrictions || ''} onChange={event => updateDraft('restrictions', event.target.value)} placeholder="Restricciones" aria-label="Restricciones"/></td>
        <td className="matrix-central-sheet-cell"><textarea rows={1} value={rowDraft.support || ''} onChange={event => updateDraft('support', event.target.value)} placeholder="Soporte" aria-label="Soporte"/></td>
        <td className="matrix-central-sheet-cell"><textarea rows={1} value={rowDraft.deliverables || ''} onChange={event => updateDraft('deliverables', event.target.value)} placeholder="Entregable" aria-label="Entregable"/></td>
        <td className="matrix-central-sheet-cell"><textarea rows={1} value={rowDraft.committee || ''} onChange={event => updateDraft('committee', event.target.value)} placeholder="Comité" aria-label="Comité"/></td>
        {effectiveCanManage && <td className="matrix-central-sheet-cell matrix-central-sheet-cell--actions"><div className="matrix-v5-row-actions matrix-central-edit-actions"><button type="button" title="Cancelar" onClick={cancelRowEdit}><X size={14}/></button><button type="button" className="save" title="Guardar · Ctrl+Enter" onClick={() => void saveRow()} disabled={saving}>{saving ? <LoaderCircle className="spin" size={14}/> : <Check size={14}/>}</button></div></td>}
      </tr>
    </>
  }

  return <div'''
source, count = pattern.subn(replacement, source, count=1)
if count != 1:
    raise SystemExit('No se pudo reemplazar renderEditRows')

source = replace_once(
    source,
    "if (editingRowId === row.id) return <Fragment key={row.id}>{renderEditRows(`edit-${row.id}`)}</Fragment>",
    "if (editingRowId === row.id) return <Fragment key={row.id}>{renderSpreadsheetDraftRows(`edit-${row.id}`)}</Fragment>",
    'editor de fila existente',
)
source = replace_once(
    source,
    "{rowFormOpen && !editingRowId && renderEditRows('new-central-action')}",
    "{rowFormOpen && !editingRowId && <Fragment key=\"new-central-action\">{renderSpreadsheetDraftRows('new-central-action')}</Fragment>}",
    'fila nueva dentro de la grilla',
)
source = replace_once(
    source,
    '<table className="matrix-v5-sheet matrix-v10-central-excel">',
    '<table className="matrix-v5-sheet matrix-v10-central-excel matrix-central-spreadsheet-grid">',
    'clase spreadsheet grid',
)
path.write_text(source)

path = Path('src/matrix-workspace-v11.css')
css = path.read_text()
legacy = re.compile(
    r"/\* V11: Central sin columna N°, Acción amplia y controles contenidos\. \*/\n"
    r"\.matrix-v11-host \.matrix-v10\.matrix-v5--central \.matrix-v5-sheet thead th:first-child,\n"
    r"\.matrix-v11-host \.matrix-v10\.matrix-v5--central \.matrix-v5-sheet tbody td\.matrix-v5-number\{\n"
    r"  display:none!important;\n\}\n\n"
    r"\.matrix-v11-host \.matrix-v10\.matrix-v5--central \.matrix-v5-sheet th:nth-child\(2\)\{\n"
    r"  width:360px!important;\n  min-width:360px!important;\n\}\n"
)
css, count = legacy.subn('/* Central spreadsheet owns its own column widths; V11 must not hide or shift them. */\n', css, count=1)
if count != 1:
    raise SystemExit('No se pudo retirar el layout legado de Central en V11')
path.write_text(css)
