// Section.tsx - a collapsible group in the inspector, with a small uppercase header.

import { useState, type ReactNode } from 'react'
import { Icon } from '../shell/icons'

export default function Section({ title, defaultOpen = true, children }: { title: string; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="section">
      <button className="section-header" onClick={() => setOpen(!open)} aria-expanded={open}>
        <Icon name={open ? 'chevronDown' : 'chevronRight'} size={12} />
        <span>{title}</span>
      </button>
      {open && <div className="section-body">{children}</div>}
    </section>
  )
}
