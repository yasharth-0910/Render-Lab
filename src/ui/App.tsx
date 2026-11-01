import { useState, type ComponentType } from 'react'
import AlphaLab from './AlphaLab'
import BresenhamLab from './BresenhamLab'
import CullingLab from './CullingLab'
import QuaternionLab from './QuaternionLab'
import RasterCanvas from './RasterCanvas'
import Shell from './shell/Shell'
import SimplifyLab from './SimplifyLab'
import TransformLab from './TransformLab'

// One entry per lab: name and icon for the left list, and the component to show. Later labs are added here.
const LABS: { id: string; name: string; icon: string; component: ComponentType }[] = [
  { id: 'cube', name: 'Rotating Cube', icon: 'cube', component: RasterCanvas },
  { id: 'bresenham', name: 'Bresenham Lab', icon: 'line', component: BresenhamLab },
  { id: 'culling', name: 'Culling Lab', icon: 'cull', component: CullingLab },
  { id: 'alpha', name: 'Alpha Lab', icon: 'layers', component: AlphaLab },
  { id: 'simplify', name: 'Simplify Lab', icon: 'polyline', component: SimplifyLab },
  { id: 'transforms', name: 'Transforms Lab', icon: 'transform', component: TransformLab },
  { id: 'quaternion', name: 'Quaternion Lab', icon: 'rotate', component: QuaternionLab },
]

export default function App() {
  const [activeId, setActiveId] = useState(LABS[0].id)
  const Active = LABS.find((l) => l.id === activeId)!.component
  return (
    <Shell labs={LABS} activeId={activeId} onSelect={setActiveId}>
      {/* key makes React start the lab fresh when you switch */}
      <Active key={activeId} />
    </Shell>
  )
}
