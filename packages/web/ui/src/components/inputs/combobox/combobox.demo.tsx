import { useState } from 'react';
import { boolean, defineState, definePlayground, Matrix, select, Slot, text, Wrap } from '../../../gallery';
import { TONE_NAMES, type Tone } from '../../../style';
import { Combobox } from './combobox';
import type { ControlSize, Option } from '../control';

/*
 * The coverage axes, as data. Every specimen below is derived from one of
 * these arrays, so adding a rung widens the grid without anyone editing a
 * state — which is how this demo stops being the one-state page it was while
 * the component picked up 63 call sites.
 */

const PRIORITIES: Option[] = [
  { value: 'p0', label: 'P0 · critical', color: 'red' },
  { value: 'p1', label: 'P1 · high', color: 'orange' },
  { value: 'p2', label: 'P2 · normal', color: 'gray' },
  { value: 'p3', label: 'P3 · low', color: 'blue' },
];

// The same set without swatches. Not decoration: a coloured option draws a
// Pill on the trigger and an uncoloured one draws a bare span, so the two are
// different code paths and only one of them used to survive a long label.
const PLAIN: Option[] = PRIORITIES.map(({ value, label }) => ({ value, label }));

const LONG_LABEL = 'Platform · ingestion · deduplicate inbound webhook payloads before fan-out';

const LONG: Option[] = [
  { value: 'long-pill', label: LONG_LABEL, color: 'purple' },
  { value: 'long-plain', label: LONG_LABEL },
  { value: 'short', label: 'Short' },
];

// Enough to make the list scroll and the search box earn its keep.
const MANY: Option[] = Array.from({ length: 60 }, (_, index) => ({
  value: `area-${index + 1}`,
  label: `Area ${String(index + 1).padStart(2, '0')} · ${['ingest', 'store', 'serve', 'observe'][index % 4]}`,
}));

const SIZES = [
  { size: 'sm', height: 28 },
  { size: 'md', height: 36 },
  { size: 'lg', height: 44 },
] as const satisfies readonly { size: ControlSize; height: number }[];

const INTERACTIONS = ['rest', 'disabled', 'read-only'] as const;
const FILL = ['empty', 'selected'] as const;

type Specimen = {
  label: string;
  options: Option[];
  initial?: string | null;
  placeholder?: string;
};

const CONTENTS: Specimen[] = [
  { label: 'empty', options: PRIORITIES, placeholder: 'Priority' },
  { label: 'selected', options: PRIORITIES, initial: 'p1' },
  { label: 'selected · no swatch', options: PLAIN, initial: 'p1' },
  { label: 'long label · pill', options: LONG, initial: 'long-pill' },
  { label: 'long label · plain', options: LONG, initial: 'long-plain' },
  { label: 'many (60)', options: MANY, initial: 'area-7' },
  { label: 'no options at all', options: [], placeholder: 'Nothing to pick' },
];

/**
 * One live combobox. Live rather than a still, because every failure this
 * control has had — a list that will not close, a pick that does not land, a
 * read-only field that opens anyway — is only visible when one is driven.
 *
 * The width is a prop because the truncation specimens need a box narrower
 * than their label, and the tone row needs eighteen of them on a page.
 */
function Fixture({
  options,
  initial = null,
  width = 'w-224',
  ...rest
}: {
  options: Option[];
  initial?: string | null;
  width?: string;
  placeholder?: string;
  size?: ControlSize;
  tone?: Tone;
  disabled?: boolean;
  readOnly?: boolean;
  searchable?: boolean;
}) {
  const [value, setValue] = useState<string | null>(initial);
  return (
    <div className={width}>
      <Combobox options={options} value={value} onChange={setValue} {...rest} />
    </div>
  );
}

export const meta = { title: 'Combobox', group: 'Inputs', size: 'lg' };

// What the trigger has to draw, which is where this component actually breaks.
// A label longer than its box must be cut by the box rather than push the
// chevron out of it, and that has to hold on both trigger paths — the Pill an
// option with a `color` gets, and the bare span it gets without one.
const content = defineState({
  title: 'content',
  render: () => (
    <Wrap>
      {CONTENTS.map(({ label, ...specimen }) => (
        <Slot key={label} label={label}>
          <Fixture {...specimen} />
        </Slot>
      ))}
    </Wrap>
  ),
});

// Two axes, because the interesting cell is where they meet: a read-only field
// with a value in it is the one that has to stay READABLE — full contrast, no
// dimming — while a disabled one is free to fade, and an empty read-only field
// still has to say what it is empty of.
//
// `disabled` and `read-only` are not two words for the same thing. Disabled
// leaves the tab order and the form submission; read-only keeps both and only
// refuses to open the list.
const interaction = defineState({
  title: 'interaction',
  render: () => (
    <Matrix
      rows={INTERACTIONS}
      columns={FILL}
      cell={(state, fill) => (
        <Fixture
          options={PRIORITIES}
          initial={fill === 'selected' ? 'p1' : null}
          placeholder="Priority"
          disabled={state === 'disabled'}
          readOnly={state === 'read-only'}
        />
      )}
    />
  ),
});

// The label size moves with the box. It did not always: the trigger's text was
// pinned at 13px, so `lg` grew the control by 8px and left the type where it
// was — visible here as three rungs that differ in more than height.
const sizes = defineState({
  title: 'sizes',
  render: () => (
    <Wrap>
      {SIZES.map(({ size, height }) => (
        <Slot key={size} label={`${size} · ${height}px`}>
          <Fixture options={PRIORITIES} initial="p1" size={size} width="w-192" />
        </Slot>
      ))}
    </Wrap>
  ),
});

// The first cell is the one to read: an UNSET tone is the resting neutral
// field, not a quiet `primary`. If those two ever render alike, a default has
// crept back in and every form in the app has gone indigo at the border.
const tone = defineState({
  title: 'tone',
  render: ({ tones }) => (
    <Wrap>
      <Slot label="(unset)">
        <Fixture options={PRIORITIES} initial="p1" width="w-160" />
      </Slot>
      {tones.map((name) => (
        <Slot key={name} label={name}>
          <Fixture options={PRIORITIES} initial="p1" width="w-160" tone={name} />
        </Slot>
      ))}
    </Wrap>
  ),
});

export const states = [content, interaction, sizes, tone];

export const playground = definePlayground({
  docs: {
    summary:
      'The single-select popover. `value` is `string | null` because a select can always be empty, and `tone` left unset is the resting neutral field rather than a quiet `primary`. `readOnly` keeps the tab stop and the submitted value and only refuses to open the list — reach for `disabled` when the field does not apply at all.',
  },
  controls: {
    placeholder: text('Priority', { placeholder: 'shown when nothing is picked…' }),
    size: select(['sm', 'md', 'lg'], { allowNone: true, type: 'ControlSize' }),
    tone: select([...TONE_NAMES], { allowNone: true, type: 'Tone' }),
    searchable: boolean(true, {
      description: 'Draws a search box above the list. Turn it off for a short fixed set.',
    }),
    disabled: boolean(false, { description: 'Not applicable: out of the tab order, not submitted.' }),
    readOnly: boolean(false, {
      description: 'Not editable, but still focusable and still submitted. Refuses to open.',
    }),
  },
  // `tone` used to be declared here and dropped on the floor — the fixture took
  // three named props and the control did nothing. Spreading the values is what
  // keeps a new control from being decorative.
  render: (v) => <Fixture options={PRIORITIES} initial="p0" {...v} />,
});
