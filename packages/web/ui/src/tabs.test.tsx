import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Tabs } from './tabs';

const items = [
  { value: 'board', label: 'Board' },
  { value: 'table', label: 'Table', badge: <span>128</span> },
];

describe('Tabs', () => {
  it('renders a real tablist with aria-selected', () => {
    render(<Tabs items={items} value="board" onChange={() => {}} />);
    expect(screen.getByRole('tablist')).toBeTruthy();
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(2);
    expect(tabs[0]!.getAttribute('aria-selected')).toBe('true');
    expect(tabs[1]!.getAttribute('aria-selected')).toBe('false');
  });
  it('fires onChange with the item value', () => {
    const onChange = vi.fn();
    render(<Tabs items={items} value="board" onChange={onChange} />);
    screen.getByRole('tab', { name: /Table/ }).click();
    expect(onChange).toHaveBeenCalledWith('table');
  });
  it('variant classes: underline default, pill track, rail vertical', () => {
    const { container: u } = render(<Tabs items={items} value="board" onChange={() => {}} />);
    expect(u.querySelector('[role="tablist"]')!.className).toContain('border-b');
    const { container: p } = render(<Tabs variant="pill" items={items} value="board" onChange={() => {}} />);
    expect(p.querySelector('[role="tablist"]')!.className).toContain('bg-inset');
    const { container: r } = render(<Tabs variant="rail" items={items} value="board" onChange={() => {}} />);
    expect(r.querySelector('[role="tablist"]')!.className).toContain('flex-col');
  });
  it('renders badges', () => {
    render(<Tabs items={items} value="board" onChange={() => {}} />);
    expect(screen.getByText('128')).toBeTruthy();
  });
  it('renders a numeric 0 badge instead of swallowing it, and renders no badge element when absent', () => {
    const zeroItems = [
      { value: 'board', label: 'Board', badge: 0 },
      { value: 'table', label: 'Table' },
    ];
    render(<Tabs items={zeroItems} value="board" onChange={() => {}} />);
    expect(screen.getByText('0')).toBeTruthy();
    const tableTab = screen.getByRole('tab', { name: 'Table' });
    expect(tableTab.querySelector('span')).toBeNull();
  });
  it('accepts an accessible label on the tablist, omitted when unset', () => {
    const { rerender } = render(<Tabs items={items} value="board" onChange={() => {}} label="Type" />);
    expect(screen.getByRole('tablist', { name: 'Type' })).toBeTruthy();
    rerender(<Tabs items={items} value="board" onChange={() => {}} />);
    expect(screen.getByRole('tablist').hasAttribute('aria-label')).toBe(false);
  });
});
