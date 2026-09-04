from pathlib import Path
import re


def read(path: str) -> str:
    return Path(path).read_text(encoding='utf-8')


def write(path: str, text: str) -> None:
    Path(path).write_text(text, encoding='utf-8')


def rep(path: str, old: str, new: str, count: int = 1) -> None:
    text = read(path)
    if old not in text:
        raise SystemExit(f'missing replacement anchor in {path}: {old[:160]!r}')
    write(path, text.replace(old, new, count))


def sub(path: str, pattern: str, repl: str, count: int = 1) -> None:
    text = read(path)
    next_text, n = re.subn(pattern, repl, text, count=count, flags=re.S)
    if n != count:
        raise SystemExit(f'pattern matched {n} times in {path}: {pattern[:160]!r}')
    write(path, next_text)


central = 'src/CentralExcelWorkspace.tsx'
rep(
    central,
    "import { ChangeEvent, CSSProperties, Fragment, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react'\nimport { ArrowLeft, ArrowRight, Building2, Check, Download, History, LoaderCircle, Maximize2, Minimize2, Plus, RotateCcw, Trash2, Upload, X, ZoomIn, ZoomOut } from 'lucide-react'",
    "import { CSSProperties, Fragment, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react'\nimport { ArrowRight, Building2, Download, History, LoaderCircle, Maximize2, Minimize2, Plus, RotateCcw, Trash2, X, ZoomIn, ZoomOut } from 'lucide-react'",
)
rep(
    central,
    "type Guideline = { id: string; management_id: string; responsible_manager_id: string | null; guideline_text: string }",
    "type Guideline = { id: string; management_id: string; code: string | null; responsible_manager_id: string | null; guideline_text: string }",
)
rep(central, "type MatrixRow = {\n  id: string\n", "type MatrixRow = {\n  id: string\n  guideline_id: string | null\n")
rep(
    central,
    "  onActiveMatrixChange?: (matrixId: string) => void\n}",
    "  onActiveMatrixChange?: (matrixId: string) => void\n  onGuidelineContextChange?: (context: { managementId: string; guidelineId: string | null }) => void\n}",
)
rep(
    central,
    "const emptyRow: RowDraft = {\n  objective_group: '', objective: '', action_plan: null, responsible_manager_id: null, responsible_text: '', priority: '', milestones: '', kpi: '', target: null,",
    "const emptyRow: RowDraft = {\n  guideline_id: null, objective_group: '', objective: '', action_plan: null, responsible_manager_id: null, responsible_text: '', priority: '', milestones: '', kpi: '', target: null,",
)
sub(central, r"\nfunction dateToIso\(value: unknown\) \{.*?\n\}\nfunction splitResponsibleNames\(value: unknown\) \{.*?\n\}\n", "\n")
rep(
    central,
    "export default function CentralExcelWorkspace({ periodId, year, unitName, canManage, onError, onNotice, onActiveMatrixChange }: Props) {",
    "export default function CentralExcelWorkspace({ periodId, year, unitName, canManage, onError, onNotice, onActiveMatrixChange, onGuidelineContextChange }: Props) {",
)
rep(
    central,
    "  const [saving, setSaving] = useState(false)\n  const [exporting, setExporting] = useState(false)\n  const [importing, setImporting] = useState(false)\n  const [editingRowId, setEditingRowId] = useState<string | null>(null)\n  const [rowFormOpen, setRowFormOpen] = useState(false)\n  const [rowDraft, setRowDraft] = useState<RowDraft>(emptyRow)\n  const [selectedResponsibleIds, setSelectedResponsibleIds] = useState<string[]>([])\n  const [centralSubpointDrafts, setCentralSubpointDrafts] = useState<CentralSubpointDraft[]>([emptyCentralSubpoint()])\n  const [creatingObjectiveGroup, setCreatingObjectiveGroup] = useState(false)",
    "  const [saving, setSaving] = useState(false)\n  const [exporting, setExporting] = useState(false)\n  const [editingRowId, setEditingRowId] = useState<string | null>(null)\n  const [rowFormOpen, setRowFormOpen] = useState(false)\n  const [rowDraft, setRowDraft] = useState<RowDraft>(emptyRow)\n  const [selectedRowGuidelineId, setSelectedRowGuidelineId] = useState<string | null>(null)\n  const [selectedResponsibleIds, setSelectedResponsibleIds] = useState<string[]>([])\n  const [responsiblePickerOpen, setResponsiblePickerOpen] = useState(false)\n  const [centralSubpointDrafts, setCentralSubpointDrafts] = useState<CentralSubpointDraft[]>([emptyCentralSubpoint()])",
)
rep(
    central,
    "  const [versions, setVersions] = useState<MatrixVersion[]>([])\n  const fileInputRef = useRef<HTMLInputElement | null>(null)\n  const loadRowsRequestRef = useRef(0)",
    "  const [versions, setVersions] = useState<MatrixVersion[]>([])\n  const responsiblePickerRef = useRef<HTMLDivElement | null>(null)\n  const loadRowsRequestRef = useRef(0)",
)
rep(
    central,
    "  const managerById = useMemo(() => new Map(managers.map(item => [item.id, item])), [managers])\n  const rowObjectiveGroups = useMemo(() => [...new Set(rows.map(row => textValue(row.objective_group)).filter(Boolean))], [rows])",
    "  const managerById = useMemo(() => new Map(managers.map(item => [item.id, item])), [managers])\n  const areaGuidelines = useMemo(() => guidelines.filter(item => item.management_id === selectedAreaId), [guidelines, selectedAreaId])",
)
rep(
    central,
    "  const effectiveCanManage = canManage || areaCanEdit\n  const tableColSpan = 12 + (effectiveCanManage ? 1 : 0)",
    "  const effectiveCanManage = canManage || areaCanEdit\n  const tableColSpan = 12",
)
rep(
    central,
    "  const selectedGuideline = useMemo(() => guidelines.find(item => item.management_id === selectedAreaId) || null, [guidelines, selectedAreaId])\n  const firstResponsible = useMemo(() => {",
    "  const selectedGuideline = useMemo(() => areaGuidelines[0] || null, [areaGuidelines])\n  const guidelineContextId = useMemo(() => {\n    if (selectedRowGuidelineId) return selectedRowGuidelineId\n    const rowGuidelineIds = [...new Set(rows.map(row => row.guideline_id).filter((id): id is string => Boolean(id)))]\n    if (rowGuidelineIds.length === 1) return rowGuidelineIds[0]\n    return selectedMatrix?.guideline_id || null\n  }, [selectedRowGuidelineId, rows, selectedMatrix?.guideline_id])\n  const firstResponsible = useMemo(() => {",
)
rep(
    central,
    "  useEffect(() => {\n    onActiveMatrixChange?.(selectedMatrixId)\n    return () => onActiveMatrixChange?.('')\n  }, [onActiveMatrixChange, selectedMatrixId])\n  useEffect(() => {\n    const handleRealtimeDataChange",
    "  useEffect(() => {\n    onActiveMatrixChange?.(selectedMatrixId)\n    return () => onActiveMatrixChange?.('')\n  }, [onActiveMatrixChange, selectedMatrixId])\n  useEffect(() => {\n    onGuidelineContextChange?.({ managementId: selectedAreaId, guidelineId: selectedAreaId ? guidelineContextId : null })\n  }, [guidelineContextId, onGuidelineContextChange, selectedAreaId])\n  useEffect(() => {\n    if (!responsiblePickerOpen) return\n    const handlePointerDown = (event: PointerEvent) => {\n      if (!responsiblePickerRef.current?.contains(event.target as Node)) setResponsiblePickerOpen(false)\n    }\n    const handleKeyDown = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape') setResponsiblePickerOpen(false) }\n    document.addEventListener('pointerdown', handlePointerDown)\n    window.addEventListener('keydown', handleKeyDown)\n    return () => { document.removeEventListener('pointerdown', handlePointerDown); window.removeEventListener('keydown', handleKeyDown) }\n  }, [responsiblePickerOpen])\n  useEffect(() => {\n    const handleRealtimeDataChange",
)
rep(
    central,
    "supabase.from('planning_guidelines').select('id,management_id,responsible_manager_id,guideline_text')",
    "supabase.from('planning_guidelines').select('id,management_id,code,responsible_manager_id,guideline_text')",
)
sub(central, r"\n  function backToAreas\(\) \{.*?\n  \}\n", "\n")
sub(
    central,
    r"  function startNewRow\(\) \{.*?  function updateDraft<K extends keyof RowDraft>",
    """  function startNewRow() {
    if (rowFormOpen || !effectiveCanManage) return
    setEditingRowId(null)
    setRowDraft({ ...emptyRow })
    setSelectedRowGuidelineId(null)
    setSelectedResponsibleIds([])
    setResponsiblePickerOpen(false)
    setCentralSubpointDrafts([emptyCentralSubpoint()])
    setRowFormOpen(true); onError(''); onNotice('')
  }
  function startEditRow(row: MatrixRow) {
    if (!effectiveCanManage || rowFormOpen) return
    const matchedGuidelineId = row.guideline_id || areaGuidelines.find(item => normalizeText(item.guideline_text) === normalizeText(row.objective_group))?.id || null
    setEditingRowId(row.id)
    setRowDraft({
      guideline_id: matchedGuidelineId, objective_group: row.objective_group || '', objective: row.objective || '', action_plan: row.action_plan, responsible_manager_id: row.responsible_manager_id,
      responsible_text: row.responsible_text || '', priority: row.priority || '', milestones: row.milestones || '', kpi: row.kpi || '', target: row.target,
      start_date: row.start_date || '', end_date: row.end_date || '', risks: row.risks || '', restrictions: row.restrictions || '', support: row.support || '',
      deliverables: row.deliverables || '', committee: row.committee || '', status: row.status || 'DRAFT',
    })
    setSelectedRowGuidelineId(matchedGuidelineId)
    setSelectedResponsibleIds(centralResponsibleIdsByRow[row.id] || (row.responsible_manager_id ? [row.responsible_manager_id] : []))
    setResponsiblePickerOpen(false)
    const subpoints = buildCentralSubpointDrafts(centralSubpointsByRow[row.id] || [], row)
    setCentralSubpointDrafts(subpoints.length ? subpoints : [emptyCentralSubpoint()])
    setRowFormOpen(true); onError(''); onNotice('')
  }
  function cancelRowEdit() {
    setEditingRowId(null); setRowFormOpen(false); setRowDraft(emptyRow); setSelectedRowGuidelineId(null); setSelectedResponsibleIds([]); setResponsiblePickerOpen(false); setCentralSubpointDrafts([emptyCentralSubpoint()])
  }
  function updateDraft<K extends keyof RowDraft>""",
)
rep(
    central,
    "  function toggleResponsible(managerId: string) {\n    setSelectedResponsibleIds(current => current.includes(managerId) ? current.filter(id => id !== managerId) : [...current, managerId])\n  }\n  function updateCentralSubpoint",
    "  function toggleResponsible(managerId: string) {\n    setSelectedResponsibleIds(current => current.includes(managerId) ? current.filter(id => id !== managerId) : [...current, managerId])\n  }\n  function selectGuideline(guidelineId: string) {\n    const guideline = areaGuidelines.find(item => item.id === guidelineId) || null\n    setSelectedRowGuidelineId(guideline?.id || null)\n    updateDraft('guideline_id', guideline?.id || null)\n    updateDraft('objective_group', guideline?.guideline_text || '')\n  }\n  function updateCentralSubpoint",
)
rep(
    central,
    "  const payload = {\n    matrix_id: selectedMatrix.id,\n    objective_group:",
    "  const payload = {\n    matrix_id: selectedMatrix.id,\n    guideline_id: selectedRowGuidelineId || rowDraft.guideline_id || null,\n    objective_group:",
)
rep(
    central,
    "    const { error } = await supabase.from('matrix_rows').update({\n      objective_group: previousRow.objective_group,",
    "    const { error } = await supabase.from('matrix_rows').update({\n      guideline_id: previousRow.guideline_id,\n      objective_group: previousRow.objective_group,",
)
rep(
    central,
    "  async function deleteRow(rowId: string) {\n    if (!supabase || !selectedMatrix || !effectiveCanManage) return\n    const { error } = await supabase.from('matrix_rows').delete().eq('id', rowId)\n    if (error) { onError('No pudimos eliminar la acción.'); return }\n    onNotice('Acción eliminada.'); await loadRows(selectedMatrix.id)\n  }",
    "  async function deleteRow(rowId: string) {\n    if (!supabase || !selectedMatrix || !effectiveCanManage) return\n    const { error } = await supabase.from('matrix_rows').delete().eq('id', rowId)\n    if (error) { onError('No pudimos eliminar la acción.'); return }\n    if (editingRowId === rowId) cancelRowEdit()\n    onNotice('Acción eliminada.'); await loadRows(selectedMatrix.id)\n  }",
)
rep(
    central,
    "  function handleEditKeyDown(event: KeyboardEvent<HTMLTableRowElement>) {\n    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); void saveRow() }\n    if (event.key === 'Escape') { event.preventDefault(); cancelRowEdit() }\n  }",
    "  function handleEditKeyDown(event: KeyboardEvent<HTMLTableRowElement>) {\n    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); void saveRow() }\n    if (event.key === 'Escape') {\n      event.preventDefault()\n      if (responsiblePickerOpen) { setResponsiblePickerOpen(false); return }\n      cancelRowEdit()\n    }\n  }",
)
sub(central, r"\n  async function importExcel\(event: ChangeEvent<HTMLInputElement>\) \{.*?\n  \}\n\n  async function openHistory", "\n\n  async function openHistory")
sub(
    central,
    r"  function renderResponsiblePicker\(\) \{.*?\n  function renderSpreadsheetDraftRows",
    """  function renderResponsiblePicker() {
    const selectedNames = selectedResponsibleIds.map(id => managerById.get(id)?.name).filter(Boolean)
    return <div ref={responsiblePickerRef} className="matrix-central-responsible-picker">
      <button type="button" className="matrix-central-responsible-trigger" aria-expanded={responsiblePickerOpen} onClick={() => setResponsiblePickerOpen(value => !value)}>{selectedNames.length ? <span className="matrix-central-summary-chips">{selectedNames.map(name => <i key={name}>{name}</i>)}</span> : <span>Seleccionar responsables</span>}</button>
      {responsiblePickerOpen && <div className="matrix-central-responsible-menu">
        <div className="matrix-central-responsible-menu-head"><strong>Responsables</strong><button type="button" className="matrix-central-responsible-close" title="Cerrar responsables" onClick={() => setResponsiblePickerOpen(false)}><X size={14}/></button></div>
        {centralManagers.length === 0 ? <small>No hay bonistas asignados a esta área.</small> : centralManagers.map(manager => <label key={manager.id}><input type="checkbox" checked={selectedResponsibleIds.includes(manager.id)} onChange={() => toggleResponsible(manager.id)}/><span><strong>{manager.name}</strong>{manager.cargo && <small>{manager.cargo}</small>}</span></label>)}
      </div>}
    </div>
  }

  function renderObjectiveGroupEditor() {
    return <div className="matrix-central-objective-toolbar"><div className="matrix-central-objective-edit"><strong>LINEAMIENTO</strong><select value={selectedRowGuidelineId || ''} onChange={event => selectGuideline(event.target.value)}><option value="">Selecciona un lineamiento</option>{areaGuidelines.map(guideline => <option key={guideline.id} value={guideline.id}>{guideline.code ? `${guideline.code} · ` : ''}{guideline.guideline_text}</option>)}</select></div></div>
  }

  function renderSpreadsheetDraftRows""",
)
rep(
    central,
    "        <td className=\"matrix-central-sheet-cell matrix-central-sheet-cell--responsible\" rowSpan={sharedRowSpan}>{renderResponsiblePicker()}</td>",
    "        <td className=\"matrix-central-sheet-cell matrix-central-sheet-cell--responsible\" rowSpan={sharedRowSpan}><div className=\"matrix-central-responsible-editor\"><div className=\"matrix-central-responsible-editor-actions\"><button type=\"button\" onClick={() => setCentralSubpointDrafts(current => [...current, emptyCentralSubpoint()])}><Plus size={13}/> Añadir subpunto</button><button type=\"button\" className=\"save\" data-edit-action=\"save\" onClick={() => void saveRow()} disabled={saving}>{saving && <LoaderCircle className=\"spin\" size={13}/>} Guardar</button><button type=\"button\" data-edit-action=\"cancel\" onClick={cancelRowEdit}>Cancelar</button>{editingRowId && <button type=\"button\" className=\"danger\" data-edit-action=\"delete\" onClick={() => void deleteRow(editingRowId)}><Trash2 size={13}/> Eliminar acción</button>}</div>{renderResponsiblePicker()}</div></td>",
)
sub(central, r"\n        \{effectiveCanManage && <td className=\"matrix-central-sheet-cell matrix-central-sheet-cell--actions\".*?</td>\}", "")
rep(central, "        <button className=\"matrix-v5-secondary\" onClick={backToAreas}><ArrowLeft size={16}/> Áreas</button>\n", "")
sub(central, r"\n        \{effectiveCanManage && <><input ref=\{fileInputRef\}.*?</>\}", "")
rep(central, "<th>Comité</th>{effectiveCanManage && <th>Acciones</th>}", "<th>Comité</th>")
sub(central, r"\n              \{effectiveCanManage && <td rowSpan=\{sharedRowSpan\}><div className=\"matrix-v5-row-actions\">.*?</td>\}", "")

