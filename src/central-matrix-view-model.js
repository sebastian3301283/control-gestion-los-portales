function normalize(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase().replace(/\s+/g, ' ')
}

export function managementRank(cargo) {
  const value = normalize(cargo)
  if (!value) return 0
  if (value.includes('DIRECTOR GERENTE')) return 700
  if (value.includes('GERENTE GENERAL')) return 650
  if (value.includes('GERENTE CENTRAL')) return 600
  if (value.includes('GERENTE CORPORATIVO')) return 580
  if (/\bGERENTE\b/.test(value) && !value.includes('SUBGERENTE') && !value.includes('SUB GERENTE')) return 550
  if (value.includes('SUBGERENTE') || value.includes('SUB GERENTE')) return 400
  if (/\bJEFE\b/.test(value)) return 300
  return 100
}

export function filterHighestAreaManagers(managers) {
  if (!Array.isArray(managers) || managers.length === 0) return []
  const ranked = managers.map(manager => ({ manager, rank: managementRank(manager?.cargo) }))
  const maxRank = Math.max(...ranked.map(item => item.rank))
  return ranked.filter(item => item.rank === maxRank).map(item => item.manager).sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || ''), 'es'))
}

export function historyActionLabel(value) {
  if (value === 'BASELINE') return 'Versión inicial'
  if (value === 'ROW_INSERT') return 'Objetivo agregado'
  if (value === 'ROW_UPDATE') return 'Objetivo actualizado'
  if (value === 'ROW_DELETE') return 'Objetivo eliminado'
  if (value === 'SUBPOINT_INSERT') return 'Subobjetivo agregado'
  if (value === 'SUBPOINT_DELETE') return 'Subobjetivo eliminado'
  if (value === 'MATRIX_UPDATE') return 'Matriz actualizada'
  if (value === 'RESTORE') return 'Versión restaurada'
  return String(value || '').replaceAll('_', ' ').toLowerCase()
}

function fallbackName(email) {
  const value = String(email || '').trim()
  if (!value) return 'Sistema'
  const local = value.split('@')[0]
  return local.replace(/[._-]+/g, ' ').replace(/\b\w/g, char => char.toUpperCase()) || value
}

export function groupHistoryByPerson(versions, namesByEmail = {}) {
  const groups = []
  const byKey = new Map()
  for (const version of Array.isArray(versions) ? versions : []) {
    const email = String(version?.changed_email || '').trim().toLowerCase()
    const key = email || '__system__'
    let group = byKey.get(key)
    if (!group) {
      group = {
        key,
        email: email || null,
        name: email ? (namesByEmail[email] || fallbackName(email)) : 'Sistema',
        versions: [],
      }
      byKey.set(key, group)
      groups.push(group)
    }
    group.versions.push(version)
  }
  return groups
}
