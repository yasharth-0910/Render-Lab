// alpha.ts - alpha compositing with the Porter-Duff "over" operator.
//
// A colour with alpha is [r, g, b, a]: r, g, b run 0..255 and alpha runs 0..1
// (0 = invisible, 1 = solid). "Over" answers: what do we see when a see-through
// colour (the SOURCE, on top) is laid over what is already there (the DESTINATION)?
//
// In plain words:
//  - Coverage: the source hides a_s of what is below, so only (1 - a_s) of the
//    destination still shows through. The destination itself is only a_d solid.
//        out_a = a_s + a_d * (1 - a_s)
//  - Colour: mix the two colours, each weighted by how much of the final pixel it makes up:
//        source weight      = a_s
//        destination weight = a_d * (1 - a_s)
//        out_rgb = (c_s * a_s + c_d * a_d * (1 - a_s)) / out_a
//    Dividing by out_a turns the weighted sum back into an ordinary colour.
//
// Over is ASSOCIATIVE ((a over b) over c = a over (b over c)) so a stack can be blended
// in any grouping, but NOT commutative: swapping the layers gives a different picture.

export type Rgba = readonly [number, number, number, number]

/** Straight-alpha "over": source on top of destination. */
export function over(src: Rgba, dst: Rgba): Rgba {
  const as = src[3]
  const ad = dst[3]
  const outA = as + ad * (1 - as)
  // Nothing visible at all: avoid dividing by zero.
  if (outA === 0) return [0, 0, 0, 0]
  const dstWeight = ad * (1 - as)
  return [
    (src[0] * as + dst[0] * dstWeight) / outA,
    (src[1] * as + dst[1] * dstWeight) / outA,
    (src[2] * as + dst[2] * dstWeight) / outA,
    outA,
  ]
}

// ---- Premultiplied alpha ----
// Here the colour is stored already multiplied by its alpha: [r*a, g*a, b*a, a].
// The division disappears and every channel (alpha too) uses ONE formula:
//     out = src + dst * (1 - a_s)

/** Straight -> premultiplied. */
export function toPremultiplied(c: Rgba): Rgba {
  return [c[0] * c[3], c[1] * c[3], c[2] * c[3], c[3]]
}

/** Premultiplied -> straight (alpha 0 gives transparent black instead of dividing by 0). */
export function fromPremultiplied(c: Rgba): Rgba {
  if (c[3] === 0) return [0, 0, 0, 0]
  return [c[0] / c[3], c[1] / c[3], c[2] / c[3], c[3]]
}

/** "Over" for premultiplied colours. Same picture as `over`, just simpler maths. */
export function overPremultiplied(src: Rgba, dst: Rgba): Rgba {
  const k = 1 - src[3]
  return [src[0] + dst[0] * k, src[1] + dst[1] * k, src[2] + dst[2] * k, src[3] + dst[3] * k]
}

/** One blend in a stack: `src` laid over `dst` gave `out`. */
export type CompositeStep = { src: Rgba; dst: Rgba; out: Rgba }

/**
 * Blend a stack of layers over a background. layers[0] is the BOTTOM layer and the
 * last layer is on TOP, so we blend them in that order. Every intermediate result is
 * kept in `steps` (one per layer) so a screen can show how the pixel was built up.
 */
export function compositeLayers(layers: Rgba[], background: Rgba): { steps: CompositeStep[]; result: Rgba } {
  const steps: CompositeStep[] = []
  let current = background
  for (const layer of layers) {
    const out = over(layer, current)
    steps.push({ src: layer, dst: current, out })
    current = out
  }
  return { steps, result: current }
}