css = 'src/central-excel-workspace.css'
text = read(css)
text = text.replace('.matrix-v10-central-excel thead th:last-child{width:82px}\n', '')
text = text.replace('.matrix-central-responsible-picker>summary{list-style:none;min-height:48px;height:100%;display:flex;align-items:center;border:0;border-radius:0;background:transparent;padding:6px 8px;cursor:pointer;color:#17324a;box-sizing:border-box}\n.matrix-central-responsible-picker>summary::-webkit-details-marker{display:none}\n', '')
text += """
.matrix-central-sheet-cell--responsible{vertical-align:top!important}
.matrix-central-responsible-editor{display:flex;flex-direction:column;gap:6px;min-height:100%;padding:6px;box-sizing:border-box}
.matrix-central-responsible-editor-actions{display:flex;flex-wrap:wrap;gap:4px;align-items:center}
.matrix-central-responsible-editor-actions button{display:inline-flex;align-items:center;justify-content:center;gap:4px;min-height:30px;border:1px solid #b8cddd;border-radius:5px;background:#fff;color:#31566f;padding:0 8px;font-size:9.5px;font-weight:850;cursor:pointer}
.matrix-central-responsible-editor-actions button.save{background:#1f6fae;border-color:#1f6fae;color:#fff}
.matrix-central-responsible-editor-actions button.danger{border-color:#efb7b7;color:#b33434;background:#fff8f8}
.matrix-central-responsible-editor-actions button:disabled{opacity:.55;cursor:wait}
.matrix-central-responsible-picker{position:relative;width:100%;height:auto}
.matrix-central-responsible-trigger{width:100%;min-height:40px;display:flex;align-items:center;text-align:left;border:1px solid #d3e0e9;border-radius:5px;background:#fff;padding:6px 8px;cursor:pointer;color:#17324a;box-sizing:border-box}
.matrix-central-responsible-menu-head{position:sticky;top:-6px;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:8px;background:#fff;border-bottom:1px solid #e2ebf2;padding:6px 4px 8px;margin:0 0 4px}
.matrix-central-responsible-menu-head>strong{font-size:10px;color:#17324a}
.matrix-central-responsible-close{display:grid;place-items:center;width:27px;height:27px;border:1px solid #cad9e4;border-radius:5px;background:#fff;color:#4f687b;cursor:pointer}
"""
write(css, text)

