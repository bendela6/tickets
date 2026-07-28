import { RADII } from '../spec';
import { DriftView, Sheet, SpecHeader, SpecRow } from '../view';

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
  'radius-1': 'chips, tags, inline marks',
  'radius-2': 'buttons, inputs, controls',
  'radius-3': 'cards, list rows, popovers',
  'radius-4': 'panels, dialogs, sheets',
};

function Scale() {
  return (
    <Sheet>
      <SpecHeader specimen="corner at 4× · in place" />
      {RADII.map((radius) => (
        <SpecRow key={radius.name} name={radius.name} value={radius.value} note={RADIUS_JOBS[radius.name]}>
          <div className="flex items-center gap-4">
            {/* One corner, magnified 4×. At real size the difference between
                6px and 8px is a couple of pixels of arc; blown up, the ramp is
                obvious. The other three corners stay square so the eye has a
                right angle to measure the curve against. */}
            <span
              className="size-16 border border-indigo-9 bg-indigo-3"
              style={{ borderTopLeftRadius: `calc(${radius.value} * 4)` }}
            />
            <span
              className="flex h-16 flex-1 items-center justify-center border border-gray-6 bg-surface-raised font-mono text-meta text-gray-9"
              style={{ borderRadius: radius.value }}
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
  const radius = (step: string) => RADII.find((r) => r.name === step)!.value;
  return (
    <Sheet>
      <div className="flex flex-wrap items-start gap-6">
        <div className="flex flex-col gap-2">
          <span className="font-mono text-nano uppercase tracking-widest text-gray-9">
            radius-1 · chip
          </span>
          <span
            className="inline-flex h-5.5 items-center bg-indigo-3 px-2.25 font-sans text-meta font-500 text-indigo-9"
            style={{ borderRadius: radius('radius-1') }}
          >
            blocked
          </span>
        </div>
        <div className="flex flex-col gap-2">
          <span className="font-mono text-nano uppercase tracking-widest text-gray-9">
            radius-2 · control
          </span>
          <span
            className="inline-flex h-7 items-center border border-gray-6 bg-surface-raised px-3 font-sans text-ui text-gray-12"
            style={{ borderRadius: radius('radius-2') }}
          >
            Assign
          </span>
        </div>
        <div className="flex flex-col gap-2">
          <span className="font-mono text-nano uppercase tracking-widest text-gray-9">
            radius-3 · card
          </span>
          <div
            className="flex w-56 flex-col gap-1 border border-gray-6 bg-surface-raised p-3"
            style={{ borderRadius: radius('radius-3') }}
          >
            <span className="font-sans text-ui font-500 text-gray-12">Retry the gateway run</span>
            <span className="font-mono text-meta text-gray-9">TIX-214 · in review</span>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <span className="font-mono text-nano uppercase tracking-widest text-gray-9">
            radius-4 · panel
          </span>
          <div
            className="flex w-64 flex-col gap-2 border border-gray-6 bg-surface-raised p-4"
            style={{ borderRadius: radius('radius-4') }}
          >
            <span className="font-sans text-title font-500 text-gray-12">Discard changes?</span>
            <span className="font-sans text-ui text-gray-11">
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
  { name: 'Drift', render: () => <DriftView families={['radius']} /> },
];
