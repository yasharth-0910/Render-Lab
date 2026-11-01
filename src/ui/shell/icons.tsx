// icons.tsx - small 16px line icons for the lab list. Plain SVG, no icon library.

const paths: Record<string, string> = {
  // a cube
  cube: 'M8 1.5 14 4.7v6.6L8 14.5 2 11.3V4.7zM2 4.7 8 8l6-3.3M8 8v6.5',
  // a pixel line
  line: 'M2 13 5 13 5 10 8 10 8 7 11 7 11 4 14 4',
  // a triangle with a cut-through eye
  cull: 'M2 12.5 8 3l6 9.5zM5.5 10c1.5-1.8 3.5-1.8 5 0-1.5 1.8-3.5 1.8-5 0z',
  // stacked layers
  layers: 'M8 2 14.5 5.5 8 9 1.5 5.5zM1.5 8.2 8 11.7l6.5-3.5M1.5 10.8 8 14.3l6.5-3.5',
  // a simplified polyline
  polyline: 'M2 12 5 5 8 9 11 3 14 8',
  // move arrows
  transform: 'M8 1.5v13M1.5 8h13M8 1.5 6.2 3.3M8 1.5 9.8 3.3M8 14.5l-1.8-1.8M8 14.5l1.8-1.8M1.5 8l1.8-1.8M1.5 8l1.8 1.8M14.5 8l-1.8-1.8M14.5 8l-1.8 1.8',
  // a circular arrow
  rotate: 'M13 8a5 5 0 1 1-1.6-3.7M13 2.5v2.8H10.2',
  chevronDown: 'M4 6l4 4 4-4',
  chevronRight: 'M6 4l4 4-4 4',
  pause: 'M5 3v10M11 3v10',
  play: 'M5 3l8 5-8 5z',
  trash: 'M3 4.5h10M6 4.5V3h4v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5',
}

export function Icon({ name, size = 16 }: { name: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={paths[name] ?? paths.cube} />
    </svg>
  )
}

/** The small RenderLab logo: a glowing cube. */
export function Logo() {
  return (
    <svg width={20} height={20} viewBox="0 0 16 16" fill="none" stroke="var(--accent)" strokeWidth={1.5} strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 4px var(--accent-glow))' }} aria-hidden="true">
      <path d={paths.cube} />
    </svg>
  )
}