v11 = 'src/MatrixWorkspaceV11.tsx'
rep(v11, "  onViewGuidelines?: () => void", "  onViewGuidelines?: (target?: { managementId: string; guidelineId: string | null }) => void")
rep(
    v11,
    "  const [matrixId, setMatrixId] = useState('')\n  const [locks, setLocks] = useState<RowLock[]>([])\n  const { onViewGuidelines, ...workspaceProps } = props",
    "  const [matrixId, setMatrixId] = useState('')\n  const [locks, setLocks] = useState<RowLock[]>([])\n  const [guidelineContext, setGuidelineContext] = useState<{ managementId: string; guidelineId: string | null }>({ managementId: '', guidelineId: null })\n  const [pendingRowSwitch, setPendingRowSwitch] = useState<string | null>(null)\n  const { onViewGuidelines, ...workspaceProps } = props",
)
sub(
    v11,
    r"  function handleRootClickCapture\(event: ReactMouseEvent<HTMLDivElement>\) \{.*?\n  \}\n\n  useEffect\(\(\) => \{\n    const root = rootRef.current",
    """  function findMatrixRow(rowId: string) {
    const rows = Array.from(rootRef.current?.querySelectorAll<HTMLTableRowElement>('tr[data-matrix-row-id]') || [])
    return rows.find(row => row.dataset.matrixRowId === rowId) || null
  }

  async function finishCurrentAndSwitch(mode: 'save' | 'discard' | 'stay') {
    const targetRowId = pendingRowSwitch
    if (!targetRowId) return
    if (mode === 'stay') { setPendingRowSwitch(null); return }
    const root = rootRef.current
    const actionButton = root?.querySelector<HTMLButtonElement>(mode === 'save'
      ? '.matrix-v5-edit-row button[data-edit-action="save"], .matrix-v5-edit-row button[title^="Guardar"]'
      : '.matrix-v5-edit-row button[data-edit-action="cancel"], .matrix-v5-edit-row button[title="Cancelar"]')
    if (!actionButton) { setPendingRowSwitch(null); props.onError('No pudimos identificar los controles de la edición actual.'); return }
    const previousLock = lockedRowIdRef.current
    setPendingRowSwitch(null)
    actionButton.click()
    for (let attempt = 0; attempt < 40; attempt += 1) {
      if (!rootRef.current?.querySelector('.matrix-v5-edit-row')) break
      await new Promise(resolve => window.setTimeout(resolve, 150))
    }
    if (rootRef.current?.querySelector('.matrix-v5-edit-row')) {
      props.onError(mode === 'save' ? 'No se pudo cambiar de fila porque la edición actual todavía no se guardó.' : 'No se pudo cerrar la edición actual.')
      return
    }
    if (previousLock && lockedRowIdRef.current === previousLock) await releaseLock(previousLock)
    const targetRow = findMatrixRow(targetRowId)
    if (!targetRow) { props.onError('La fila que querías editar cambió. Inténtalo nuevamente.'); return }
    const ok = await acquireLock(targetRowId)
    if (!ok) return
    bypassClickRef.current = true
    targetRow.click()
  }

  function handleRootClickCapture(event: ReactMouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement
    const editorButton = target.closest<HTMLButtonElement>('.matrix-central-responsible-editor-actions button')
    if (editorButton) {
      const rowId = lockedRowIdRef.current
      if (rowId) releaseWhenEditorCloses(rowId)
      return
    }
    const button = target.closest<HTMLButtonElement>('.matrix-v5-row-actions button')
    const matrixRow = target.closest<HTMLTableRowElement>('tr[data-matrix-row-id]')
    if (!button && !matrixRow) return

    if (bypassClickRef.current) {
      bypassClickRef.current = false
      return
    }

    const editingRow = button?.closest('tr.matrix-v5-edit-row')
    if (editingRow) {
      const rowId = lockedRowIdRef.current
      if (rowId) releaseWhenEditorCloses(rowId)
      return
    }

    const rowId = matrixRow?.dataset.matrixRowId || (button ? rowIdForButton(button) : '')
    if (!rowId) return

    if (rootRef.current?.querySelector('.matrix-v5-edit-row')) {
      event.preventDefault()
      event.stopPropagation()
      setPendingRowSwitch(rowId)
      return
    }

    const existing = locksRef.current.find(lock => lock.row_id === rowId)
    if (existing && existing.user_id !== currentUserIdRef.current) {
      event.preventDefault()
      event.stopPropagation()
      props.onError(`${existing.display_name || existing.user_email} está editando esta fila. Espera a que termine.`)
      return
    }

    event.preventDefault()
    event.stopPropagation()
    const deleting = Boolean(button?.classList.contains('danger'))
    void (async () => {
      const ok = await acquireLock(rowId)
      if (!ok) return
      bypassClickRef.current = true
      if (button) button.click()
      else matrixRow?.click()
      if (deleting) window.setTimeout(() => void releaseLock(rowId), 1200)
    })()
  }

  useEffect(() => {
    const root = rootRef.current""",
)
rep(
    v11,
    "    {onViewGuidelines && <div className=\"matrix-v11-guideline-shortcut\"><button type=\"button\" onClick={onViewGuidelines}><BookOpenText size={16}/> Ver lineamientos</button></div>}",
    "    {onViewGuidelines && <div className=\"matrix-v11-guideline-shortcut\"><button type=\"button\" onClick={() => onViewGuidelines?.(guidelineContext)}><BookOpenText size={16}/> Ver lineamientos</button></div>}",
)
rep(
    v11,
    "    {props.unitCode === 'CENTRAL' ? <CentralExcelWorkspace key={revision} {...workspaceProps} unitCode=\"CENTRAL\" onActiveMatrixChange={handleActiveMatrixChange} /> : <UnitExcelWorkspace",
    "    {props.unitCode === 'CENTRAL' ? <CentralExcelWorkspace key={revision} {...workspaceProps} unitCode=\"CENTRAL\" onActiveMatrixChange={handleActiveMatrixChange} onGuidelineContextChange={setGuidelineContext} /> : <UnitExcelWorkspace",
)
rep(
    v11,
    "    {props.unitCode === 'CENTRAL' ? <CentralExcelWorkspace key={revision} {...workspaceProps} unitCode=\"CENTRAL\" onActiveMatrixChange={handleActiveMatrixChange} onGuidelineContextChange={setGuidelineContext} /> : <UnitExcelWorkspace key={revision} periodId={props.periodId} year={props.year} unitCode={props.unitCode} unitName={props.unitName} canManage={props.canManage} onError={props.onError} onNotice={props.onNotice} onActiveMatrixChange={handleActiveMatrixChange} />}\n  </div>\n}",
    "    {props.unitCode === 'CENTRAL' ? <CentralExcelWorkspace key={revision} {...workspaceProps} unitCode=\"CENTRAL\" onActiveMatrixChange={handleActiveMatrixChange} onGuidelineContextChange={setGuidelineContext} /> : <UnitExcelWorkspace key={revision} periodId={props.periodId} year={props.year} unitCode={props.unitCode} unitName={props.unitName} canManage={props.canManage} onError={props.onError} onNotice={props.onNotice} onActiveMatrixChange={handleActiveMatrixChange} />}\n    {pendingRowSwitch && <div className=\"matrix-v11-switch-backdrop\" role=\"presentation\" onMouseDown={event => { if (event.currentTarget === event.target) setPendingRowSwitch(null) }}><section className=\"matrix-v11-switch-dialog\" role=\"dialog\" aria-modal=\"true\"><h3>Cambiar de fila</h3><p>Tienes una edición abierta. Elige qué hacer antes de continuar.</p><div><button type=\"button\" className=\"primary\" onClick={() => void finishCurrentAndSwitch('save')}>Guardar y cambiar</button><button type=\"button\" onClick={() => void finishCurrentAndSwitch('discard')}>Descartar y cambiar</button><button type=\"button\" onClick={() => void finishCurrentAndSwitch('stay')}>Seguir editando</button></div></section></div>}\n  </div>\n}",
)

