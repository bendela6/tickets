import type { KeyboardEvent, ReactNode } from 'react';
import { cn } from '../../../../style';
import { Icon } from '../../../primitives/components/icon';

export interface TreeProps {
  /** The focused row's element id, from `useTreeView`'s `activeDescendant`. */
  activeDescendant: string | undefined;
  /** The keyboard handler, from `useTreeView`'s `onKeyDown`. */
  onKeyDown: (e: KeyboardEvent) => void;
  /** Added to the tree's classes. */
  className?: string;
  /** The rows: one `TreeRow` per row `useTreeView` returns. */
  children: ReactNode;
}

/** The tree's single tab stop. Focus roves by `aria-activedescendant`, so no
 *  row is ever a tab stop of its own — tabbing moves past the whole tree. */
export function Tree({ activeDescendant, onKeyDown, className, children }: TreeProps) {
  return (
    <div
      role="tree"
      tabIndex={0}
      aria-activedescendant={activeDescendant}
      onKeyDown={onKeyDown}
      className={cn('outline-none', className)}
    >
      {children}
    </div>
  );
}

export interface TreeRowProps {
  /** How deep the row is, from 0 at the roots: one guide line per level. */
  depth: number;
  /** Whether its children show. The caret points down when they do. */
  expanded: boolean;
  /** Whether it can expand. When false, the row is a leaf: no caret and no `aria-expanded`. */
  hasChildren: boolean;
  /** Whether it is the selected row, drawn filled and set as `aria-selected`. */
  selected: boolean;
  /** Whether it is the row the keyboard is on, drawn with an outline. */
  focused: boolean;
  /** The treeitem's id, which the tree's `activeDescendant` points at: `rowElementId(id)`. */
  elementId: string;
  /**
   * Labels the caret: "expand <caretLabel>" / "collapse <caretLabel>". The caret is for
   * the mouse and hidden from assistive tech, which expands a row with the arrow keys.
   */
  caretLabel: string;
  /** Accessible name for the treeitem. Falls back to its text content. */
  label?: string;
  /** Replaces the chevron — a Spinner while children load, for instance. */
  caret?: ReactNode;
  /** Before the treeitem and outside it, so a control here is its own action. */
  leading?: ReactNode;
  /** After the row's content, inside the treeitem. */
  trailing?: ReactNode;
  /** Called when the caret is clicked. */
  onToggle: () => void;
  /** Called when the row is clicked. */
  onSelect: () => void;
  /** Added to the treeitem's classes. */
  className?: string;
  /** The row's content, inside the treeitem. */
  children: ReactNode;
}

/**
 * One row: guide columns, a caret, an optional leading slot, the treeitem
 * itself, and an optional trailing slot.
 *
 * The caret and `leading` sit OUTSIDE the `role="treeitem"` element on purpose.
 * A control in `leading` (a visibility toggle, say) is a separate action from
 * selecting the node, and nesting an interactive element inside a treeitem
 * breaks its semantics.
 */
export function TreeRow({
  depth,
  expanded,
  hasChildren,
  selected,
  focused,
  elementId,
  caretLabel,
  label,
  caret,
  leading,
  trailing,
  onToggle,
  onSelect,
  className,
  children,
}: TreeRowProps) {
  return (
    <div className="flex items-stretch gap-4">
      {Array.from({ length: depth }, (_, i) => {
        return (
          <span
            key={i}
            data-tree-guide=""
            aria-hidden
            className="border-gray-6 w-16 flex-none border-l-1"
          />
        );
      })}

      {hasChildren ? (
        // For the mouse only: a tree holds only its items, and the keyboard's
        // arrows already expand the row, whose treeitem says `aria-expanded`.
        <button
          type="button"
          tabIndex={-1}
          aria-hidden
          aria-label={`${expanded ? 'collapse' : 'expand'} ${caretLabel}`}
          onClick={onToggle}
          className="rounded-4 text-gray-11 hover:bg-surface-inset hover:text-gray-12 grid size-16 flex-none place-items-center self-center"
        >
          {caret ?? <Icon name={expanded ? 'chevron-down' : 'chevron-right'} size="xs" />}
        </button>
      ) : (
        <span aria-hidden className="size-16 flex-none self-center" />
      )}

      {leading}

      <button
        type="button"
        id={elementId}
        tabIndex={-1}
        role="treeitem"
        aria-level={depth + 1}
        aria-expanded={hasChildren ? expanded : undefined}
        aria-selected={selected}
        aria-label={label}
        onClick={onSelect}
        className={cn(
          'rounded-6 flex min-w-0 flex-1 items-center gap-6 px-6 py-4 text-left',
          'hover:bg-surface-inset',
          selected && 'bg-surface-inset',
          focused && 'outline-indigo-9 outline outline-2 -outline-offset-1',
          className,
        )}
      >
        {children}
        {trailing}
      </button>
    </div>
  );
}
