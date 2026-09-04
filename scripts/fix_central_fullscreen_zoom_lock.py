from pathlib import Path

central_path = Path('src/CentralExcelWorkspace.tsx')
v11_path = Path('src/MatrixWorkspaceV11.tsx')

central = central_path.read_text(encoding='utf-8')
old_zoom_start = '      <div className="matrix-central-zoom-dock" aria-label="Zoom de matriz">'
new_zoom_start = '      {expanded && <div className="matrix-central-zoom-dock" aria-label="Zoom de matriz">'
if old_zoom_start not in central:
    raise SystemExit('zoom dock start not found')
central = central.replace(old_zoom_start, new_zoom_start, 1)
old_zoom_end = '</button></div>\n      <div className="matrix-v5-footer">'
new_zoom_end = '</button></div>}\n      <div className="matrix-v5-footer">'
if old_zoom_end not in central:
    raise SystemExit('zoom dock end not found')
central = central.replace(old_zoom_end, new_zoom_end, 1)
central_path.write_text(central, encoding='utf-8')

v11 = v11_path.read_text(encoding='utf-8')
old_block = '''    const target = event.target as HTMLElement\n    const editorButton = target.closest<HTMLButtonElement>('.matrix-central-responsible-editor-actions button')\n    if (editorButton) {\n      const rowId = lockedRowIdRef.current\n      if (rowId) releaseWhenEditorCloses(rowId)\n      return\n    }\n'''
new_block = '''    const target = event.target as HTMLElement\n    const editorActionButton = target.closest<HTMLButtonElement>('.matrix-central-top-actions button[data-edit-action], .matrix-central-responsible-editor-actions button')\n    if (editorActionButton) {\n      const rowId = lockedRowIdRef.current\n      if (rowId) releaseWhenEditorCloses(rowId)\n      return\n    }\n'''
if old_block not in v11:
    raise SystemExit('editor action capture block not found')
v11 = v11.replace(old_block, new_block, 1)
v11_path.write_text(v11, encoding='utf-8')
