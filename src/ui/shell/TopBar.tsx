// TopBar.tsx - logo and name, the open lab, a Play/Pause button, and live FPS on the right.

import { useEffect, useState } from 'react'
import { Icon, Logo } from './icons'

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

type Props = { labName: string; paused: boolean; onTogglePaused: () => void }

export default function TopBar({ labName, paused, onTogglePaused }: Props) {
  const { fps, ms } = useFrameRate()
  return (
    <header className="topbar">
      <div className="topbar-brand"><Logo /> <span>RenderLab</span></div>
      <div className="topbar-sep" />
      <div className="topbar-lab">{labName}</div>
      <div className="topbar-center">
        <button className={`play-button${paused ? ' is-paused' : ''}`} onClick={onTogglePaused} title={paused ? 'Resume animations' : 'Pause animations'}>
          <Icon name={paused ? 'play' : 'pause'} size={14} />
          <span>{paused ? 'Paused' : 'Running'}</span>
        </button>
      </div>
      <div className="topbar-stats">
        <span><b>{fps.toFixed(0)}</b> FPS</span>
        <span><b>{ms.toFixed(1)}</b> ms</span>
      </div>
    </header>
  )
}
