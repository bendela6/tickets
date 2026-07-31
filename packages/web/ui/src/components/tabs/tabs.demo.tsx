import { useState } from 'react';
import { definePlayground, select, number } from '../../gallery';
import { TONE_NAMES } from '../../style';
import { Tabs } from './tabs';

const VARIANTS = ['underline', 'pill', 'rail', 'segment'] as const;
const SIZES = ['sm', 'md', 'lg'] as const;
const ROLES = ['tablist', 'group'] as const;

const ALL_ITEMS = [
  { value: 'board', label: 'Board' },
  { value: 'table', label: 'Table', badge: <span>128</span> },
  { value: 'timeline', label: 'Timeline' },
  { value: 'calendar', label: 'Calendar' },
  { value: 'activity', label: 'Activity' },
];

function DemoTabs({
  variant,
  size,
  role,
  showPrevious,
}: {
  variant: (typeof VARIANTS)[number];
  size?: (typeof SIZES)[number];
  role?: (typeof ROLES)[number];
  showPrevious?: boolean;
}) {
  const items = ALL_ITEMS.slice(0, 3);
  const [value, setValue] = useState(items[0]!.value);
  const [previous, setPrevious] = useState<string | undefined>(undefined);
  return (
    <Tabs
      variant={variant}
      size={size}
      role={role}
      items={items}
      value={value}
      previousValue={showPrevious ? (previous ?? items[2]!.value) : undefined}
      onChange={(next) => {
        setPrevious(value);
        setValue(next);
      }}
    />
  );
}

export const meta = { title: 'Tabs', group: 'Components', size: 'md' };

export const states = [
  { name: 'Underline', render: () => <DemoTabs variant="underline" /> },
  { name: 'Pill', render: () => <DemoTabs variant="pill" /> },
  { name: 'Rail', render: () => <DemoTabs variant="rail" /> },
  { name: 'Segment', render: () => <DemoTabs variant="segment" role="group" /> },
  {
    name: 'Segment · came from',
    render: () => <DemoTabs variant="segment" role="group" showPrevious />,
  },
  {
    name: 'Sizes',
    render: () => (
      <div className="flex flex-col gap-3">
        {SIZES.map((size) => (
          <DemoTabs key={size} variant="pill" size={size} />
        ))}
      </div>
    ),
  },
  {
    // What SegmentedControl used to be: same pixels, different semantics.
    name: 'Toggle group',
    render: () => <DemoTabs variant="pill" role="group" />,
  },
];

function PlaygroundFixture({
  variant,
  size,
  role,
  tone,
  count,
}: {
  variant: (typeof VARIANTS)[number];
  size: (typeof SIZES)[number];
  role: (typeof ROLES)[number];
  tone?: (typeof TONE_NAMES)[number];
  count: number;
}) {
  const items = ALL_ITEMS.slice(0, count);
  const [value, setValue] = useState(items[0]!.value);
  return (
    <Tabs
      variant={variant}
      size={size}
      role={role}
      tone={tone}
      items={items}
      value={items.some((item) => item.value === value) ? value : items[0]!.value}
      onChange={setValue}
    />
  );
}

export const playground = definePlayground({
  docs: {
    summary:
      'One strip for three shapes, and for both kinds of choice. The variants are visual placement only; `role` is what changes the semantics — `tablist` promises a panel behind each item, `group` is a set of toggles that change something in place.',
  },
  controls: {
    variant: select(VARIANTS, {
      initial: 'underline',
      type: 'TabsVariant',
      description:
        '`underline` for the tabs at the top of a pane, `pill` for a compact inline switch, `rail` for a vertical sidebar list, `segment` for a hairline group of mono values that sits on the page ground.',
    }),
    size: select(SIZES, {
      initial: 'md',
      type: 'TabsSize',
      description: 'Padding and label size. Each variant pads to suit its own shape.',
    }),
    role: select(ROLES, {
      initial: 'tablist',
      type: 'TabsRole',
      description:
        'Pick `group` when the items change something in place — a density, a filter, a view mode — rather than revealing a panel. It swaps role="tab"/aria-selected for plain buttons with aria-pressed.',
    }),
    tone: select([...TONE_NAMES], {
      allowNone: true,
      type: 'Tone',
      description: 'Which ramp the active item paints from. Defaults to `primary`.',
    }),
    count: number(3, {
      min: 2,
      max: ALL_ITEMS.length,
      step: 1,
      label: 'Tabs',
      description:
        'Demo knob, not a prop — it slices the fixture’s `items` array so you can see how the strip handles more entries.',
    }),
  },
  render: (v) => (
    <PlaygroundFixture
      variant={v.variant}
      size={v.size}
      role={v.role}
      tone={v.tone}
      count={v.count}
    />
  ),
});
