import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { twoZoneRaw } from '../../test/models';
import { renderDiagram } from '../../test/render';
import { SidePanel } from './side-panel';

afterEach(cleanup);

async function render() {
  return renderDiagram(<SidePanel />, twoZoneRaw());
}

describe('SidePanel', () => {
  it('shows the detail content and defaults to 320px wide', async () => {
    const { container } = await render();
    expect(screen.getByText('Overview')).toBeInTheDocument();
    const aside = container.querySelector('aside') as HTMLElement;
    expect(aside.style.getPropertyValue('--sidebar-w')).toBe('320px');
  });

  it('collapses to an expand-only rail and restores', async () => {
    await render();
    fireEvent.click(screen.getByRole('button', { name: 'Collapse panel' }));
    // content gone, only the expand affordance remains
    expect(screen.queryByText('Overview')).not.toBeInTheDocument();
    const expand = screen.getByRole('button', { name: 'Expand panel' });
    expect(expand).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(expand);
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Expand panel' })).not.toBeInTheDocument();
  });

  it('dragging the resize handle sets the width from the cursor, clamped', async () => {
    const { container } = await render();
    const aside = container.querySelector('aside') as HTMLElement;
    const handle = screen.getByRole('separator', { name: 'Resize panel' });

    // jsdom's window.innerWidth defaults to 1024; a left edge at clientX=700
    // means the panel spans 1024-700 = 324px.
    fireEvent.pointerDown(handle);
    fireEvent.pointerMove(window, { clientX: 700 });
    expect(aside.style.getPropertyValue('--sidebar-w')).toBe('324px');

    // past the max: clientX=100 → 924px requested, clamped to 640.
    fireEvent.pointerMove(window, { clientX: 100 });
    expect(aside.style.getPropertyValue('--sidebar-w')).toBe('640px');

    // below the min: clientX=1000 → 24px requested, clamped to 240.
    fireEvent.pointerMove(window, { clientX: 1000 });
    expect(aside.style.getPropertyValue('--sidebar-w')).toBe('240px');

    // after release, further moves are ignored.
    fireEvent.pointerUp(window);
    fireEvent.pointerMove(window, { clientX: 500 });
    expect(aside.style.getPropertyValue('--sidebar-w')).toBe('240px');
  });

  it('resizes by keyboard on the handle', async () => {
    const { container } = await render();
    const aside = container.querySelector('aside') as HTMLElement;
    const handle = screen.getByRole('separator', { name: 'Resize panel' });
    fireEvent.keyDown(handle, { key: 'ArrowLeft' }); // widen
    expect(aside.style.getPropertyValue('--sidebar-w')).toBe('344px');
    fireEvent.keyDown(handle, { key: 'ArrowRight' }); // narrow
    fireEvent.keyDown(handle, { key: 'ArrowRight' });
    expect(aside.style.getPropertyValue('--sidebar-w')).toBe('296px');
  });
});
