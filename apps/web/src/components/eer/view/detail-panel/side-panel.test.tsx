import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { twoZoneRaw } from '../../test/models';
import { renderDiagram } from '../../test/render';
import { SidePanel } from './side-panel';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

async function render() {
  return renderDiagram(<SidePanel />, twoZoneRaw());
}

describe('SidePanel', () => {
  it('shows the detail content and defaults to 320px wide', async () => {
    const { container } = await render();
    expect(screen.getByText('Overview')).toBeInTheDocument();
    const aside = container.querySelector('aside') as HTMLElement;
    expect(aside.style.getPropertyValue('--panel-w')).toBe('320px');
  });

  it('collapses to an expand-only rail and restores', async () => {
    await render();
    fireEvent.click(screen.getByRole('button', { name: 'Hide Details' }));
    expect(screen.queryByText('Overview')).not.toBeInTheDocument();

    const expand = screen.getByRole('button', { name: 'Show Details' });
    expect(expand).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(expand);
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Show Details' })).not.toBeInTheDocument();
  });

  it('resizes by keyboard, clamped to the panel bounds', async () => {
    const { container } = await render();
    const aside = container.querySelector('aside') as HTMLElement;
    const handle = screen.getByRole('separator', { name: 'Resize Details' });
    // A right-docked panel widens leftward.
    fireEvent.keyDown(handle, { key: 'ArrowLeft' });
    expect(aside.style.getPropertyValue('--panel-w')).toBe('344px');
    fireEvent.keyDown(handle, { key: 'ArrowRight' });
    fireEvent.keyDown(handle, { key: 'ArrowRight' });
    expect(aside.style.getPropertyValue('--panel-w')).toBe('296px');

    for (let i = 0; i < 40; i += 1) fireEvent.keyDown(handle, { key: 'ArrowLeft' });
    expect(aside.style.getPropertyValue('--panel-w')).toBe('640px');
  });

  it('remembers its width across a remount', async () => {
    const first = await render();
    fireEvent.keyDown(screen.getByRole('separator', { name: 'Resize Details' }), {
      key: 'ArrowLeft',
    });
    first.unmount();

    const { container } = await render();
    const aside = container.querySelector('aside') as HTMLElement;
    expect(aside.style.getPropertyValue('--panel-w')).toBe('344px');
  });
});
