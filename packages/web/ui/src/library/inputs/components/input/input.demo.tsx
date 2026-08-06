import { useState, type ComponentProps, type ReactNode } from 'react';
import { boolean, definePlayground, defineState, List, Matrix, select, Slot, text } from '../../../../gallery';
import { TONE_NAMES, type Tone } from '../../../../style';
import { Icon } from '../../../primitives/components/icon';
import { Input } from './input';
import type { ControlSize } from '../../contract';

/**
 * Every specimen owns its value, because `ControlProps<string>` makes one
 * mandatory. Real local state rather than a frozen string: a demo you cannot
 * type into hides the one bug this contract change could introduce — an
 * `onChange` that unwraps the event and then never reaches the value.
 */
function DemoInput({
  initial = '',
  ...props
}: Omit<ComponentProps<typeof Input>, 'value' | 'onChange'> & { initial?: string }) {
  const [value, setValue] = useState(initial);
  return <Input value={value} onChange={setValue} {...props} />;
}

const PLACEHOLDER = 'Ticket title…';

/**
 * The three things a field can be holding, and the reason the states are
 * crossed rather than listed. "Ideal" is the case a demo usually shows and the
 * least informative one; empty is where the placeholder has to be legible
 * without reading as a value, and overflowing is where a single line has to
 * scroll inside a fixed box instead of stretching it.
 */
const CONTENT = {
  empty: '',
  ideal: 'Board group headers collapse on reload',
  overflowing:
    'Board group headers come back collapsed after a reload when the view is filtered by epic',
} as const;

type ContentKey = keyof typeof CONTENT;
const CONTENT_KEYS = Object.keys(CONTENT) as ContentKey[];

/**
 * Rest, disabled and read-only — three columns, not two.
 *
 * Disabled and read-only are different claims (see `ControlProps`): disabled
 * leaves the tab order, drops out of submission and dims its text to `gray-9`;
 * read-only keeps all three and only changes the ground and the affordances.
 * Showing them side by side is the only way to see that the two treatments
 * actually differ — and read-only is new here, so nothing else would.
 */
const AVAILABILITY = {
  rest: {},
  disabled: { disabled: true },
  'read-only': { readOnly: true },
} as const satisfies Record<string, Partial<ComponentProps<typeof Input>>>;

type AvailabilityKey = keyof typeof AVAILABILITY;
const AVAILABILITY_KEYS = Object.keys(AVAILABILITY) as AvailabilityKey[];

// Height, padding and font size — 28 / 36 / 44px.
const SIZES = ['xs', 'md', 'lg'] as const satisfies readonly ControlSize[];

/**
 * The two render paths, crossed with everything below.
 *
 * They are not a styling detail: with no adornment the chrome sits on the
 * `<input>`, and with one it moves to a wrapper `div` while the input goes
 * bare. `readOnly` and the ref have to behave the same on both, and the only
 * way to see that they do is to put the two paths next to each other.
 */
const SHELL = {
  bare: {},
  adorned: { leading: <Icon name="search" size="xs" className="text-gray-9" /> },
} as const satisfies Record<string, Partial<ComponentProps<typeof Input>>>;

type ShellKey = keyof typeof SHELL;
const SHELL_KEYS = Object.keys(SHELL) as ShellKey[];

/**
 * Where an adornment can sit. `both` is its own case rather than the sum of the
 * other two — it is the one that has to keep the text from colliding with
 * either side once the value is long.
 */
const ADORNMENT = {
  leading: { leading: <Icon name="search" size="xs" className="text-gray-9" /> },
  trailing: { trailing: <kbd className="font-mono text-11/13 text-gray-9">⌘K</kbd> },
  both: {
    leading: <Icon name="search" size="xs" className="text-gray-9" />,
    trailing: <kbd className="font-mono text-11/13 text-gray-9">⌘K</kbd>,
  },
} as const satisfies Record<string, Partial<ComponentProps<typeof Input>>>;

type AdornmentKey = keyof typeof ADORNMENT;
const ADORNMENT_KEYS = Object.keys(ADORNMENT) as AdornmentKey[];

