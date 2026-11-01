// AboutDock.tsx - the dock under the scene tree (Godot's FileSystem spot):
// what the open lab teaches, in a few plain sentences.

import type { LabEntry } from './Sidebar'

export default function AboutDock({ lab }: { lab: LabEntry }) {
  return (
    <section className="dock about-dock">
      <div className="dock-tabs"><span className="tab active">About</span></div>
      <div className="about-body">
        <div className="about-title">{lab.name}</div>
        <div className="about-topic">{lab.topic}</div>
        <p>{lab.blurb}</p>
      </div>
    </section>
  )
}
