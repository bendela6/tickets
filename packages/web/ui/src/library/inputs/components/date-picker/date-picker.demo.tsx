import { useState } from 'react';
import {
  boolean,
  defineState,
  definePlayground,
  select,
  Slot,
  text,
  Wrap,
} from '../../../../gallery';
import { TONE_NAMES } from '../../../../style';
import { DatePicker, type DatePickerProps } from './date-picker';

// July 2026 for every specimen, so the sections differ by the one axis each is
// about rather than by whatever month the machine happens to be in.
const SELECTED = '2026-07-09T00:00:00Z';
const RANGE = { min: '2026-07-06', max: '2026-07-17' };

/** A picker that actually holds what you pick — every specimen is live. */
function Picker({
  initial = null,
  ...props
}: { initial?: string | null } & Omit<DatePickerProps, 'value' | 'onChange'>) {
  const [value, setValue] = useState<string | null>(initial);
  return (
    <div className="w-208">
      <DatePicker value={value} onChange={setValue} {...props} />
    </div>
  );
}

// The three things a date field can be holding. `outside` is the one worth
// drawing: the value predates the bound (an imported due date, a narrowed
// range) and the field still shows it — min/max govern what can be picked, not
// what can be held.
const CONTENT = [
  { label: 'empty · placeholder', props: {} },
  { label: 'selected', props: { initial: SELECTED } },
  { label: 'outside Jul 6–17', props: { initial: '2026-07-28T00:00:00Z', ...RANGE } },
] as const;

// Disabled and read-only are NOT two weights of the same thing: disabled drops
// the tab stop and the submitted value, read-only keeps both and only refuses
// the calendar. Side by side is the only way that reads.
const INTERACTION = [
  { label: 'rest', props: {} },
  { label: 'disabled', props: { disabled: true } },
  { label: 'read-only', props: { readOnly: true } },
] as const;

const SIZES = [
  { size: 'xs', height: 28 },
  { size: 'md', height: 36 },
  { size: 'lg', height: 44 },
] as const;

const content = defineState({
  title: 'content',
  render: () => (
    <Wrap>
      {CONTENT.map(({ label, props }) => (
        <Slot key={label} label={label}>
          <Picker {...props} />
        </Slot>
      ))}
    </Wrap>
  ),
});

const interaction = defineState({
  title: 'rest · disabled · read-only',
  render: () => (
    <Wrap>
      {INTERACTION.map(({ label, props }) => (
        <Slot key={label} label={label}>
          <Picker initial={SELECTED} {...props} />
        </Slot>
      ))}
    </Wrap>
  ),
});

const sizes = defineState({
  title: 'sizes',
  render: () => (
    <Wrap>
      {SIZES.map(({ size, height }) => (
        <Slot key={size} label={`${size} · ${height}px`}>
          <Picker initial={SELECTED} size={size} />
        </Slot>
      ))}
    </Wrap>
  ),
});

// Unset comes first and is the point of the row: a bordered field left alone is
// neutral, and every named tone after it is the field saying something about
// itself — `danger` being the one a form reaches for on a validation error.
const tones = defineState({
  title: 'tone (unset is the resting field)',
  render: ({ tones: toneSet }) => (
    <Wrap>
      <Slot label="unset">
        <Picker initial={SELECTED} />
      </Slot>
      {toneSet.map((tone) => (
        <Slot key={tone} label={tone}>
          <Picker initial={SELECTED} tone={tone} />
        </Slot>
      ))}
    </Wrap>
  ),
});

function PlaygroundFixture({
  min,
  max,
  ...props
}: { min: string; max: string } & Omit<DatePickerProps, 'value' | 'onChange' | 'min' | 'max'>) {
  return (
    <Picker
      initial={SELECTED}
      min={min.length > 0 ? min : undefined}
      max={max.length > 0 ? max : undefined}
      {...props}
    />
  );
}

export const meta = { title: 'DatePicker', group: 'Inputs', size: 'md' };

export const states = [content, interaction, sizes, tones];

export const playground = definePlayground({
  docs: {
    summary:
      'The date field. `value` is an ISO string in and out — never a `Date` — because a calendar day has no time and no zone to lose. `readOnly` keeps the field focusable and submitted and only refuses the calendar; `disabled` is what removes it from the form.',
  },
  controls: {
    placeholder: text('Set date…'),
    size: select(['xs', 'md', 'lg'], { allowNone: true, type: 'ControlSize' }),
    tone: select([...TONE_NAMES], {
      allowNone: true,
      type: 'Tone',
      description: 'Unset is the resting neutral field — it is not a synonym for `primary`.',
    }),
    min: text('', {
      placeholder: 'yyyy-mm-dd',
      description: 'Earliest selectable day. Leave empty for no floor.',
    }),
    max: text('', {
      placeholder: 'yyyy-mm-dd',
      description: 'Latest selectable day. Leave empty for no ceiling.',
    }),
    disabled: boolean(false, {
      description: 'Not applicable: out of the tab order and out of the submitted form.',
    }),
    readOnly: boolean(false, {
      description: 'Not editable, still focusable and still submitted. The calendar will not open.',
    }),
  },
  render: (v) => <PlaygroundFixture {...v} />,
});
