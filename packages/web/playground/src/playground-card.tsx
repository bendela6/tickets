import { useState } from 'react';
import { initialValues, type AnyControlDef, type PlaygroundDef } from '@tickets/ui/gallery';
import { ControlsPanel } from './controls-panel';

export function PlaygroundCard<C extends Record<string, AnyControlDef>>({
  playground,
}: {
  playground: PlaygroundDef<C>;
}) {
  const [values, setValues] = useState<Record<string, unknown>>(() => initialValues(playground.controls));
  return (
    <section className="flex flex-col gap-3">
      <h3 className="font-sans text-label font-medium uppercase tracking-wider text-ink-2">Playground</h3>
      <div className="flex items-start gap-6 rounded-card border border-hairline bg-raised p-4">
        <ControlsPanel
          controls={playground.controls}
          values={values}
          onChange={(key, value) => setValues((v) => ({ ...v, [key]: value }))}
        />
        <div className="flex min-h-20 flex-1 items-start">{playground.render(values as never)}</div>
      </div>
    </section>
  );
}
