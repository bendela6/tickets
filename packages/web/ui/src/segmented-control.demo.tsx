import { useState, type ReactNode } from 'react';
import { definePlayground, number } from './gallery';
import { SegmentedControl } from './segmented-control';
import type { IconName } from './icons/icon';

type Option = { value: string; label?: ReactNode; icon?: IconName };

const LABELED: Option[] = [
  { value: 'board', label: 'Board' },
  { value: 'table', label: 'Table' },
];

const ICON_ONLY: Option[] = [
  { value: 'columns', icon: 'columns' },
  { value: 'rows', icon: 'rows' },
];

const WITH_COUNTS: Option[] = [
  { value: 'open', label: <>Open <span className="font-mono text-[11px] text-ink-3">12</span></> },
  { value: 'resolved', label: <>Resolved <span className="font-mono text-[11px] text-ink-3">0</span></> },
];

function DemoSegmentedControl({ options }: { options: Option[] }) {
  const [value, setValue] = useState(options[0]!.value);
  return <SegmentedControl options={options} value={value} onChange={setValue} />;
}

export const meta = { title: 'SegmentedControl', group: 'Display', size: 'md' };

export const states = [
  { name: 'Labeled', render: () => <DemoSegmentedControl options={LABELED} /> },
  { name: 'Icon only', render: () => <DemoSegmentedControl options={ICON_ONLY} /> },
  { name: 'With counts', render: () => <DemoSegmentedControl options={WITH_COUNTS} /> },
];

function PlaygroundFixture({ count }: { count: number }) {
  const items: Option[] = [...LABELED, { value: 'timeline', label: 'Timeline' }].slice(0, count);
  const [value, setValue] = useState(items[0]!.value);
  return (
    <SegmentedControl
      options={items}
      value={items.some((item) => item.value === value) ? value : items[0]!.value}
      onChange={setValue}
    />
  );
}

export const playground = definePlayground({
  docs: {
    summary:
      'A two-or-three-way switch between views of the same thing — never a navigation control. Options are pressed buttons, not tabs: reach for `Tabs` when the choice swaps the panel underneath.',
  },
  controls: {
    count: number(2, {
      min: 2,
      max: 3,
      step: 1,
      label: 'Options',
      description:
        'Demo knob, not a prop — it slices the fixture’s `options` array. Past three segments the control stops reading as a switch; use a select instead.',
    }),
  },
  render: (v) => <PlaygroundFixture count={v.count} />,
});
