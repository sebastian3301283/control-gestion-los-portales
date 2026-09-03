export function filterManagersForArea(managers, mappings, managementId) {
  if (!managementId) return []
  const allowed = new Set(
    (mappings || [])
      .filter(item => String(item.management_id || '') === String(managementId))
      .map(item => String(item.manager_id || '')),
  )
  return (managers || []).filter(manager => allowed.has(String(manager.id || '')))
}

export function toggleResponsibleId(currentIds, managerId) {
  const id = String(managerId || '')
  if (!id) return [...(currentIds || [])]
  const current = [...new Set((currentIds || []).map(String).filter(Boolean))]
  return current.includes(id) ? current.filter(item => item !== id) : [...current, id]
}

export function responsibleNames(ids, managers) {
  const byId = new Map((managers || []).map(manager => [String(manager.id), String(manager.name || '')]))
  return (ids || []).map(id => byId.get(String(id)) || '').filter(Boolean)
}

export function splitResponsibleNames(value) {
  return String(value || '')
    .split(/[;,\n|]+/)
    .map(item => item.trim())
    .filter(Boolean)
}

export function normalizeCentralGroup(value) {
  return String(value || '').trim().replace(/\s+/g, ' ')
}
