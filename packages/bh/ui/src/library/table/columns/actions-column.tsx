import type { Renderer } from '@bh/table';
import { Button } from '../../primitives/components/button';
import { Icon, type IconName } from '../../primitives/components/icon';
import type { Tone } from '../../../style';

interface ActionItem {
  /** The button's glyph. */
  icon: IconName;
  /** The button's accessible name, and its tooltip. */
  label: string;
  /** Called with the row; the click goes no further, so the row doesn't open too. */
  onClick: (row: unknown) => void;
  /** The button's tone, `danger` for a delete. */
  tone?: Tone;
}

interface ActionsColumnOpts {
  /** The buttons, in order, at the cell's end. */
  items: ActionItem[];
}

/**
 * A cell of icon buttons, one per action, shown while the row is hovered or
 * a button has focus. Enter on the focused cell steps into them.
 */
// The reveal rides on `group-hover`, which requires the `group` class the `tr`
// slot sets (render-tr.tsx) — this container must NOT set its own `group`,
// since a nested group would make the buttons reveal on hovering the cell
// rather than the row. The buttons stay in the tree rather than being
// conditionally rendered, so they remain keyboard-reachable (via
// `focus-visible`) when nothing is hovered.
//
// Button has no `icon` prop — it only ever renders `children` — so the glyph
// is passed as a child `<Icon>` rather than a prop. There is also no
// icon-only size rung, so a size is squared off with `w-<n> p-0` matching that
// size's height (`sm` is `h-28`, so `w-28 p-0`).
export function ActionsColumn(opts: ActionsColumnOpts): Renderer<unknown> {
  return ({ row }) => {
    return (
      <div className="flex items-center justify-end gap-4">
        {opts.items.map((item) => {
          return (
            <Button
              key={item.label}
              variant="ghost"
              size="sm"
              tone={item.tone}
              aria-label={item.label}
              title={item.label}
              // Reached by stepping into the cell (Enter / F2), not by Tab —
              // see LinkColumn. `focus-visible:opacity-100` below still works:
              // a negative tabindex removes it from the tab ORDER, not from
              // being focusable.
              tabIndex={-1}
              className="w-28 p-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
              onClick={(e) => {
                // The row opens a drawer on click; without this an action would do
                // its own job and open the drawer behind it.
                e.stopPropagation();
                item.onClick(row);
              }}
            >
              <Icon name={item.icon} size="sm" />
            </Button>
          );
        })}
      </div>
    );
  };
}
