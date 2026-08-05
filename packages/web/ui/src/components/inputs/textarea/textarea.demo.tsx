import { useState, type ComponentProps } from 'react';
import { boolean, definePlayground, defineState, List, Matrix, select, Slot, text } from '../../../gallery';
import { TONE_NAMES, type Tone } from '../../../style';
import { Textarea } from './textarea';
import type { ControlSize } from '../control';

/**
 * Every specimen owns its value, because `ControlProps<string>` makes one
 * mandatory. Real local state rather than a frozen string: a demo you cannot
 * type into hides the one bug this contract change could introduce — an
 * `onChange` that unwraps the event and then never reaches the value.
 */
function DemoTextarea({
  initial = '',
  ...props
}: Omit<ComponentProps<typeof Textarea>, 'value' | 'onChange'> & { initial?: string }) {
  const [value, setValue] = useState(initial);
  return <Textarea value={value} onChange={setValue} {...props} />;
}

const PLACEHOLDER = 'Steps to reproduce…';

/**
 * The three things a textarea can be holding, and the reason the states are
 * crossed rather than listed. "Ideal" is the case a demo usually shows and the
 * least informative one; empty is where the placeholder has to be legible
 * without reading as a value, and overflowing is where the box has to scroll
 * instead of growing past its row.
 */
const CONTENT = {
  empty: '',
  ideal: 'Filter the board by epic, then reload — the group headers come back collapsed.',
  overflowing: [
    'Filter the board by epic, then reload — the group headers come back collapsed.',
    'Happens on staging and locally, every time, in both Chrome and Firefox.',
    'The collapsed set is read from localStorage before the view config resolves,',
    'so the first paint uses the previous view’s keys and nothing ever corrects it.',
    'Workaround: toggle any group open and the state re-syncs for the rest of the session.',
  ].join(' '),
} as const;

type ContentKey = keyof typeof CONTENT;
const CONTENT_KEYS = Object.keys(CONTENT) as ContentKey[];

/**
 * Rest, disabled and read-only — three columns, not two.
 *
 * Disabled and read-only are different claims (see `ControlProps`): disabled
 * leaves the tab order and drops out of submission and dims its text to
 * `gray-9`; read-only keeps all three and only changes the ground and the
 * affordances. Showing them side by side is the only way to see that the two
 * treatments actually differ.
 */
const AVAILABILITY = {
  rest: {},
  disabled: { disabled: true },
  'read-only': { readOnly: true },
} as const satisfies Record<string, Partial<ComponentProps<typeof Textarea>>>;

type AvailabilityKey = keyof typeof AVAILABILITY;
const AVAILABILITY_KEYS = Object.keys(AVAILABILITY) as AvailabilityKey[];

// The size axis sets a floor, not a height — roughly two, three and four lines.
const SIZES = [
  { size: 'sm', minHeight: 56 },
  { size: 'md', minHeight: 72 },
  { size: 'lg', minHeight: 88 },
] as const satisfies readonly { size: ControlSize; minHeight: number }[];

// A sample, not the whole vocabulary: tone drives the border and `danger` also
// drives `aria-invalid`, and three of them show that as well as seventeen would.
const TONE_SAMPLE = [
  { tone: 'danger', note: 'Required — describe what you did.' },
  { tone: 'warning', note: 'This will be visible to the reporter.' },
  { tone: 'success', note: 'Saved to the ticket.' },
] as const satisfies readonly { tone: Tone; note: string }[];

export const meta = { title: 'Textarea', group: 'Components', size: 'md' };

const contentByAvailability = defineState({
  title: 'content × availability',
  render: () => (
    <Matrix
      rows={CONTENT_KEYS}
      columns={AVAILABILITY_KEYS}
      cell={(content, availability) => (
        <DemoTextarea
          aria-label={`${content}, ${availability}`}
          placeholder={PLACEHOLDER}
          initial={CONTENT[content]}
          {...AVAILABILITY[availability]}
        />
      )}
    />
  ),
});

const sizes = defineState({
  title: 'sizes',
  render: () => (
    <List>
      {SIZES.map(({ size, minHeight }) => (
        <Slot key={size} label={`${size} · min ${minHeight}px`}>
          <DemoTextarea
            size={size}
            aria-label={size}
            placeholder={PLACEHOLDER}
            initial={CONTENT.ideal}
          />
        </Slot>
      ))}
    </List>
  ),
});

const tone = defineState({
  title: 'tone',
  render: () => (
    <List>
      {TONE_SAMPLE.map(({ tone: name, note }) => (
        <Slot key={name} label={name}>
          <DemoTextarea tone={name} aria-label={name} placeholder={note} initial={CONTENT.ideal} />
        </Slot>
      ))}
      {/* Read-only wins over the tone's border on purpose: the field is no
          longer asking for a correction, so it drops to the resting rung and
          stops answering to hover. `aria-invalid` stays — the value is still
          the one that failed. */}
      <Slot label="danger + read-only">
        <DemoTextarea tone="danger" readOnly aria-label="danger read-only" initial={CONTENT.ideal} />
      </Slot>
    </List>
  ),
});

export const states = [contentByAvailability, sizes, tone];

export const playground = definePlayground({
  docs: {
    summary:
      'The multi-line text control, on `ControlProps<string>` — `onChange` hands you the value, never the event. `size` sets a minimum height rather than a fixed one, so the box still grows with its content.',
  },
  controls: {
    placeholder: text(PLACEHOLDER),
    size: select(['sm', 'md', 'lg'] as const, {
      allowNone: true,
      type: 'ControlSize',
      description: 'Minimum height, padding and font size — roughly two, three and four lines.',
    }),
    tone: select([...TONE_NAMES], {
      allowNone: true,
      type: 'Tone',
      description:
        'What the field is saying about itself. Unset is the resting field, not `primary`; `danger` also sets `aria-invalid`.',
    }),
    disabled: boolean(false, {
      description: 'Not applicable: leaves the tab order and drops out of form submission.',
    }),
    readOnly: boolean(false, {
      description:
        'Not editable, but still focusable and still submitted — the case a permission-locked field needs and `disabled` gets wrong.',
    }),
  },
  render: (v) => (
    <div className="w-288">
      <DemoTextarea
        initial={CONTENT.ideal}
        placeholder={v.placeholder}
        size={v.size}
        tone={v.tone}
        disabled={v.disabled}
        readOnly={v.readOnly}
      />
    </div>
  ),
});
