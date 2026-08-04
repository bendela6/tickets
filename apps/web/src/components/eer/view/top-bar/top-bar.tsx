// The canvas toolbar: what you do TO the drawing. Three controls, no more.
//
// Everything that names or filters the model — the title, the search box, the
// group chips, the edge-kind chips — moved to the outline (view/outline), which
// on /schema renders in the app shell's mode panel. The split is by question:
// "what am I looking at" lives in the left sidebar, "how is it drawn" lives
// here.

import { cn } from '@tickets/ui';
import { useDiagramActions } from '../../state/diagram-context';
import { btn } from './button-class';
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
      <button
        type="button"
        className={btn}
        title="Fit the diagram to the viewport"
        onClick={() => actions.fit()}
      >
        Fit
      </button>
      <button
        type="button"
        className={btn}
        title="Re-pack entities by group"
        onClick={() => actions.rearrange()}
      >
        Rearrange
      </button>
    </header>
  );
}
