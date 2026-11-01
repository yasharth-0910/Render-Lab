import { describe, it, expect } from 'vitest'
import {
  wedge2, signedTriangleArea, triangleAreaWedge, triangleAreaCross, sineRule, intersectLines, intersectSegments, lineRelation,
  handedness, orientation2D, volume3, determinant, rank, spansSpace, spans, gramSchmidt, coordinatesInBasis,
} from './geometryLab'
import { dot } from './vec3'

const close = (a: readonly number[], b: readonly number[], digits = 9) => {
  expect(a.length).toBe(b.length)
  a.forEach((v, i) => expect(v).toBeCloseTo(b[i], digits))
}

describe('wedge2 (the 2D outer product)', () => {
  it('x then y is +1 (anticlockwise), y then x is -1 (clockwise)', () => {
    expect(wedge2([1, 0], [0, 1])).toBe(1)
    expect(wedge2([0, 1], [1, 0])).toBe(-1)
  })
  it('parallel vectors give 0, and so does a vector with itself', () => {
    expect(wedge2([1, 2], [2, 4])).toBe(0)
    expect(wedge2([3, 5], [3, 5])).toBe(0)
  })
  it('is the area of the parallelogram: a 3 by 4 rectangle has area 12', () => {
    expect(wedge2([3, 0], [0, 4])).toBe(12)
  })
  it('equals |a||b| sin(angle): 2 and 3 apart by 30 degrees gives 6 * 0.5', () => {
    const angle = Math.PI / 6
    expect(wedge2([2, 0], [3 * Math.cos(angle), 3 * Math.sin(angle)])).toBeCloseTo(3)
  })
})

describe('triangle area', () => {
  it('the 3-4-5 right triangle has area 6 by the wedge and by the cross product', () => {
    expect(triangleAreaWedge([0, 0], [3, 0], [0, 4])).toBe(6)
    expect(triangleAreaCross([0, 0, 0], [3, 0, 0], [0, 4, 0])).toBe(6)
  })
  it('both methods agree for a tilted triangle (a 2D triangle placed in 3D)', () => {
    const a: [number, number] = [1, 1]
    const b: [number, number] = [5, 2]
    const c: [number, number] = [2, 6]
    expect(triangleAreaCross([a[0], a[1], 0], [b[0], b[1], 0], [c[0], c[1], 0])).toBeCloseTo(triangleAreaWedge(a, b, c))
  })
  it('the cross product method works for a triangle that is not flat on the xy plane', () => {
    // two edges of length 2 at right angles, in the plane x = 1: area 2
    expect(triangleAreaCross([1, 0, 0], [1, 2, 0], [1, 0, 2])).toBeCloseTo(2)
  })
  it('the signed area is positive for anticlockwise corners and negative for clockwise', () => {
    expect(signedTriangleArea([0, 0], [3, 0], [0, 4])).toBe(6)
    expect(signedTriangleArea([0, 0], [0, 4], [3, 0])).toBe(-6)
  })
  it('three points on a line give area 0', () => {
    expect(triangleAreaWedge([0, 0], [1, 1], [2, 2])).toBe(0)
  })
})

describe('sineRule', () => {
  const r = sineRule([0, 0], [4, 0], [0, 3]) // right angle at A
  it('the right angle is at A and the sides are 5, 3, 4', () => {
    expect(r.angles[0]).toBeCloseTo(Math.PI / 2)
    close(r.sides, [5, 3, 4])
  })
  it('side / sin(opposite angle) is the same for all three sides (here 5)', () => {
    for (const ratio of r.ratios) expect(ratio).toBeCloseTo(5)
  })
  it('also for a scalene triangle at an odd place', () => {
    const t = sineRule([-2, 1], [5, -1], [1, 6])
    expect(t.ratios[0]).toBeCloseTo(t.ratios[1])
    expect(t.ratios[1]).toBeCloseTo(t.ratios[2])
    expect(t.degenerate).toBe(false)
  })
  it('sin of an angle is the wedge over the product of the lengths', () => {
    expect(r.sines[0]).toBeCloseTo(1)
    expect(r.sines[1]).toBeCloseTo(3 / 5) // angle at B: opposite side 3 over hypotenuse 5
  })
  it('an obtuse angle is found correctly (angle at C of this triangle is 135 degrees)', () => {
    const t = sineRule([0, 0], [2, 0], [-1, 1]) // at A the corner is 135 degrees
    expect(t.angles[0]).toBeCloseTo((3 * Math.PI) / 4)
  })
  it('three points on a line are reported as degenerate', () => {
    expect(sineRule([0, 0], [1, 1], [2, 2]).degenerate).toBe(true)
  })
})

