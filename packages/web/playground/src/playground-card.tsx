import { useState } from 'react';
import { initialValues, type AnyControlDef, type PlaygroundDef } from '@tickets/ui/gallery';
import { ControlsPanel } from './controls-panel';
import { PropsTable } from './props-table';

export function PlaygroundCard<C extends Record<string, AnyControlDef>>({
  playground,
}: {
  playground: PlaygroundDef<C>;
}) {
  const [values, setValues] = useState<Record<string, unknown>>(() => initialValues(playground.controls));

  const handleReset = () => {
    setValues(initialValues(playground.controls));
  };

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-2.5">
        <div className="font-mono text-label uppercase tracking-(--tracking-caps) text-ink-3">PLAYGROUND</div>
        <div className="flex items-start gap-6">
          <div className="flex flex-1 flex-col gap-3">
            <div className="flex min-h-32 items-center justify-center rounded-card border border-hairline bg-raised p-7">
              {playground.render(values as never)}
            </div>
          </div>
          <div className="flex w-64 shrink-0 flex-col">
            <div className="flex items-center justify-between pb-2.5">
              <span className="font-mono text-label uppercase tracking-(--tracking-caps) text-ink-3">CONTROLS</span>
              <button
                type="button"
                onClick={handleReset}
                className="text-accent hover:underline"
                style={{ font: '500 11px \'IBM Plex Sans\', sans-serif' }}
              >
                Reset
              </button>
            </div>
            <ControlsPanel
              controls={playground.controls}
              values={values}
              onChange={(key, value) => setValues((v) => ({ ...v, [key]: value }))}
            />
            <p className="mt-3 font-sans text-label text-ink-3">Unset props fall back to the component default and are omitted from generated code.</p>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-2.5">
        <div className="font-mono text-label uppercase tracking-(--tracking-caps) text-ink-3">PROPS</div>
        <PropsTable controls={playground.controls} />
      </div>
    </section>
  );
}
