import { useMemo, useState, type ReactNode } from 'react';
import {
  DEFAULT_VIEW,
  extractStateSources,
  Tabs,
  type StateView,
  type AnyControlDef,
  type AnyPlayground,
  type CollectedDemo,
  type CollectedState,
  type ControlValues,
} from '@tickets/ui';
import { CodeBlock } from '../../code/code-block';
import { generateSnippet } from '../../code/code-snippet';
import { deriveAxes, type AxisSection } from '../state-axes';

type LiveDemo = Extract<CollectedDemo, { slug: string }>;

const CAPTION = 'font-mono text-11/13 tracking-wider uppercase tracking-widest text-gray-9';

type SectionView = 'preview' | 'source';

const VIEWS = [
  { value: 'preview', label: 'Preview' },
  { value: 'source', label: 'Source' },
];

/**
 * The frame every section shares: a card, its title, and the Preview/Source
 * tabs. It contributes NO layout to the preview — a derived axis brings its
 * own row and an authored section brings whatever components its render body
 * uses, which is the point of those being components rather than a `layout`
 * prop the frame would resolve invisibly.
 *
 * A section is as tall as its states: scrolling one vertically hides specimens
 * behind an interaction, and a states list you have to scroll inside to read
 * is not a states list. Width is the one axis that gets a scrollbar — a wide
 * matrix should not force the page itself sideways.
 */
function SectionCard({
  id,
  title,
  preview,
  source,
}: {
  id: string;
  title: string;
  preview: ReactNode;
  source: string | null;
}) {
  const [view, setView] = useState<SectionView>('preview');
  const showing = source === null ? 'preview' : view;
  return (
    <section
      id={id}
      className="flex w-full flex-col gap-3 rounded-lg border border-gray-6 bg-surface-raised px-3.5 py-3"
    >
      <header className="flex items-center justify-between gap-4">
        <span className={CAPTION}>{title}</span>
        {/* A real tablist, not a toggle group: each item genuinely swaps the
            panel below for another one, which is exactly the promise the role
            makes. Hidden entirely when there is no source to swap to. */}
        {source !== null && (
          <Tabs
            variant="pill"
            size="sm"
            label={`${title} view`}
            items={VIEWS}
            value={showing}
            onChange={(next) => setView(next as SectionView)}
          />
        )}
      </header>
      <div role="tabpanel" aria-label={`${title} ${showing}`} className="overflow-x-auto">
        {showing === 'preview' ? preview : <CodeBlock code={source!} />}
      </div>
    </section>
  );
}

// One prop, every value it can take, laid out full-bleed. Sections stack down
// the page rather than tiling into a grid: an axis is read across, comparing
// siblings that differ in exactly one prop, and a two-column grid puts half of
// them on a different line at a different width.
function AxisCard({
  section,
  playground,
  component,
}: {
  section: AxisSection;
  playground: AnyPlayground;
  component: string;
}) {
  return (
    <SectionCard
      id={section.slug}
      title={section.prop}
      preview={
        /* `items-end`, so the captions of a row share one baseline and the
           specimens hang above it. A size axis is exactly the case that breaks
           under `items-start`: the tallest rung pushes its own caption down and
           the labels stagger, reading as misalignment not scale. */
        <div className="flex flex-wrap items-end gap-x-5 gap-y-4">
          {section.cells.map((cell) => (
            <figure key={cell.slug} id={cell.slug} className="m-0 flex min-w-0 flex-col gap-2">
              {/* Same contravariance gap MatrixMode hits: the values are built
                  generically, so they are asserted back into the concrete shape
                  this playground's render declares. */}
              <div className="flex min-h-9 items-center">
                {playground.render(cell.values as ControlValues<Record<string, AnyControlDef>>)}
              </div>
              <figcaption className="font-mono text-11/13 tracking-wider text-gray-9">
                {cell.label}
              </figcaption>
            </figure>
          ))}
        </div>
      }
      // One block, one line per cell, in the same order the specimens appear.
      // Seventeen separate blocks down a tone axis would be a stack of chrome
      // around one line of code each, and this is also what you would actually
      // paste. The axis prop is pinned so the default-valued cell still prints
      // the prop the section is about, rather than collapsing to `<Button />`.
      source={section.cells
        .map(
          (cell) => generateSnippet(component, playground.controls, cell.values, [section.prop]).code,
        )
        .join('\n')}
    />
  );
}

// An authored section renders exactly what its `render` returns — the frame
// adds nothing around it. Its source is the render body lifted out of the demo
// file's own text, so the layout components in it are visible rather than
// implied.
function AuthoredCard({
  state,
  source,
  view,
}: {
  state: CollectedState;
  source: string | null;
  view: StateView;
}) {
  return (
    <SectionCard id={state.slug} title={state.name} preview={state.render(view)} source={source} />
  );
}

// Demos that have neither authored `defineState` sections nor a playground —
// a handful of Foundation pages — keep rendering their plain literals. There
// is no source to show and no axis to derive, so this is the whole card.
function LegacyStates({ demo }: { demo: LiveDemo }) {
  return (
    <div className="flex flex-col gap-2.5">
      {demo.states.map((state) => (
        <figure
          key={state.slug}
          id={state.slug}
          className="m-0 flex w-full flex-col gap-3 rounded-lg border border-gray-6 bg-surface-raised px-3.5 py-3"
        >
          <figcaption className={CAPTION}>{state.name}</figcaption>
          <div className="flex w-full min-w-0 max-w-full items-center overflow-x-auto">
            {state.render(DEFAULT_VIEW)}
          </div>
        </figure>
      ))}
    </div>
  );
}

/**
 * One component's demo: heading, then one full-width section per state.
 *
 * Which states those are is a three-way call, and the order matters. Sections
 * a demo AUTHORED win — that is what `defineState` opts into, one demo at a
 * time. Otherwise the playground's enumerable props are derived into axes.
 * Only a demo with neither falls back to its plain literals.
 *
 * Section and cell ids are the screenshot/deep-link anchors
 * (`#button--variant`, `#button--variant-solid`).
 */
export function StateGrid({
  demo,
  source,
  view = DEFAULT_VIEW,
}: {
  demo: LiveDemo;
  source?: string;
  view?: StateView;
}) {
  const authored = demo.states.filter((state) => state.defined);
  const sources = useMemo(() => (source ? extractStateSources(source) : {}), [source]);
  const sections = demo.playground && authored.length === 0 ? deriveAxes(demo.playground.controls, demo.slug) : [];
  const component = demo.meta.title.replace(/\s+/g, '');
  return (
    <section id={demo.slug} className="flex flex-col gap-3">
      <h2 className="font-sans text-11/13 tracking-wider font-500 uppercase tracking-wider text-gray-11">
        {demo.meta.title}
      </h2>
      <div className="flex flex-col gap-2.5">
        <div className={CAPTION}>STATES</div>
        {authored.length > 0 ? (
          <div className="flex flex-col gap-2.5">
            {authored.map((state) => (
              <AuthoredCard
                key={state.slug}
                state={state}
                source={sources[state.name] ?? null}
                view={view}
              />
            ))}
          </div>
        ) : sections.length > 0 && demo.playground ? (
          <div className="flex flex-col gap-2.5">
            {sections.map((section) => (
              <AxisCard
                key={section.prop}
                section={section}
                playground={demo.playground!}
                component={component}
              />
            ))}
          </div>
        ) : (
          <LegacyStates demo={demo} />
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