describe('intersectLines', () => {
  it('y = x and y = -x + 2 meet at (1, 1), with t = 1 on the first line', () => {
    const hit = intersectLines([0, 0], [1, 1], [0, 2], [1, -1])!
    close(hit.point, [1, 1])
    expect(hit.t).toBeCloseTo(1)
    expect(hit.s).toBeCloseTo(1)
  })
  it('the point is on both lines: p1 + t d1 = p2 + s d2', () => {
    const p1: [number, number] = [-3, 2]
    const d1: [number, number] = [2, 1]
    const p2: [number, number] = [4, -1]
    const d2: [number, number] = [-1, 3]
    const hit = intersectLines(p1, d1, p2, d2)!
    close([p1[0] + hit.t * d1[0], p1[1] + hit.t * d1[1]], hit.point)
    close([p2[0] + hit.s * d2[0], p2[1] + hit.s * d2[1]], hit.point)
  })
  it('parallel lines return null and are reported as parallel', () => {
    expect(intersectLines([0, 0], [1, 1], [0, 1], [2, 2])).toBeNull()
    expect(lineRelation([0, 0], [1, 1], [0, 1], [2, 2])).toBe('parallel')
  })
  it('the same line twice is reported as coincident', () => {
    expect(lineRelation([0, 0], [1, 1], [2, 2], [-3, -3])).toBe('coincident')
  })
  it('crossing lines are reported as intersecting', () => {
    expect(lineRelation([0, 0], [1, 1], [0, 2], [1, -1])).toBe('intersecting')
  })
})

describe('intersectSegments', () => {
  it('two segments that cross give the point', () => {
    const hit = intersectSegments([0, 0], [2, 2], [0, 2], [2, 0])!
    close(hit.point, [1, 1])
    expect(hit.t).toBeCloseTo(0.5)
  })
  it('segments that would cross only if extended miss each other', () => {
    expect(intersectSegments([0, 0], [1, 1], [0, 4], [4, 0])).toBeNull() // the lines meet at (2, 2): beyond the first segment
  })
  it('segments that only touch at an end point count (t = 1)', () => {
    expect(intersectSegments([0, 0], [1, 1], [1, 1], [3, 0])).not.toBeNull()
  })
  it('parallel segments return null', () => {
    expect(intersectSegments([0, 0], [1, 0], [0, 1], [1, 1])).toBeNull()
  })
})

describe('handedness and orientation', () => {
  it('x, y, z is right handed (+1); swapping two axes makes it left handed (-1)', () => {
    expect(handedness([1, 0, 0], [0, 1, 0], [0, 0, 1])).toMatchObject({ value: 1, hand: 'right' })
    expect(handedness([0, 1, 0], [1, 0, 0], [0, 0, 1])).toMatchObject({ value: -1, hand: 'left' })
    expect(handedness([1, 0, 0], [0, 1, 0], [0, 0, -1]).hand).toBe('left') // flipping one axis also does it
  })
  it('three vectors in one plane are neither (flat)', () => {
    expect(handedness([1, 0, 0], [0, 1, 0], [1, 1, 0]).hand).toBe('flat')
  })
  it('orientation2D: anticlockwise, and clockwise when two points are swapped', () => {
    expect(orientation2D([0, 0], [1, 0], [0, 1])).toBe('anticlockwise')
    expect(orientation2D([0, 0], [0, 1], [1, 0])).toBe('clockwise')
    expect(orientation2D([0, 0], [1, 1], [2, 2])).toBe('collinear')
  })
})

describe('volume3 and determinant', () => {
  it('the unit cube has volume 1, and it flips sign when two vectors are swapped', () => {
    expect(volume3([1, 0, 0], [0, 1, 0], [0, 0, 1])).toBe(1)
    expect(volume3([0, 1, 0], [1, 0, 0], [0, 0, 1])).toBe(-1)
  })
  it('a 2 x 3 x 4 box has volume 24', () => {
    expect(volume3([2, 0, 0], [0, 3, 0], [0, 0, 4])).toBe(24)
  })
  it('three vectors in a plane enclose no volume', () => {
    expect(volume3([1, 0, 0], [0, 1, 0], [2, 3, 0])).toBe(0)
  })
  it('equals a dot (b cross c), the triple product', () => {
    const a: [number, number, number] = [1, 2, 3]
    const b: [number, number, number] = [-2, 0, 1]
    const c: [number, number, number] = [4, 1, -1]
    const cross: [number, number, number] = [b[1] * c[2] - b[2] * c[1], b[2] * c[0] - b[0] * c[2], b[0] * c[1] - b[1] * c[0]]
    expect(volume3(a, b, c)).toBeCloseTo(dot(a, cross))
  })
  it('determinant of a 2x2 and 3x3 matrix', () => {
    expect(determinant([[1, 2], [3, 4]])).toBe(-2)
    expect(determinant([[2, 0, 0], [0, 3, 0], [0, 0, 4]])).toBe(24)
    expect(determinant([[1, 2, 3], [4, 5, 6], [7, 8, 9]])).toBeCloseTo(0)
  })
})

