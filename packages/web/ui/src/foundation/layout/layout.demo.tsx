import { useEffect, useState } from 'react';
import { BORDERS, BREAKPOINTS, LAYERS, RINGS } from '../spec';
import { DriftView, Sheet, SpecHeader, SpecRow } from '../view';

export const meta = {
  title: 'Layout',
  group: 'Foundation',
  order: 6,
  size: 'full',
  impl: ['./foundation.ts', './foundation-view.tsx'],
};

const BORDER_JOBS: Record<string, string> = {
  'border-thin': 'dividers, table rules',
  'border-thick': 'inputs, cards — edges you act on',
};

const LAYER_JOBS: Record<string, string> = {
  'z-sticky': 'pinned headers, toolbars',
  'z-scrim': 'the dim behind a dialog',
  'z-overlay': 'dialogs, menus, toasts',
};

function Edges() {
  const ring = RINGS.find((r) => r.name === 'ring-focus')!;
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
          <div className="flex items-center gap-4">
            <span
              className="h-10 w-40 rounded-md border-gray-6 bg-surface-raised"
              style={{ borderStyle: 'solid', borderWidth: border.value }}
            />
            {/* A rule on its own, where the weight difference is easiest to
                judge — a box's four edges hide a half-pixel, one line does not. */}
            <span
              className="w-40 bg-gray-6"
              style={{ height: border.value }}
            />
          </div>
        </SpecRow>
      ))}
      <SpecRow name={ring.name} value={ring.value} note="keyboard focus, all controls">
        <div className="flex items-center gap-4">
          <button
            type="button"
            className="rounded-md border border-gray-6 bg-surface-raised px-3 py-1 font-sans text-ui text-gray-12 outline-none focus-visible:ring-(length:--ring-focus) focus-visible:ring-indigo-9"
          >
            Tab to me
          </button>
          <span className="font-sans text-meta text-gray-9">
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
      <div className="relative mt-2 h-44 overflow-hidden rounded-xl bg-gray-1">
        <div
          className="absolute inset-x-4 top-4 flex h-10 items-center rounded-lg border border-gray-6 bg-surface-raised px-3 font-mono text-meta text-gray-11"
          style={{ zIndex: Number(LAYERS.find((l) => l.name === 'z-sticky')!.value) }}
        >
          z-sticky · pinned header
        </div>
        <div
          className="absolute inset-0 bg-black/40"
          style={{ zIndex: Number(LAYERS.find((l) => l.name === 'z-scrim')!.value) }}
        />
        <div
          className="absolute inset-x-16 top-16 flex h-20 items-center justify-center rounded-xl bg-surface-raised font-mono text-meta text-gray-12"
          style={{ zIndex: Number(LAYERS.find((l) => l.name === 'z-overlay')!.value) }}
        >
          z-overlay · dialog
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
  const narrow = Number.parseInt(BREAKPOINTS.find((b) => b.name === 'breakpoint-narrow')!.value, 10);
  const wide = Number.parseInt(BREAKPOINTS.find((b) => b.name === 'breakpoint-wide')!.value, 10);
  const band = width < narrow ? 'below narrow' : width < wide ? 'narrow' : 'wide';
  return (
    <Sheet>
      <SpecHeader specimen="what changes at this width" />
      <SpecRow
        name="breakpoint-narrow"
        value={`${narrow}px`}
        note="rail collapses to icons"
      >
        <span className="font-sans text-meta text-gray-11">
          Below this, the board drops to a single column and the detail pane becomes a sheet.
        </span>
      </SpecRow>
      <SpecRow name="breakpoint-wide" value={`${wide}px`} note="detail pane pins open">
        <span className="font-sans text-meta text-gray-11">
          Above this, the detail pane stays open beside the board instead of replacing it.
        </span>
      </SpecRow>
      {/* A ruler, so the two numbers have somewhere to sit relative to the
          window they describe. */}
      <div className="mt-2 flex flex-col gap-2">
        <div className="relative h-8 overflow-hidden rounded-md bg-surface-inset">
          <span
            className="absolute inset-y-0 left-0 bg-indigo-3"
            style={{ width: `${Math.min(100, (width / wide) * 100)}%` }}
          />
          <span
            className="absolute inset-y-0 w-px bg-indigo-9"
            style={{ left: `${(narrow / wide) * 100}%` }}
          />
        </div>
        <span className="font-mono text-meta text-gray-9">
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
  { name: 'Drift', render: () => <DriftView families={['border', 'ring', 'z', 'breakpoint']} /> },
];
