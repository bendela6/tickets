// The canvas toolbar: what you do TO the drawing. Three controls, no more.
//
// Everything that names or filters the model — the title, the search box, the
// group chips, the edge-kind chips — moved to the outline (view/outline), which
// on /schema renders in the page's outline panel. The split is by question:
// "what am I looking at" lives in the side panel, "how is it drawn" lives
// here.

import { Button, cn, Tooltip } from '@bh/ui';
import { useDiagramActions } from '../../state/diagram-context';
import { RoutingMenu } from './routing-menu';

export function TopBar() {
  const actions = useDiagramActions();

  return (
    <header
      className={cn(
        'z-10 flex flex-wrap items-center gap-8 px-16 py-12',
        'border-b-1 border-gray-6 bg-gray-1/95',
      )}
    >
      <RoutingMenu />
      <Tooltip content="Fit the diagram to the viewport">
        <Button variant="outline" tone="neutral" size="sm" onClick={() => actions.fit()}>
          Fit
        </Button>
      </Tooltip>
      <Tooltip content="Re-pack entities by group">
        <Button variant="outline" tone="neutral" size="sm" onClick={() => actions.rearrange()}>
          Rearrange
        </Button>
      </Tooltip>
    </header>
  );
}
