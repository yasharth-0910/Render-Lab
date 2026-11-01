// NumberRow.tsx - label, slider and the current value in a small box, on one row.

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
    <label className="row number-row">
      <span className="row-label">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <span className="value-box">{format ? format(value) : value}</span>
    </label>
  )
}
