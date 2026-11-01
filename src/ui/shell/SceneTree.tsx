// SceneTree.tsx - the objects of the reactor scene as a tree under the lab in the Scene dock:
// folders (Floor, Walls, Reactor, ...) with the objects inside. Click an object to select it.

import { useEffect, useMemo, useState } from 'react'
import type { EditorObject } from '../../core/render/sceneEditor'
import { editorStore, useEditorState } from './editorStore'
import { Icon } from './icons'
import { selectObject } from '../../core/render/sceneEditor'

const KIND_ICON: Record<EditorObject['kind'], string> = { cube: 'cube', sphere: 'node', cylinder: 'cylinder', plane: 'plane', ground: 'plane' }

export default function SceneTree() {
  const { objects, selectedId } = useEditorState()
  const [open, setOpen] = useState<Record<string, boolean>>({}) // folders the user opened or closed by hand

  // Group the objects by folder, keeping the order they first appear in; "Added" (new objects) goes first.
  const groups = useMemo(() => {
    const map = new Map<string, EditorObject[]>()
    for (const o of objects) map.set(o.group, [...(map.get(o.group) ?? []), o])
    return [...map.entries()].sort(([a], [b]) => (a === 'Added' ? -1 : b === 'Added' ? 1 : 0))
  }, [objects])

  // The folder of the selected object opens by itself, so the selection is always visible.
  const selectedGroup = objects.find((o) => o.id === selectedId)?.group
  const isOpen = (group: string) => open[group] ?? (group === selectedGroup || group === 'Added')

  // Scroll the selected row into view when the selection changes (for example after a click in the viewport).
  useEffect(() => {
    document.querySelector('.scene-tree .tree-leaf.active')?.scrollIntoView({ block: 'nearest' })
  }, [selectedId])

  return (
    <ul className="scene-tree">
      {groups.map(([group, members]) => (
        <li key={group}>
          <button className="tree-group" onClick={() => setOpen({ ...open, [group]: !isOpen(group) })}>
            <Icon name={isOpen(group) ? 'chevronDown' : 'chevronRight'} size={11} />
            <span>{group}</span>
            <span className="tag">{members.length}</span>
          </button>
          {isOpen(group) && (
            <ul>
              {members.map((o) => (
                <li key={o.id}>
                  <button
                    className={`tree-leaf${o.id === selectedId ? ' active' : ''}${o.visible ? '' : ' is-hidden'}`}
                    onClick={() => editorStore.update((s) => selectObject(s, o.id))}
                    title={o.name}
                  >
                    <Icon name={KIND_ICON[o.kind]} size={12} />
                    <span>{o.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  )
}
