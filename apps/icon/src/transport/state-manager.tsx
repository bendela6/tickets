import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger, cn } from '@tickets/ui';
import { SUSTAINS } from '../doc/constants';
import { useEditor } from '../editor-context';
import type { IconState, Sustain } from '../doc/types';

const labelFor = (sustain: Sustain) => sustain ?? 'settled';

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
  const states = state.doc.states;
  const onlyOne = states.length <= 1;

  return (
    <Popover>
      <PopoverTrigger
        aria-label="States"
        title="Add, rename, reorder states"
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
            />
          ))}
        </ul>

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
}) {
  return (
    <li
      draggable={!renaming}
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
          onClick={onRename}
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
