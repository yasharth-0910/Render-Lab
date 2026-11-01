// ConsolePanel.tsx - the bottom dock (Godot's Output): the algorithm trace of the open lab.

import { useEffect, useRef } from 'react'
import { labConsole, useConsoleLines } from './console'
import { Icon } from './icons'

type Props = { labName: string; open: boolean; onToggle: () => void }

export default function ConsolePanel({ labName, open, onToggle }: Props) {
  const lines = useConsoleLines(labName)
  const bodyRef = useRef<HTMLDivElement>(null)

  // Keep the newest line in view.
  useEffect(() => {
    const body = bodyRef.current
    if (body) body.scrollTop = body.scrollHeight
  }, [lines, open])

  const hasWarning = lines.some((l) => l.level === 'warn')
  return (
    <section className={`bottom-dock${open ? '' : ' is-collapsed'}`}>
      <div className="dock-tabs">
        <button className="tab active tab-button" onClick={onToggle} title={open ? 'Collapse' : 'Expand'}>
          <span className={`dot${hasWarning ? ' warn' : ''}`} />Output <span className="count">{lines.length}</span>
        </button>
        <button className="icon-button" onClick={() => labConsole.clear(labName)} title="Clear" disabled={lines.length === 0}>
          <Icon name="trash" size={13} />
        </button>
        <span className="dock-version">RenderLab 0.1 · CPU rasterizer</span>
      </div>
      {open && (
        <div className="console-body" ref={bodyRef}>
          {lines.length === 0 && <div className="console-empty">Nothing yet. Use the lab and its steps appear here.</div>}
          {lines.map((l) => (
            <div key={l.id} className={`console-line ${l.level}`}>
              <span className="time">{(l.time / 1000).toFixed(2)}s</span>
              <span className="text">{l.text}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
