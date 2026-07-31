import type { ReactNode } from 'react';
import { axis, cn, HUE_TONES, over, TONE_SCALE, variants, type Tone } from '../../style';
import { Icon, type IconName, type IconSize } from '../icon';

// Which ramp this component paints from. `scale` is the prop it surfaces as.
const SCALE = axis('scale', HUE_TONES, 'indigo');

export type TabsVariant = 'underline' | 'pill' | 'rail' | 'segment';
export type TabsSize = 'sm' | 'md' | 'lg';

/**
 * Whether this is a set of tabs or a set of toggle buttons.
 *
 * `tablist` promises assistive tech that each item reveals a panel; `group` is
 * a set of related toggles that change something in place — a density switch,
 * a filter, a view mode. Announcing the second as tabs tells screen-reader
 * users to expect panels that are not there, so the choice is explicit rather
 * than inferred from the variant.
 */
export type TabsRole = 'tablist' | 'group';

const LIST_BOX: Record<TabsVariant, Record<TabsSize, string>> = {
  underline: { sm: 'gap-3', md: 'gap-4.5', lg: 'gap-6' },
  pill: { sm: 'gap-0.5 p-0.5', md: 'gap-1 p-0.75', lg: 'gap-1 p-1' },
  rail: { sm: 'gap-0.5', md: 'gap-0.5', lg: 'gap-1' },
  segment: { sm: 'gap-0.5 p-0.5', md: 'gap-0.5 p-0.5', lg: 'gap-1 p-0.75' },
};

/** The rung, shared by the list and its tabs so the two cannot disagree. */
const SIZE = axis('size', ['sm', 'md', 'lg'], 'md');
/**
 * Whether a tab is the selected one.
 *
 * `previous` is the one the selection just left. Only `segment` draws it
 * differently — an outline where `active` is a fill — because a segmented
 * control is the one place a set shows both where you are and where you came
 * from at once. Every other variant reads it as `inactive`, which is what the
 * `state === 'active' ? … : …` branches below already do.
 */
const STATE = axis('state', ['active', 'previous', 'inactive'], 'inactive');

const listClass = variants({
  base: '',
  config: {
    variant: {
      default: 'underline',
      options: {
        underline: over(SIZE, (size) =>
          cn('flex items-center border-b-2 border-gray-6', LIST_BOX.underline[size]),
        ),
        pill: over(SIZE, (size) =>
          cn('inline-flex items-center rounded-lg bg-surface-inset', LIST_BOX.pill[size]),
        ),
        rail: over(SIZE, (size) => cn('flex flex-col', LIST_BOX.rail[size])),
        // A hairline container over the page ground, not a filled well. Its
        // one-pixel edge is what separates the group from whatever it sits
        // on, so `segment` works directly on the app background where `pill`
        // needs a surface beneath it.
        segment: over(SIZE, (size) =>
          cn(
            'inline-flex items-center rounded-lg border-1 border-gray-6',
            LIST_BOX.segment[size],
          ),
        ),
      },
    },
  },
});

// Padding and font-size are per variant AND per size — an underline tab pads
// against the rule beneath it while a pill pads inside its own fill — so size
// is a param of the variant rather than an axis beside it. The `md` column of
// each row is exactly what that variant rendered before the axis existed.
const TAB_BOX: Record<TabsVariant, Record<TabsSize, string>> = {
  underline: {
    sm: 'px-0.5 pt-1.25 pb-1.5 text-12/17',
    md: 'px-0.5 pt-1.75 pb-2 text-13/19',
    lg: 'px-1 pt-2.25 pb-2.5 text-15',
  },
  pill: {
    sm: 'rounded-md px-2 py-0.5 text-11/13 tracking-wider',
    md: 'rounded-md px-3 py-1 text-12/17',
    lg: 'rounded-md px-3.5 py-1.5 text-13/19',
  },
  rail: {
    sm: 'rounded-md px-2 py-1 text-left text-12/17',
    md: 'rounded-md px-2.5 py-1.5 text-left text-13/19',
    lg: 'rounded-md px-3 py-2 text-left text-15',
  },
  // Mono, because a segment names a value — `1.5×`, `soft`, `dark` — where
  // the other variants name a place.
  segment: {
    sm: 'rounded-md px-2 py-0.5 font-mono text-10',
    md: 'rounded-md px-3 py-1 font-mono text-11',
    lg: 'rounded-md px-3.5 py-1.5 font-mono text-12',
  },
};

