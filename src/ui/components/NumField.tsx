// NumField.tsx - a number box that keeps its own text while you type (so "-" or "0." do not
// get erased) and passes a number up as soon as the text is a valid number.

import { useEffect, useState } from 'react'

export default function NumField({ value, onChange, step = 0.1 }: { value: number; onChange: (v: number) => void; step?: number }) {
  const [text, setText] = useState(String(value))
  useEffect(() => {
    if (Number(text) !== value) setText(String(value))
  }, [value])
  return (
    <input
      className="num-field"
      type="number" step={step} value={text}
      onChange={(e) => {
        setText(e.target.value)
        const n = Number(e.target.value)
        if (e.target.value !== '' && Number.isFinite(n)) onChange(n)
      }}
      onBlur={() => setText(String(value))}
    />
  )
}
