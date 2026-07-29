import { fireEvent, render, screen, within } from '@testing-library/react';
import {
  boolean,
  Center,
  collectDemos,
  definePlayground,
  defineState,
  isDemoError,
  select,
  text,
} from '@tickets/ui';
import { StateGrid } from './state-grid';

function buildDemo(mod: Record<string, unknown>) {
  const collected = collectDemos({ './x.demo.tsx': mod })[0]!;
  if (isDemoError(collected)) throw new Error(collected.error);
  return collected;
}

const withPlayground = buildDemo({
  meta: { title: 'Button', group: 'Components' },
  // Authored states exist but are NOT rendered when props can be derived —
  // the viewer shows one section per prop instead.
  states: [{ name: 'hand written', render: () => <button>hand written</button> }],
  playground: definePlayground({
    controls: {
      variant: select(['subtle', 'solid']),
      size: select(['sm', 'md']),
      label: text('New ticket'),
      loading: boolean(false),
    },
    render: (v) => <button>{`${v.variant}/${v.size}${v.loading ? '/loading' : ''}`}</button>,
  }),
});

const withoutPlayground = buildDemo({
  meta: { title: 'Colors', group: 'Foundation' },
  states: [
    { name: 'ramps', render: () => <div>twelve steps</div> },
    { name: 'surfaces', render: () => <div>three surfaces</div> },
  ],
});

function section(name: string): HTMLElement {
  const el = document.getElementById(`button--${name}`);
  if (!el) throw new Error(`expected a section for ${name}`);
  return el;
}

