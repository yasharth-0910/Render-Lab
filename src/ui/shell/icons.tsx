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
  stop: 'M4 4h8v8H4z',
  close: 'M4 4l8 8M12 4l-8 8',
  plus: 'M8 3v10M3 8h10',
  maximize: 'M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4',
  restore: 'M6 2v4H2M14 6h-4V2M10 14v-4h4M2 10h4v4',
  search: 'M7 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM11 11l3.5 3.5',
  dots: 'M8 3v.01M8 8v.01M8 13v.01',
  scene: 'M8 5.2a2.8 2.8 0 1 1 0 5.6 2.8 2.8 0 0 1 0-5.6zM8 1.5v1.6M8 12.9v1.6M1.5 8h1.6M12.9 8h1.6M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M3.4 12.6l1.1-1.1M11.5 4.5l1.1-1.1',
  cylinder: 'M3 4c0-1 2.2-1.8 5-1.8S13 3 13 4v8c0 1-2.2 1.8-5 1.8S3 13 3 12zM3 4c0 1 2.2 1.8 5 1.8S13 5 13 4',
  plane: 'M2 10 8 6.5 14 10 8 13.5z',
  node: 'M8 2.5a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11z',
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