v11css = 'src/matrix-workspace-v11.css'
text = read(v11css)
text += """
.matrix-v11-switch-backdrop{position:fixed;inset:0;z-index:1400;display:grid;place-items:center;background:rgba(15,35,52,.38);padding:18px}
.matrix-v11-switch-dialog{width:min(430px,100%);border:1px solid #c7d8e4;border-radius:14px;background:#fff;box-shadow:0 24px 70px rgba(16,42,61,.22);padding:20px}
.matrix-v11-switch-dialog h3{margin:0 0 7px;color:#17324a;font-size:17px}.matrix-v11-switch-dialog p{margin:0 0 16px;color:#637b8d;font-size:12px;line-height:1.5}.matrix-v11-switch-dialog>div{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end}.matrix-v11-switch-dialog button{min-height:36px;border:1px solid #c5d6e2;border-radius:8px;background:#fff;color:#31566f;padding:0 12px;font-size:10.5px;font-weight:850;cursor:pointer}.matrix-v11-switch-dialog button.primary{background:#1769aa;border-color:#1769aa;color:#fff}
"""
write(v11css, text)

for path in ['src/MatrixWorkspaceV12.tsx', 'src/MatrixWorkspaceV13.tsx', 'src/MatrixWorkspace.tsx']:
    rep(path, "  onViewGuidelines?: () => void", "  onViewGuidelines?: (target?: { managementId: string; guidelineId: string | null }) => void")

