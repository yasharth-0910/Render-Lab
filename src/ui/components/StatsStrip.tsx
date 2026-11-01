// StatsStrip.tsx - one line of small facts, shown at the bottom of the viewport.

export default function StatsStrip({ items }: { items: string[] }) {
  return (
    <div className="stats-strip">
      {items.map((item, i) => <span key={i}>{item}</span>)}
    </div>
  )
}
