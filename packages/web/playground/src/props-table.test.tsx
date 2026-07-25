import { fireEvent, render, screen, within } from '@testing-library/react';
import {
  boolean as booleanControl,
  collectDemos,
  definePlayground,
  isDemoError,
  number as numberControl,
  select,
  text,
  type AnyControlDef,
  type PlaygroundDocs,
} from '@tickets/ui/gallery';
import { PropsTable } from './props-table';

// 13 values — one past the design's 12-chip cap, so the truncation branch is
// exercised by the smallest possible margin.
const MANY = [
  'red', 'orange', 'yellow', 'green', 'teal', 'cyan', 'blue',
  'indigo', 'purple', 'pink', 'gray', 'black', 'white',
] as const;

function buildDemo(
  controls: Record<string, AnyControlDef>,
  opts: { path?: string; docs?: PlaygroundDocs } = {},
) {
  const path = opts.path ?? 'packages/web/ui/src/pill.demo.tsx';
  const collected = collectDemos({
    [path]: {
      meta: { title: 'Pill', group: 'Display' },
      states: [{ name: 'default', render: () => null }],
      playground: definePlayground({ controls, render: () => null, docs: opts.docs }),
    },
  })[0]!;
  if (isDemoError(collected)) throw new Error(collected.error);
  return collected;
}

const controls = {
  variant: select(['primary', 'secondary', 'ghost'], {
    initial: 'primary',
    type: 'PillVariant',
    description: 'Visual weight and intent. Pass `ghost` inside a toolbar.',
  }),
  size: select(['compact', 'regular'], { allowNone: true }),
  loading: booleanControl(false),
  children: text('New ticket', { type: 'ReactNode', required: true }),
  count: numberControl(5, { min: 1, max: 99 }),
};

// A prop's row: the grid cell holding the name, walked up to the row itself.
function row(name: string): HTMLElement {
  const el = screen.getByText(name).closest('.grid');
  if (!el) throw new Error(`no props row for "${name}"`);
  return el as HTMLElement;
}

describe('PropsTable — API header', () => {
  it('derives the package from the demo path', () => {
    render(<PropsTable demo={buildDemo(controls)} />);
    expect(screen.getByText('API')).toBeTruthy();
    expect(screen.getByText('@tickets/ui')).toBeTruthy();

    render(<PropsTable demo={buildDemo(controls, { path: 'apps/web/src/ui/button.demo.tsx' })} />);
    expect(screen.getByText('@tickets/web')).toBeTruthy();
  });

  it('shows version and status only when declared', () => {
    const { unmount } = render(<PropsTable demo={buildDemo(controls)} />);
    expect(screen.queryByText('a11y verified')).toBeNull();
    unmount();

    render(
      <PropsTable
        demo={buildDemo(controls, { docs: { version: 'v2.4.0 · stable', status: 'a11y verified' } })}
      />,
    );
    expect(screen.getByText('v2.4.0 · stable')).toBeTruthy();
    expect(screen.getByText('a11y verified').className).toContain('text-opt-green');
  });

  it('renders backticked spans of the summary as inline code', () => {
    render(
      <PropsTable
        demo={buildDemo(controls, { docs: { summary: 'Icon-only pills need `aria-label`.' } })}
      />,
    );
    const code = screen.getByText('aria-label');
    expect(code.className).toContain('font-mono');
    expect(code.className).toContain('bg-inset');
    // The surrounding prose survives the split, rather than only the chip.
    expect(code.parentElement?.textContent).toBe('Icon-only pills need aria-label.');
  });

  it('falls back to the unsettable note when no summary is declared', () => {
    render(<PropsTable demo={buildDemo(controls)} />);
    expect(screen.getByText(/fall back to the component default/)).toBeTruthy();
  });
});