const tabClass = variants({
  base: 'inline-flex items-center gap-1.5',
  config: {
    variant: {
      default: 'underline',
      // Three axes. Written per option, the branch each variant actually takes
      // is visible next to the classes it produces, instead of a shared
      // closure computing `on` and `box()` above three ternaries.
      options: {
        underline: over(SCALE, SIZE, STATE, (tone, size, state) =>
          cn(
            '-mb-px border-b-2',
            TAB_BOX.underline[size],
            state === 'active'
              ? `border-${tone}-9 font-500 text-gray-12`
              : 'border-transparent text-gray-11 hover:text-gray-12',
          ),
        ),
        pill: over(SCALE, SIZE, STATE, (_tone, size, state) =>
          cn(
            'font-500',
            TAB_BOX.pill[size],
            state === 'active'
              ? 'bg-surface-raised text-gray-12 shadow-sm'
              : 'text-gray-11 hover:text-gray-12',
          ),
        ),
        rail: over(SCALE, SIZE, STATE, (tone, size, state) =>
          cn(
            TAB_BOX.rail[size],
            state === 'active'
              ? `bg-${tone}-3 font-500 text-${tone}-9`
              : 'text-gray-11 hover:bg-surface-inset hover:text-gray-12',
          ),
        ),
        segment: over(SCALE, SIZE, STATE, (tone, size, state) =>
          cn(
            TAB_BOX.segment[size],
            state === 'active' ? `bg-${tone}-3 font-500 text-${tone}-9` : '',
            state === 'previous' ? `inset-ring-1 inset-ring-${tone}-9 text-${tone}-9` : '',
            state === 'inactive' ? 'text-gray-11 hover:text-gray-12' : '',
          ),
        ),
      },
    },
  },
});

const GLYPH: Record<TabsSize, IconSize> = { sm: 'xs', md: 'sm', lg: 'md' };

export function Tabs({
  variant = 'underline',
  size = 'md',
  tone = 'primary',
  role = 'tablist',
  items,
  value,
  previousValue,
  onChange,
  label,
  className,
}: {
  variant?: TabsVariant;
  size?: TabsSize;
  /** Which ramp the active item paints from. Defaults to `primary`. */
  tone?: Tone;
  role?: TabsRole;
  items: { value: string; label: ReactNode; icon?: IconName; badge?: ReactNode }[];
  value: string;
  /**
   * The item the selection just left, drawn outlined by `segment`. Ignored by
   * every other variant, and by any value equal to `value` — leaving and
   * arriving at the same item is not a journey.
   */
  previousValue?: string;
  onChange: (value: string) => void;
  label?: string;
  className?: string;
}) {
  const isTablist = role === 'tablist';
  const scale = TONE_SCALE[tone];

  return (
    <div
      role={isTablist ? 'tablist' : 'group'}
      aria-label={label}
      className={listClass({ variant, size, className })}
    >
      {items.map((item) => {
        const active = item.value === value;
        const previous = !active && item.value === previousValue;
        return (
          <button
            key={item.value}
            // A tablist item is a `tab` that is selected; a toggle in a group is
            // a plain button that is pressed. Mixing the two — a `tab` carrying
            // aria-pressed, or a group item claiming aria-selected — is worse
            // than either, so the pair switches together.
            role={isTablist ? 'tab' : undefined}
            aria-selected={isTablist ? active : undefined}
            aria-pressed={isTablist ? undefined : active}
            type="button"
            onClick={() => onChange(item.value)}
            className={tabClass({
              variant,
              scale,
              size,
              state: active ? 'active' : previous ? 'previous' : 'inactive',
            })}
          >
            {item.icon ? <Icon name={item.icon} size={GLYPH[size]} /> : null}
            {item.label}
            {item.badge != null ? (
              <span className="font-mono text-10 text-gray-9">{item.badge}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
