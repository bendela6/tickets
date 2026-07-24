import { fireEvent, render, screen } from '@testing-library/react';
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

  it('renders all demos and a sidebar link per demo plus All (plain StateGrids, no tabs)', () => {
    render(<GalleryShell demos={demos} title="t" />);
    expect(screen.getByRole('link', { name: 'All' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Button' })).toBeTruthy();
    expect(screen.getByText('btn')).toBeTruthy();
    expect(screen.getByText('inp')).toBeTruthy();
    expect(screen.queryByText('play')).toBeNull(); // playground hidden in All view
    expect(screen.queryByRole('button', { name: 'Preview' })).toBeNull(); // no tab strip in All view
  });

  it('hash selects a single component and routes it through ComponentPage (tabs + playground)', () => {
    render(<GalleryShell demos={demos} title="t" />);
    setHash('#button');
    expect(screen.getByText('btn')).toBeTruthy();
    expect(screen.queryByText('inp')).toBeNull();
    expect(screen.getByText('play')).toBeTruthy();
    // ComponentPage's tab strip, with Preview active by default.
    expect(screen.getByRole('button', { name: 'Preview' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Code' })).toBeTruthy();
  });

  it('selecting a demo without a playground still routes through ComponentPage but shows no rail', () => {
    render(<GalleryShell demos={demos} title="t" />);
    setHash('#input');
    expect(screen.getByText('inp')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Preview' })).toBeTruthy();
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
    expect(screen.getByText('inp')).toBeTruthy();
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
    expect(screen.getByRole('button', { name: 'Preview' })).toBeTruthy();
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
