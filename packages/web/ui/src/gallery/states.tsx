import { createContext, useContext, type ReactNode } from 'react';
import { cn } from '../style';

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
  render: () => ReactNode;
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
    <Layout width="inline" className={cn('flex flex-wrap items-end gap-x-5 gap-y-4', className)}>
      {children}
    </Layout>
  );
}

/** One specimen per line, each spanning the width — rows, streams, banners. */
export function List({ children, className }: LayoutProps) {
  return (
    <Layout width="block" className={cn('flex flex-col gap-3', className)}>
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
    <Layout width="block" className={cn('grid items-end gap-4', COLUMNS[columns], className)}>
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
    <Layout width="inline" className={cn('flex items-center justify-center py-6', className)}>
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
 * columns size themselves to their specimens, and the headers can stick
 * without any grid-template arithmetic — which matters because the card
 * scrolls at 24rem and a tone axis is seventeen rows deep.
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
          {/* The corner outranks both header bands, so it stays put while
              either one scrolls under it. */}
          <th className="sticky left-0 top-0 z-20 bg-surface-raised" />
          {columns.map((column) => (
            <th
              key={column}
              scope="col"
              className={cn('sticky top-0 z-10 bg-surface-raised px-3 py-2 text-center', HEAD)}
            >
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
              className={cn('sticky left-0 z-10 bg-surface-raised pr-3 text-right', HEAD)}
            >
              {row}
            </th>
            {columns.map((column) => (
              <td key={column} className="px-3 py-2 text-center">
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
    <figure className={cn('m-0 flex min-w-0 flex-col gap-2', block && 'w-full', className)}>
      <div className={cn('flex min-h-9 items-center', block && 'w-full')}>{children}</div>
      {label !== undefined && (
        <figcaption className="font-mono text-11/13 tracking-wider text-gray-9">{label}</figcaption>
      )}
    </figure>
  );
}
