// editorStore.ts - the one list of reactor-scene objects, shared by the Reactor tab (viewport and
// inspector) and the Scene dock (the tree). It lives outside React, like the console store, so both
// places see the same objects and the list survives switching to another lab and back.
// The pure functions that change the list are in core/render/sceneEditor.ts.

import { useSyncExternalStore } from 'react'
import { createReactorScene } from '../../core/render/reactorScene'
import { fromReactorScene, type EditorState } from '../../core/render/sceneEditor'

/** The reactor scene as it was built: its lights, grid, fog, sky and starting camera, and the starting objects. */
export const reactorBase = createReactorScene()

let state: EditorState = fromReactorScene(reactorBase)
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((listener) => listener())

export const editorStore = {
  getState: (): EditorState => state,
  /** Replace the state with the result of one of the pure functions, e.g. update((s) => selectObject(s, 5)). */
  update(change: (s: EditorState) => EditorState): void {
    state = change(state)
    emit()
  },
  /** Back to the original scene. */
  reset(): void {
    state = fromReactorScene(reactorBase)
    emit()
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
}

/** The current editor state; the component re-renders whenever it changes. */
export const useEditorState = (): EditorState => useSyncExternalStore(editorStore.subscribe, editorStore.getState)
