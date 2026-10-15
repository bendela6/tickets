import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TabsField } from './tabs-field';

const OPTIONS = [
  { value: 'open', label: 'Open', count: 12 },
  { value: 'resolved', label: 'Resolved', count: 40 },
  { value: 'ignored', label: 'Ignored' },
];
const base = { name: 'status', loading: false, onBlur: vi.fn(), config: { options: OPTIONS } };

describe('TabsField', () => {
  it('draws each option as a tab, its count as the badge', () => {
    render(<TabsField {...base} value="open" onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Open 12' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Resolved 40' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    // No count, no badge.
    expect(screen.getByRole('button', { name: 'Ignored' })).toBeInTheDocument();
  });

  it('reports the tab the user picks', async () => {
    const onChange = vi.fn();
    render(<TabsField {...base} value="open" onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Resolved 40' }));
    expect(onChange).toHaveBeenCalledWith('resolved');
  });

  it('is a group named by its config’s label, then the field’s, then its name', () => {
    const { rerender } = render(<TabsField {...base} value="" onChange={vi.fn()} />);
    expect(screen.getByRole('group', { name: 'status' })).toBeInTheDocument();
    rerender(<TabsField {...base} label="Status" value="" onChange={vi.fn()} />);
    expect(screen.getByRole('group', { name: 'Status' })).toBeInTheDocument();
    rerender(
      <TabsField
        {...base}
        label="Status"
        config={{ options: OPTIONS, label: 'Issue status' }}
        value=""
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByRole('group', { name: 'Issue status' })).toBeInTheDocument();
  });

  it('is read-only when the engine says so: a click changes nothing', async () => {
    const onChange = vi.fn();
    render(<TabsField {...base} value="open" onChange={onChange} readOnly />);
    const resolved = screen.getByRole('button', { name: 'Resolved 40' });
    expect(resolved).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(resolved);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('is disabled while the engine resolves async config', () => {
    render(<TabsField {...base} value="" onChange={vi.fn()} loading />);
    expect(screen.getByRole('group')).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('button', { name: 'Open 12' })).toBeDisabled();
  });
});
