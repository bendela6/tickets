import { Fragment, useState, type ReactNode } from 'react';
import { cn } from '@tickets/ui/cn';
import { UI_SRC_ROOT, WEB_SRC_ROOT, type AnyControlDef, type CollectedDemo } from '@tickets/ui/gallery';

type LiveDemo = Extract<CollectedDemo, { slug: string }>;

// Design 1j: enums up to this many values print every option as a chip;
// larger sets print the first twelve plus a count and a way into the rest.
// (The design says "the twelve most-used" — we have no usage data, so it's
// declaration order, which is how the option list is authored anyway.)
const CHIP_CAP = 12;

// The design frames this panel at 860px with 28px side padding, so its rows
// measure 200px + 28px gap + 576px. The shell is full-bleed, so the measure
// has to be stated or documentation prose runs the width of the monitor —
// unreadable, and not what §1j draws. Exported so the All view can align its
// per-component heading and jump links to the same column.
export const DOCS_MEASURE = 'max-w-201';

const CHIP =
  'inline-flex h-5.5 items-center rounded-ctrl border border-hairline bg-raised px-2 font-mono text-label tracking-normal text-ink-2';
const META_LINE = 'flex flex-wrap gap-6 font-mono text-label tracking-normal text-ink-3';

// Which package a demo belongs to, for the API header's right column. Derived
// from the demo path rather than declared, so it can never drift.
function packageLabel(path: string): string {
  if (path.startsWith(`${UI_SRC_ROOT}/`)) return '@tickets/ui';
  if (path.startsWith(`${WEB_SRC_ROOT}/`)) return '@tickets/web';
  return path.split('/')[0] ?? path;
}

// The primitive name shown when a control doesn't declare a named type.
function derivedType(def: AnyControlDef): string {
  return def.kind === 'select' ? 'enum' : def.kind === 'text' ? 'string' : def.kind;
}

function defaultValue(def: AnyControlDef): string {
  if (def.kind === 'select') return def.initial ?? '—';
  if (def.kind === 'text') return def.initial || '—';
  return String(def.initial);
}

// Options rendered as chips. Selects list their values; a number lists its
// range as a single chip (design: "1 – 99"); booleans and free text have
// nothing to enumerate, and their rows simply skip the chip row.
function chipValues(def: AnyControlDef): string[] {
  if (def.kind === 'select') return [...def.options];
  if (def.kind === 'number' && (def.min !== undefined || def.max !== undefined)) {
    return [`${def.min ?? '…'} – ${def.max ?? '…'}`];
  }
  return [];
}

// Doc prose — both the API summary and each prop's description — renders
// `backticked` spans as inline code, matching the design's inline chip. Split
// on the delimiter and alternate: odd indices are the code spans. Code in
// documentation is always written in backticks, never quotes.
function prose(text: string): ReactNode[] {
  return text.split('`').map((part, i) =>
    i % 2 === 1 ? (
      <span
        key={i}
        className="rounded-chip bg-inset px-1.25 py-px font-mono text-ui text-ink"
      >
        {part}
      </span>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}

function OptionChips({ values }: { values: string[] }) {
  const [expanded, setExpanded] = useState(false);
  const overflowing = values.length > CHIP_CAP;
  const shown = overflowing && !expanded ? values.slice(0, CHIP_CAP) : values;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {shown.map((value) => (
        <span key={value} className={CHIP}>
          {value}
        </span>
      ))}
      {overflowing && !expanded && (
        <span className={cn(CHIP, 'border-transparent bg-inset text-ink-3')}>
          + {values.length - CHIP_CAP} more
        </span>
      )}
      {overflowing && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="ml-0.5 font-sans text-meta font-medium text-accent hover:underline"
        >
          {expanded ? 'Show fewer' : `Show all ${values.length}`}
        </button>
      )}
    </div>
  );
}

