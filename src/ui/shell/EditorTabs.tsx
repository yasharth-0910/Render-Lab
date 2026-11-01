// EditorTabs.tsx - the row above the viewport (Godot's open-scene tabs): one tab per open lab,
// a close button on each, a "+" menu to open another lab, and a maximize button on the right.

import { Icon } from './icons'
import Menu from './Menu'
import type { LabEntry } from './Sidebar'

type Props = {
  openLabs: LabEntry[]
  closedLabs: LabEntry[]
  activeId: string
  onSelect: (id: string) => void
  onClose: (id: string) => void
  onOpen: (id: string) => void
  maximized: boolean
  onToggleMaximize: () => void
}

export default function EditorTabs({ openLabs, closedLabs, activeId, onSelect, onClose, onOpen, maximized, onToggleMaximize }: Props) {
  return (
    <div className="editor-tabs">
      {openLabs.map((lab) => (
        <div key={lab.id} className={`editor-tab${lab.id === activeId ? ' active' : ''}`}>
          <button className="editor-tab-name" onClick={() => onSelect(lab.id)}><Icon name={lab.icon} size={13} />{lab.name}</button>
          {openLabs.length > 1 && (
            <button className="editor-tab-close" onClick={() => onClose(lab.id)} title="Close tab"><Icon name="close" size={10} /></button>
          )}
        </div>
      ))}
      {closedLabs.length > 0 && (
        <Menu title="+" items={closedLabs.map((lab) => ({ label: lab.name, onClick: () => onOpen(lab.id) }))} />
      )}
      <button className="icon-button maximize" onClick={onToggleMaximize} title={maximized ? 'Restore the docks' : 'Maximize the viewport'}>
        <Icon name={maximized ? 'restore' : 'maximize'} size={13} />
      </button>
    </div>
  )
}
