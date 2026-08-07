import { Sheet, SpecHeader, SpecRow } from '../view';

export const meta = {
  title: 'Radius',
  order: 3,
  size: 'full',
  impl: ['../spec.ts', '../view.tsx'],
};

/**
 * The rungs the design sanctions — NOT the rungs that compile.
 *
 * `rounded-<n>` is n pixels for any integer, the way `p-16` is 16px, so this
 * list is an agreement rather than a constraint. It is short on purpose: a
 * radius is only legible in relation to the box it rounds, and 4px on a chip
 * reads as the same softness as 12px on a panel, while 4 and 5 on the SAME box
 * read as a mistake. Six rungs, and 3/4/5 only ever appear on the three
 * form-control heights they were drawn for.
 *
 * Declared here rather than in a token file, for the reason `layout.demo.tsx`
 * gives about border and ring: with nothing to emit and nothing to clear, a
 * token file could only describe this agreement, never enforce it — and this
 * page was its only reader. `border.tokens.json` was deleted on 2026-08-07.
 * The agreement lives where it is read.
 */
const RADII = [3, 4, 5, 6, 8, 12];
const ROWS = RADII.map((n) => ({ name: `rounded-${n}`, value: `${n}px` }));

const RADIUS_JOBS: Record<string, string> = {
  'rounded-3': 'xs form controls — 30px fields',
  'rounded-4': 'chips, tags, inline marks · md fields',
  'rounded-5': 'lg form controls — 46px fields',
  'rounded-6': 'buttons, tabs, menu rows',
  'rounded-8': 'cards, list rows, popovers',
  'rounded-12': 'panels, dialogs, sheets',
};

/** The rung's utility class, written out rather than interpolated: the scanner
 *  only finds literals, and the specimen must demonstrate the CLASS, not a
 *  number that happens to equal it — otherwise the page can be right while the
 *  scale is broken. */
const RADIUS_CLASS: Record<string, string> = {
  'rounded-3': 'rounded-3',
  'rounded-4': 'rounded-4',
  'rounded-5': 'rounded-5',
  'rounded-6': 'rounded-6',
  'rounded-8': 'rounded-8',
  'rounded-12': 'rounded-12',
};

function Scale() {
  return (
    <Sheet>
      <p className="font-sans text-13/19 text-gray-11">
        <span className="font-mono text-12/17 text-gray-12">rounded-6</span> is 6px — the class
        states the value, the way <span className="font-mono text-12/17 text-gray-12">border-2</span>{' '}
        and <span className="font-mono text-12/17 text-gray-12">p-16</span> do. Any integer
        compiles; the six below are the ones the design uses.
      </p>
      <SpecHeader specimen="corner at 4× · in place" />
      {ROWS.map((radius) => (
        <SpecRow key={radius.name} name={radius.name} value={radius.value} note={RADIUS_JOBS[radius.name]}>
          <div className="flex items-center gap-16">
            {/* One corner, magnified 4×. At real size the difference between
                6px and 8px is a couple of pixels of arc; blown up, the ramp is
                obvious. The other three corners stay square so the eye has a
                right angle to measure the curve against. */}
            <span
              className="size-64 border-1 border-indigo-9 bg-indigo-3"
              style={{ borderTopLeftRadius: `calc(${radius.value} * 4)` }}
            />
            <span
              className={`flex h-64 flex-1 items-center justify-center border-1 border-gray-6 bg-surface-raised font-mono text-12/17 text-gray-9 ${RADIUS_CLASS[radius.name]}`}
            >
              {radius.value}
            </span>
          </div>
        </SpecRow>
      ))}
    </Sheet>
  );
}

function InUse() {
  return (
    <Sheet>
      <div className="flex flex-wrap items-start gap-24">
        <div className="flex flex-col gap-8">
          <span className="font-mono text-9/12 uppercase tracking-widest text-gray-9">
            rounded-4 · chip
          </span>
          <span className="inline-flex h-22 items-center rounded-4 bg-indigo-3 px-9 font-sans text-12/17 font-500 text-indigo-9">
            blocked
          </span>
        </div>
        <div className="flex flex-col gap-8">
          <span className="font-mono text-9/12 uppercase tracking-widest text-gray-9">
            rounded-6 · button
          </span>
          <span className="inline-flex h-28 items-center rounded-6 border-1 border-gray-6 bg-surface-raised px-12 font-sans text-13/19 text-gray-12">
            Assign
          </span>
        </div>
        <div className="flex flex-col gap-8">
          <span className="font-mono text-9/12 uppercase tracking-widest text-gray-9">
            rounded-8 · card
          </span>
          <div className="flex w-224 flex-col gap-4 rounded-8 border-1 border-gray-6 bg-surface-raised p-12">
            <span className="font-sans text-13/19 font-500 text-gray-12">Retry the gateway run</span>
            <span className="font-mono text-12/17 text-gray-9">TIX-214 · in review</span>
          </div>
        </div>
        <div className="flex flex-col gap-8">
          <span className="font-mono text-9/12 uppercase tracking-widest text-gray-9">
            rounded-12 · panel
          </span>
          <div className="flex w-256 flex-col gap-8 rounded-12 border-1 border-gray-6 bg-surface-raised p-16">
            <span className="font-sans text-16/22 font-500 text-gray-12">Discard changes?</span>
            <span className="font-sans text-13/19 text-gray-11">
              Three edits will be lost. This cannot be undone.
            </span>
          </div>
        </div>
      </div>
    </Sheet>
  );
}

export const states = [
  { name: 'Scale', render: () => <Scale /> },
  { name: 'In use', render: () => <InUse /> },
];
