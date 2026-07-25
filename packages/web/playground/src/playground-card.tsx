import { forwardRef, type ReactNode } from 'react';
import type { AnyControlDef } from '@tickets/ui/gallery';

// The design's PLAYGROUND caption (1a, right of the label): the component
// name followed by whatever is currently set, so the stage reads back its own
// state without anyone having to scan the rail. Unset props and values still
// at their default are left out — the same rule the generated snippet uses.
export function playgroundCaption(
  component: string,
  controls: Record<string, AnyControlDef>,
  values: Record<string, unknown>,
): string {
  const set = Object.entries(controls)
    .filter(([key, def]) => {
      const value = values[key];
      return value !== undefined && value !== '' && value !== false && value !== def.initial;
    })
    .map(([key, def]) => (def.kind === 'boolean' ? key : String(values[key])));
  return [component, ...set].join(' · ');
}

// Stage-only: renders the live preview for the current control values. State
// (values + Reset) is owned by ComponentPage, which also renders the
// CONTROLS rail (ControlsPanel) alongside this in the resizable split.
// The render param is erased to `never` so a concrete PlaygroundDef<C>
// stays assignable despite contravariance (same pattern the PlaygroundCard
// generic used before the Task 4 stage/rail split).
export const PlaygroundCard = forwardRef<
  HTMLDivElement,
  {
    component: string;
    playground: { controls: Record<string, AnyControlDef>; render: (values: never) => ReactNode };
    values: Record<string, unknown>;
  }
>(function PlaygroundCard({ component, playground, values }, ref) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-4">
        <span className="font-mono text-label uppercase tracking-(--tracking-caps) text-ink-3">
          PLAYGROUND
        </span>
        <span className="font-mono text-label tracking-normal text-ink-3">
          {playgroundCaption(component, playground.controls, values)}
        </span>
      </div>
      <div
        ref={ref}
        className="flex min-h-32 items-center justify-center rounded-card border border-hairline bg-raised p-7"
      >
        {playground.render(values as never)}
      </div>
    </div>
  );
});
