import { fireEvent, render, screen, within } from '@testing-library/react';
import { boolean, collectDemos, definePlayground, isDemoError, select, text } from '@tickets/ui';
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

  it('hides source until asked, then shows the JSX for each specimen', () => {
    render(<StateGrid demo={withPlayground} />);
    const variant = section('variant');
    expect(within(variant).queryByText(/<Button/)).toBeNull();

    fireEvent.click(within(variant).getByRole('button', { name: /source/i }));
    // The pinned axis prop prints even on the default-valued cell, which
    // would otherwise render as a bare `<Button />`.
    expect(within(variant).getByText(/variant="subtle"/)).toBeTruthy();
    expect(within(variant).getByText(/variant="solid"/)).toBeTruthy();
  });

  it('toggles source per section, not for the whole page', () => {
    render(<StateGrid demo={withPlayground} />);
    fireEvent.click(within(section('variant')).getByRole('button', { name: /source/i }));
    expect(within(section('variant')).getAllByText(/variant=/)).toHaveLength(2);
    expect(within(section('size')).queryByText(/size=/)).toBeNull();
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
