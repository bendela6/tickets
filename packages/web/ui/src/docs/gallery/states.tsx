import { createContext, useContext, type ReactNode } from 'react';
import { cn, HUES, ROLES, TONE_NAMES, type Tone } from '../../style';

/**
 * The two halves of the tone vocabulary, plus both at once.
 *
 * A role is a JOB — `danger` resolves to whichever scale currently does it —
 * and a hue IS the scale. They answer different questions, and seventeen
 * swatches in one row answers neither, so the gallery lets you look at one
 * half at a time.
 */
export const TONE_SETS = {
  all: TONE_NAMES,
  roles: ROLES,
  palette: HUES,
} as const satisfies Record<string, readonly Tone[]>;

export type ToneSet = keyof typeof TONE_SETS;

export const TONE_SET_NAMES = Object.keys(TONE_SETS) as ToneSet[];

export function isToneSet(value: unknown): value is ToneSet {
  return typeof value === 'string' && value in TONE_SETS;
}

/**
 * Gallery-wide view settings a section can answer to, resolved before render
 * is called. A section takes what it needs by destructuring and the rest is
 * invisible — including to sections that predate a setting, which is why
 * `render()` with no parameters stays valid.
 */
export interface StateView {
  /** Whichever half of the tone vocabulary the rail's switch has selected. */
  tones: readonly Tone[];
}

export const DEFAULT_VIEW: StateView = { tones: TONE_SETS.all };

/**
 * A hand-authored state section.
 *
 * The frame around one of these contributes a card, a title and the
 * Preview/Source tabs — nothing else. Layout lives INSIDE `render`, as real
 * components, so the Source tab shows the arrangement rather than hiding it
 * behind a `layout` prop that only the frame can see. What you read is what
 * renders.
 */
export interface DefinedState {
  /** Discriminates an authored section from the legacy `{ name, render }`
   *  literal, and is how a demo opts in — see `collectDemos`. */
  kind: 'state';
  title: string;
  render: (view: StateView) => ReactNode;
}

/**
 * Marks a section as authored. Not sugar: this brand is the opt-in signal.
 * Thirty-odd demos still export raw `{ name, render }` arrays that the derived
 * axes currently win over, and flipping all of them at once is exactly what
 * this migration is trying not to do. A demo switches to its authored page the
 * moment its sections are wrapped here, and not before.
 */
export function defineState(state: Omit<DefinedState, 'kind'>): DefinedState {
  return { kind: 'state', ...state };
}

export function isDefinedState(state: unknown): state is DefinedState {
  return typeof state === 'object' && state !== null && (state as DefinedState).kind === 'state';
}

// Whether a Slot in this layout is one of several on a line or owns the full
// width. Passed by context rather than by prop: the layout component already
// knows, and making every Slot restate it would be noise in the source view
// that is the whole point of these being components.
type SlotWidth = 'inline' | 'block';

const SlotWidthContext = createContext<SlotWidth>('inline');

interface LayoutProps {
  children: ReactNode;
  className?: string;
}

function Layout({ width, className, children }: LayoutProps & { width: SlotWidth }) {
  return (
    <SlotWidthContext.Provider value={width}>
      <div className={className}>{children}</div>
    </SlotWidthContext.Provider>
  );
}

/**
 * Specimens on a line, wrapping. The default arrangement and the one the
 * derived axes use: `items-end` so a row of mixed heights shares one baseline
 * under the specimens rather than staggering the captions.
 */
export function Wrap({ children, className }: LayoutProps) {
  return (
    <Layout width="inline" className={cn('flex flex-wrap items-end gap-x-20 gap-y-16', className)}>
      {children}
    </Layout>
  );
}

/** One specimen per line, each spanning the width — rows, streams, banners. */
export function List({ children, className }: LayoutProps) {
  return (
    <Layout width="block" className={cn('flex flex-col gap-12', className)}>
      {children}
    </Layout>
  );
}

// Written out rather than interpolated: `grid-cols-${columns}` cannot be
// scanned, and this file is in the safelist's blind spot — a template string
// here renders every grid as a single column with no error anywhere.
const COLUMNS = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-5',
  6: 'grid-cols-6',
  7: 'grid-cols-7',
  8: 'grid-cols-8',
} as const;

export type GridColumns = keyof typeof COLUMNS;

/** Even columns — icon sets, tone ramps, anything you count rather than read. */
export function Grid({
  columns = 4,
  children,
  className,
}: LayoutProps & { columns?: GridColumns }) {
  return (
    <Layout width="block" className={cn('grid items-end gap-16', COLUMNS[columns], className)}>
      {children}
    </Layout>
  );
}

/**
 * A lone specimen with room around it — dialogs, empty states, a spinner.
 * Padding rather than a min-height: a tall specimen brings its own height, and
 * imposing one leaves a small specimen floating in a void that reads as a
 * rendering failure.
 */
export function Center({ children, className }: LayoutProps) {
  return (
    <Layout width="inline" className={cn('flex items-center justify-center py-24', className)}>
      {children}
    </Layout>
  );
}

const HEAD = 'font-mono text-11/13 tracking-wider font-400 uppercase tracking-widest text-gray-9';

/**
 * Two axes crossed — `variant × tone`, `size × state`. The one arrangement the
 * derived sections cannot produce: an axis row varies exactly one prop, and
 * the interesting failures live where two of them meet.
 *
 * A real table rather than a grid of divs. The content IS labelled on two
 * axes, so `scope="col"` / `scope="row"` says so to a screen reader, the
 * columns size themselves to their specimens, and the row headers can stick
 * without any grid-template arithmetic — which matters because a wide matrix
 * is the one thing in a section that scrolls sideways, and the labels are
 * what you lose first.
 *
 * Cells carry no caption: the headers already name every one of them, and a
 * label under each of sixty-eight specimens is noise.
 */
export function Matrix<R extends string, C extends string>({
  rows,
  columns,
  cell,
  className,
}: {
  rows: readonly R[];
  columns: readonly C[];
  /** Rendered once per intersection. Both arguments keep their literal union
   *  type, so a typo in either axis is a compile error. */
  cell: (row: R, column: C) => ReactNode;
  className?: string;
}) {
  return (
    <table className={cn('w-full border-collapse', className)}>
      <thead>
        <tr>
          {/* Sits in the row-header column, so it travels with it. A section
              never scrolls vertically, so nothing sticks to the top. */}
          <th className="sticky left-0 z-10 bg-surface-raised" />
          {columns.map((column) => (
            <th key={column} scope="col" className={cn('px-12 py-8 text-center', HEAD)}>
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row}>
            <th
              scope="row"
              className={cn('sticky left-0 z-10 bg-surface-raised pr-12 text-right', HEAD)}
            >
              {row}
            </th>
            {columns.map((column) => (
              <td key={column} className="px-12 py-8 text-center">
                {cell(row, column)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * One specimen and its caption. Sizes itself from the surrounding layout, so
 * the same `<Slot>` is a cell in a `Wrap` and a full-width band in a `List`.
 */
export function Slot({
  label,
  children,
  className,
}: {
  label?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const width = useContext(SlotWidthContext);
  const block = width === 'block';
  return (
    <figure className={cn('m-0 flex min-w-0 flex-col gap-8', block && 'w-full', className)}>
      <div className={cn('flex min-h-36 items-center', block && 'w-full')}>{children}</div>
      {label !== undefined && (
        <figcaption className="font-mono text-11/13 tracking-wider text-gray-9">{label}</figcaption>
      )}
    </figure>
  );
}
