import type { Renderer } from '@tickets/table';
import { Button } from '../../components/button';
import { Icon, type IconName } from '../../components/icon';
import type { Tone } from '../../style';

type ActionItem = {
  icon: IconName;
  label: string;
  onClick: (row: unknown) => void;
  tone?: Tone;
};

type ActionsColumnOpts = { items: ActionItem[] };

/**
 * Inline row actions, revealed on row hover.
 *
 * The reveal rides on `group-hover`, which requires the `group` class the `tr`
 * slot sets (render-tr.tsx) — this container must NOT set its own `group`,
 * since a nested group would make the buttons reveal on hovering the cell
 * rather than the row. The buttons stay in the tree rather than being
 * conditionally rendered, so they remain keyboard-reachable (via
 * `focus-visible`) when nothing is hovered.
 *
 * Button has no `icon` prop — it only ever renders `children` — so the glyph
 * is passed as a child `<Icon>` rather than a prop. There is also no
 * icon-only size rung; per the button gallery ("icon-only is geometry, not a
 * rung"), a size is squared off with `w-<n> p-0` matching that size's height
 * (`sm` is `h-28`, so `w-28 p-0`).
 */
export function ActionsColumn(opts: ActionsColumnOpts): Renderer<unknown> {
  return ({ row }) => (
    <div className="flex items-center justify-end gap-4">
      {opts.items.map((item) => (
        <Button
          key={item.label}
          variant="ghost"
          size="sm"
          tone={item.tone}
          aria-label={item.label}
          title={item.label}
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
      ))}
    </div>
  );
}
