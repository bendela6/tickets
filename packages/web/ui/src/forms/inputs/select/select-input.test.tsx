import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SelectInput } from './select-input';

const OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'high', label: 'High' },
];
const base = { name: 'priority', loading: false, onBlur: vi.fn(), config: { options: OPTIONS } };

describe('SelectInput', () => {
  it('shows the selected option', () => {
    render(<SelectInput {...base} value="high" onChange={vi.fn()} />);
    expect(screen.getByText('High')).toBeInTheDocument();
  });

  it('reports the option the user picks', async () => {
    const onChange = vi.fn();
    render(<SelectInput {...base} value={null} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button'));
    await userEvent.click(screen.getByText('Low'));
    expect(onChange).toHaveBeenCalledWith('low');
  });

  it('tolerates config whose options have not resolved yet', () => {
    render(<SelectInput {...base} config={{}} value={null} onChange={vi.fn()} loading />);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('is disabled while the engine resolves async config', () => {
    render(<SelectInput {...base} value={null} onChange={vi.fn()} loading />);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('is disabled when the engine says so', () => {
    render(<SelectInput {...base} value={null} onChange={vi.fn()} disabled />);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
