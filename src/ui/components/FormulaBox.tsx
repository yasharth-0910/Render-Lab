// FormulaBox.tsx - small monospace box for a formula and its live numbers.
import type { ReactNode } from 'react'

export default function FormulaBox({ children }: { children: ReactNode }) {
  return <div className="formula-box">{children}</div>
}
