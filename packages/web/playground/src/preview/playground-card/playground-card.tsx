import { forwardRef, type ReactNode } from 'react';
import { Card, type AnyControlDef } from '@tickets/ui';

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
    <div className="flex flex-col gap-10">
      <div className="flex items-baseline justify-between gap-16">
        <span className="font-mono text-11/13 tracking-wider uppercase tracking-widest text-gray-9">
          PLAYGROUND
        </span>
        <span className="font-mono text-11/13 tracking-wider tracking-normal text-gray-9">
          {playgroundCaption(component, playground.controls, values)}
        </span>
      </div>
      {/* Named region: the Preview tab stacks three stages (states, playground,
          code) that all render the same component, so the live one needs to be
          distinguishable — to a screen reader walking landmarks, and to a test
          asserting which specimen reflects the current controls. */}
      <Card
        ref={ref}
        role="region"
        aria-label="Playground preview"
        radius="lg"
        // 24px, down from a hand-written p-28. Card's padding reuses Stack's
        // gap domain and 28 is not on it — keeping the old value would have
        // meant passing an off-scale class straight back through className,
        // which is the thing the scale exists to prevent.
        padding={6}
        className="flex min-h-128 items-center justify-center"
      >
        {playground.render(values as never)}
      </Card>
    </div>
  );
});
