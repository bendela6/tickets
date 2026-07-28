import { useState } from 'react';
import {
  Tabs,
  type AnyControlDef,
  type AnyPlayground,
  type CollectedDemo,
  type ControlValues,
} from '@tickets/ui';
import { CodeBlock } from '../../code/code-block';
import { generateSnippet } from '../../code/code-snippet';
import { deriveAxes, type AxisSection } from '../state-axes';

type LiveDemo = Extract<CollectedDemo, { slug: string }>;

const CAPTION = 'font-mono text-11/13 tracking-wider uppercase tracking-widest text-gray-9';

type AxisView = 'preview' | 'source';

const VIEWS = [
  { value: 'preview', label: 'Preview' },
  { value: 'source', label: 'Source' },
];

// One prop, every value it can take, laid out full-bleed. Sections stack down
// the page rather than tiling into a grid: an axis is read across, comparing
// siblings that differ in exactly one prop, and a two-column grid puts half of
// them on a different line at a different width.
function AxisRow({
  section,
  playground,
  component,
}: {
  section: AxisSection;
  playground: AnyPlayground;
  component: string;
}) {
  const [view, setView] = useState<AxisView>('preview');
  return (
    <section
      id={section.slug}
      className="flex w-full flex-col gap-3 rounded-lg border border-gray-6 bg-surface-raised px-3.5 py-3"
    >
      <header className="flex items-center justify-between gap-4">
        <span className={CAPTION}>{section.prop}</span>
        {/* A real tablist, not a toggle group: each item genuinely swaps the
            panel below for another one, which is exactly the promise the role
            makes. */}
        <Tabs
          variant="pill"
          size="sm"
          label={`${section.prop} view`}
          items={VIEWS}
          value={view}
          onChange={(next) => setView(next as AxisView)}
        />
      </header>
      <div role="tabpanel" aria-label={`${section.prop} ${view}`}>
        {view === 'preview' ? (
          /* `items-end`, so the captions of a row share one baseline and the
             specimens hang above it. A size axis is exactly the case that
             breaks under `items-start`: the tallest rung pushes its own caption
             down and the labels stagger, reading as misalignment not scale. */
          <div className="flex flex-wrap items-end gap-x-5 gap-y-4">
            {section.cells.map((cell) => (
              <figure key={cell.slug} id={cell.slug} className="m-0 flex min-w-0 flex-col gap-2">
                {/* Same contravariance gap MatrixMode hits: the values are built
                    generically, so they are asserted back into the concrete
                    shape this playground's render declares. */}
                <div className="flex min-h-9 items-center">
                  {playground.render(cell.values as ControlValues<Record<string, AnyControlDef>>)}
                </div>
                <figcaption className="font-mono text-11/13 tracking-wider text-gray-9">{cell.label}</figcaption>
              </figure>
            ))}
          </div>
        ) : (
          // One block, one line per cell, in the same order the specimens
          // appear. Seventeen separate blocks down a tone axis would be a
          // stack of chrome around one line of code each, and this is also
          // what you would actually paste. The axis prop is pinned so the
          // default-valued cell still prints the prop the section is about,
          // rather than collapsing to a bare `<Button />`.
          <CodeBlock
            code={section.cells
              .map(
                (cell) =>
                  generateSnippet(component, playground.controls, cell.values, [section.prop]).code,
              )
              .join('\n')}
          />
        )}
      </div>
    </section>
  );
}

// Demos with no playground — the Foundation pages, and a handful of specimens
// with nothing to vary — have no props to derive an axis from, so they keep
// rendering the states they author by hand. There is no third thing to show.
function AuthoredStates({ demo }: { demo: LiveDemo }) {
  return (
    <div className="flex flex-col gap-2.5">
      {demo.states.map((state) => (
        <figure
          key={state.slug}
          id={state.slug}
          className="m-0 flex w-full flex-col gap-3 rounded-lg border border-gray-6 bg-surface-raised px-3.5 py-3"
        >
          <figcaption className={CAPTION}>{state.name}</figcaption>
          <div className="flex w-full min-w-0 max-w-full items-center">{state.render()}</div>
        </figure>
      ))}
    </div>
  );
}

// One component's demo: heading, then one full-width section per enumerable
// prop. Section and cell ids are the screenshot/deep-link anchors
// (`#button--variant`, `#button--variant-solid`).
export function StateGrid({ demo }: { demo: LiveDemo }) {
  const sections = demo.playground ? deriveAxes(demo.playground.controls, demo.slug) : [];
  const component = demo.meta.title.replace(/\s+/g, '');
  return (
    <section id={demo.slug} className="flex flex-col gap-3">
      <h2 className="font-sans text-11/13 tracking-wider font-500 uppercase tracking-wider text-gray-11">
        {demo.meta.title}
      </h2>
      <div className="flex flex-col gap-2.5">
        <div className={CAPTION}>STATES</div>
        {sections.length > 0 && demo.playground ? (
          <div className="flex flex-col gap-2.5">
            {sections.map((section) => (
              <AxisRow
                key={section.prop}
                section={section}
                playground={demo.playground!}
                component={component}
              />
            ))}
          </div>
        ) : (
          <AuthoredStates demo={demo} />
        )}
      </div>
    </section>
  );
}

export function DemoErrorCard({ path, error }: { path: string; error: string }) {
  return (
    <section className="rounded-lg border border-red-9 bg-red-3 p-4 font-mono text-12/17 text-red-9">
      {path}: {error}
    </section>
  );
}
