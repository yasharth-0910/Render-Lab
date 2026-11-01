// ConsolePanel.tsx - the bottom console: the algorithm trace of the open lab. Collapsible.

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

  return (
    <section className={`console${open ? '' : ' is-collapsed'}`}>
      <div className="panel-header console-header">
        <button className="console-toggle" onClick={onToggle}>
          <Icon name={open ? 'chevronDown' : 'chevronRight'} size={12} />
          <span>Console</span>
          <span className="count">{lines.length}</span>
        </button>
        <button className="icon-button" onClick={() => labConsole.clear(labName)} title="Clear" disabled={lines.length === 0}>
          <Icon name="trash" size={13} />
        </button>
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
