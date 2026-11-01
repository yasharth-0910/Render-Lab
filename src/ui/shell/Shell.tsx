// Shell.tsx - the editor window around every lab, laid out like the Godot editor:
//   top    : menus | 2D / 3D workspaces | play, pause, stop
//   left   : Scene dock (the lab tree) over an About dock
//   centre : open-lab tabs, the viewport, and the Output dock under it
//   right  : Inspector dock
//   bottom : status bar
// The shell only provides EMPTY places (the viewport and the inspector). The open lab fills them
// through LabLayout, which draws into them with React portals. So a lab needs no shell code.

import { useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from 'react'
import AboutDock from './AboutDock'
import { labConsole } from './console'
import ConsolePanel from './ConsolePanel'
import EditorTabs from './EditorTabs'
import { Icon } from './icons'
import { ShellContext } from './ShellContext'
import Sidebar, { type LabEntry } from './Sidebar'
import StatusBar from './StatusBar'
import TopBar, { type Workspace } from './TopBar'

type Props = {
  labs: LabEntry[]
  renderLab: (lab: LabEntry) => ReactNode // makes the open lab's component
  trees?: Record<string, ReactNode> // extra tree shown under a lab in the Scene dock while it is open
}

type LeftMode = 'open' | 'icons' | 'hidden'

export default function Shell({ labs, renderLab, trees }: Props) {
  const [viewportEl, setViewportEl] = useState<HTMLElement | null>(null)
  const [inspectorEl, setInspectorEl] = useState<HTMLElement | null>(null)
  const [ready, setReady] = useState(false) // true once both places exist; the lab then stays mounted
  const [openIds, setOpenIds] = useState([labs[0].id]) // the lab tabs that are open
  const [activeId, setActiveId] = useState(labs[0].id)
  const [restart, setRestart] = useState(0) // bumped by Stop: remounts the lab fresh
  const [paused, setPaused] = useState(false)
  const [workspace, setWorkspace] = useState<Workspace>('all')
  const [filter, setFilter] = useState('')
  const [leftMode, setLeftMode] = useState<LeftMode>('open')
  const [rightOpen, setRightOpen] = useState(true)
  const [consoleOpen, setConsoleOpen] = useState(true)

  useEffect(() => {
    if (viewportEl && inspectorEl) setReady(true)
  }, [viewportEl, inspectorEl])

  const active = labs.find((l) => l.id === activeId)!
  const labName = active.name

  // Say which lab opened (a layout effect runs before the lab's own console lines).
  useLayoutEffect(() => {
    labConsole.log(labName, `${labName} opened`, 'info')
  }, [labName, restart])

  const select = (id: string) => {
    setOpenIds((ids) => (ids.includes(id) ? ids : [...ids, id]))
    setActiveId(id)
  }
  const close = (id: string) => {
    const next = openIds.filter((x) => x !== id)
    setOpenIds(next)
    if (id === activeId) setActiveId(next[Math.max(0, openIds.indexOf(id) - 1)])
  }

  // The tree shows the labs that match the 2D / 3D button and the filter box.
  const shown = useMemo(
    () => labs.filter((l) => (workspace === 'all' || l.dim === 'both' || l.dim === workspace) && l.name.toLowerCase().includes(filter.toLowerCase())),
    [labs, workspace, filter],
  )

  const maximized = leftMode === 'hidden' && !rightOpen && !consoleOpen
  const toggleMaximize = () => {
    setLeftMode(maximized ? 'open' : 'hidden')
    setRightOpen(maximized)
    setConsoleOpen(maximized)
  }

  const menus = [
    { title: 'Lab', items: labs.map((l) => ({ label: l.name, onClick: () => select(l.id), checked: l.id === activeId })) },
    {
      title: 'View',
      items: [
        { label: 'Scene and About docks', checked: leftMode !== 'hidden', onClick: () => setLeftMode(leftMode === 'hidden' ? 'open' : 'hidden') },
        { label: 'Inspector', checked: rightOpen, onClick: () => setRightOpen(!rightOpen) },
        { label: 'Output', checked: consoleOpen, onClick: () => setConsoleOpen(!consoleOpen) },
        'separator' as const,
        { label: maximized ? 'Restore the docks' : 'Maximize the viewport', onClick: toggleMaximize },
      ],
    },
    {
      title: 'Help',
      items: [
        {
          label: 'About this lab',
          onClick: () => {
            setConsoleOpen(true)
            labConsole.log(labName, `${active.topic}: ${active.blurb}`, 'info')
          },
        },
      ],
    },
  ]

  return (
    <ShellContext.Provider value={{ viewportEl, inspectorEl, paused, labName }}>
      <div className={`shell left-${leftMode}${rightOpen ? '' : ' right-hidden'}${consoleOpen ? '' : ' console-collapsed'}`}>
        <TopBar
          menus={menus}
          workspace={workspace}
          onWorkspace={setWorkspace}
          paused={paused}
          onPlay={() => setPaused(false)}
          onPause={() => setPaused(true)}
          onStop={() => setRestart(restart + 1)}
        />

        <div className="left-col">
          <Sidebar
            labs={shown}
            activeId={activeId}
            onSelect={select}
            iconsOnly={leftMode === 'icons'}
            onToggleIcons={() => setLeftMode(leftMode === 'icons' ? 'open' : 'icons')}
            filter={filter}
            onFilter={setFilter}
            trees={trees}
          />
          {leftMode === 'open' && <AboutDock lab={active} />}
        </div>

        <div className="center-col">
          <EditorTabs
            openLabs={openIds.map((id) => labs.find((l) => l.id === id)!)}
            closedLabs={labs.filter((l) => !openIds.includes(l.id))}
            activeId={activeId}
            onSelect={setActiveId}
            onClose={close}
            onOpen={select}
            maximized={maximized}
            onToggleMaximize={toggleMaximize}
          />
          <main className="viewport" ref={setViewportEl} />
          <ConsolePanel labName={labName} open={consoleOpen} onToggle={() => setConsoleOpen(!consoleOpen)} />
        </div>

        {rightOpen && (
          <aside className="dock inspector">
            <div className="dock-tabs"><span className="tab active">Inspector</span></div>
            <div className="object-row"><Icon name={active.icon} size={14} /><span>{labName}</span></div>
            <div className="inspector-body" ref={setInspectorEl} />
          </aside>
        )}
        <StatusBar labName={labName} paused={paused} />
      </div>
      {/* The lab renders nothing here itself; it draws into the viewport and inspector above.
          It is only mounted once both places exist, so its canvases are ready for its effects,
          and it stays mounted when the Inspector is hidden and shown again. */}
      {ready && <LabHost key={`${activeId}-${restart}`}>{renderLab(active)}</LabHost>}
    </ShellContext.Provider>
  )
}

// A plain wrapper whose only job is to carry the key that restarts the lab.
function LabHost({ children }: { children: ReactNode }) {
  return <>{children}</>
}
