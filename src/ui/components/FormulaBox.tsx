// FormulaBox.tsx - small monospace box for the formula and live numbers.
import type { ReactNode } from 'react'
import { theme } from './theme'

export default function FormulaBox({ children }: { children: ReactNode }) {
  return (
    <div style={{
      font: theme.mono, background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: 4,
      padding: 8, maxHeight: 280, overflowY: 'auto', whiteSpace: 'pre-wrap',
    }}>
      {children}
    </div>
  )
}
