function validIsoDate(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

export function milestoneDateInputValue(value) {
  const text = String(value ?? '').trim()
  if (!text) return ''
  if (validIsoDate(text)) return text
  const match = text.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/)
  if (!match) return ''
  const iso = `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`
  return validIsoDate(iso) ? iso : ''
}

export function formatMilestoneDate(value) {
  const text = String(value ?? '').trim()
  if (!text) return '—'
  const iso = milestoneDateInputValue(text)
  if (!iso) return text
  const [year, month, day] = iso.split('-')
  return `${day}/${month}/${year}`
}
