import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Tabs } from './tabs';

afterEach(cleanup);

type Id = 'a' | 'b' | 'c';

function renderTabs(overrides: Partial<Parameters<typeof Tabs<Id>>[0]> = {}) {
  const onSelect = vi.fn();
  const props: Parameters<typeof Tabs<Id>>[0] = {
    idBase: 'test',
    activeId: 'a',
    onSelect,
    tabs: [
      { id: 'a', label: 'Alpha', count: 3 },
      { id: 'b', label: 'Beta', count: 0 },
      { id: 'c', label: 'Gamma', count: 5 },
    ],
    ...overrides,
  };
  render(<Tabs {...props} />);
  return { onSelect };
}

describe('Tabs', () => {
  it('renders a tablist with one tab per item, each showing its count', () => {
    renderTabs();
    expect(screen.getByRole('tablist')).toBeInTheDocument();
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(3);
    expect(screen.getByRole('tab', { name: /alpha/i })).toHaveTextContent('3');
    expect(screen.getByRole('tab', { name: /gamma/i })).toHaveTextContent('5');
  });

  it('marks only the active tab aria-selected', () => {
    renderTabs({ activeId: 'b' });
    expect(screen.getByRole('tab', { name: /alpha/i })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('tab', { name: /beta/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /gamma/i })).toHaveAttribute('aria-selected', 'false');
  });

  it('clicking a tab reports its id, whether or not it is already active', () => {
    const { onSelect } = renderTabs({ activeId: 'a' });
    fireEvent.click(screen.getByRole('tab', { name: /gamma/i }));
    expect(onSelect).toHaveBeenCalledWith('c');
  });

  it('a tab with hasError renders its count in red instead of the normal neutral color', () => {
    renderTabs({
      tabs: [
        { id: 'a', label: 'Alpha', count: 3, hasError: true },
        { id: 'b', label: 'Beta', count: 0 },
        { id: 'c', label: 'Gamma', count: 5 },
      ],
    });
    const alphaCount = screen.getByRole('tab', { name: /alpha/i }).querySelector('span:last-child')!;
    const betaCount = screen.getByRole('tab', { name: /beta/i }).querySelector('span:last-child')!;
    expect(alphaCount.className).toMatch(/text-red-400/);
    expect(betaCount.className).not.toMatch(/text-red-400/);
  });
});
