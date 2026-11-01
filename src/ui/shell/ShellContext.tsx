// ShellContext.tsx - what the shell shares with the lab that is open.
//  - viewportEl / inspectorEl: the two places on screen where a lab puts its content.
//    LabLayout draws into them with React portals, so a lab never has to know about the shell.
//  - paused: the top bar's Play/Pause button. Labs with an animation loop stop when it is true.
//  - labName: the open lab (used by the console).

import { createContext, useContext, useRef, type MutableRefObject } from 'react'

export type ShellState = {
  viewportEl: HTMLElement | null
  inspectorEl: HTMLElement | null
  paused: boolean
  labName: string
}

export const ShellContext = createContext<ShellState>({ viewportEl: null, inspectorEl: null, paused: false, labName: '' })

export const useShell = () => useContext(ShellContext)

/** A ref that always holds the current `paused` value, for animation loops that must not restart. */
export function usePausedRef(): MutableRefObject<boolean> {
  const { paused } = useShell()
  const ref = useRef(paused)
  ref.current = paused
  return ref
}
