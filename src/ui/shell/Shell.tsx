// Shell.tsx - the editor window around every lab:
//   top bar | left lab list | centre viewport | right inspector | bottom console | status bar
// The shell only provides EMPTY places (the viewport and the inspector). The open lab fills them
// through LabLayout, which draws into them with React portals. So a lab needs no shell code.

import { useLayoutEffect, useState, type ReactNode } from 'react'
import { labConsole } from './console'
import ConsolePanel from './ConsolePanel'
import { ShellContext } from './ShellContext'
import Sidebar, { type LabEntry } from './Sidebar'
import StatusBar from './StatusBar'
import TopBar from './TopBar'

type Props = {
  labs: LabEntry[]
  activeId: string
  onSelect: (id: string) => void
  children: ReactNode // the open lab
}

export default function Shell({ labs, activeId, onSelect, children }: Props) {
  const [viewportEl, setViewportEl] = useState<HTMLElement | null>(null)
  const [inspectorEl, setInspectorEl] = useState<HTMLElement | null>(null)
  const [paused, setPaused] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [consoleOpen, setConsoleOpen] = useState(true)
  const labName = labs.find((l) => l.id === activeId)?.name ?? ''

  // Say which lab opened (a layout effect runs before the lab's own console lines).
  useLayoutEffect(() => {
    labConsole.log(labName, `${labName} opened`, 'info')
  }, [labName])

  return (
    <ShellContext.Provider value={{ viewportEl, inspectorEl, paused, labName }}>
      <div className={`shell${sidebarOpen ? '' : ' sidebar-collapsed'}${consoleOpen ? '' : ' console-collapsed'}`}>
        <TopBar labName={labName} paused={paused} onTogglePaused={() => setPaused(!paused)} />
        <Sidebar labs={labs} activeId={activeId} onSelect={onSelect} open={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
        <main className="viewport" ref={setViewportEl} />
        <aside className="inspector">
          <div className="panel-header"><span>Inspector</span><span className="inspector-lab">{labName}</span></div>
          <div className="inspector-body" ref={setInspectorEl} />
        </aside>
        <ConsolePanel labName={labName} open={consoleOpen} onToggle={() => setConsoleOpen(!consoleOpen)} />
        <StatusBar labName={labName} paused={paused} />
      </div>
      {/* The lab renders nothing here itself; it draws into the viewport and inspector above.
          It is only mounted once both places exist, so its canvases are ready for its effects. */}
      {viewportEl && inspectorEl && children}
    </ShellContext.Provider>
  )
}
