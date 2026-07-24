import { definePlayground, number, select } from './gallery';
import { TONE_NAMES } from './tones';
import { Meter } from './meter';

export const meta = { title: 'Meter', group: 'Display', size: 'sm' };

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
  controls: {
    value: number(34, { min: -20, max: 150, step: 1 }),
    max: number(100, { min: 1, max: 200, step: 1 }),
    tone: select(TONE_NAMES, { initial: 'primary' }),
    warnAt: number(80, { min: 0, max: 200, step: 1, label: 'warnAt (0 = off)' }),
    dangerAt: number(95, { min: 0, max: 200, step: 1, label: 'dangerAt (0 = off)' }),
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
