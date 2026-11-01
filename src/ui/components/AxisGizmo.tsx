// AxisGizmo.tsx - a small axis marker in the corner of 3D viewports (x red, y green, z blue).
// It is a fixed isometric picture, not tied to the camera. `zUp` is for labs where z points up.

export default function AxisGizmo({ zUp = false }: { zUp?: boolean }) {
  const right: [number, number] = [22, 13]
  const left: [number, number] = [-22, 13]
  const up: [number, number] = [0, -26]
  // Right-handed: with y up, x goes right-down and z left-down; with z up, x goes left-down and y right-down.
  const axes = zUp
    ? [{ name: 'x', color: '#ff5f5f', to: left }, { name: 'y', color: '#5fe58a', to: right }, { name: 'z', color: '#6c9bff', to: up }]
    : [{ name: 'x', color: '#ff5f5f', to: right }, { name: 'y', color: '#5fe58a', to: up }, { name: 'z', color: '#6c9bff', to: left }]
  return (
    <svg className="gizmo" width={72} height={72} viewBox="-36 -36 72 72" aria-label="axes">
      <circle r={33} fill="rgba(0,0,0,0.25)" stroke="rgba(255,255,255,0.08)" />
      {axes.map(({ name, color, to }) => (
        <g key={name}>
          <line x1={0} y1={4} x2={to[0]} y2={to[1] + 4} stroke={color} strokeWidth={2.2} strokeLinecap="round" />
          <circle cx={to[0]} cy={to[1] + 4} r={5.5} fill={color} />
          <text x={to[0]} y={to[1] + 7.2} textAnchor="middle" fontSize={8} fontWeight={700} fill="#111">{name.toUpperCase()}</text>
        </g>
      ))}
    </svg>
  )
}
