import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const central = fs.readFileSync(new URL('../src/CentralExcelWorkspace.tsx', import.meta.url), 'utf8')
const v11 = fs.readFileSync(new URL('../src/MatrixWorkspaceV11.tsx', import.meta.url), 'utf8')

test('Central only renders the zoom dock while the matrix is fullscreen', () => {
  assert.match(central, /\{expanded\s*&&\s*<div className="matrix-central-zoom-dock"/)
})

test('top edit actions release the collaborative row lock after save cancel or delete', () => {
  assert.match(v11, /data-edit-action/)
  assert.match(v11, /matrix-central-top-actions/)
  assert.match(v11, /releaseWhenEditorCloses\(rowId\)/)
})
