import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { GalleryShell } from './gallery-shell';
import { collectDemos } from './collect-demos';
import { boolean as booleanControl, definePlayground } from './controls';

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

  it('renders all demos and a sidebar link per demo plus All', () => {
    render(<GalleryShell demos={demos} title="t" />);
    expect(screen.getByRole('link', { name: 'All' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Button' })).toBeTruthy();
    expect(screen.getByText('btn')).toBeTruthy();
    expect(screen.getByText('inp')).toBeTruthy();
    expect(screen.queryByText('play')).toBeNull(); // playground hidden in All view
  });

  it('hash selects a single component and shows its playground', () => {
    render(<GalleryShell demos={demos} title="t" />);
    setHash('#button');
    expect(screen.getByText('btn')).toBeTruthy();
    expect(screen.queryByText('inp')).toBeNull();
    expect(screen.getByText('play')).toBeTruthy();
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
});