dashboard = 'src/Dashboard.tsx'
rep(
    dashboard,
    "onViewGuidelines={() => { setStep('guidelines'); setError(''); setNotice('') }}",
    "onViewGuidelines={(target) => { if (selectedPlanningUnit.code === 'CENTRAL' && target?.managementId) sessionStorage.setItem('cg:guideline-target', JSON.stringify({ periodId: selectedPeriod.id, unitCode: selectedPlanningUnit.code, managementId: target.managementId, guidelineId: target.guidelineId, createdAt: Date.now() })); setStep('guidelines'); setError(''); setNotice('') }}",
)

planning = 'src/PlanningGuidelines.tsx'
rep(
    planning,
    "type SelectedArea = { id: string; name: string } | null",
    "type SelectedArea = { id: string; name: string } | null\ntype GuidelineTarget = { periodId: string; unitCode: string; managementId: string; guidelineId: string | null; createdAt: number }",
)
rep(
    planning,
    "  const [selectedArea, setSelectedArea] = useState<SelectedArea>(null)\n  const isCentral = unit.code === 'CENTRAL'",
    "  const [selectedArea, setSelectedArea] = useState<SelectedArea>(null)\n  const [guidelineTarget, setGuidelineTarget] = useState<GuidelineTarget | null>(null)\n  const isCentral = unit.code === 'CENTRAL'",
)
rep(
    planning,
    "  useEffect(() => { setSelectedArea(null) }, [periodId, unit.code])\n\n  useEffect(() => {\n    if (isCentral) return",
    "  useEffect(() => { setSelectedArea(null) }, [periodId, unit.code])\n  useEffect(() => {\n    if (!isCentral) { setGuidelineTarget(null); return }\n    try {\n      const raw = sessionStorage.getItem('cg:guideline-target')\n      const target = raw ? JSON.parse(raw) as GuidelineTarget : null\n      if (target && target.periodId === periodId && target.unitCode === unit.code && Date.now() - target.createdAt <= 30000) setGuidelineTarget(target)\n      else setGuidelineTarget(null)\n    } catch { setGuidelineTarget(null) }\n    finally { sessionStorage.removeItem('cg:guideline-target') }\n  }, [isCentral, periodId, unit.code])\n\n  useEffect(() => {\n    if (isCentral) return",
)
rep(
    planning,
    "    {isCentral ? <CentralGuidelineWorkspace key={catalogRevision} periodId={periodId} canManage={canManage} onAreaChange={setSelectedArea} /> : <GuidelineCatalogV2",
    "    {isCentral ? <CentralGuidelineWorkspace key={catalogRevision} periodId={periodId} canManage={canManage} initialAreaId={guidelineTarget?.managementId} focusGuidelineId={guidelineTarget?.guidelineId} onAreaChange={setSelectedArea} /> : <GuidelineCatalogV2",
)

