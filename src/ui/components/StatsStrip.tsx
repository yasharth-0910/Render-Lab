// StatsStrip.tsx - one line of small facts, shown under the canvas.
import { theme } from './theme'

export default function StatsStrip({ items }: { items: string[] }) {
  return (
    <div style={{ marginTop: 6, color: theme.muted, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
      {items.join('  ·  ')}
    </div>
  )
}
