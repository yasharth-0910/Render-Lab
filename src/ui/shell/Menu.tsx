// Menu.tsx - one drop-down menu of the top menu bar (click the title, click an item).

import { useEffect, useRef, useState } from 'react'

export type MenuItem = { label: string; onClick: () => void; checked?: boolean; disabled?: boolean } | 'separator'

export default function Menu({ title, items }: { title: string; items: MenuItem[] }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // A click anywhere outside the menu closes it.
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  return (
    <div className="menu" ref={ref}>
      <button className={`menu-title${open ? ' open' : ''}`} onClick={() => setOpen(!open)}>{title}</button>
      {open && (
        <ul className="menu-list">
          {items.map((item, i) =>
            item === 'separator' ? (
              <li key={i} className="menu-sep" />
            ) : (
              <li key={i}>
                <button
                  disabled={item.disabled}
                  onClick={() => { item.onClick(); setOpen(false) }}
                >
                  <span className="check">{item.checked ? '✓' : ''}</span>
                  {item.label}
                </button>
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  )
}
