// Small test helper: check two number lists are equal within a tiny error.
import { expect } from 'vitest'

export function expectClose(actual: ArrayLike<number>, expected: ArrayLike<number>, digits = 6) {
  expect(actual.length).toBe(expected.length)
  for (let i = 0; i < expected.length; i++) {
    expect(actual[i]).toBeCloseTo(expected[i], digits)
  }
}
