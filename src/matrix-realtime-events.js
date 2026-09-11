function changeRecord(payload) {
  if (payload?.new && Object.keys(payload.new).length) return payload.new
  if (payload?.old && Object.keys(payload.old).length) return payload.old
  return {}
}

export function matrixIdFromChange(payload) {
  const record = changeRecord(payload)
  return typeof record.matrix_id === 'string' ? record.matrix_id : ''
}

export function parentRowIdFromChange(payload) {
  const record = changeRecord(payload)
  if (typeof record.matrix_row_id === 'string') return record.matrix_row_id
  return typeof record.row_id === 'string' ? record.row_id : ''
}

export function shouldRefreshMatrix(payload, activeMatrixId) {
  if (!activeMatrixId) return false
  const changedMatrixId = matrixIdFromChange(payload)
  return !changedMatrixId || changedMatrixId === activeMatrixId
}

export function sameCollaborationLocation(left, right) {
  if (left === right) return true
  if (!left || !right) return false
  return left.field === right.field && (left.row || '') === (right.row || '') && (left.subpoint || '') === (right.subpoint || '')
}
