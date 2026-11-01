// Equation.tsx - the pieces a lab uses to show formulas so that they are easy to read:
//   <Eq label="Normal">n = (b − a) × (c − a)</Eq>   one typeset equation (italic variables, real fractions)
//   <Note>short explanation in plain words</Note>
//   <Numbers title="Live numbers" lines={[...]} />   the numbers of the current example, one per line
// The text of an equation uses the small formula language of mathParse.ts (x_i, x^2, frac{a}{b}).

import type { ReactNode } from 'react'
import { parseMath, prettify, type MathNode } from './mathParse'

function draw(nodes: MathNode[]): ReactNode[] {
  return nodes.map((node, i) => {
    switch (node.t) {
      case 'text': return node.text
      case 'var': return <i key={i}>{node.text}</i>
      case 'sub': return <sub key={i}>{draw(node.nodes)}</sub>
      case 'sup': return <sup key={i}>{draw(node.nodes)}</sup>
      case 'frac': return (
        <span key={i} className="frac">
          <span className="frac-top">{draw(node.num)}</span>
          <span className="frac-bottom">{draw(node.den)}</span>
        </span>
      )
    }
  })
}

/** Formula text drawn inline, in the math font. Also used for the equations in the console. */
export function MathText({ children }: { children: string }) {
  return <span className="math">{draw(parseMath(children))}</span>
}

/** One equation on its own line, with an optional small label above it. */
export function Eq({ label, children }: { label?: string; children: string }) {
  return (
    <div className="eq">
      {label && <div className="eq-label">{label}</div>}
      <div className="eq-body"><MathText>{children}</MathText></div>
    </div>
  )
}

/** A short explanation in plain words. */
export function Note({ children }: { children: ReactNode }) {
  return <p className="eq-note">{children}</p>
}

/** The numbers of the current example, one line each, in a monospace block (a long line wraps with an indent). */
export function Numbers({ title, lines }: { title?: string; lines: string[] }) {
  return (
    <div className="eq">
      {title && <div className="eq-label">{title}</div>}
      <div className="numbers">
        {lines.map((line, i) => <div key={i} className="numbers-line">{prettify(line)}</div>)}
      </div>
    </div>
  )
}
