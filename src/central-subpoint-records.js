import { splitSubpoints } from './matrix-subpoints.js'

function text(value) {
  return String(value ?? '').trim()
}

function date(value) {
  const normalized = text(value)
  return normalized || null
}

export function buildCentralSubpointDrafts(records, legacyRow = {}) {
  const ordered = [...(records || [])]
    .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0))
    .map(item => ({
      id: item.id || null,
      text: text(item.text),
      milestones: text(item.milestones),
      kpi: text(item.kpi),
      start_date: text(item.start_date),
      end_date: text(item.end_date),
    }))
    .filter(item => item.text)

  if (ordered.length) return ordered

  return splitSubpoints(legacyRow.action_plan || '').map((subpoint, index) => ({
    id: null,
    text: subpoint,
    milestones: index === 0 ? text(legacyRow.milestones) : '',
    kpi: index === 0 ? text(legacyRow.kpi) : '',
    start_date: index === 0 ? text(legacyRow.start_date) : '',
    end_date: index === 0 ? text(legacyRow.end_date) : '',
  }))
}

export function normalizeCentralSubpointRows(drafts) {
  return (drafts || [])
    .map(item => ({
      text: text(item.text),
      milestones: text(item.milestones) || null,
      kpi: text(item.kpi) || null,
      start_date: date(item.start_date),
      end_date: date(item.end_date),
    }))
    .filter(item => item.text)
    .map((item, sort_order) => ({ ...item, sort_order }))
}

export function actionPlanFromSubpoints(rows) {
  return (rows || []).map(item => text(item.text)).filter(Boolean).join('\n')
}
