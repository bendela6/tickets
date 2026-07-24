import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SegmentedControl } from './segmented-control';

const options = [
  { value: 'board', label: 'Board' },
  { value: 'table', label: 'Table' },
];

describe('SegmentedControl', () => {
  it('renders an inset track container', () => {
    const { container } = render(
      <SegmentedControl options={options} value="board" onChange={() => {}} />,
    );
    expect(container.firstElementChild!.className).toContain('bg-inset');
  });

  it('sets aria-pressed on the active option only', () => {
    render(<SegmentedControl options={options} value="board" onChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'Board' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Table' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('fires onChange with the option value', () => {
    const onChange = vi.fn();
    render(<SegmentedControl options={options} value="board" onChange={onChange} />);
    screen.getByRole('button', { name: 'Table' }).click();
    expect(onChange).toHaveBeenCalledWith('table');
  });

  it('renders an icon and exposes an accessible name for an icon-only option', () => {
    const iconOptions = [
      { value: 'columns', icon: 'columns' as const },
      { value: 'rows', icon: 'rows' as const },
    ];
    render(<SegmentedControl options={iconOptions} value="columns" onChange={() => {}} />);
    const button = screen.getByRole('button', { name: 'columns' });
    expect(button.querySelector('svg')).toBeTruthy();
    expect(button.getAttribute('aria-label')).toBe('columns');
  });

  it('does not set aria-label when a label is present, even an icon+label combo', () => {
    render(
      <SegmentedControl
        options={[{ value: 'board', label: 'Board', icon: 'columns' as const }]}
        value="board"
        onChange={() => {}}
      />,
    );
    const button = screen.getByRole('button', { name: 'Board' });
    expect(button.hasAttribute('aria-label')).toBe(false);
  });

  it('renders a numeric 0 label instead of swallowing it', () => {
    render(
      <SegmentedControl
        options={[{ value: 'open', label: 0 }]}
        value="open"
        onChange={() => {}}
      />,
    );
    expect(screen.getByText('0')).toBeTruthy();
  });
});
