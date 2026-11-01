// LabLayout.tsx - how a lab puts its content into the editor shell (see "UI rules" in CLAUDE.md).
//   canvas / overlay / stats -> the centre VIEWPORT (stats strip along its bottom edge)
//   controls / formula       -> the right INSPECTOR, as collapsible sections
// The shell provides the two empty places; React portals draw the lab's content into them.
// A lab only describes WHAT to show, never where, so it needs no shell code.

import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '../shell/icons'
import { useShell } from '../shell/ShellContext'
import AxisGizmo from './AxisGizmo'
import Section from './Section'
import StatsStrip from './StatsStrip'

type Props = {
  canvas: ReactNode
  overlay?: ReactNode // small text in the top-left corner of the canvas
  stats: string[] // the stats strip along the bottom of the viewport
  controls: ReactNode
  formula?: ReactNode // goes at the bottom of the inspector
  gizmo?: boolean // show the axis gizmo (3D labs)
  zUp?: boolean // the gizmo's z axis points up (instead of y)
  sections?: boolean // `controls` already contains its own <Section>s, so do not wrap it in one
}

export default function LabLayout({ canvas, overlay, stats, controls, formula, gizmo = false, zUp = false, sections = false }: Props) {
  const { viewportEl, inspectorEl } = useShell()
  if (!viewportEl) return null
  return (
    <>
      {createPortal(
        <>
          <div className="viewport-toolbar">
            <span className="view-label"><Icon name="dots" size={12} />{gizmo ? 'Perspective' : 'Orthographic 2D'}</span>
          </div>
          <div className="viewport-stage">
            <div className="canvas-wrap">
              {canvas}
              {overlay && <div className="overlay">{overlay}</div>}
            </div>
          </div>
          {gizmo && <AxisGizmo zUp={zUp} />}
          <StatsStrip items={stats} />
        </>,
        viewportEl,
      )}
      {inspectorEl && createPortal(
        <>
          {sections ? controls : <Section title="Controls">{controls}</Section>}
          {formula && <Section title="Formula">{formula}</Section>}
        </>,
        inspectorEl,
      )}
    </>
  )
}
