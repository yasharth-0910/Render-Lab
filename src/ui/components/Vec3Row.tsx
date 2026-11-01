// Vec3Row.tsx - an x y z row like the Unity Inspector: three number boxes with
// red X, green Y and blue Z labels.

import type { Vec3 } from '../../core/math/vec3'
import NumField from './NumField'

type Props = { label: string; value: Vec3; onChange: (v: Vec3) => void; step?: number }

export default function Vec3Row({ label, value, onChange, step = 0.1 }: Props) {
  const axes = ['X', 'Y', 'Z'] as const
  return (
    <div className="row vec3-row">
      <span className="row-label">{label}</span>
      <div className="vec3-fields">
        {axes.map((axis, i) => (
          <label key={axis} className={`vec3-field axis-${axis.toLowerCase()}`}>
            <span className="axis-tag">{axis}</span>
            <NumField value={value[i]} step={step} onChange={(n) => onChange(value.map((old, j) => (j === i ? n : old)) as unknown as Vec3)} />
          </label>
        ))}
      </div>
    </div>
  )
}
