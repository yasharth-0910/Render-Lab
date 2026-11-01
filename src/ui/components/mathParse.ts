// mathParse.ts - turns a short text formula into a small tree that Equation.tsx draws nicely
// (italic variables, real subscripts, superscripts and fractions). Pure text work, no React.
//
// The little formula language:
//   x_i  x_{out}     subscript            x^2  x^{n+1}     superscript
//   frac{top}{bottom}                     a fraction (the parts can contain anything, also fractions)
// Everything else is plain text. A single letter standing on its own (not next to other letters) is a
// variable and is drawn in italics; words such as max, eye or range stay upright.

export type MathNode =
  | { t: 'text'; text: string }
  | { t: 'var'; text: string }
  | { t: 'sub'; nodes: MathNode[] }
  | { t: 'sup'; nodes: MathNode[] }
  | { t: 'frac'; num: MathNode[]; den: MathNode[] }

/**
 * Typographic clean-up of ASCII text: "->" becomes an arrow, "<=" and ">=" real comparison signs,
 * and a hyphen in front of a number (or between spaces) becomes a proper minus sign. Hyphens inside
 * words ("back-face") are left alone.
 */
export function prettify(text: string): string {
  return text
    .replace(/->/g, '→')
    .replace(/<=/g, '≤')
    .replace(/>=/g, '≥')
    .replace(/(^|[\s(,=×·+*/→≤≥<>])-(?=\d)/g, '$1−') // -6 or (-0.5 : a minus sign
    .replace(/ - /g, ' − ')
}

// Split plain text into runs of text and single-letter variables.
function splitVariables(plain: string): MathNode[] {
  const nodes: MathNode[] = []
  let last = 0
  for (const match of plain.matchAll(/(?<![A-Za-zΑ-Ωα-ω])[A-Za-zΑ-Ωα-ω](?![A-Za-zΑ-Ωα-ω])/g)) {
    if (match.index! > last) nodes.push({ t: 'text', text: plain.slice(last, match.index) })
    nodes.push({ t: 'var', text: match[0] })
    last = match.index! + 1
  }
  if (last < plain.length) nodes.push({ t: 'text', text: plain.slice(last) })
  return nodes
}

// text[start] is '{': return what is inside the matching '}' (nested braces count) and where it ends.
function readGroup(text: string, start: number): { inner: string; next: number } {
  let depth = 0
  for (let i = start; i < text.length; i++) {
    if (text[i] === '{') depth++
    else if (text[i] === '}' && --depth === 0) return { inner: text.slice(start + 1, i), next: i + 1 }
  }
  return { inner: text.slice(start + 1), next: text.length } // no closing brace: take the rest
}

function parseRange(text: string): MathNode[] {
  const nodes: MathNode[] = []
  let plain = ''
  const flush = () => {
    if (plain) nodes.push(...splitVariables(plain))
    plain = ''
  }
  let i = 0
  while (i < text.length) {
    if (text.startsWith('frac{', i)) {
      flush()
      const top = readGroup(text, i + 4)
      const bottom = text[top.next] === '{' ? readGroup(text, top.next) : { inner: '', next: top.next }
      nodes.push({ t: 'frac', num: parseRange(top.inner), den: parseRange(bottom.inner) })
      i = bottom.next
    } else if ((text[i] === '_' || text[i] === '^') && i + 1 < text.length) {
      flush()
      const group = text[i + 1] === '{' ? readGroup(text, i + 1) : { inner: text[i + 1], next: i + 2 }
      nodes.push({ t: text[i] === '_' ? 'sub' : 'sup', nodes: parseRange(group.inner) })
      i = group.next
    } else {
      plain += text[i]
      i++
    }
  }
  flush()
  return nodes
}

/** Parse a formula string into nodes (after the typographic clean-up). */
export function parseMath(input: string): MathNode[] {
  return parseRange(prettify(input))
}
