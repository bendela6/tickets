import type { KeyboardEvent, ReactNode } from 'react';
import { cn } from '../../../../style';
import { Icon } from '../../../primitives/components/icon';

export interface TreeProps {
  activeDescendant: string | undefined;
  onKeyDown: (e: KeyboardEvent) => void;
  className?: string;
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
  depth: number;
  expanded: boolean;
  hasChildren: boolean;
  selected: boolean;
  focused: boolean;
  elementId: string;
  /** Names the caret: "expand <caretLabel>" / "collapse <caretLabel>". */
  caretLabel: string;
  /** Accessible name for the treeitem. Falls back to its text content. */
  label?: string;
  /** Replaces the chevron — a Spinner while children load, for instance. */
  caret?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  onToggle: () => void;
  onSelect: () => void;
  className?: string;
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
      {Array.from({ length: depth }, (_, i) => (
        <span key={i} data-tree-guide="" aria-hidden className="w-16 flex-none border-l-1 border-gray-6" />
      ))}

      {hasChildren ? (
        <button
          type="button"
          tabIndex={-1}
          aria-label={`${expanded ? 'collapse' : 'expand'} ${caretLabel}`}
          onClick={onToggle}
          className="grid size-16 flex-none self-center place-items-center rounded-4 text-gray-11 hover:bg-surface-inset hover:text-gray-12"
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
          'flex min-w-0 flex-1 items-center gap-6 rounded-6 px-6 py-4 text-left',
          'hover:bg-surface-inset',
          selected && 'bg-surface-inset',
          focused && 'outline outline-2 -outline-offset-1 outline-indigo-9',
          className,
        )}
      >
        {children}
        {trailing}
      </button>
    </div>
  );
}
