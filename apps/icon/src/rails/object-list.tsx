import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@tickets/ui';
import { PenGlyph, PEN_TOOL, ShapeGlyph, SHAPE_TOOLS } from '../canvas/shape-tools';
import { useEditor } from '../editor-context';
import { everyNode, isGroup, levelOf } from '../doc/tree';
import type { IconNode } from '../doc/types';

/** Named once so the row's title and the handler agree on what the chord is. */
const REORDER_HINT = 'hold ⌥ and press ↑ or ↓ to reorder';

/** How far one level of nesting shifts a row, in rem. */
const INDENT_REM = 0.875;

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

/**
 * A group's mark: two panels, one behind the other. It says "more than one
 * thing, held together" without borrowing the folder metaphor, which would
 * promise a place on disk this has nothing to do with.
 */
function GroupGlyph() {
  return (
    <svg aria-hidden width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="1.5" y="1.5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <rect x="4.5" y="4.5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2" fill="none" />
    </svg>
  );
}

/** The disclosure triangle, pointing down when the group is open. */
function TwistyGlyph({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="currentColor"
      style={{ transform: open ? 'rotate(90deg)' : undefined }}
    >
      <path d="M3.5 2 L7 5 L3.5 8 Z" />
    </svg>
  );
}

function ObjectRow({
  node,
  index,
  depth,
  selected,
  moving,
  open,
  inLevel,
  onToggleOpen,
  onDragStart,
  onDragOver,
  onDrop,
  onMove,
  registerRef,
}: {
  node: IconNode;
  index: number;
  /** How deep in the tree, counted from 1 so `aria-level` reads as ARIA states it. */
  depth: number;
  selected: boolean;
  moving: boolean;
  /** Null for a shape, which has nothing to open. */
  open: boolean | null;
  /** Whether this row is in the list clicks currently pick from. */
  inLevel: boolean;
  onToggleOpen: () => void;
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
      // Dragging a row INTO or OUT OF a group is deliberately not built. A drag
      // that can re-parent has to say, mid-drag, whether the pointer means
      // "before this group", "after it" or "inside it", and that is a drop
      // indicator with three states rather than a reorder with two. ⌘G and
      // ⇧⌘G are how the tree is restructured, and a drag stays what it always
      // was: a reorder within one list. Whoever builds it starts here.
      title={REORDER_HINT}
      aria-level={depth}
      onDragStart={() => onDragStart(index)}
      onDragOver={(event) => {
        event.preventDefault();
        onDragOver(index);
      }}
      onDrop={onDrop}
      style={{ paddingLeft: `${(depth - 1) * INDENT_REM}rem` }}
      className={cn(
        'flex h-30 items-center gap-8 rounded-md pl-8 pr-7',
        selected && 'bg-indigo-3',
        node.hidden && 'opacity-50',
        // Rows outside the level you are standing in recede rather than
        // disappear: they are still there, and still clickable to step back
        // out, but they are not what a click on the artboard would find.
        !inLevel && !selected && 'opacity-45',
      )}
    >
      {open === null ? (
        <span aria-hidden className="size-14 flex-none" />
      ) : (
        <button
          type="button"
          aria-label={`${open ? 'Collapse' : 'Expand'} ${node.name}`}
          aria-expanded={open}
          onClick={onToggleOpen}
          className="flex size-14 flex-none items-center justify-center text-gray-9 hover:text-gray-12"
        >
          <TwistyGlyph open={open} />
        </button>
      )}

      <button
        type="button"
        aria-pressed={selected}
        ref={registerRef}
        // Shift adds the row to the selection or takes it out, exactly as
        // shift-clicking the shape on the artboard does: the rail and the
        // canvas are two views of one selection, not two ways of selecting.
        onClick={(event) =>
          dispatch(
            event.shiftKey
              ? { type: 'toggleSelect', id: node.id }
              : { type: 'selectObject', id: node.id },
          )
        }
        onKeyDown={(event) => {
          // Alt/Option is free over a list row — the browser owns Ctrl/Cmd+arrows
          // for tab and word navigation, and plain arrows are left alone entirely
          // since nothing here scrolls or steps selection with them today.
          if (!event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
          event.preventDefault();
          onMove(event.key === 'ArrowUp' ? -1 : 1);
        }}
        className="flex min-w-0 flex-1 items-center gap-8 text-left"
      >
        <span className={cn('flex-none', selected ? 'text-indigo-9' : 'text-gray-11')}>
          {isGroup(node) ? <GroupGlyph /> : <ShapeGlyph kind={node.geometry.kind} />}
        </span>
        <span
          className={cn(
            'truncate font-mono text-12',
            selected ? 'font-500 text-indigo-9' : 'text-gray-12',
            node.hidden && 'line-through',
          )}
        >
          {node.name}
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
        aria-label={node.hidden ? `Show ${node.name}` : `Hide ${node.name}`}
        aria-pressed={node.hidden}
        onClick={() => dispatch({ type: 'toggleHidden', id: node.id })}
        className={cn('flex size-20 flex-none items-center justify-center rounded-sm', node.hidden ? 'text-gray-11' : 'text-gray-9')}
      >
        <EyeGlyph hidden={node.hidden} />
      </button>
      <button
        type="button"
        title="Lock"
        aria-label={node.locked ? `Unlock ${node.name}` : `Lock ${node.name}`}
        aria-pressed={node.locked}
        onClick={() => dispatch({ type: 'toggleLocked', id: node.id })}
        className={cn(
          'flex size-20 flex-none items-center justify-center rounded-sm',
          node.locked ? 'text-gray-11' : 'text-gray-9 opacity-55',
        )}
      >
        <LockGlyph locked={node.locked} />
      </button>
    </li>
  );
}

/**
 * The left rail: what is on the artboard, front-to-back, and one way to add
 * each shape the document may hold. Selection reads three ways at once and
 * nowhere else — an outline on the artboard, an accent row here, and a
 * populated right rail. Every selected row reads as pressed, so a selection of
 * three is three accented rows rather than one plus something implied.
 *
 * A tree since groups: one row per node, indented by depth, and `aria-level` on
 * each so the nesting reaches a screen reader as more than left padding. It is
 * still a list rather than an ARIA tree, because the rows are not a navigation
 * structure — you do not arrow between them, you click one and it becomes the
 * subject of the whole editor.
 */
export function ObjectList() {
  const { state, dispatch, view } = useEditor();
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState('');
  /**
   * Which groups are shut. Collapsed rather than expanded, so a group that has
   * just been made shows what went into it — and so a document arriving from
   * disk shows all of itself rather than a row saying nothing.
   *
   * Local to the rail and not in the store: it is a statement about this list
   * on this screen, nothing else reads it, and it must not enter the undo
   * history — closing a group is not an edit to the document.
   */
  const [shut, setShut] = useState<ReadonlySet<string>>(new Set());
  // Keyed by object id rather than index, since the whole point of a move is
  // that a row's index changes out from under it.
  const rowButtons = useRef(new Map<string, HTMLButtonElement>());
  const focusAfterMove = useRef<string | null>(null);

  // A dispatch re-renders the list with the moved object at a new index. Its
  // `<li key={node.id}>` survives that re-render — same DOM node, just
  // relocated — but the reorder still lands between two renders, one commit
  // apart from the keydown that caused it. Refocusing has to wait for the
  // commit the new index shows up in, which is exactly what an effect is for.
  useEffect(() => {
    const id = focusAfterMove.current;
    if (!id) return;
    focusAfterMove.current = null;
    rowButtons.current.get(id)?.focus();
  }, [state.doc.objects]);

  const level = levelOf(state.doc.objects, state.entered);
  const standing = state.entered.at(-1);
  const standingName = standing
    ? (everyNode(state.doc.objects).find((node) => node.id === standing)?.name ?? null)
    : null;

  const commitReorder = (parentId: string | null) => {
    if (dragFrom !== null && dragOver !== null && dragFrom !== dragOver) {
      dispatch({ type: 'reorderObjects', parentId, from: dragFrom, to: dragOver });
    }
    setDragFrom(null);
    setDragOver(null);
  };

  /**
   * ⌥ + arrow inside a tree moves a row **among its own siblings and no
   * further**. The floor and ceiling of a group are dead ends exactly as the
   * floor and ceiling of the document are: front-to-back is a property of one
   * list, and there is no "after the back" of a group for a row to fall out of
   * into its parent. Moving between lists is re-parenting, which is what ⌘G
   * and ⇧⌘G are for — a chord that reordered *and* sometimes re-parented would
   * be two commands wearing one key.
   */
  const moveNode = (
    node: IconNode,
    index: number,
    siblings: readonly IconNode[],
    parentId: string | null,
    delta: -1 | 1,
  ) => {
    const to = index + delta;
    if (to < 0 || to >= siblings.length) return;
    dispatch({ type: 'reorderObjects', parentId, from: index, to });
    focusAfterMove.current = node.id;
    setAnnouncement(
      `${node.name} moved ${delta === -1 ? 'up' : 'down'}, now ${to + 1} of ${siblings.length}`,
    );
  };

  const rows = (
    list: readonly IconNode[],
    parentId: string | null,
    depth: number,
  ): ReactNode[] =>
    list.flatMap((node, index) => {
      const group = isGroup(node);
      const open = group ? !shut.has(node.id) : null;
      const row = (
        <ObjectRow
          key={node.id}
          node={node}
          index={index}
          depth={depth}
          selected={state.selectedIds.has(node.id)}
          // A locked object in the selection is not going anywhere, so it
          // does not claim to be.
          moving={view.dragging && state.selectedIds.has(node.id) && !node.locked}
          open={open}
          inLevel={parentId === level.parentId}
          onToggleOpen={() =>
            setShut((was) => {
              const next = new Set(was);
              if (!next.delete(node.id)) next.add(node.id);
              return next;
            })
          }
          onDragStart={setDragFrom}
          onDragOver={setDragOver}
          onDrop={() => commitReorder(parentId)}
          onMove={(delta) => moveNode(node, index, list, parentId, delta)}
          registerRef={(el) => {
            if (el) rowButtons.current.set(node.id, el);
            else rowButtons.current.delete(node.id);
          }}
        />
      );
      return group && open ? [row, ...rows(node.children, node.id, depth + 1)] : [row];
    });

  return (
    <>
      <div className="flex h-34 flex-none items-center gap-8 px-14">
        <span className="font-sans text-9 font-500 tracking-widest text-gray-9">OBJECTS</span>
        <span className="font-mono text-10 text-gray-9">{level.list.length}</span>
      </div>

      {/* Which level you are standing in, and the way back out. Only shown
          when you are inside something: a document with no groups in it never
          has a level to be told about. */}
      {standingName === null ? null : (
        <div className="flex h-26 flex-none items-center gap-8 px-14">
          <span className="min-w-0 flex-1 truncate font-mono text-10 text-indigo-9">
            inside {standingName}
          </span>
          <button
            type="button"
            aria-label={`Leave ${standingName}`}
            title="Escape"
            onClick={() => dispatch({ type: 'exitGroup' })}
            className="flex-none font-mono text-10 text-gray-9 hover:text-gray-12"
          >
            leave
          </button>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto px-7 pb-8">
        <ul aria-label="Objects, front to back">{rows(state.doc.objects, null, 1)}</ul>
        {state.doc.objects.length === 0 ? (
          <div className="px-8 pt-10 font-mono text-11 italic text-gray-9">— no objects —</div>
        ) : null}
      </div>

      {/* No `role="status"` here on purpose: the canvas footer already owns
          that role for the one status line the design has, and a second
          element claiming it would make that query ambiguous everywhere else
          in the app. `aria-live` alone still reaches a screen reader. */}
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>

      <div className="flex flex-none flex-col gap-8 border-t-1 border-gray-6 px-12 pb-13 pt-11">
        <span className="font-sans text-9 font-500 tracking-widest text-gray-9">ADD SHAPE</span>
        {/* Four across rather than one row: the pen makes eight, and eight in a
            232px rail leaves each one narrower than the mark inside it. */}
        <div className="grid grid-cols-4 gap-6">
          {SHAPE_TOOLS.map((tool) => (
            <button
              key={tool.kind}
              type="button"
              title={`${tool.label} · ${tool.key}`}
              aria-label={tool.label}
              onClick={() => dispatch({ type: 'addObject', kind: tool.kind })}
              className="flex h-34 flex-1 items-center justify-center rounded-lg border-1 border-gray-6 bg-surface-raised text-gray-11 hover:text-gray-12"
            >
              <ShapeGlyph kind={tool.kind} size={15} />
            </button>
          ))}

          {/* A toggle rather than an add: pressing it enters a mode, and the
              shape it makes does not exist until the path is finished. It says
              so with `aria-pressed`, which the seven beside it have nothing to
              report. */}
          <button
            type="button"
            title={`${PEN_TOOL.label} · ${PEN_TOOL.key}`}
            aria-label={PEN_TOOL.label}
            aria-pressed={state.tool === 'pen'}
            onClick={() =>
              dispatch(
                state.tool === 'pen'
                  ? { type: 'penEnd', close: false }
                  : { type: 'setTool', tool: 'pen' },
              )
            }
            className={cn(
              'tool-toggle flex h-34 items-center justify-center border-1',
              state.tool === 'pen'
                ? 'border-indigo-9 bg-indigo-3 text-indigo-9'
                : 'border-gray-6 bg-surface-raised text-gray-11 hover:text-gray-12',
            )}
          >
            <PenGlyph size={15} />
          </button>
        </div>
      </div>
    </>
  );
}
