// StatusBar.tsx - the thin bar at the very bottom: open lab and a "ready" light.

export default function StatusBar({ labName, paused }: { labName: string; paused: boolean }) {
  return (
    <footer className="statusbar">
      <span className="status-light" data-paused={paused} />
      <span>{paused ? 'Animations paused' : 'Ready'}</span>
      <span className="status-sep" />
      <span>{labName}</span>
    </footer>
  )
}
