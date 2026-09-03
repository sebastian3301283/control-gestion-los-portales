function clean(value) {
  return String(value ?? '').trim()
}

export function buildCentralTableRows(input = {}) {
  const subpoints = Array.isArray(input.subpoints) ? input.subpoints : []
  const milestones = Array.isArray(input.milestones) ? input.milestones : []
  const kpis = Array.isArray(input.kpis) ? input.kpis : []
  const startDates = Array.isArray(input.startDates) ? input.startDates : []
  const endDates = Array.isArray(input.endDates) ? input.endDates : []

  return subpoints.map((subpoint, index) => ({
    index,
    label: `S${index + 1}`,
    objective: clean(input.objective),
    subpoint: clean(subpoint) || '—',
    milestones: clean(milestones[index]) || '—',
    kpi: clean(kpis[index]) || '—',
    startDate: clean(startDates[index]) || '—',
    endDate: clean(endDates[index]) || '—',
  }))
}