describe('StateGrid', () => {
  it('renders the title and the STATES label', () => {
    render(<StateGrid demo={withPlayground} />);
    expect(screen.getByRole('heading', { name: 'Button' })).toBeTruthy();
    expect(screen.getByText('STATES')).toBeTruthy();
  });

  it('renders one section per enumerable prop, in variant/tone/size order', () => {
    render(<StateGrid demo={withPlayground} />);
    expect(section('variant')).toBeTruthy();
    expect(section('size')).toBeTruthy();
    expect(section('loading')).toBeTruthy();
    // `label` is free text — no honest "every value" to lay out.
    expect(document.getElementById('button--label')).toBeNull();
  });

  it('lays a section out full width rather than in a sized grid', () => {
    const { container } = render(<StateGrid demo={withPlayground} />);
    expect(section('variant').className).toContain('w-full');
    // The old viewer tiled cells into a grid whose column width came from
    // meta.size; sections now stack and each spans the row.
    expect(container.querySelector('.pg-state-grid')).toBeNull();
    expect(container.querySelector('[style*="--demo-cell"]')).toBeNull();
  });

  it('renders one labelled specimen per value, with a stable anchor', () => {
    render(<StateGrid demo={withPlayground} />);
    const variant = section('variant');
    expect(within(variant).getByText('subtle')).toBeTruthy();
    expect(within(variant).getByText('solid')).toBeTruthy();
    expect(document.getElementById('button--variant-solid')).toBeTruthy();
    expect(document.getElementById('button--size-sm')).toBeTruthy();
  });

  it('varies only the section prop, holding the rest at their defaults', () => {
    render(<StateGrid demo={withPlayground} />);
    // Both variant specimens keep size at its default, so the row isolates
    // the one axis it claims to show.
    expect(within(section('variant')).getByText('subtle/sm')).toBeTruthy();
    expect(within(section('variant')).getByText('solid/sm')).toBeTruthy();
  });

  it('does not render the authored states when props can be derived', () => {
    render(<StateGrid demo={withPlayground} />);
    expect(screen.queryByText('hand written')).toBeNull();
  });

  it('offers Preview and Source as a real tablist over one panel', () => {
    render(<StateGrid demo={withPlayground} />);
    const variant = section('variant');
    const tabs = within(variant).getByRole('tablist', { name: 'variant view' });
    expect(within(tabs).getByRole('tab', { name: 'Preview' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    expect(within(tabs).getByRole('tab', { name: 'Source' }).getAttribute('aria-selected')).toBe(
      'false',
    );
    expect(within(variant).getByRole('tabpanel')).toBeTruthy();
  });

  it('shows specimens on Preview and swaps them for the JSX on Source', () => {
    render(<StateGrid demo={withPlayground} />);
    const variant = section('variant');
    expect(within(variant).queryByText(/<Button/)).toBeNull();

    fireEvent.click(within(variant).getByRole('tab', { name: 'Source' }));
    // The pinned axis prop prints even on the default-valued cell, which
    // would otherwise render as a bare `<Button />`.
    expect(within(variant).getByText(/variant="subtle"/)).toBeTruthy();
    expect(within(variant).getByText(/variant="solid"/)).toBeTruthy();
    // Tabs swap the panel — the specimens are gone, not merely pushed down.
    expect(within(variant).queryByText('subtle/sm')).toBeNull();
  });

  it('lists one line per cell, in specimen order, in a single block', () => {
    render(<StateGrid demo={withPlayground} />);
    const variant = section('variant');
    fireEvent.click(within(variant).getByRole('tab', { name: 'Source' }));
    expect(within(variant).getByRole('tabpanel').textContent).toContain(
      '<Button variant="subtle" />\n<Button variant="solid" />',
    );
  });

  it('switches view per section, not for the whole page', () => {
    render(<StateGrid demo={withPlayground} />);
    fireEvent.click(within(section('variant')).getByRole('tab', { name: 'Source' }));
    expect(within(section('variant')).getByText(/variant=/)).toBeTruthy();
    expect(within(section('size')).queryByText(/size=/)).toBeNull();
    expect(
      within(section('size')).getByRole('tab', { name: 'Preview' }).getAttribute('aria-selected'),
    ).toBe('true');
  });

  it('scrolls a tall section rather than pushing the page', () => {
    // A tone grid runs to seventeen rungs and the states list now sits under
    // the playground, so an unbounded section buries everything after it.
    render(<StateGrid demo={withPlayground} />);
    expect(within(section('variant')).getByRole('tabpanel').className).toContain('overflow-auto');
  });

  it('falls back to the authored states when there is no playground to derive from', () => {
    // The Foundation pages are token showcases with no props to enumerate, so
    // deriving would leave them blank.
    render(<StateGrid demo={withoutPlayground} />);
    expect(screen.getByText('twelve steps')).toBeTruthy();
    expect(screen.getByText('three surfaces')).toBeTruthy();
    expect(screen.getByText('ramps')).toBeTruthy();
    expect(document.getElementById('colors--surfaces')).toBeTruthy();
  });
});

const authored = buildDemo({
  meta: { title: 'Button', group: 'Components' },
  states: [
    defineState({
      title: 'icon only',
      render: () => (
        <Center>
          <button aria-label="More">⋯</button>
        </Center>
      ),
    }),
  ],
  playground: definePlayground({
    controls: { variant: select(['subtle', 'solid']) },
    render: (v) => <button>{v.variant}</button>,
  }),
});

// The demo file's own text, as the eager `?raw` glob hands it over.
const AUTHORED_SOURCE = `
const iconOnly = defineState({
  title: 'icon only',
  render: () => (
    <Center>
      <button aria-label="More">⋯</button>
    </Center>
  ),
});
`;

describe('StateGrid with authored sections', () => {
  it('renders the authored sections instead of the derived axes', () => {
    // This is what defineState opts into: the demo owns its page, so the
    // per-prop axes stop being generated for it.
    render(<StateGrid demo={authored} source={AUTHORED_SOURCE} />);
    expect(screen.getByRole('button', { name: 'More' })).toBeTruthy();
    expect(document.getElementById('button--icon-only')).toBeTruthy();
    expect(document.getElementById('button--variant')).toBeNull();
  });

  it('shows the render body from the demo file, not a generated snippet', () => {
    render(<StateGrid demo={authored} source={AUTHORED_SOURCE} />);
    const card = document.getElementById('button--icon-only')!;
    fireEvent.click(within(card).getByRole('tab', { name: 'Source' }));
    // The layout is a component in the body, so it is visible here — the whole
    // reason it is not a `layout` prop on defineState.
    expect(within(card).getByRole('tabpanel').textContent).toContain('<Center>');
    expect(within(card).getByRole('tabpanel').textContent).toContain('aria-label="More"');
  });

  it('hides the tablist when the source could not be read', () => {
    // Better a card with no tabs than a Source tab that opens on nothing.
    render(<StateGrid demo={authored} />);
    const card = document.getElementById('button--icon-only')!;
    expect(within(card).queryByRole('tablist')).toBeNull();
    expect(screen.getByRole('button', { name: 'More' })).toBeTruthy();
  });
});
