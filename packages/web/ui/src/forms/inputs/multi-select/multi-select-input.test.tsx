import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MultiSelectInput } from './multi-select-input';

const OPTIONS = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
];
const base = { name: 'labels', loading: false, onBlur: vi.fn(), config: { options: OPTIONS } };

describe('MultiSelectInput', () => {
  it('shows every selected option', () => {
    render(<MultiSelectInput {...base} value={['a', 'b']} onChange={vi.fn()} />);
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
  });

  it('adds the option the user picks to the existing selection', async () => {
    const onChange = vi.fn();
    render(<MultiSelectInput {...base} value={['a']} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button'));
    await userEvent.click(screen.getByText('Beta'));
    expect(onChange).toHaveBeenCalledWith(['a', 'b']);
  });

  it('treats an unset value as an empty selection', () => {
    render(
      <MultiSelectInput {...base} value={undefined as unknown as string[]} onChange={vi.fn()} />,
    );
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('is disabled while the engine resolves async config', () => {
    render(<MultiSelectInput {...base} value={[]} onChange={vi.fn()} loading />);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
