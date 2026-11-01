// FormulaBox.tsx - the box at the bottom of the inspector that holds a lab's formulas.
// Fill it with <Eq>, <Note> and <Numbers> from Equation.tsx.
import type { ReactNode } from 'react'

export default function FormulaBox({ children }: { children: ReactNode }) {
  return <div className="formula-box">{children}</div>
}