function PropRow({ name, def }: { name: string; def: AnyControlDef }) {
  const values = chipValues(def);
  const truncated = values.length > CHIP_CAP;

  return (
    <div className="grid grid-cols-[200px_1fr] gap-7 border-t border-hairline py-4.5">
      <div className="flex flex-col gap-1.5">
        <span className="font-mono text-ui font-semibold text-ink">{name}</span>
        <span className="font-mono text-label tracking-normal text-ink-3 text-pretty">
          {def.type ?? derivedType(def)}
        </span>
        <span
          className={cn(
            'inline-flex h-4.5 items-center self-start rounded-chip px-1.5 font-mono text-micro font-medium tracking-(--tracking-label)',
            def.required ? 'bg-accent-subtle text-accent' : 'bg-inset text-ink-3',
          )}
        >
          {def.required ? 'REQUIRED' : 'OPTIONAL'}
        </span>
      </div>
      <div className="flex min-w-0 flex-col gap-2.5">
        {def.description && (
          <div className="font-sans text-ui leading-[1.6] text-ink-2 text-pretty">
            {prose(def.description)}
          </div>
        )}
        {values.length > 0 && <OptionChips values={values} />}
        <div className={META_LINE}>
          <span>
            default <span className="text-ink">{defaultValue(def)}</span>
          </span>
          <span>
            {def.kind === 'select' && def.allowNone ? 'unsettable' : 'not unsettable'}
          </span>
          {truncated && <span>enum · {values.length} values</span>}
        </div>
      </div>
    </div>
  );
}

// The Docs tab (design docs/design/pulls/playground-workbench.dc.html §1j) —
// API documentation rather than a spreadsheet: an API header, then one
// definition-list row per prop (name/type/badge on the left, prose, options
// and defaults on the right).
//
// The same panel runs under each component in the All view, where there is no
// controls rail — hence `railNote`, which drops the closing note rather than
// letting it point at a rail that isn't on screen.
export function DocsPanel({ demo, railNote = true }: { demo: LiveDemo; railNote?: boolean }) {
  const { playground } = demo;
  if (!playground) {
    return (
      <p className="font-sans text-meta text-ink-3">This component has no playground controls.</p>
    );
  }
  const docs = playground.docs;

  return (
    <div className={cn('flex flex-col', DOCS_MEASURE)}>
      <div className="mt-5.5 mb-1.5 flex items-start justify-between gap-8">
        <div className="flex max-w-130 flex-col gap-2">
          <span className="font-mono text-micro font-medium tracking-(--tracking-mono-label) text-ink-3">
            API
          </span>
          {docs?.summary ? (
            <div className="font-sans text-body leading-[1.65] text-ink-2 text-pretty">
              {prose(docs.summary)}
            </div>
          ) : (
            <div className="font-sans text-body leading-[1.65] text-ink-3 text-pretty">
              Props marked unsettable fall back to the component default and are omitted from
              generated code.
            </div>
          )}
        </div>
        <div className="flex flex-none flex-col gap-1.5 font-mono text-label tracking-normal text-ink-3">
          <span>{packageLabel(demo.path)}</span>
          {docs?.version && <span>{docs.version}</span>}
          {docs?.status && <span className="text-opt-green">{docs.status}</span>}
        </div>
      </div>

      {Object.entries(playground.controls).map(([name, def]) => (
        <PropRow key={name} name={name} def={def} />
      ))}

      {railNote && (
        <div className="mt-5.5 flex gap-2.5 rounded-card bg-opt-green-subtle px-3.5 py-3.25">
          <span className="mt-px inline-flex size-4 flex-none items-center justify-center rounded-full bg-opt-green font-sans text-nano font-semibold text-on-opt-green">
            i
          </span>
          <span className="font-sans text-meta leading-[1.55] text-opt-green text-pretty">
            Every prop on this page is wired to the controls rail — edit a value there and the code
            on the Preview tab regenerates.
          </span>
        </div>
      )}
    </div>
  );
}
