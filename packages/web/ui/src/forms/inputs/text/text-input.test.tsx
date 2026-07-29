import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TextInput } from './text-input';

const base = { name: 'title', loading: false, onBlur: vi.fn(), config: {} };

describe('TextInput', () => {
  it('reports what the user types', async () => {
    const onChange = vi.fn();
    render(<TextInput {...base} value="" onChange={onChange} />);
    await userEvent.type(screen.getByRole('textbox'), 'hi');
    expect(onChange).toHaveBeenLastCalledWith('hi');
  });

  it('renders an undefined value as an empty controlled input', () => {
    render(<TextInput {...base} value={undefined as unknown as string} onChange={vi.fn()} />);
    expect(screen.getByRole('textbox')).toHaveValue('');
  });

  it('fires onBlur so the engine can mark the field touched', async () => {
    const onBlur = vi.fn();
    render(<TextInput {...base} onBlur={onBlur} value="" onChange={vi.fn()} />);
    await userEvent.click(screen.getByRole('textbox'));
    await userEvent.tab();
    expect(onBlur).toHaveBeenCalled();
  });

  it('marks itself invalid when the engine passes an error', () => {
    render(<TextInput {...base} value="" onChange={vi.fn()} error="Required" />);
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
  });

  it('renders the prefix slot when configured', () => {
    render(<TextInput {...base} config={{ prefix: 'https://' }} value="" onChange={vi.fn()} />);
    expect(screen.getByText('https://')).toBeInTheDocument();
  });

  it('passes the placeholder through', () => {
    render(<TextInput {...base} config={{ placeholder: 'Ticket title' }} value="" onChange={vi.fn()} />);
    expect(screen.getByPlaceholderText('Ticket title')).toBeInTheDocument();
  });

  it('is disabled when the engine says so', () => {
    render(<TextInput {...base} value="" onChange={vi.fn()} disabled />);
    expect(screen.getByRole('textbox')).toBeDisabled();
  });
});
