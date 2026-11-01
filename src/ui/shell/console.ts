// console.ts - the shared console API. A lab pushes short text lines (an "algorithm trace")
// and the bottom Console panel shows the lines of the lab that is open.
//
//   const log = useLabLog()           // inside a lab component
//   log('Line A(2,3) -> B(28,15)')    // a trace line
//   log('something odd', 'warn')
//
// The store lives outside React; components read it with useSyncExternalStore.

import { useCallback, useMemo, useSyncExternalStore } from 'react'
import { useShell } from './ShellContext'

export type ConsoleLevel = 'info' | 'trace' | 'warn'
export type ConsoleLine = { id: number; lab: string; level: ConsoleLevel; text: string; time: number }

const MAX_LINES = 500
let lines: ConsoleLine[] = []
let snapshot: readonly ConsoleLine[] = lines // a new array each change, so React sees it change
let nextId = 1
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((fn) => fn())

export const labConsole = {
  /** Add one line for a lab. */
  log(lab: string, text: string, level: ConsoleLevel = 'trace'): void {
    lines = [...lines, { id: nextId++, lab, level, text, time: performance.now() }].slice(-MAX_LINES)
    snapshot = lines
    emit()
  },
  /** Remove the lines of one lab (or all lines). */
  clear(lab?: string): void {
    lines = lab ? lines.filter((l) => l.lab !== lab) : []
    snapshot = lines
    emit()
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  getSnapshot(): readonly ConsoleLine[] {
    return snapshot
  },
}

/** The lines of one lab, oldest first. */
export function useConsoleLines(lab: string): ConsoleLine[] {
  const all = useSyncExternalStore(labConsole.subscribe, labConsole.getSnapshot)
  return useMemo(() => all.filter((l) => l.lab === lab), [all, lab])
}

/** A log function bound to the open lab. Its identity never changes while the lab stays open. */
export function useLabLog(): (text: string, level?: ConsoleLevel) => void {
  const { labName } = useShell()
  return useCallback((text: string, level: ConsoleLevel = 'trace') => labConsole.log(labName, text, level), [labName])
}
