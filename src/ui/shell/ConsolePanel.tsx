// ConsolePanel.tsx - the bottom dock (Godot's Output): the algorithm trace of the open lab.

import { useEffect, useRef } from 'react'
import { MathText } from '../components/Equation'
import { prettify } from '../components/mathParse'
import { labConsole, useConsoleLines } from './console'
import { Icon } from './icons'

type Props = { labName: string; open: boolean; onToggle: () => void }

// A console line is plain text, but an equation can be put between backticks: `e_0 = 2·minor − major`.
// Those parts are drawn as small typeset equations, and ASCII like -> or -6 gets real symbols.
function renderText(text: string) {
  return text.split('`').map((part, i) => (i % 2 === 1 ? <span key={i} className="console-math"><MathText>{part}</MathText></span> : prettify(part)))
}

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
            <div key={l.id} className={`console-line ${l.level}${l.text.startsWith('  ') ? ' sub' : ''}`}>
              <span className="time">{(l.time / 1000).toFixed(2)}s</span>
              <span className="text">{renderText(l.text.trim())}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
