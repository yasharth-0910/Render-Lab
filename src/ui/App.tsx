import { useState } from 'react'
import BresenhamLab from './BresenhamLab'
import CullingLab from './CullingLab'
import RasterCanvas from './RasterCanvas'

// One entry per tab. Later labs are added here.
const TABS = [
  { name: 'Rotating Cube', component: RasterCanvas },
  { name: 'Bresenham Lab', component: BresenhamLab },
  { name: 'Culling Lab', component: CullingLab },
]

export default function App() {
  const [active, setActive] = useState(0)
  const Active = TABS[active].component
  return (
    <div style={{ fontFamily: 'sans-serif', padding: 16 }}>
      <h1>RenderLab</h1>
      <div style={{ marginBottom: 12 }}>
        {TABS.map((t, i) => (
          <button
            key={t.name}
            onClick={() => setActive(i)}
            style={{ marginRight: 4, fontWeight: i === active ? 'bold' : 'normal' }}
          >
            {t.name}
          </button>
        ))}
      </div>
      <Active />
    </div>
  )
}
