import { useState } from 'react';
import {
  Icon,
  type AnyControlDef,
  type AnyPlayground,
  type CollectedDemo,
  type ControlValues,
} from '@tickets/ui';
import { CodeBlock } from '../../code/code-block';
import { generateSnippet } from '../../code/code-snippet';
import { deriveAxes, type AxisSection } from '../state-axes';

type LiveDemo = Extract<CollectedDemo, { slug: string }>;

const CAPTION = 'font-mono text-label uppercase tracking-(--tracking-caps) text-gray-9';

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
  const [showSource, setShowSource] = useState(false);
  return (
    <section
      id={section.slug}
      className="flex w-full flex-col gap-3 rounded-lg border border-gray-6 bg-surface-raised px-3.5 py-3"
    >
      <header className="flex items-center justify-between gap-4">
        <span className={CAPTION}>{section.prop}</span>
        <button
          type="button"
          aria-expanded={showSource}
          onClick={() => setShowSource((shown) => !shown)}
          className="inline-flex h-6.5 items-center gap-1.5 rounded-md border border-gray-7 px-2 font-sans text-label font-medium text-gray-11 hover:text-gray-12"
        >
          <Icon name={showSource ? 'chevron-up' : 'chevron-down'} size="sm" />
          Source
        </button>
      </header>
      {/* `items-end`, so the captions of a row share one baseline and the
          specimens hang above it. A size axis is exactly the case that breaks
          under `items-start`: the tallest rung pushes its own caption down and
          the labels stagger, reading as misalignment rather than as scale. */}
      <div className="flex flex-wrap items-end gap-x-5 gap-y-4">
        {section.cells.map((cell) => (
          <figure key={cell.slug} id={cell.slug} className="m-0 flex min-w-0 flex-col gap-2">
            {/* Same contravariance gap MatrixMode hits: the values are built
                generically, so they are asserted back into the concrete shape
                this playground's render declares. */}
            <div className="flex min-h-9 items-center">
              {playground.render(cell.values as ControlValues<Record<string, AnyControlDef>>)}
            </div>
            <figcaption className="font-mono text-label text-gray-9">{cell.label}</figcaption>
            {showSource ? (
              // The axis prop is pinned so the default-valued cell still prints
              // the prop the section is about.
              <CodeBlock
                copyable={false}
                className="p-3 text-meta"
                code={generateSnippet(component, playground.controls, cell.values, [section.prop]).code}
              />
            ) : null}
          </figure>
        ))}
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
      <h2 className="font-sans text-label font-medium uppercase tracking-wider text-gray-11">
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
    <section className="rounded-lg border border-red-9 bg-red-3 p-4 font-mono text-meta text-red-9">
      {path}: {error}
    </section>
  );
}
