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
    expect(p.querySelector('[role="tablist"]')!.className).toContain('bg-surface-inset');
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
  // The half of the SegmentedControl merge that could silently regress. Every
  // call site it absorbed is a toggle group — density, view mode, status
  // filter, SDK platform, file picker — none of which reveals a panel.
  // Announcing those as tabs tells a screen-reader user to expect panels that
  // do not exist.
  it('role="group" renders toggle buttons, not tabs', () => {
    render(<Tabs role="group" variant="pill" items={items} value="board" onChange={() => {}} />);
    expect(screen.getByRole('group')).toBeTruthy();
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(screen.queryAllByRole('tab')).toHaveLength(0);

    const buttons = screen.getAllByRole('button');
    expect(buttons[0]!.getAttribute('aria-pressed')).toBe('true');
    expect(buttons[1]!.getAttribute('aria-pressed')).toBe('false');
    // A `tab` must never also claim aria-pressed, and a toggle must never
    // claim aria-selected — the pair switches together or not at all.
    expect(buttons[0]!.hasAttribute('aria-selected')).toBe(false);
  });

  it('tablist items never carry aria-pressed', () => {
    render(<Tabs items={items} value="board" onChange={() => {}} />);
    expect(screen.getByRole('tab', { name: 'Board' }).hasAttribute('aria-pressed')).toBe(false);
  });

  it('the active item follows tone rather than a fixed indigo', () => {
    const { container } = render(
      <Tabs variant="rail" tone="success" items={items} value="board" onChange={() => {}} />,
    );
    const active = container.querySelector('[aria-selected="true"]')!;
    expect(active.className).toContain('bg-green-3');
    expect(active.className).toContain('text-green-9');
  });

  it('size pads each variant to suit its own shape', () => {
    const { container: sm } = render(
      <Tabs variant="pill" size="sm" items={items} value="board" onChange={() => {}} />,
    );
    expect(sm.querySelector('[role="tab"]')!.className).toContain('px-2');
    const { container: lg } = render(
      <Tabs variant="pill" size="lg" items={items} value="board" onChange={() => {}} />,
    );
    expect(lg.querySelector('[role="tab"]')!.className).toContain('px-3.5');
  });

  it('accepts an accessible label on the tablist, omitted when unset', () => {
    const { rerender } = render(<Tabs items={items} value="board" onChange={() => {}} label="Type" />);
    expect(screen.getByRole('tablist', { name: 'Type' })).toBeTruthy();
    rerender(<Tabs items={items} value="board" onChange={() => {}} />);
    expect(screen.getByRole('tablist').hasAttribute('aria-label')).toBe(false);
  });
});