describe('PropsTable — prop rows', () => {
  beforeEach(() => {
    render(<PropsTable demo={buildDemo(controls)} />);
  });

  it('prints the declared type, falling back to the control primitive', () => {
    expect(within(row('variant')).getByText('PillVariant')).toBeTruthy();
    expect(within(row('size')).getByText('enum')).toBeTruthy();
    expect(within(row('loading')).getByText('boolean')).toBeTruthy();
    expect(within(row('count')).getByText('number')).toBeTruthy();
    // text controls report `string`, not their kind
    expect(within(row('children')).getByText('ReactNode')).toBeTruthy();
  });

  it('renders backticked code inside a description, not literal backticks', () => {
    const description = within(row('variant')).getByText(/Visual weight and intent/);
    expect(description.textContent).toBe('Visual weight and intent. Pass ghost inside a toolbar.');
    // `ghost` is also an option chip in this row, so match the code span by class.
    const code = [...description.querySelectorAll('span')].map((s) => s.className);
    expect(code).toHaveLength(1);
    expect(code[0]).toContain('font-mono');
    expect(code[0]).toContain('bg-inset');
  });

  it('badges required props apart from optional ones', () => {
    expect(within(row('children')).getByText('REQUIRED').className).toContain('text-accent');
    expect(within(row('variant')).getByText('OPTIONAL').className).toContain('text-ink-3');
  });

  it('renders a description only for props that declare one', () => {
    expect(within(row('variant')).getByText(/Visual weight and intent/)).toBeTruthy();
    expect(row('loading').textContent).not.toContain('Visual weight');
  });

  it('chips every enum option and the number range, and nothing for boolean/text', () => {
    // Scoped to the chip strip: "primary" is also the row's default value,
    // and asserting against the whole row would match either one.
    const chips = (name: string) => row(name).querySelector('.flex-wrap')!.textContent;
    expect(chips('variant')).toBe('primarysecondaryghost');
    expect(chips('count')).toBe('1 – 99');
    // A boolean has nothing to enumerate — its row is description + meta only.
    expect(row('loading').textContent).toBe('loadingbooleanOPTIONALdefault falsenot unsettable');
  });

  it('reports the default and unsettable state per the design wording', () => {
    expect(row('variant').textContent).toContain('default primary');
    expect(row('variant').textContent).toContain('not unsettable');
    // allowNone selects have no initial, so they read as an em dash
    expect(row('size').textContent).toContain('default —');
    expect(row('size').textContent).toContain('unsettable');
  });
});

describe('PropsTable — large option sets', () => {
  function renderMany() {
    return render(
      <PropsTable demo={buildDemo({ tone: select(MANY, { initial: 'red' }) })} />,
    );
  }

  it('caps chips at 12, counts the rest, and notes the enum size', () => {
    renderMany();
    expect(screen.getByText('gray')).toBeTruthy(); // 11th — inside the cap
    expect(screen.queryByText('white')).toBeNull(); // 13th — past it
    expect(screen.getByText('+ 1 more')).toBeTruthy();
    expect(screen.getByText('enum · 13 values')).toBeTruthy();
  });

  it('expands to the full list and back', () => {
    renderMany();
    fireEvent.click(screen.getByRole('button', { name: 'Show all 13' }));
    expect(screen.getByText('white')).toBeTruthy();
    expect(screen.queryByText('+ 1 more')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Show fewer' }));
    expect(screen.queryByText('white')).toBeNull();
  });

  it('leaves a 12-value enum untruncated — the cap is inclusive', () => {
    render(<PropsTable demo={buildDemo({ tone: select(MANY.slice(0, 12)) })} />);
    expect(screen.queryByRole('button', { name: /show all/i })).toBeNull();
    expect(screen.queryByText(/enum · /)).toBeNull();
    expect(screen.getByText('black')).toBeTruthy();
  });
});

describe('PropsTable — footer', () => {
  it('carries the design note tying the page to the controls rail', () => {
    render(<PropsTable demo={buildDemo(controls)} />);
    expect(screen.getByText(/wired to the controls rail/)).toBeTruthy();
  });

  it('says so plainly when a demo has no playground', () => {
    const demo = collectDemos({
      'packages/web/ui/src/x.demo.tsx': {
        meta: { title: 'X', group: 'Display' },
        states: [{ name: 'default', render: () => null }],
      },
    })[0]!;
    if (isDemoError(demo)) throw new Error(demo.error);
    render(<PropsTable demo={demo} />);
    expect(screen.getByText('This component has no playground controls.')).toBeTruthy();
  });
});
