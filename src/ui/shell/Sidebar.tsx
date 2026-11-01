// Sidebar.tsx - the lab list, in the style of a Unity Hierarchy. Collapses to icons only.

import { Icon } from './icons'

export type LabEntry = { id: string; name: string; icon: string }

type Props = {
  labs: LabEntry[]
  activeId: string
  onSelect: (id: string) => void
  open: boolean
  onToggle: () => void
}

export default function Sidebar({ labs, activeId, onSelect, open, onToggle }: Props) {
  return (
    <nav className="sidebar" aria-label="Labs">
      <button className="panel-header sidebar-header" onClick={onToggle} title={open ? 'Collapse' : 'Expand'}>
        <Icon name={open ? 'chevronDown' : 'chevronRight'} size={12} />
        {open && <span>Hierarchy</span>}
      </button>
      <ul>
        {labs.map((lab) => (
          <li key={lab.id}>
            <button
              className={`lab-item${lab.id === activeId ? ' active' : ''}`}
              onClick={() => onSelect(lab.id)}
              title={lab.name}
            >
              <Icon name={lab.icon} />
              {open && <span>{lab.name}</span>}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}
