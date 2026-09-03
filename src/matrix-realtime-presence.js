function clean(value) {
  return String(value ?? '').trim()
}

export function flattenPresenceState(state = {}) {
  const unique = new Map()
  Object.values(state || {}).forEach(entries => {
    if (!Array.isArray(entries)) return
    entries.forEach(entry => {
      const userId = clean(entry?.user_id)
      if (!userId) return
      unique.set(userId, {
        user_id: userId,
        name: clean(entry?.name) || clean(entry?.email) || 'Usuario',
        email: clean(entry?.email),
        location: entry?.location && typeof entry.location === 'object' ? {
          ...(clean(entry.location.field) ? { field: clean(entry.location.field) } : {}),
          ...(clean(entry.location.subpoint) ? { subpoint: clean(entry.location.subpoint) } : {}),
          ...(clean(entry.location.row) ? { row: clean(entry.location.row) } : {}),
        } : null,
      })
    })
  })
  return [...unique.values()]
}

export function collaborationLocationLabel(location) {
  if (!location || typeof location !== 'object') return ''
  const parts = []
  const field = clean(location.field)
  const subpoint = clean(location.subpoint)
  const row = clean(location.row)
  if (field) parts.push(field)
  if (subpoint) parts.push(subpoint)
  if (row) parts.push(`fila ${row}`)
  return parts.join(' · ')
}
