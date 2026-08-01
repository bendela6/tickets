import { useEffect, useRef, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger, cn } from '@tickets/ui';
import { SUSTAINS } from '../doc/constants';
import { useEditor } from '../editor-context';
import type { IconState, Sustain } from '../doc/types';

const labelFor = (sustain: Sustain) => sustain ?? 'settled';

/** Named once so the row's title and the handler agree on what the chord is. */
const REORDER_HINT = 'hold ⌥ and press ↑ or ↓ to reorder';

const nextSustain = (sustain: Sustain): Sustain => {
  const index = SUSTAINS.indexOf(sustain);
  return SUSTAINS[(index + 1) % SUSTAINS.length] ?? null;
};

/**
 * Adding, renaming and reordering states is rare, so it holds no permanent
 * space: a popover from the ⋯ button in the strip. No keyframes, no easing, no
 * duration per state — a state is a name and whether it keeps moving.
 */
export function StateManager() {
  const { state, dispatch, view } = useEditor();
  const [renaming, setRenaming] = useState<string | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState('');
  // Keyed by state id rather than index, since the whole point of a move is
  // that a row's index changes out from under it.
  const rowButtons = useRef(new Map<string, HTMLButtonElement>());
  const focusAfterMove = useRef<string | null>(null);
  const states = state.doc.states;
  const onlyOne = states.length <= 1;

  // A dispatch re-renders the list with the moved state at a new index. Its
  // `<li key={iconState.id}>` survives that re-render — same DOM node, just
  // relocated — but the reorder still lands between two renders, one commit
  // apart from the keydown that caused it. Refocusing has to wait for the
  // commit the new index shows up in, which is exactly what an effect is for.
  useEffect(() => {
    const id = focusAfterMove.current;
    if (!id) return;
    focusAfterMove.current = null;
    rowButtons.current.get(id)?.focus();
  }, [states]);

  const moveState = (iconState: IconState, index: number, delta: -1 | 1) => {
    const to = index + delta;
    // The floor and ceiling of the list are dead ends, not a wraparound — a
    // traversal order has no "after the last state" to mean.
    if (to < 0 || to >= states.length) return;
    dispatch({ type: 'reorderStates', from: index, to });
    focusAfterMove.current = iconState.id;
    setAnnouncement(
      `${iconState.name} moved ${delta === -1 ? 'up' : 'down'}, now ${to + 1} of ${states.length}`,
    );
  };

  return (
    <Popover>
      <PopoverTrigger
        aria-label="States"
        title={`Add, rename, reorder states · ${REORDER_HINT} on a row`}
        className="flex size-5.5 flex-none items-center justify-center rounded-md text-13 text-gray-9 hover:bg-surface-inset"
      >
        ⋯
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-58 p-0">
        <div className="flex items-center gap-2 border-b-1 border-gray-6 px-3 py-2.5">
          <span className="flex-1 font-sans text-11 font-500 text-gray-12">States</span>
          <span className="font-mono text-10 text-gray-9">{states.length}</span>
        </div>

        <ul aria-label="States" className="p-1.5">
          {states.map((iconState, index) => (
            <StateRow
              key={iconState.id}
              state={iconState}
              current={iconState.id === view.to}
              renaming={renaming === iconState.id}
              onRename={() => setRenaming(iconState.id)}
              onRenamed={(name) => {
                if (name.trim()) dispatch({ type: 'renameState', id: iconState.id, name: name.trim() });
                setRenaming(null);
              }}
              deletable={!onlyOne}
              onDelete={() => dispatch({ type: 'deleteState', id: iconState.id })}
              onCycleSustain={() =>
                dispatch({
                  type: 'setSustain',
                  id: iconState.id,
                  sustain: nextSustain(iconState.sustain),
                })
              }
              onDragStart={() => setDragFrom(index)}
              onDragOver={() => setDragOver(index)}
              onDrop={() => {
                if (dragFrom !== null && dragOver !== null && dragFrom !== dragOver) {
                  dispatch({ type: 'reorderStates', from: dragFrom, to: dragOver });
                }
                setDragFrom(null);
                setDragOver(null);
              }}
              onMove={(delta) => moveState(iconState, index, delta)}
              registerRef={(el) => {
                if (el) rowButtons.current.set(iconState.id, el);
                else rowButtons.current.delete(iconState.id);
              }}
            />
          ))}
        </ul>

        {/* No `role="status"` here on purpose: the canvas footer already owns
            that role for the one status line the design has, and a second
            element claiming it would make that query ambiguous everywhere
            else in the app. `aria-live` alone still reaches a screen reader. */}
        <div aria-live="polite" className="sr-only">
          {announcement}
        </div>

        <p className="px-3 pb-2 font-mono text-9/relaxed text-gray-9 text-pretty">
          settled holds a pose · sustained keeps moving while you stay in it
        </p>

        <div className="px-1.5 pb-1.75 pt-0.5">
          <button
            type="button"
            onClick={() => dispatch({ type: 'addState' })}
            className="flex h-7 w-full items-center justify-center gap-1.5 rounded-md border-1 border-dashed border-gray-7 font-mono text-11 text-gray-11"
          >
            + add state
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function StateRow({
  state,
  current,
  renaming,
  onRename,
  onRenamed,
  deletable,
  onDelete,
  onCycleSustain,
  onDragStart,
  onDragOver,
  onDrop,
  onMove,
  registerRef,
}: {
  state: IconState;
  current: boolean;
  renaming: boolean;
  onRename: () => void;
  onRenamed: (name: string) => void;
  deletable: boolean;
  onDelete: () => void;
  onCycleSustain: () => void;
  onDragStart: () => void;
  onDragOver: () => void;
  onDrop: () => void;
  onMove: (delta: -1 | 1) => void;
  registerRef: (el: HTMLButtonElement | null) => void;
}) {
  return (
    <li
      draggable={!renaming}
      title={renaming ? undefined : REORDER_HINT}
      onDragStart={onDragStart}
      onDragOver={(event) => {
        event.preventDefault();
        onDragOver();
      }}
      onDrop={onDrop}
      className={cn(
        'flex h-7.5 items-center gap-2 rounded-md px-1.5',
        current && !renaming && 'bg-surface-inset',
      )}
    >
      <span aria-hidden className="flex-none cursor-grab font-mono text-11 text-gray-9">
        ⠿
      </span>

      {renaming ? (
        <input
          autoFocus
          aria-label={`Rename ${state.name}`}
          defaultValue={state.name}
          onBlur={(event) => onRenamed(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') onRenamed(event.currentTarget.value);
            if (event.key === 'Escape') onRenamed(state.name);
          }}
          className="h-6.5 min-w-0 flex-1 rounded-md border-1 border-indigo-9 bg-surface-raised px-1.75 font-mono text-11 text-gray-12 outline-none ring-3 ring-indigo-3"
        />
      ) : (
        <button
          type="button"
          ref={registerRef}
          onClick={onRename}
          onKeyDown={(event) => {
            // Alt/Option is free over a list row — plain arrows are left alone
            // entirely since nothing here scrolls or steps selection with them
            // today.
            if (!event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
            event.preventDefault();
            onMove(event.key === 'ArrowUp' ? -1 : 1);
          }}
          className={cn(
            'min-w-0 flex-1 cursor-text truncate text-left font-mono text-11',
            current ? 'text-gray-12' : 'text-gray-11',
          )}
        >
          {state.name}
        </button>
      )}

      <button
        type="button"
        title="Settled or sustained"
        aria-label={`${state.name} is ${labelFor(state.sustain)}`}
        onClick={onCycleSustain}
        className={cn(
          'flex h-5.25 flex-none items-center gap-1.25 rounded-md border-1 border-gray-6 px-1.75 font-mono text-9',
          state.sustain ? 'bg-surface-inset text-gray-12' : 'text-gray-9',
        )}
      >
        <span
          aria-hidden
          className={
            state.sustain
              ? 'size-2.25 flex-none rounded-full border-1 border-current border-r-transparent'
              : 'size-1.75 flex-none rounded-sm border-1 border-current'
          }
        />
        {labelFor(state.sustain)}
      </button>

      <button
        type="button"
        title="Delete state"
        aria-label={`Delete ${state.name}`}
        onClick={onDelete}
        disabled={!deletable}
        className="size-5 flex-none rounded-sm text-13 text-gray-9 disabled:opacity-30"
      >
        ×
      </button>
    </li>
  );
}
