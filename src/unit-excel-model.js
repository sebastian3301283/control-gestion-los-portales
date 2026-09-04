function normalizedRole(value) {
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
