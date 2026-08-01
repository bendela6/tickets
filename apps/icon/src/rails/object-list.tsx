import { useEffect, useRef, useState } from 'react';
import { cn } from '@tickets/ui';
import { ShapeGlyph, SHAPE_TOOLS } from '../canvas/shape-tools';
import { useEditor } from '../editor-context';
import type { IconObject } from '../doc/types';

/** Named once so the row's title and the handler agree on what the chord is. */
const REORDER_HINT = 'hold ⌥ and press ↑ or ↓ to reorder';

/** The eye and lock marks, drawn rather than iconified: two states each. */
function EyeGlyph({ hidden }: { hidden: boolean }) {
  return (
    <svg aria-hidden width="14" height="14" viewBox="0 0 14 14" fill="none">
      {hidden ? (
        <line x1="1" y1="10" x2="13" y2="4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      ) : (
        <>
          <ellipse cx="7" cy="7" rx="6" ry="4" stroke="currentColor" strokeWidth="1.3" />
          <circle cx="7" cy="7" r="1.75" fill="currentColor" />
        </>
      )}
    </svg>
  );
}

function LockGlyph({ locked }: { locked: boolean }) {
  return (
    <svg aria-hidden width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="2.5" y="6.5" width="9" height="6" rx="1.5" fill="currentColor" />
      <path
        d={locked ? 'M4.5 6.5V4.75a2.5 2.5 0 0 1 5 0V6.5' : 'M9.5 6.5V4.25a2.5 2.5 0 0 1 2.5-2.5'}
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
      />
    </svg>
  );
}