central_guidelines = 'src/CentralGuidelineWorkspace.tsx'
rep(central_guidelines, "import { useEffect, useMemo, useState } from 'react'", "import { useEffect, useMemo, useRef, useState } from 'react'")
rep(
    central_guidelines,
    "  canManage: boolean\n  onAreaChange?: (area: { id: string; name: string } | null) => void",
    "  canManage: boolean\n  initialAreaId?: string\n  focusGuidelineId?: string | null\n  onAreaChange?: (area: { id: string; name: string } | null) => void",
)
rep(
    central_guidelines,
    "export default function CentralGuidelineWorkspace({ periodId, canManage, onAreaChange }: Props) {",
    "export default function CentralGuidelineWorkspace({ periodId, canManage, initialAreaId, focusGuidelineId, onAreaChange }: Props) {",
)
rep(central_guidelines, "  const [selectedAreaId, setSelectedAreaId] = useState('')", "  const [selectedAreaId, setSelectedAreaId] = useState(initialAreaId || '')")
rep(
    central_guidelines,
    "  const [pendingDelete, setPendingDelete] = useState<Guideline | null>(null)\n\n  const areas",
    "  const [pendingDelete, setPendingDelete] = useState<Guideline | null>(null)\n  const focusRowRef = useRef<HTMLTableRowElement | null>(null)\n\n  const areas",
)
rep(
    central_guidelines,
    "  useEffect(() => { void load() }, [periodId, canManage])\n\n  useEffect(() => {\n    if (!selectedAreaId && areas.length)",
    "  useEffect(() => { void load() }, [periodId, canManage])\n  useEffect(() => { if (initialAreaId) setSelectedAreaId(initialAreaId) }, [initialAreaId, periodId])\n\n  useEffect(() => {\n    if (!selectedAreaId && areas.length)",
)
rep(
    central_guidelines,
    "  useEffect(() => {\n    onAreaChange?.(selectedArea ? { id: selectedArea.id, name: selectedArea.name } : null)\n  }, [selectedArea?.id, selectedArea?.name, onAreaChange])",
    "  useEffect(() => {\n    onAreaChange?.(selectedArea ? { id: selectedArea.id, name: selectedArea.name } : null)\n  }, [selectedArea?.id, selectedArea?.name, onAreaChange])\n  useEffect(() => {\n    if (!focusGuidelineId || !visibleGuidelines.some(item => item.id === focusGuidelineId)) return\n    const timer = window.setTimeout(() => focusRowRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 80)\n    return () => window.clearTimeout(timer)\n  }, [focusGuidelineId, selectedAreaId, visibleGuidelines])",
)
rep(
    central_guidelines,
    "visibleGuidelines.map(item => <tr key={item.id}>",
    "visibleGuidelines.map(item => <tr key={item.id} ref={item.id === focusGuidelineId ? focusRowRef : undefined} className={item.id === focusGuidelineId ? 'central-guideline-row--focused' : ''}>",
)

