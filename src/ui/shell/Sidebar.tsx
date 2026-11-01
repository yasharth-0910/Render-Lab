// Sidebar.tsx - the "Scene" dock: a tree of the labs with a filter box, like Godot's scene tree.
// The header chevron shrinks it to icons only.

import type { ReactNode } from 'react'
import { Icon } from './icons'

export type LabEntry = {
  id: string
  name: string
  icon: string
  dim: '2D' | '3D' | 'both' // which workspace button shows it
  topic: string // the course topic, shown in the About dock
  blurb: string // a short explanation, shown in the About dock
}

type Props = {
  labs: LabEntry[] // the labs to show (already filtered)
  activeId: string
  onSelect: (id: string) => void
  iconsOnly: boolean
  onToggleIcons: () => void
  filter: string
  onFilter: (text: string) => void
  trees?: Record<string, ReactNode> // extra content shown under a lab while it is open (the reactor scene tree)
}

export default function Sidebar({ labs, activeId, onSelect, iconsOnly, onToggleIcons, filter, onFilter, trees }: Props) {
  return (
    <section className="dock scene-dock" aria-label="Labs">
      <div className="dock-tabs">
        <span className="tab active">{iconsOnly ? '' : 'Scene'}</span>
        <button className="icon-button dock-collapse" onClick={onToggleIcons} title={iconsOnly ? 'Expand' : 'Icons only'}>
          <Icon name={iconsOnly ? 'chevronRight' : 'chevronDown'} size={12} />
        </button>
      </div>
      {!iconsOnly && (
        <div className="filter-row">
          <Icon name="search" size={12} />
          <input type="text" placeholder="Filter labs" value={filter} onChange={(e) => onFilter(e.target.value)} />
        </div>
      )}
      <ul className="tree">
        {!iconsOnly && (
          <li className="tree-root"><Icon name="node" size={12} /> <span>RenderLab</span></li>
        )}
        {labs.map((lab) => (
          <li key={lab.id}>
            <button className={`tree-item${lab.id === activeId ? ' active' : ''}${iconsOnly ? ' icon-only' : ''}`} onClick={() => onSelect(lab.id)} title={lab.name}>
              <Icon name={lab.icon} />
              {!iconsOnly && <span>{lab.name}</span>}
              {!iconsOnly && <span className="tag">{lab.dim === 'both' ? '2D·3D' : lab.dim}</span>}
            </button>
            {!iconsOnly && lab.id === activeId && trees?.[lab.id]}
          </li>
        ))}
        {labs.length === 0 && !iconsOnly && <li className="tree-empty">No lab matches.</li>}
      </ul>
    </section>
  )
}
