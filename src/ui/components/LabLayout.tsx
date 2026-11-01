// LabLayout.tsx - the one layout every lab uses (see "UI rules" in CLAUDE.md).
//   left : the canvas (with an optional corner overlay) and a one-line stats strip below it
//   right: a narrow panel with the lab's controls, and the formula box at the bottom
import type { ReactNode } from 'react'
import StatsStrip from './StatsStrip'
import { theme } from './theme'

type Props = {
  canvas: ReactNode
  overlay?: ReactNode // small text drawn in the top-left corner of the canvas
  stats: string[] // the stats strip under the canvas
  controls: ReactNode
  formula?: ReactNode // goes at the bottom of the panel
}

export default function LabLayout({ canvas, overlay, stats, controls, formula }: Props) {
  return (
    <div style={{
      display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'stretch',
      background: theme.bg, color: theme.text, font: theme.font, padding: 16, borderRadius: 8,
    }}>
      <div>
        <div style={{ position: 'relative', lineHeight: 0 }}>
          {canvas}
          {overlay && (
            <div style={{
              position: 'absolute', top: 6, left: 8, font: theme.mono, lineHeight: 1.4,
              color: '#fff', textShadow: '0 0 3px #000', pointerEvents: 'none', whiteSpace: 'pre',
            }}>
              {overlay}
            </div>
          )}
        </div>
        <StatsStrip items={stats} />
      </div>
      <div style={{ width: 300, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div>{controls}</div>
        {formula && <div style={{ marginTop: 'auto' }}>{formula}</div>}
      </div>
    </div>
  )
}