function ObjectRow({
  object,
  index,
  selected,
  moving,
  onDragStart,
  onDragOver,
  onDrop,
  onMove,
  registerRef,
}: {
  object: IconObject;
  index: number;
  selected: boolean;
  moving: boolean;
  onDragStart: (index: number) => void;
  onDragOver: (index: number) => void;
  onDrop: () => void;
  onMove: (delta: -1 | 1) => void;
  registerRef: (el: HTMLButtonElement | null) => void;
}) {
  const { dispatch } = useEditor();
  return (
    <li
      draggable
      title={REORDER_HINT}
      onDragStart={() => onDragStart(index)}
      onDragOver={(event) => {
        event.preventDefault();
        onDragOver(index);
      }}
      onDrop={onDrop}
      className={cn(
        'flex h-7.5 items-center gap-2 rounded-md pl-2 pr-1.75',
        selected && 'bg-indigo-3',
        object.hidden && 'opacity-50',
      )}
    >
      <button
        type="button"
        aria-pressed={selected}
        ref={registerRef}
        onClick={() => dispatch({ type: 'selectObject', id: object.id })}
        onKeyDown={(event) => {
          // Alt/Option is free over a list row — the browser owns Ctrl/Cmd+arrows
          // for tab and word navigation, and plain arrows are left alone entirely
          // since nothing here scrolls or steps selection with them today.
          if (!event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
          event.preventDefault();
          onMove(event.key === 'ArrowUp' ? -1 : 1);
        }}
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
      >
        <span className={cn('flex-none', selected ? 'text-indigo-9' : 'text-gray-11')}>
          <ShapeGlyph kind={object.geometry.kind} />
        </span>
        <span
          className={cn(
            'truncate font-mono text-12',
            selected ? 'font-500 text-indigo-9' : 'text-gray-12',
            object.hidden && 'line-through',
          )}
        >
          {object.name}
        </span>
      </button>

      {moving ? (
        <span className="flex-none font-mono text-9 font-500 tracking-wider text-indigo-9">
          MOVING
        </span>
      ) : null}

      <button
        type="button"
        title="Visibility"
        aria-label={object.hidden ? `Show ${object.name}` : `Hide ${object.name}`}
        aria-pressed={object.hidden}
        onClick={() => dispatch({ type: 'toggleHidden', id: object.id })}
        className={cn('flex size-5 flex-none items-center justify-center rounded-sm', object.hidden ? 'text-gray-11' : 'text-gray-9')}
      >
        <EyeGlyph hidden={object.hidden} />
      </button>
      <button
        type="button"
        title="Lock"
        aria-label={object.locked ? `Unlock ${object.name}` : `Lock ${object.name}`}
        aria-pressed={object.locked}
        onClick={() => dispatch({ type: 'toggleLocked', id: object.id })}
        className={cn(
          'flex size-5 flex-none items-center justify-center rounded-sm',
          object.locked ? 'text-gray-11' : 'text-gray-9 opacity-55',
        )}
      >
        <LockGlyph locked={object.locked} />
      </button>
    </li>
  );
}

/**
 * The left rail: what is on the artboard, front-to-back, and one way to add
 * each shape the document may hold. Selection reads three ways at once and
 * nowhere else — handles on the artboard, an accent row here, and a populated
 * right rail.
 */
export function ObjectList() {
  const { state, dispatch, view } = useEditor();
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState('');
  // Keyed by object id rather than index, since the whole point of a move is
  // that a row's index changes out from under it.
  const rowButtons = useRef(new Map<string, HTMLButtonElement>());
  const focusAfterMove = useRef<string | null>(null);

  // A dispatch re-renders the list with the moved object at a new index. Its
  // `<li key={object.id}>` survives that re-render — same DOM node, just
  // relocated — but the reorder still lands between two renders, one commit
  // apart from the keydown that caused it. Refocusing has to wait for the
  // commit the new index shows up in, which is exactly what an effect is for.
  useEffect(() => {
    const id = focusAfterMove.current;
    if (!id) return;
    focusAfterMove.current = null;
    rowButtons.current.get(id)?.focus();
  }, [state.doc.objects]);

  const commitReorder = () => {
    if (dragFrom !== null && dragOver !== null && dragFrom !== dragOver) {
      dispatch({ type: 'reorderObjects', from: dragFrom, to: dragOver });
    }
    setDragFrom(null);
    setDragOver(null);
  };

  const moveObject = (object: IconObject, index: number, delta: -1 | 1) => {
    const to = index + delta;
    // The floor and ceiling of the list are dead ends, not a wraparound —
    // there is no "after the back" for the front-to-back order to mean.
    if (to < 0 || to >= state.doc.objects.length) return;
    dispatch({ type: 'reorderObjects', from: index, to });
    focusAfterMove.current = object.id;
    setAnnouncement(
      `${object.name} moved ${delta === -1 ? 'up' : 'down'}, now ${to + 1} of ${state.doc.objects.length}`,
    );
  };

  return (
    <>
      <div className="flex h-8.5 flex-none items-center gap-2 px-3.5">
        <span className="font-sans text-9 font-500 tracking-widest text-gray-9">OBJECTS</span>
        <span className="font-mono text-10 text-gray-9">{state.doc.objects.length}</span>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-1.75 pb-2">
        <ul aria-label="Objects, front to back">
          {state.doc.objects.map((object, index) => (
            <ObjectRow
              key={object.id}
              object={object}
              index={index}
              selected={object.id === state.selectedId}
              moving={view.dragging && object.id === state.selectedId}
              onDragStart={setDragFrom}
              onDragOver={setDragOver}
              onDrop={commitReorder}
              onMove={(delta) => moveObject(object, index, delta)}
              registerRef={(el) => {
                if (el) rowButtons.current.set(object.id, el);
                else rowButtons.current.delete(object.id);
              }}
            />
          ))}
        </ul>
        {state.doc.objects.length === 0 ? (
          <div className="px-2 pt-2.5 font-mono text-11 italic text-gray-9">— no objects —</div>
        ) : null}
      </div>

      {/* No `role="status"` here on purpose: the canvas footer already owns
          that role for the one status line the design has, and a second
          element claiming it would make that query ambiguous everywhere else
          in the app. `aria-live` alone still reaches a screen reader. */}
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>

      <div className="flex flex-none flex-col gap-2 border-t-1 border-gray-6 px-3 pb-3.25 pt-2.75">
        <span className="font-sans text-9 font-500 tracking-widest text-gray-9">ADD SHAPE</span>
        <div className="flex gap-1.5">
          {SHAPE_TOOLS.map((tool) => (
            <button
              key={tool.kind}
              type="button"
              title={`${tool.label} · ${tool.key}`}
              aria-label={tool.label}
              onClick={() => dispatch({ type: 'addObject', kind: tool.kind })}
              className="flex h-8.5 flex-1 items-center justify-center rounded-lg border-1 border-gray-6 bg-surface-raised text-gray-11 hover:text-gray-12"
            >
              <ShapeGlyph kind={tool.kind} size={15} />
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
