import { useEffect, useState } from 'react';
import { BREAKPOINTS } from '../../generated';
import { NativeNote, Sheet, SpecHeader, SpecRow } from '../view';

/**
 * Border widths, ring widths and z-index rungs, declared here rather than in a
 * token file.
 *
 * They had one (`layout.tokens.json`) until 2026-08-04. It was deleted because
 * it could not do the job a token file exists to do: Tailwind has no
 * `--border-width-*`, `--ring-*` or `--z-*` theme namespace, so these are
 * bare-value utilities — the number in the class IS the value. Measured:
 * `border-7`, `ring-42` and `z-999` all compile. There was nothing to emit and
 * nothing to clear, so the file could only ever describe an agreement, never
 * enforce one — and this page was its only reader.
 *
 * So the agreement lives where it is read. Fractions do not compile
 * (`border-3.5` emits nothing), which is the one constraint Tailwind does give.
 */
const BORDERS = [1, 2, 3, 4, 5].map((n) => ({ name: `border-${n}`, value: `${n}px` }));
const RINGS = [1, 2, 3, 4, 5].map((n) => ({ name: `ring-${n}`, value: `${n}px` }));
const LAYERS = [0, 10, 20, 30, 40, 50].map((n) => ({ name: `z-${n}`, value: `${n}` }));

export const meta = {
  title: 'Layout',
  group: 'Foundation',
  order: 6,
  size: 'full',
  impl: ['./foundation.ts', './foundation-view.tsx'],
};

const BORDER_JOBS: Record<string, string> = {
  'border-1': 'dividers, table rules, inputs, cards',
  'border-2': 'outline controls — edges you act on',
};

const LAYER_JOBS: Record<string, string> = {
  'z-10': 'pinned headers, toolbars',
  'z-40': 'the dim behind a dialog',
  'z-50': 'dialogs, menus, toasts',
};

const BORDER_CLASS: Record<string, string> = { 'border-1': 'border-1', 'border-2': 'border-2' };

function Edges() {
  const ring = RINGS.find((r) => r.name === 'ring-3')!;
  return (
    <Sheet>
      <SpecHeader specimen="drawn against the page" />
      {BORDERS.map((border) => (
        <SpecRow
          key={border.name}
          name={border.name}
          value={border.value}
          note={BORDER_JOBS[border.name]}
        >
          <div className="flex items-center gap-16">
            <span
              className={`h-40 w-160 rounded-md border-solid border-gray-6 bg-surface-raised ${BORDER_CLASS[border.name]}`}
            />
            {/* A rule on its own, where the weight difference is easiest to
                judge — a box's four corners and anti-aliasing make 1px vs 2px
                harder to compare at a glance than a single straight line. */}
            <span
              className="w-160 bg-gray-6"
              style={{ height: border.value }}
            />
          </div>
        </SpecRow>
      ))}
      <SpecRow name={ring.name} value={ring.value} note="keyboard focus, all controls">
        <div className="flex items-center gap-16">
          <button
            type="button"
            className="rounded-md border-1 border-gray-6 bg-surface-raised px-12 py-4 font-sans text-13/19 text-gray-12 outline-none focus-visible:ring-3 focus-visible:ring-indigo-9"
          >
            Tab to me
          </button>
          <span className="font-sans text-12/17 text-gray-9">
            Focus this with the keyboard — the ring is the token, live.
          </span>
        </div>
      </SpecRow>
    </Sheet>
  );
}

function Layers() {
  return (
    <Sheet>
      <SpecHeader specimen="what sits above what" />
      {LAYERS.map((layer) => (
        <SpecRow key={layer.name} name={layer.name} value={layer.value} note={LAYER_JOBS[layer.name]} />
      ))}
      {/* The three planes in one stack, at their real z-index, so the order is
          demonstrated rather than asserted. */}
      <div className="relative mt-8 h-176 overflow-hidden rounded-xl bg-gray-1">
        <div
          className="absolute inset-x-16 top-16 flex h-40 items-center rounded-lg border-1 border-gray-6 bg-surface-raised px-12 font-mono text-12/17 text-gray-11"
          style={{ zIndex: Number(LAYERS.find((l) => l.name === 'z-10')!.value) }}
        >
          z-10 · pinned header
        </div>
        <div
          className="absolute inset-0 bg-black/40"
          style={{ zIndex: Number(LAYERS.find((l) => l.name === 'z-40')!.value) }}
        />
        <div
          className="absolute inset-x-64 top-64 flex h-80 items-center justify-center rounded-xl bg-surface-raised font-mono text-12/17 text-gray-12"
          style={{ zIndex: Number(LAYERS.find((l) => l.name === 'z-50')!.value) }}
        >
          z-50 · dialog
        </div>
      </div>
    </Sheet>
  );
}

function useViewportWidth(): number {
  const [width, setWidth] = useState(() =>
    typeof window === 'undefined' ? 0 : window.innerWidth,
  );
  useEffect(() => {
    const read = () => setWidth(window.innerWidth);
    read();
    window.addEventListener('resize', read);
    return () => window.removeEventListener('resize', read);
  }, []);
  return width;
}

function Breakpoints() {
  const width = useViewportWidth();
  const breakpointLg = BREAKPOINTS.lg;
  const breakpoint2xl = BREAKPOINTS['2xl'];
  const band =
    width < breakpointLg
      ? 'below breakpoint-lg'
      : width < breakpoint2xl
        ? 'breakpoint-lg'
        : 'breakpoint-2xl';
  return (
    <Sheet>
      <SpecHeader specimen="what changes at this width" />
      <SpecRow
        name="breakpoint-lg"
        value={`${breakpointLg}px`}
        note="rail collapses to icons"
      >
        <span className="font-sans text-12/17 text-gray-11">
          Below this, the board drops to a single column and the detail pane becomes a sheet.
        </span>
      </SpecRow>
      <SpecRow name="breakpoint-2xl" value={`${breakpoint2xl}px`} note="detail pane pins open">
        <span className="font-sans text-12/17 text-gray-11">
          Above this, the detail pane stays open beside the board instead of replacing it.
        </span>
      </SpecRow>
      {/* A ruler, so the two numbers have somewhere to sit relative to the
          window they describe. */}
      <div className="mt-8 flex flex-col gap-8">
        <div className="relative h-32 overflow-hidden rounded-md bg-surface-inset">
          <span
            className="absolute inset-y-0 left-0 bg-indigo-3"
            style={{ width: `${Math.min(100, (width / breakpoint2xl) * 100)}%` }}
          />
          <span
            className="absolute inset-y-0 w-px bg-indigo-9"
            style={{ left: `${(breakpointLg / breakpoint2xl) * 100}%` }}
          />
        </div>
        <span className="font-mono text-12/17 text-gray-9">
          viewport {width}px · {band}
        </span>
      </div>
    </Sheet>
  );
}

export const states = [
  { name: 'Borders & focus', render: () => <Edges /> },
  { name: 'Layers', render: () => <Layers /> },
  { name: 'Breakpoints', render: () => <Breakpoints /> },
  {
    name: 'Native',
    render: () => (
      <>
        <NativeNote family="border" />
        <NativeNote family="ring" />
        <NativeNote family="z" />
      </>
    ),
  },
];
