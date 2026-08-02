import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppShell } from './app-shell';

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
  useRouterState: ({ select }: { select: (state: unknown) => unknown }) =>
    select({ location: { pathname: '/', search: {} } }),
}));

// The shell's own layout is under test, not what the panels put inside it.
vi.mock('./activity-rail', () => ({ ActivityRail: () => <div>rail</div> }));
vi.mock('./brand-mark', () => ({ BrandMark: () => <span>mark</span> }));
vi.mock('./mode-panel', () => ({ ModePanel: () => <div>panel body</div> }));

afterEach(() => localStorage.clear());

const renderShell = () => render(<AppShell><p>content</p></AppShell>);
const dockedWidth = () =>
  (document.querySelector('aside') as HTMLElement).style.getPropertyValue('--panel-w');

describe('AppShell', () => {
  it('docks the navigation in a resizable panel', () => {
    renderShell();
    expect(screen.getByText('panel body')).toBeInTheDocument();
    expect(screen.getByRole('separator', { name: 'Resize Navigation' })).toBeInTheDocument();
    expect(dockedWidth()).toBe('224px');
  });

  it('collapses the navigation and remembers that across a remount', async () => {
    const { unmount } = renderShell();
    await userEvent.click(screen.getByRole('button', { name: 'Hide Navigation' }));
    expect(screen.queryByText('panel body')).not.toBeInTheDocument();
    unmount();

    renderShell();
    expect(screen.queryByText('panel body')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Show Navigation' }));
    expect(screen.getByText('panel body')).toBeInTheDocument();
  });

  it('remembers a resized width across a remount', () => {
    const { unmount } = renderShell();
    fireEvent.keyDown(screen.getByRole('separator', { name: 'Resize Navigation' }), {
      key: 'ArrowRight',
    });
    expect(dockedWidth()).toBe('248px');
    unmount();

    renderShell();
    expect(dockedWidth()).toBe('248px');
  });

  it('opens the mobile navigation as a dialog that Escape closes', async () => {
    // Esc did nothing here before: the old slide-over was a bare fixed aside.
    renderShell();
    await userEvent.click(screen.getByRole('button', { name: 'Open navigation' }));
    expect(screen.getByRole('dialog', { name: 'Navigation' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
