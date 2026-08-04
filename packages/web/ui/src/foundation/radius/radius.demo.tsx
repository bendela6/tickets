import { RADII } from '../../generated';
import { specRows } from '../spec';
import { Sheet, SpecHeader, SpecRow } from '../view';

export const meta = {
  title: 'Radius',
  group: 'Foundation',
  order: 3,
  size: 'full',
  impl: ['./foundation.ts', './foundation-view.tsx'],
};

// What each step is for. Four steps rather than six because a radius is only
// legible in relation to the box it rounds — 4px on a chip and 12px on a panel
// read as the same softness, while 4 and 5 on the same box read as a mistake.
const RADIUS_JOBS: Record<string, string> = {
  'radius-sm': 'chips, tags, inline marks',
  'radius-md': 'buttons, inputs, controls',
  'radius-lg': 'cards, list rows, popovers',
  'radius-xl': 'panels, dialogs, sheets',
};

/** The rung's utility class. The specimen must demonstrate the class, not a
 *  number that happens to equal it — otherwise the page can be right while the
 *  scale is broken. */
const RADIUS_CLASS: Record<string, string> = {
  'radius-sm': 'rounded-sm',
  'radius-md': 'rounded-md',
  'radius-lg': 'rounded-lg',
  'radius-xl': 'rounded-xl',
};

function Scale() {
  return (
    <Sheet>
      <SpecHeader specimen="corner at 4× · in place" />
      {specRows('radius', RADII).map((radius) => (
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
            rounded-sm · chip
          </span>
          <span className="inline-flex h-22 items-center rounded-sm bg-indigo-3 px-9 font-sans text-12/17 font-500 text-indigo-9">
            blocked
          </span>
        </div>
        <div className="flex flex-col gap-8">
          <span className="font-mono text-9/12 uppercase tracking-widest text-gray-9">
            rounded-md · control
          </span>
          <span className="inline-flex h-28 items-center rounded-md border-1 border-gray-6 bg-surface-raised px-12 font-sans text-13/19 text-gray-12">
            Assign
          </span>
        </div>
        <div className="flex flex-col gap-8">
          <span className="font-mono text-9/12 uppercase tracking-widest text-gray-9">
            rounded-lg · card
          </span>
          <div className="flex w-224 flex-col gap-4 rounded-lg border-1 border-gray-6 bg-surface-raised p-12">
            <span className="font-sans text-13/19 font-500 text-gray-12">Retry the gateway run</span>
            <span className="font-mono text-12/17 text-gray-9">TIX-214 · in review</span>
          </div>
        </div>
        <div className="flex flex-col gap-8">
          <span className="font-mono text-9/12 uppercase tracking-widest text-gray-9">
            rounded-xl · panel
          </span>
          <div className="flex w-256 flex-col gap-8 rounded-xl border-1 border-gray-6 bg-surface-raised p-16">
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
