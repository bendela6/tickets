import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { GalleryShell } from './gallery-shell';
import { collectDemos, boolean as booleanControl, definePlayground } from '@tickets/ui/gallery';

const demos = collectDemos({
  'a': { meta: { title: 'Button', group: 'Form controls' }, states: [{ name: 'primary', render: () => <b>btn</b> }, { name: 'primary2', render: () => <b>btn2</b> }],
         playground: definePlayground({ controls: { on: booleanControl() }, render: () => <i>play</i> }) },
  'b': { meta: { title: 'Input', group: 'Form controls' }, states: [{ name: 'basic', render: () => <b>inp</b> }] },
});

function setHash(h: string) {
  window.location.hash = h;
  fireEvent(window, new HashChangeEvent('hashchange'));
}

describe('GalleryShell v2', () => {
  afterEach(() => { window.location.hash = ''; });

  it('renders a sidebar link per demo plus All, and no tab strip in the All view', () => {
    render(<GalleryShell demos={demos} title="t" />);
    expect(screen.getByRole('link', { name: 'All' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Button' })).toBeTruthy();
    expect(screen.queryByRole('tab', { name: 'Preview' })).toBeNull();
  });

  it('the All view is docs plus one preview per component — no state grids', () => {
    render(<GalleryShell demos={demos} title="t" />);
    // Both components are present, by heading...
    expect(screen.getByRole('heading', { name: 'Button' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Input' })).toBeTruthy();
    // ...with docs under them: Button's `on` control renders as a prop row.
    expect(screen.getByText('API')).toBeTruthy();
    expect(screen.getByText('on')).toBeTruthy();
    // Input has no playground, so it says so rather than vanishing from the index.
    expect(screen.getByText('This component has no playground controls.')).toBeTruthy();

    // The preview shows the playground at its defaults where there is one,
    // and falls back to the first state where there isn't.
    expect(screen.getAllByText('PREVIEW')).toHaveLength(2);
    expect(screen.getByText('play')).toBeTruthy(); // Button: playground
    expect(screen.getByText('inp')).toBeTruthy(); // Input: first state

    // The state grid itself stays on the Preview tab: only ONE instance each,
    // not a card per state.
    expect(screen.queryByText('btn')).toBeNull();
    expect(screen.queryByText('btn2')).toBeNull();
    expect(screen.queryByText('STATES')).toBeNull();
    expect(document.querySelectorAll('figure')).toHaveLength(0);
  });

  it('holds the preview back until there is room for it beside the docs', () => {
    render(<GalleryShell demos={demos} title="t" />);
    const preview = screen.getAllByText('PREVIEW')[0]!.closest('section')!.lastElementChild!
      .lastElementChild!;
    // jsdom applies no media queries, so the gate is asserted on the class.
    expect(preview.className).toContain('hidden');
    expect(preview.className).toContain('2xl:block');
  });

  it('gives no preview column to a full-width demo, which cannot fit beside 800px of docs', () => {
    const wide = collectDemos({
      c: {
        meta: { title: 'Wide', group: 'Display', size: 'full' },
        states: [{ name: 'only', render: () => <b>wide-state</b> }],
      },
    });
    render(<GalleryShell demos={[...demos, ...wide]} title="t" />);
    const section = screen.getByRole('heading', { name: 'Wide' }).closest('section')!;
    expect(within(section).queryByText('PREVIEW')).toBeNull();
    expect(screen.queryByText('wide-state')).toBeNull();
  });

  it('keeps the per-component anchor in the All view', () => {
    render(<GalleryShell demos={demos} title="t" />);
    expect(document.getElementById('button')).toBeTruthy();
    expect(document.getElementById('input')).toBeTruthy();
  });

  it('separates and heads each docs entry, with jump links into the component', () => {
    render(<GalleryShell demos={demos} title="t" />);
    const heading = screen.getByRole('heading', { name: 'Button' });
    // A real heading at heading size, not the small uppercase state-grid label.
    expect(heading.className).toContain('text-heading');

    const section = heading.closest('section')!;
    // A 2px rule in the control tone, not a hairline — and the first entry
    // draws none above it.
    expect(section.className).toContain('border-t-2');
    expect(section.className).toContain('border-control');
    expect(section.className).toContain('first:border-t-0');
    // The rule spans the column; only the content inside keeps the measure.
    expect(section.className).not.toContain('max-w');
    expect(heading.parentElement!.parentElement!.className).toContain('max-w');

    const links = [...section.querySelectorAll('a')].map((a) => [a.textContent, a.getAttribute('href')]);
    expect(links).toEqual([
      ['Preview', '#button::preview'],
      ['Implementation', '#button::impl'],
      ['Demo', '#button::demo'],
    ]);
  });

  it('a tab-targeting hash opens the component on that tab', () => {
    render(<GalleryShell demos={demos} title="t" />);
    setHash('#button::impl');
    expect(screen.getByRole('tab', { name: 'Implementation' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    expect(screen.getByRole('tab', { name: 'Preview' }).getAttribute('aria-selected')).toBe('false');

    // Switching target on an already-selected component still moves the tab —
    // ComponentPage is keyed by slug, so this can't rely on a remount.
    setHash('#button::demo');
    expect(screen.getByRole('tab', { name: 'Demo' }).getAttribute('aria-selected')).toBe('true');
  });

  it('ignores an unknown tab name rather than blanking the page', () => {
    render(<GalleryShell demos={demos} title="t" />);
    setHash('#button::nope');
    expect(screen.getByRole('tab', { name: 'Preview' }).getAttribute('aria-selected')).toBe('true');
  });

  it('drops the controls-rail note in the All view, where there is no rail', () => {
    render(<GalleryShell demos={demos} title="t" />);
    expect(screen.queryByText(/wired to the controls rail/)).toBeNull();

    // Selecting the component brings the note back with the Docs pane — which
    // is mounted from the start (hidden, not unmounted), so its presence in
    // the DOM is the assertion, not its visibility.
    setHash('#button');
    expect(screen.getByText(/wired to the controls rail/)).toBeTruthy();
  });

  it('hash selects a single component and routes it through ComponentPage (tabs + playground)', () => {
    render(<GalleryShell demos={demos} title="t" />);
    setHash('#button');
    expect(screen.getByText('btn')).toBeTruthy();
    expect(screen.queryByText('inp')).toBeNull();
    expect(screen.getByText('play')).toBeTruthy();
    // ComponentPage's tab strip, with Preview active by default.
    expect(screen.getByRole('tab', { name: 'Preview' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Docs' })).toBeTruthy();
  });

  it('selecting a demo without a playground still routes through ComponentPage but shows no rail', () => {
    render(<GalleryShell demos={demos} title="t" />);
    setHash('#input');
    expect(screen.getByText('inp')).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Preview' })).toBeTruthy();
    expect(screen.queryByText('CONTROLS')).toBeNull();
  });

  it('state-anchor hash selects the owning component', () => {
    render(<GalleryShell demos={demos} title="t" />);
    setHash('#button--primary');
    expect(screen.queryByText('inp')).toBeNull();
    expect(screen.getByText('btn')).toBeTruthy();
  });

  it('unknown hash falls back to All', () => {
    render(<GalleryShell demos={demos} title="t" />);
    setHash('#nope');
    expect(screen.getByRole('heading', { name: 'Input' })).toBeTruthy();
    expect(screen.queryByRole('tab', { name: 'Preview' })).toBeNull();
  });

  it('re-scrolls when moving between state anchors of the same component', () => {
    const spy = vi.spyOn(Element.prototype, 'scrollIntoView');
    render(<GalleryShell demos={demos} title="t" />);
    setHash('#button--primary');
    const first = spy.mock.calls.length;
    expect(first).toBeGreaterThan(0);
    setHash('#button--primary2');
    expect(spy.mock.calls.length).toBeGreaterThan(first);
    spy.mockRestore();
  });

  it('passes sources[demo.path] through to ComponentPage', () => {
    const button = demos.find((d) => 'slug' in d && d.slug === 'button');
    if (!button || !('path' in button)) throw new Error('fixture missing button demo');
    render(<GalleryShell demos={demos} title="t" sources={{ [button.path]: 'export const x = 1;' }} />);
    setHash('#button');
    // Source tab is still a placeholder in this task; just assert selection
    // didn't crash with sources wired up (Code/Source tabs land in Task 5).
    expect(screen.getByRole('tab', { name: 'Preview' })).toBeTruthy();
  });

  it('filter input narrows sidebar links (type "butt" → Button remains, Input gone, empty groups hide)', () => {
    render(<GalleryShell demos={demos} title="t" />);

    const filterInput = screen.getByPlaceholderText('Filter components…') as HTMLInputElement;
    fireEvent.change(filterInput, { target: { value: 'butt' } });

    expect(screen.getByRole('link', { name: 'Button' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Input' })).toBeNull();
  });

  it('ctrl+K keydown opens the palette', () => {
    render(<GalleryShell demos={demos} title="t" />);

    fireEvent(window, new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));

    // The palette's search input should be visible when open
    const paletteInput = screen.getAllByPlaceholderText('');
    expect(paletteInput.length).toBeGreaterThan(0);
  });

  it('⌘K chip in filter input opens the palette', () => {
    render(<GalleryShell demos={demos} title="t" />);

    const cmdKButton = screen.getByRole('button', { name: '⌘K' });
    fireEvent.click(cmdKButton);

    // The palette's search input should be visible when open
    const paletteInput = screen.getAllByPlaceholderText('');
    expect(paletteInput.length).toBeGreaterThan(0);
  });
});
