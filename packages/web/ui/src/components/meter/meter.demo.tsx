import { definePlayground, number, select } from '../../gallery';
import { TONE_NAMES } from '../../style/tones';
import { Meter } from './meter';

export const meta = { title: 'Meter', group: 'Components', size: 'sm' };

export const states = [
  {
    name: 'Values',
    render: () => (
      <div className="flex w-48 flex-col gap-2.5">
        <Meter value={0} />
        <Meter value={34} />
        <Meter value={100} />
      </div>
    ),
  },
  {
    name: 'Tones',
    render: () => (
      <div className="flex w-48 flex-col gap-2.5">
        {TONE_NAMES.map((tone) => (
          <Meter key={tone} value={60} tone={tone} />
        ))}
      </div>
    ),
  },
  {
    name: 'Thresholds',
    render: () => (
      <div className="flex w-48 flex-col gap-2.5">
        <Meter value={60} warnAt={80} dangerAt={95} />
        <Meter value={85} warnAt={80} dangerAt={95} />
        <Meter value={97} warnAt={80} dangerAt={95} />
      </div>
    ),
  },
  {
    name: 'Label + trailing',
    render: () => (
      <div className="flex w-48 flex-col gap-2.5">
        <Meter value={1.06} max={5} label="$1.06" trailing="/ $5.00" />
        <Meter value={72_000} max={200_000} label="▣" trailing="72k / 200k" />
      </div>
    ),
  },
];

export const playground = definePlayground({
  docs: {
    summary:
      'A single horizontal bar for a value against a ceiling — spend against a cap, tasks against a total. The track clamps out-of-range values rather than overflowing, so a runaway number stays inside its row.',
  },
  controls: {
    size: select(['sm', 'md', 'lg'] as const, { initial: 'md', type: 'MeterSize' }),
    value: number(34, {
      min: -20,
      max: 150,
      step: 1,
      required: true,
      description:
        'Current amount. Values below zero or above `max` are clamped for drawing; the number you pass is still what a label reports.',
    }),
    max: number(100, {
      min: 1,
      max: 200,
      step: 1,
      description: 'The ceiling the value is measured against.',
    }),
    tone: select(TONE_NAMES, {
      initial: 'primary',
      type: 'Tone',
      description: 'Fill colour while the value sits below both thresholds.',
    }),
    warnAt: number(80, {
      min: 0,
      max: 200,
      step: 1,
      label: 'warnAt (0 = off)',
      description:
        'Value at which the fill turns to the `warning` tone. Leave it unset for a bar that never changes colour.',
    }),
    dangerAt: number(95, {
      min: 0,
      max: 200,
      step: 1,
      label: 'dangerAt (0 = off)',
      description: 'Value at which the fill turns to the `danger` tone. Takes precedence over `warnAt`.',
    }),
  },
  render: (v) => (
    <div className="w-48">
      <Meter
        value={v.value}
        max={v.max}
        tone={v.tone}
        warnAt={v.warnAt || undefined}
        dangerAt={v.dangerAt || undefined}
      />
    </div>
  ),
});