cgc = 'src/central-guideline-workspace.css'
text = read(cgc)
text += "\n.central-guideline-row--focused td{background:#e8f4ff!important;box-shadow:inset 0 1px 0 #69aee0,inset 0 -1px 0 #69aee0}.central-guideline-row--focused .central-guideline-text>span{font-weight:850;color:#0f5f9b}\n"
write(cgc, text)

test_path = 'tests/central-workspace-structure.test.mjs'
text = read(test_path)
text = text.replace("for (const label of ['Expandir matriz', 'Historial', 'Importar Excel', 'Exportar Excel', 'Nueva fila'])", "for (const label of ['Expandir matriz', 'Historial', 'Exportar Excel', 'Nueva fila'])")
text = text.replace("  assert.match(v11, /CentralExcelWorkspace/)\n", "  assert.doesNotMatch(central, /Importar Excel/)\n  assert.match(v11, /CentralExcelWorkspace/)\n", 1)
write(test_path, text)

migration = Path('supabase/migrations/20260904162128_central_matrix_row_guideline_link.sql')
migration.write_text(
    """alter table public.matrix_rows
  add column if not exists guideline_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'matrix_rows_guideline_id_fkey'
      and conrelid = 'public.matrix_rows'::regclass
  ) then
    alter table public.matrix_rows
      add constraint matrix_rows_guideline_id_fkey
      foreign key (guideline_id)
      references public.planning_guidelines(id)
      on delete set null;
  end if;
end
$$;

create index if not exists idx_matrix_rows_guideline_id
  on public.matrix_rows(guideline_id);

update public.matrix_rows mr
set guideline_id = pg.id
from public.matrices m
join public.processes p on p.id = m.process_id
join public.planning_guidelines pg
  on pg.period_id = m.period_id
 and pg.unit_code = m.unit_code
 and pg.management_id = p.management_id
 and pg.active = true
where mr.matrix_id = m.id
  and m.unit_code = 'CENTRAL'
  and mr.guideline_id is null
  and nullif(btrim(mr.objective_group), '') is not null
  and lower(btrim(pg.guideline_text)) = lower(btrim(mr.objective_group));
""",
    encoding='utf-8',
)
