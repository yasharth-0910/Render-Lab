// TopBar.tsx - like the Godot title row:
//   left   : logo and the menus (Lab, View, Help)
//   centre : the 2D / 3D workspace buttons (they filter the lab list)
//   right  : play / pause / stop, the renderer name, and live FPS

import { useEffect, useState } from 'react'
import { Icon, Logo } from './icons'
import Menu, { type MenuItem } from './Menu'

// Measures how often the browser draws a frame. Updates the numbers twice a second.
function useFrameRate(): { fps: number; ms: number } {
  const [rate, setRate] = useState({ fps: 0, ms: 0 })
  useEffect(() => {
    let frame = 0
    let frames = 0
    let since = performance.now()
    const tick = (now: number) => {
      frames++
      if (now - since >= 500) {
        setRate({ fps: (frames * 1000) / (now - since), ms: (now - since) / frames })
        frames = 0
        since = now
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])
  return rate
}

export type Workspace = 'all' | '2D' | '3D'

type Props = {
  menus: { title: string; items: MenuItem[] }[]
  workspace: Workspace
  onWorkspace: (w: Workspace) => void
  paused: boolean
  onPlay: () => void
  onPause: () => void
  onStop: () => void
}

export default function TopBar({ menus, workspace, onWorkspace, paused, onPlay, onPause, onStop }: Props) {
  const { fps, ms } = useFrameRate()
  return (
    <header className="topbar">
      <div className="topbar-brand"><Logo /></div>
      <nav className="menubar">
        {menus.map((m) => <Menu key={m.title} title={m.title} items={m.items} />)}
      </nav>

      <div className="workspaces">
        {(['all', '2D', '3D'] as const).map((w) => (
          <button key={w} className={`workspace${workspace === w ? ' active' : ''}`} onClick={() => onWorkspace(w)}>
            {w === 'all' ? 'All labs' : w}
          </button>
        ))}
      </div>

      <div className="topbar-right">
        <div className="transport">
          <button className={`transport-button play${!paused ? ' on' : ''}`} onClick={onPlay} title="Run animations"><Icon name="play" size={13} /></button>
          <button className={`transport-button pause${paused ? ' on' : ''}`} onClick={onPause} title="Pause animations"><Icon name="pause" size={13} /></button>
          <button className="transport-button" onClick={onStop} title="Stop: restart this lab from its start"><Icon name="stop" size={13} /></button>
        </div>
        <span className="renderer-chip" title="Everything is drawn by our own code on the CPU">CPU Rasterizer</span>
        <span className="topbar-stats"><b>{fps.toFixed(0)}</b> FPS · <b>{ms.toFixed(1)}</b> ms</span>
      </div>
    </header>
  )
}
