// Edge routing, as a menu rather than the cycle button it used to be: three
// modes behind one control meant two clicks to reach the third and no way to
// see what the others were without landing on them.

import { Button, Dropdown, cn } from '@bh/ui';
import type { RoutingMode } from '../../engine/model/types';
import { useDiagramActions, useDiagramView } from '../../state/diagram-context';

const MODES: { mode: RoutingMode; label: string; tip: string }[] = [
  { mode: 'curved', label: 'Curved', tip: 'Direct curves (may cross cards)' },
  { mode: 'avoid', label: 'Avoid', tip: 'Curves routed around cards' },
  { mode: 'ortho', label: 'Ortho', tip: 'Horizontal / vertical only' },
];

export function RoutingMenu() {
  const view = useDiagramView();
  const actions = useDiagramActions();
  const current = MODES.find((m) => m.mode === view.routing) ?? MODES[0]!;

  return (
    <Dropdown
      align="start"
      padding="sm"
      trigger={
        // Button's chevron is aria-hidden, so the trigger's accessible name
        // stays the mode itself ("Lines: avoid") — the state, not the decoration.
        <Button variant="outline" tone="neutral" size="sm" chevron title={current.tip}>
          Lines: {current.mode}
        </Button>
      }
    >
      {(close) => (
        <div className="flex w-224 flex-col gap-2">
          {MODES.map((m) => (
            <button
              key={m.mode}
              type="button"
              onClick={() => {
                actions.setRouting(m.mode);
                close();
              }}
              className={cn(
                'flex flex-col gap-2 rounded-8 px-8 py-6 text-left',
                m.mode === view.routing ? 'bg-surface-inset' : 'hover:bg-surface-inset',
              )}
            >
              <span className={cn('text-13 text-gray-12', m.mode === view.routing && 'font-500')}>
                {m.label}
              </span>
              <span className="text-11 text-gray-11">{m.tip}</span>
            </button>
          ))}
        </div>
      )}
    </Dropdown>
  );
}
