import { definePlayground, number, select, text } from '../../gallery';
import { cn } from '../../style';
import { DriftView } from '../view';

export const meta = {
  title: 'Typography',
  group: 'Foundation',
  order: 2,
  size: 'full',
  impl: ['../spec.ts', '../view.tsx'],
};

// Real copy, not a pangram, so the specimens read at the density the app
// actually sets text in. Long enough to wrap, because leading only becomes
// visible when one line sits under another.
const COPY =
  `Gateway returned 504 after three retries. The run was marked failed and the queue drained.`;

// Written out rather than interpolated: `text-${size}` cannot be scanned, and
// these maps ARE the documentation — the page shows the real utilities, not an
// inline style that happens to match them.
const FONT = {
  sans: 'font-sans',
  mono: 'font-mono',
} as const;

const SIZE = {
  '9': 'text-9',
  '10': 'text-10',
  '11': 'text-11',
  '12': 'text-12',
  '13': 'text-13',
  '14': 'text-14',
  '15': 'text-15',
  '16': 'text-16',
  '18': 'text-18',
  '20': 'text-20',
  '22': 'text-22',
  '24': 'text-24',
} as const;

const WEIGHT = {
  '400': 'font-400',
  '500': 'font-500',
  '600': 'font-600',
} as const;

const TRACKING = {
  tight: 'tracking-tight',
  normal: 'tracking-normal',
  wide: 'tracking-wide',
  wider: 'tracking-wider',
  widest: 'tracking-widest',
} as const;

type Specimen = {
  font: keyof typeof FONT;
  size: keyof typeof SIZE;
  weight: keyof typeof WEIGHT;
  tracking: keyof typeof TRACKING;
  leading: number | undefined;
  uppercase: boolean;
  text: string;
};

// One renderer for every block and for the playground, so a specimen can never
// disagree with itself between the two.
function Type({ font, size, weight, tracking, leading, uppercase, text: copy }: Specimen) {
  return (
    <p
      className={cn(
        'm-0 max-w-160 text-gray-12',
        'truncate',
        FONT[font],
        SIZE[size],
        WEIGHT[weight],
        TRACKING[tracking],
        uppercase && 'uppercase',
      )}
      // The size scale is closed and the leading range is open (8..96), so the
      // leading cannot be a lookup map the way the other four are. Unset means
      // the size ships bare and inherits, which is the common case.
      style={leading === undefined ? undefined : { lineHeight: `${leading}px` }}
    >
      {copy}
    </p>
  );
}

const DEFAULTS: Specimen = {
  font: 'sans',
  size: '13',
  weight: '400',
  tracking: 'normal',
  leading: undefined,
  uppercase: false,
  text: COPY,
};

export const states = [
  {
    name: 'Drift',
    render: () => <DriftView families={['text', 'font', 'font-weight']} />,
  },
];

/**
 * The four axes are the four blocks: the state viewer derives one section per
 * enumerable control and renders every value of it, so FONT / SIZE / WEIGHT /
 * TRACKING come from this config rather than from four hand-written tables
 * that could drift from it.
 *
 * `leading` and `text` are deliberately not enumerable — a free integer and a
 * string have no "every value" to lay out — so they belong to the playground
 * only, which is exactly where a per-site decision is made.
 */
export const playground = definePlayground({
  docs: {
    summary:
      'A size is a design decision and the scale is closed at twelve rungs; a leading is derived from its size, so the range is open (8–96) and stated per call site as `text-13/19`. Nothing else is bundled: weight, family and tracking are separate axes because none of them is a function of the size.',
    status: 'migrated',
  },
  controls: {
    font: select(['sans', 'mono'], {
      type: 'FontFamily',
      description: 'IBM Plex Sans for prose and controls; IBM Plex Mono for keys, times and code.',
    }),
    size: select(Object.keys(SIZE) as (keyof typeof SIZE)[], {
      initial: '13',
      type: 'TextSize',
      description:
        'Named for its own pixel value. Closed on purpose — admitting every integer would be arbitrary values with nicer syntax.',
    }),
    weight: select(['400', '500', '600'], {
      initial: '400',
      type: 'FontWeight',
      description:
        'Only the three the app loads a font file for. A fourth would be a browser-synthesised bold, not the typeface.',
    }),
    tracking: select(['tight', 'normal', 'wide', 'wider', 'widest'], {
      initial: 'normal',
      type: 'Tracking',
      description:
        "Tailwind's own scale. Tracking is a property of being an uppercase run, not of a size, so it is never bundled into one.",
    }),
    leading: number(undefined, {
      allowNone: true,
      min: 8,
      max: 96,
      type: 'number | undefined',
      description:
        'Line height in px, written as the modifier on the size: `text-13/19`. Unset leaves the size bare and inherits.',
    }),
    uppercase: select(['no', 'yes'], {
      type: 'boolean',
      description: 'Tracking only earns its keep on an uppercase run — this is how to see it.',
    }),
    text: text(COPY, { type: 'string', description: 'Specimen copy.' }),
  },
  render: (v) => (
    <Type
      {...DEFAULTS}
      font={v.font}
      size={v.size}
      weight={v.weight}
      tracking={v.tracking}
      leading={v.leading}
      uppercase={v.uppercase === 'yes'}
      text={v.text}
    />
  ),
});
