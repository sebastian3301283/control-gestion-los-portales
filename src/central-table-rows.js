function clean(value) {
  return String(value ?? '').trim()
}

export function buildCentralTableRows(input = {}) {
  const records = Array.isArray(input.subpointRecords) ? input.subpointRecords : null
  const subpoints = records || (Array.isArray(input.subpoints) ? input.subpoints : [])
  const milestones = Array.isArray(input.milestones) ? input.milestones : []
  const kpis = Array.isArray(input.kpis) ? input.kpis : []
  const startDates = Array.isArray(input.startDates) ? input.startDates : []
  const endDates = Array.isArray(input.endDates) ? input.endDates : []

  return subpoints.map((subpoint, index) => ({
    index,
    label: `S${index + 1}`,
    objective: clean(input.objective),
    subpoint: clean(records ? subpoint?.text : subpoint) || '—',
    milestones: clean(records ? subpoint?.milestones : milestones[index]) || '—',
    kpi: clean(records ? subpoint?.kpi : kpis[index]) || '—',
    startDate: clean(records ? subpoint?.start_date : startDates[index]) || '—',
    endDate: clean(records ? subpoint?.end_date : endDates[index]) || '—',
  }))
}
