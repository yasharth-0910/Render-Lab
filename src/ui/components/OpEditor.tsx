// OpEditor.tsx - an ordered list of operations the user can edit, used by the transforms lab
// (2D and 3D). Each row has its own number boxes. Buttons add, remove and reorder rows.
// Also contains NumField (a number box that allows typing "-" or "1." freely) and MatrixView.

import { useEffect, useState } from 'react'
import { theme } from './theme'

export type Field = { key: string; label: string; def: number; step?: number }
export type Spec = Record<string, { label: string; fields: Field[]; axis?: boolean }>

/** One operation in the list. `v` holds its numbers by field key. Angles are in DEGREES here. */
export type UiOp = { id: number; type: string; v: Record<string, number>; axis: 'x' | 'y' }

let nextId = 1

/** A new operation of the given type, filled with that type's default numbers. */
export function makeOp(type: string, spec: Spec, overrides: Record<string, number> = {}, axis: 'x' | 'y' = 'x'): UiOp {
  const v: Record<string, number> = {}
  for (const f of spec[type].fields) v[f.key] = overrides[f.key] ?? f.def
  return { id: nextId++, type, v, axis }
}

// A number box that keeps its own text while you type (so "-" or "0." do not get erased),
// and passes a number up as soon as the text is a valid number.
export function NumField({ value, onChange, step = 0.1 }: { value: number; onChange: (v: number) => void; step?: number }) {
  const [text, setText] = useState(String(value))
  useEffect(() => {
    if (Number(text) !== value) setText(String(value))
  }, [value])
  return (
    <input
      type="number" step={step} value={text}
      onChange={(e) => {
        setText(e.target.value)
        const n = Number(e.target.value)
        if (e.target.value !== '' && Number.isFinite(n)) onChange(n)
      }}
      onBlur={() => setText(String(value))}
      style={{ width: 58, background: theme.panel, color: theme.text, border: `1px solid ${theme.border}`, borderRadius: 3, padding: '1px 3px' }}
    />
  )
}

const smallButton = {
  background: 'none', color: theme.text, border: `1px solid ${theme.border}`, borderRadius: 3, cursor: 'pointer', padding: '0 6px',
} as const

type Props = {
  ops: UiOp[]
  spec: Spec
  onChange: (ops: UiOp[]) => void
  onReset: () => void
}

export default function OpEditor({ ops, spec, onChange, onReset }: Props) {
  const update = (id: number, change: Partial<UiOp>) => onChange(ops.map((o) => (o.id === id ? { ...o, ...change } : o)))
  const move = (i: number, dir: 1 | -1) => {
    const j = i + dir
    if (j < 0 || j >= ops.length) return
    const copy = [...ops]
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
    onChange(copy)
  }
  return (
    <div>
      <div style={{ color: theme.muted, margin: '8px 0 2px' }}>Operations (the top one happens first)</div>
      {ops.map((o, i) => (
        <div key={o.id} style={{ borderTop: `1px solid ${theme.border}`, padding: '4px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ flex: 1 }}>{i + 1}. {spec[o.type].label}</span>
            <button style={smallButton} disabled={i === 0} onClick={() => move(i, -1)} title="move up">▲</button>
            <button style={smallButton} disabled={i === ops.length - 1} onClick={() => move(i, 1)} title="move down">▼</button>
            <button style={smallButton} onClick={() => onChange(ops.filter((x) => x.id !== o.id))} title="remove">✕</button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 10px', marginTop: 3 }}>
            {spec[o.type].fields.map((f) => (
              <label key={f.key} style={{ color: theme.muted }}>
                {f.label} <NumField value={o.v[f.key]} step={f.step} onChange={(v) => update(o.id, { v: { ...o.v, [f.key]: v } })} />
              </label>
            ))}
            {spec[o.type].axis && (
              <label style={{ color: theme.muted }}>
                mirror axis{' '}
                <select value={o.axis} onChange={(e) => update(o.id, { axis: e.target.value as 'x' | 'y' })}>
                  <option value="x">x axis (flips y)</option>
                  <option value="y">y axis (flips x)</option>
                </select>
              </label>
            )}
          </div>
        </div>
      ))}
      <div style={{ borderTop: `1px solid ${theme.border}`, paddingTop: 6, display: 'flex', gap: 8 }}>
        <select
          value="" style={{ flex: 1 }}
          onChange={(e) => e.target.value && onChange([...ops, makeOp(e.target.value, spec)])}
        >
          <option value="">+ Add operation…</option>
          {Object.entries(spec).map(([type, s]) => <option key={type} value={type}>{s.label}</option>)}
        </select>
        <button style={{ ...smallButton, padding: '2px 8px' }} onClick={onReset}>Reset</button>
      </div>
    </div>
  )
}

/** A matrix shown as a grid of numbers. `size` is 3 or 4. */
export function MatrixView({ m, size }: { m: number[]; size: 3 | 4 }) {
  return (
    <div style={{ display: 'inline-grid', gridTemplateColumns: `repeat(${size}, 58px)`, font: theme.mono, background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: 4, padding: '4px 6px' }}>
      {m.map((v, i) => (
        <div key={i} style={{ textAlign: 'right', padding: '1px 2px' }}>{(Math.abs(v) < 5e-5 ? 0 : v).toFixed(2)}</div>
      ))}
    </div>
  )
}
