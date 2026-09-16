function normalizedRole(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function normalizedObjective(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

export function filterGerenteManagers(managers) {
  return (managers || []).filter(manager => {
    if (manager?.active === false) return false
    const cargo = normalizedRole(manager?.cargo)
    if (!cargo || /(?:^|\s)subgerente(?:\s|$)/.test(cargo)) return false
    return /(?:^|\s)gerente(?:\s|$)/.test(cargo)
  })
}

export function toggleResponsibleId(currentIds, managerId) {
  const id = String(managerId || '')
  if (!id) return [...(currentIds || [])]
  const current = [...new Set((currentIds || []).map(String).filter(Boolean))]
  return current.includes(id) ? current.filter(item => item !== id) : [...current, id]
}

export function groupRowsByObjective(rows) {
  const groups = []
  const groupsByKey = new Map()

  for (const row of rows || []) {
    const objective = String(row?.objective_group || '').trim() || 'Sin objetivo'
    const key = normalizedObjective(objective) || '__sin_objetivo__'
    let group = groupsByKey.get(key)
    if (!group) {
      group = { objective, rows: [] }
      groupsByKey.set(key, group)
      groups.push(group)
    }
    group.rows.push(row)
  }

  return groups
}
