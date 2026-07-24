import { forwardRef, type ReactNode } from 'react';
import type { AnyControlDef } from '@tickets/ui/gallery';

// Stage-only: renders the live preview for the current control values. State
// (values + Reset) is owned by ComponentPage, which also renders the
// CONTROLS rail (ControlsPanel) alongside this in the resizable split.
// The render param is erased to `never` so a concrete PlaygroundDef<C>
// stays assignable despite contravariance (same pattern the PlaygroundCard
// generic used before the Task 4 stage/rail split).
export const PlaygroundCard = forwardRef<
  HTMLDivElement,
  {
    playground: { controls: Record<string, AnyControlDef>; render: (values: never) => ReactNode };
    values: Record<string, unknown>;
  }
>(function PlaygroundCard({ playground, values }, ref) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="font-mono text-label uppercase tracking-(--tracking-caps) text-ink-3">PLAYGROUND</div>
      <div
        ref={ref}
        className="flex min-h-32 items-center justify-center rounded-card border border-hairline bg-raised p-7"
      >
        {playground.render(values as never)}
      </div>
    </div>
  );
});
