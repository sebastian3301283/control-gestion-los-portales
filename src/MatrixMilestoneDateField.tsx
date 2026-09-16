import './matrix-milestone-date.css'

type Props = {
  value: string
  onChange: (value: string) => void
  ariaLabel?: string
}

function validIsoDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

export function milestoneDateInputValue(value: string | null | undefined) {
  const text = String(value ?? '').trim()
  if (!text) return ''
  if (validIsoDate(text)) return text
  const match = text.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/)
  if (!match) return ''
  const iso = `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`
  return validIsoDate(iso) ? iso : ''
}

export function formatMilestoneDate(value: string | null | undefined) {
  const text = String(value ?? '').trim()
  if (!text) return '—'
  const iso = milestoneDateInputValue(text)
  if (!iso) return text
  const [year, month, day] = iso.split('-')
  return `${day}/${month}/${year}`
}

export default function MatrixMilestoneDateField({ value, onChange, ariaLabel = 'Hitos / Fechas' }: Props) {
  const inputValue = milestoneDateInputValue(value)
  const legacyValue = value.trim() && !inputValue ? value.trim() : ''

  return <div className="matrix-milestone-date-field">
    <input
      type="date"
      lang="es-PE"
      value={inputValue}
      onChange={event => onChange(event.target.value)}
      aria-label={ariaLabel}
      title={inputValue ? formatMilestoneDate(inputValue) : 'Selecciona una fecha'}
    />
    {legacyValue && <small title={legacyValue}>Dato anterior: {legacyValue}</small>}
  </div>
}
