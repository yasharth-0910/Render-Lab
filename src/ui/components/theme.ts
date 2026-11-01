// theme.ts - the colours and fonts shared by every lab. ONE source of truth:
//  - labs read these values directly (canvas drawing needs real colour strings),
//  - applyTheme() copies them into CSS variables so theme.css can use them too.
// Charcoal palette, one glowing accent colour.

const fontUi = 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif'
const fontMono = '"JetBrains Mono", ui-monospace, Menlo, Consolas, monospace'

export const theme = {
  bg: '#1c2027', // app background (the gaps between panels)
  panel: '#262b34', // panel surfaces; also the surround of canvases and the formula box
  panelRaised: '#323844', // buttons, headers, hovered rows
  viewport: '#1b1f26', // the viewport and text inputs
  border: '#3b4352',
  sep: '#161a20', // the dark lines between docks
  text: '#dfe3ea',
  muted: '#98a1b0',
  accent: '#4cc2ff', // the one accent colour
  accentGlow: 'rgba(76, 194, 255, 0.35)',
  fontUi,
  fontMono,
  font: `13px ${fontUi}`, // shorthand for the CSS `font:` property
  mono: `12px ${fontMono}`, // shorthand; the first word is the size
} as const

/** Copy the theme into CSS variables on <html>. Call once at start-up. */
export function applyTheme(): void {
  const root = document.documentElement.style
  root.setProperty('--bg', theme.bg)
  root.setProperty('--panel', theme.panel)
  root.setProperty('--panel-raised', theme.panelRaised)
  root.setProperty('--viewport', theme.viewport)
  root.setProperty('--border', theme.border)
  root.setProperty('--sep', theme.sep)
  root.setProperty('--text', theme.text)
  root.setProperty('--muted', theme.muted)
  root.setProperty('--accent', theme.accent)
  root.setProperty('--accent-glow', theme.accentGlow)
  root.setProperty('--font-ui', theme.fontUi)
  root.setProperty('--font-mono', theme.fontMono)
}
