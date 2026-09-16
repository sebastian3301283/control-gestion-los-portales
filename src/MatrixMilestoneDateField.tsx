import { formatMilestoneDate, milestoneDateInputValue } from './matrix-milestone-date.js'
import './matrix-milestone-date.css'

type Props = {
  value: string
  onChange: (value: string) => void
  ariaLabel?: string
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
