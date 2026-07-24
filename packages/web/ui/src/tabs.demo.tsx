import { useState } from 'react';
import { definePlayground, select, number } from './gallery';
import { Tabs } from './tabs';

const VARIANTS = ['underline', 'pill', 'rail'] as const;

const ALL_ITEMS = [
  { value: 'board', label: 'Board' },
  { value: 'table', label: 'Table', badge: <span>128</span> },
  { value: 'timeline', label: 'Timeline' },
  { value: 'calendar', label: 'Calendar' },
  { value: 'activity', label: 'Activity' },
];

function DemoTabs({ variant }: { variant: (typeof VARIANTS)[number] }) {
  const [value, setValue] = useState(ALL_ITEMS[0]!.value);
  return <Tabs variant={variant} items={ALL_ITEMS.slice(0, 3)} value={value} onChange={setValue} />;
}

export const meta = { title: 'Tabs', group: 'Display' };

export const states = [
  { name: 'Underline', render: () => <DemoTabs variant="underline" /> },
  { name: 'Pill', render: () => <DemoTabs variant="pill" /> },
  { name: 'Rail', render: () => <DemoTabs variant="rail" /> },
];

function PlaygroundFixture({ variant, count }: { variant: (typeof VARIANTS)[number]; count: number }) {
  const items = ALL_ITEMS.slice(0, count);
  const [value, setValue] = useState(items[0]!.value);
  return (
    <Tabs
      variant={variant}
      items={items}
      value={items.some((item) => item.value === value) ? value : items[0]!.value}
      onChange={setValue}
    />
  );
}

export const playground = definePlayground({
  controls: {
    variant: select(VARIANTS, { initial: 'underline' }),
    count: number(3, { min: 2, max: ALL_ITEMS.length, step: 1, label: 'Tabs' }),
  },
  render: (v) => <PlaygroundFixture variant={v.variant} count={v.count} />,
});
