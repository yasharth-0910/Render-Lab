// NumberRow.tsx - label, slider and the current value on one row.
import { theme } from './theme'

type Props = {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
  format?: (value: number) => string // how to show the value (default: as is)
}

export default function NumberRow({ label, value, min, max, step = 1, onChange, format }: Props) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0' }}>
      <span style={{ width: 84, color: theme.muted }}>{label}</span>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ flex: 1, accentColor: theme.accent, minWidth: 0 }}
      />
      <span style={{ width: 44, textAlign: 'right' }}>{format ? format(value) : value}</span>
    </label>
  )
}
