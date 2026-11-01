// lighting.ts - how bright and what colour a lit surface is, and fog.
//
// Colours here run 0..1 per channel (red, green, blue) while we work, and the result is 0..255.
// For one flat triangle:
//   light = ambient
//         + sum over lamps of  lampColour * intensity * max(0, n . l) * attenuation
//         + directional light (n . direction)
//   colour = albedo * light + emissive
// n is the surface normal, l the direction from the surface to the lamp. A surface turned away from
// the lamp (n . l <= 0) gets nothing from it. Attenuation makes a lamp weaker with distance d:
//   attenuation = 1 / (1 + (d / range)^2)
// At the end a soft curve squeezes any brightness into 0..1 (so very bright lights saturate smoothly
// instead of clipping), then the number is scaled to 0..255.

import { dot, length, normalize, sub, type Vec3 } from '../math/vec3'

export type Rgb = readonly [number, number, number]

/** albedo = the colour of the surface itself; emissive = light it gives off on its own. */
export type Material = { color: Rgb; emissive?: Rgb }

export type PointLight = { position: Vec3; color: Rgb; intensity: number; range: number }

export type Lighting = {
  ambient: Rgb // light that reaches everything
  lights: PointLight[]
  directional?: { direction: Vec3; color: Rgb } // direction points TOWARDS the light
  exposure?: number // how fast brightness saturates (default 1.4)
}

/** The 0..255 colour of a surface point with the given normal (unit length) under this lighting. */
export function lightAt(material: Material, position: Vec3, normal: Vec3, lighting: Lighting): [number, number, number] {
  const light: [number, number, number] = [lighting.ambient[0], lighting.ambient[1], lighting.ambient[2]]

  for (const lamp of lighting.lights) {
    const toLamp = sub(lamp.position, position)
    const distance = length(toLamp)
    if (distance === 0) continue
    const facing = Math.max(0, dot(normal, normalize(toLamp)))
    if (facing === 0) continue
    const attenuation = 1 / (1 + (distance / lamp.range) ** 2)
    const k = lamp.intensity * facing * attenuation
    light[0] += lamp.color[0] * k
    light[1] += lamp.color[1] * k
    light[2] += lamp.color[2] * k
  }

  if (lighting.directional) {
    const facing = Math.max(0, dot(normal, normalize(lighting.directional.direction)))
    light[0] += lighting.directional.color[0] * facing
    light[1] += lighting.directional.color[1] * facing
    light[2] += lighting.directional.color[2] * facing
  }

  const exposure = lighting.exposure ?? 1.4
  const emissive = material.emissive ?? [0, 0, 0]
  const out: [number, number, number] = [0, 0, 0]
  for (let c = 0; c < 3; c++) {
    const brightness = material.color[c] * light[c] + emissive[c]
    out[c] = Math.round(255 * (1 - Math.exp(-brightness * exposure)))
  }
  return out
}

/**
 * Fog: the farther away, the more the colour is replaced by the fog colour (0..255 colours).
 * The share of fog is 1 - e^(-density * distance): 0 up close, towards 1 far away.
 */
export function fogMix(color: readonly number[], distance: number, fogColor: readonly number[], density: number): [number, number, number] {
  const fog = 1 - Math.exp(-density * distance)
  return [
    color[0] + (fogColor[0] - color[0]) * fog,
    color[1] + (fogColor[1] - color[1]) * fog,
    color[2] + (fogColor[2] - color[2]) * fog,
  ]
}