describe('rank and spanning', () => {
  it('rank counts the independent vectors', () => {
    expect(rank([[1, 0, 0], [0, 1, 0], [0, 0, 1]])).toBe(3)
    expect(rank([[1, 2], [2, 4]])).toBe(1)
    expect(rank([[1, 0, 0], [2, 0, 0], [0, 1, 0]])).toBe(2)
    expect(rank([[0, 0], [0, 0]])).toBe(0)
  })
  it('two independent vectors span the plane; two parallel ones do not', () => {
    expect(spansSpace([[1, 0], [1, 1]], 2)).toBe(true)
    expect(spansSpace([[1, 2], [2, 4]], 2)).toBe(false)
  })
  it('three vectors span 3D only if they are not in one plane', () => {
    expect(spansSpace([[1, 0, 0], [0, 1, 0], [0, 0, 1]], 3)).toBe(true)
    expect(spansSpace([[1, 0, 0], [0, 1, 0], [1, 1, 0]], 3)).toBe(false)
  })
  it('spans(vectors, target): a target is in the span only if it is a combination of the vectors', () => {
    expect(spans([[1, 2], [2, 4]], [3, 6])).toBe(true) // on the line
    expect(spans([[1, 2], [2, 4]], [1, 0])).toBe(false) // off the line: two parallel vectors do not span the plane
    expect(spans([[1, 0], [1, 1]], [5, -7])).toBe(true)
  })
})

describe('gramSchmidt', () => {
  it('turns two slanted vectors into perpendicular ones; the first stays the same', () => {
    const r = gramSchmidt([[3, 1], [2, 2]])
    close(r.orthogonal[0], [3, 1])
    expect(r.orthogonal[0].reduce((sum, v, k) => sum + v * r.orthogonal[1][k], 0)).toBeCloseTo(0)
    expect(r.rank).toBe(2)
    expect(r.dependent).toEqual([])
  })
  it('the orthonormal version has length 1', () => {
    const r = gramSchmidt([[3, 1, 0], [2, 2, 1], [0, 1, 4]])
    for (const u of r.orthonormal) expect(Math.hypot(...u)).toBeCloseTo(1)
    for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) {
      expect(r.orthonormal[i].reduce((s, v, k) => s + v * r.orthonormal[j][k], 0)).toBeCloseTo(0)
    }
  })
  it('spans the same space: every original vector is a combination of the new ones', () => {
    const original = [[3, 1, 0], [2, 2, 1], [0, 1, 4]]
    const r = gramSchmidt(original)
    for (const v of original) expect(coordinatesInBasis(v, r.orthogonal)!.residual).toBeCloseTo(0)
  })
  it('detects a dependent vector and leaves it out', () => {
    const r = gramSchmidt([[1, 0, 0], [2, 0, 0], [0, 1, 0]])
    expect(r.dependent).toEqual([1])
    expect(r.rank).toBe(2)
    expect(r.orthogonal.length).toBe(2)
  })
  it('a zero vector counts as dependent', () => {
    expect(gramSchmidt([[1, 1], [0, 0]]).dependent).toEqual([1])
  })
})

describe('coordinatesInBasis', () => {
  it('basis (1,1) and (1,-1): the vector (3,1) is 2 of the first plus 1 of the second', () => {
    const r = coordinatesInBasis([3, 1], [[1, 1], [1, -1]])!
    close(r.coefficients, [2, 1])
    expect(r.inSpan).toBe(true)
  })
  it('round trip: the basis times the coordinates gives the vector back', () => {
    const basis = [[2, 1, 0], [0, 3, 1], [1, 0, 4]]
    const v = [5, -2, 7]
    const { coefficients } = coordinatesInBasis(v, basis)!
    const back = [0, 1, 2].map((k) => coefficients.reduce((sum, c, i) => sum + c * basis[i][k], 0))
    close(back, v)
  })
  it('a vector outside the plane of two basis vectors has a residual and is not in the span', () => {
    const r = coordinatesInBasis([0, 0, 5], [[1, 0, 0], [0, 1, 0]])!
    expect(r.inSpan).toBe(false)
    expect(r.residual).toBeCloseTo(5)
  })
  it('returns null when the basis vectors are dependent', () => {
    expect(coordinatesInBasis([1, 1], [[1, 2], [2, 4]])).toBeNull()
  })
})
