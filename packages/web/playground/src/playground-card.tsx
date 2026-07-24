import { forwardRef } from 'react';
import type { AnyControlDef, ControlValues, PlaygroundDef } from '@tickets/ui/gallery';

// Stage-only: renders the live preview for the current control values. State
// (values + Reset) is owned by ComponentPage, which also renders the
// CONTROLS rail (ControlsPanel) alongside this in the resizable split.
export const PlaygroundCard = forwardRef<
  HTMLDivElement,
  {
    playground: PlaygroundDef<Record<string, AnyControlDef>>;
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
        {playground.render(values as ControlValues<Record<string, AnyControlDef>>)}
      </div>
    </div>
  );
});
