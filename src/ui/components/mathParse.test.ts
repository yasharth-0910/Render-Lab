import { describe, it, expect } from 'vitest'
import { parseMath, prettify, type MathNode } from './mathParse'

const flat = (nodes: MathNode[]): string =>
  nodes.map((n) => {
    if (n.t === 'text') return n.text
    if (n.t === 'var') return `<${n.text}>`
    if (n.t === 'sub') return `_[${flat(n.nodes)}]`
    if (n.t === 'sup') return `^[${flat(n.nodes)}]`
    return `frac[${flat(n.num)}|${flat(n.den)}]`
  }).join('')

describe('prettify', () => {
  it('turns ASCII arrows and comparisons into real symbols', () => {
    expect(prettify('a -> b, x <= 3, y >= 4')).toBe('a → b, x ≤ 3, y ≥ 4')
  })
  it('turns a hyphen before a number into a real minus sign, and " - " too', () => {
    expect(prettify('error -6 -> 18')).toBe('error −6 → 18')
    expect(prettify('(-0.5, 2) and 3 - 1')).toBe('(−0.5, 2) and 3 − 1')
  })
  it('leaves hyphens inside words alone', () => {
    expect(prettify('back-face view-space 2-3')).toBe('back-face view-space 2-3')
  })
})

describe('parseMath', () => {
  it('makes single letters on their own italic variables, and keeps words upright', () => {
    expect(flat(parseMath('n · (a − eye)'))).toBe('<n> · (<a> − eye)')
  })
  it('function names are not split into letters', () => {
    expect(flat(parseMath('max(0, n)'))).toBe('max(0, <n>)')
  })
  it('subscripts and superscripts, with or without braces', () => {
    expect(flat(parseMath('a_s + a_{out} + x^2 + y^{n+1}'))).toBe('<a>_[<s>] + <a>_[out] + <x>^[2] + <y>^[<n>+1]')
  })
  it('fractions, also nested inside other things', () => {
    expect(flat(parseMath('frac{c_s a_s}{a_{out}}'))).toBe('frac[<c>_[<s>] <a>_[<s>]|<a>_[out]]')
    expect(flat(parseMath('frac{1}{1 + (d/range)^2}'))).toBe('frac[1|1 + (<d>/range)^[2]]')
  })
  it('does not crash on a missing closing brace or a trailing underscore', () => {
    expect(() => parseMath('a_{b')).not.toThrow()
    expect(() => parseMath('x_')).not.toThrow()
    expect(() => parseMath('frac{1}')).not.toThrow()
  })
  it('keeps Greek letters on their own as variables', () => {
    expect(flat(parseMath('α + β'))).toBe('<α> + <β>')
  })
})
