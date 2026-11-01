// vec3.ts - 3D vectors.
// A Vec3 is just a list of three numbers: [x, y, z]. Every function returns a NEW
// vector and never changes its inputs.

export type Vec3 = readonly [number, number, number]

/** a + b, component by component. */
export function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
}

/** a - b, component by component. */
export function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}

/** Multiply every component by the number s. */
export function scale(a: Vec3, s: number): Vec3 {
  return [a[0] * s, a[1] * s, a[2] * s]
}

/** Dot product: a.x*b.x + a.y*b.y + a.z*b.z. It is 0 when a and b are perpendicular. */
export function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

/** Cross product: a vector perpendicular to both a and b (right-hand rule). */
export function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ]
}

/** Length (magnitude) of the vector: sqrt(x^2 + y^2 + z^2). */
export function length(a: Vec3): number {
  return Math.sqrt(dot(a, a))
}

/** Same direction, length 1. The zero vector has no direction, so it stays zero. */
export function normalize(a: Vec3): Vec3 {
  const len = length(a)
  return len === 0 ? [0, 0, 0] : scale(a, 1 / len)
}

/**
 * Outer (wedge) product a ^ b. The result is a BIVECTOR: an oriented patch of plane
 * spanned by a and b. It has 3 components, one per coordinate plane:
 *   [xy, yz, zx]
 *   xy = a.x*b.y - a.y*b.x   (area of the shadow of the a,b parallelogram on the xy plane)
 *   yz = a.y*b.z - a.z*b.y
 *   zx = a.z*b.x - a.x*b.z
 *
 * Relation to the cross product: the numbers are the SAME as cross(a, b), only
 * read differently. cross = [yz, zx, xy] is a vector pointing along the normal,
 * while wedge = [xy, yz, zx] is a plane piece (the normal's "dual").
 * In 3D we can swap between the two, which is why cross "works" at all.
 *
 * Triangle area: the length of the wedge is the area of the parallelogram
 * a,b span, so a triangle with edges a and b has area = length(wedge(a, b)) / 2.
 * Swapping a and b flips the sign: a ^ b = -(b ^ a).
 */
export function wedge(a: Vec3, b: Vec3): Vec3 {
  return [
    a[0] * b[1] - a[1] * b[0], // xy
    a[1] * b[2] - a[2] * b[1], // yz
    a[2] * b[0] - a[0] * b[2], // zx
  ]
}