// A sample, not the whole vocabulary: tone drives the border and `danger` also
// drives `aria-invalid`, and three of them show that as well as seventeen would.
const TONE_SAMPLE = [
  { tone: 'danger', note: 'Required — give the ticket a title.' },
  { tone: 'warning', note: 'A title this long will be truncated on the board.' },
  { tone: 'success', note: 'Saved.' },
] as const satisfies readonly { tone: Tone; note: string }[];

// Every specimen is inside a fixed-width box on purpose. `w-full` is the
// component's own width, so without a container each cell would size itself to
// its content and the overflowing row would prove nothing.
function Box({ children }: { children: ReactNode }) {
  return <div className="w-224">{children}</div>;
}

export const meta = { title: 'Input', group: 'Inputs', size: 'md' };

const contentByAvailability = defineState({
  title: 'content × availability',
  render: () => (
    <Matrix
      rows={CONTENT_KEYS}
      columns={AVAILABILITY_KEYS}
      cell={(content, availability) => (
        <Box>
          <DemoInput
            aria-label={`${content}, ${availability}`}
            placeholder={PLACEHOLDER}
            initial={CONTENT[content]}
            {...AVAILABILITY[availability]}
          />
        </Box>
      )}
    />
  ),
});

const sizes = defineState({
  title: 'size × shell',
  render: () => (
    <Matrix
      rows={SIZES}
      columns={SHELL_KEYS}
      cell={(size, shell) => (
        <Box>
          <DemoInput
            size={size}
            aria-label={`${size}, ${shell}`}
            placeholder={PLACEHOLDER}
            initial={CONTENT.ideal}
            {...SHELL[shell]}
          />
        </Box>
      )}
    />
  ),
});

const tone = defineState({
  title: 'tone',
  render: () => (
    <List>
      {TONE_SAMPLE.map(({ tone: name, note }) => (
        <Slot key={name} label={name}>
          <Box>
            <DemoInput tone={name} aria-label={name} placeholder={note} initial={CONTENT.ideal} />
          </Box>
        </Slot>
      ))}
      {/* Read-only wins over the tone's border on purpose: the field is no
          longer asking for a correction, so it drops to the resting rung and
          stops answering to hover. `aria-invalid` stays — the value is still
          the one that failed. */}
      <Slot label="danger + read-only">
        <Box>
          <DemoInput tone="danger" readOnly aria-label="danger read-only" initial={CONTENT.ideal} />
        </Box>
      </Slot>
    </List>
  ),
});

const adornments = defineState({
  title: 'adornment × availability',
  render: () => (
    <Matrix
      rows={ADORNMENT_KEYS}
      columns={AVAILABILITY_KEYS}
      cell={(adornment, availability) => (
        <Box>
          <DemoInput
            aria-label={`${adornment}, ${availability}`}
            placeholder={PLACEHOLDER}
            initial={CONTENT.overflowing}
            {...ADORNMENT[adornment]}
            {...AVAILABILITY[availability]}
          />
        </Box>
      )}
    />
  ),
});

export const states = [contentByAvailability, sizes, tone, adornments];

export const playground = definePlayground({
  docs: {
    summary:
      'The single-line text control, on `ControlProps<string>` — `onChange` hands you the value, never the event. A `leading` or `trailing` adornment moves the field chrome onto a wrapper so the border draws around it; everything else about the field is unchanged.',
  },
  controls: {
    placeholder: text(PLACEHOLDER),
    size: select(SIZES, {
      allowNone: true,
      type: 'ControlSize',
      description: 'Field height, padding and font size — 28 / 36 / 44px.',
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
    adorned: boolean(false, {
      description:
        'Adds a leading icon, which moves the chrome onto a wrapper and the focus ring onto `focus-within`.',
    }),
  },
  render: (v) => (
    <Box>
      <DemoInput
        initial={CONTENT.ideal}
        placeholder={v.placeholder}
        size={v.size}
        tone={v.tone}
        disabled={v.disabled}
        readOnly={v.readOnly}
        {...(v.adorned ? SHELL.adorned : SHELL.bare)}
      />
    </Box>
  ),
});
