// StatusBar.tsx - the thin bar at the very bottom: a ready light, the state and the open lab.

export default function StatusBar({ labName, paused }: { labName: string; paused: boolean }) {
  return (
    <footer className="statusbar">
      <span className="status-light" data-paused={paused} />
      <span>{paused ? 'Animations paused' : 'Ready'}</span>
      <span className="status-sep" />
      <span>{labName}</span>
      <span className="status-version">RenderLab 0.1</span>
    </footer>
  )
}
