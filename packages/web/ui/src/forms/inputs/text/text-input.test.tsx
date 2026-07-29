import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TextInput, type TextInputConfig } from './text-input';

const base = { name: 'title', loading: false, onBlur: vi.fn(), config: {} };

/** Feeds `onChange` back into `value`, the way the form engine does. */
function Controlled({ config = {} as TextInputConfig }) {
  const [value, setValue] = useState('');
  return <TextInput {...base} config={config} value={value} onChange={setValue} />;
}

describe('TextInput', () => {
  it('round-trips what the user types through its parent', async () => {
    render(<Controlled />);
    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'hi');
    expect(input).toHaveValue('hi');
  });

  it('reports each keystroke to onChange', async () => {
    const onChange = vi.fn();
    render(<TextInput {...base} value="" onChange={onChange} />);
    await userEvent.type(screen.getByRole('textbox'), 'h');
    expect(onChange).toHaveBeenCalledWith('h');
  });

  // The proof it holds no state: with `value` pinned by the parent, typing
  // cannot change what is displayed.
  it('shows only what its parent gives it', async () => {
    render(<TextInput {...base} value="fixed" onChange={vi.fn()} />);
    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'more');
    expect(input).toHaveValue('fixed');
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
