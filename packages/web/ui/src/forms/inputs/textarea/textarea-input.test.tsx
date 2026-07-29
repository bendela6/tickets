import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TextareaInput, type TextareaInputConfig } from './textarea-input';

const base = { name: 'body', loading: false, onBlur: vi.fn(), config: {} };

/** Feeds `onChange` back into `value`, the way the form engine does. */
function Controlled({ config = {} as TextareaInputConfig }) {
  const [value, setValue] = useState('');
  return <TextareaInput {...base} config={config} value={value} onChange={setValue} />;
}

describe('TextareaInput', () => {
  it('round-trips what the user types through its parent', async () => {
    render(<Controlled />);
    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'ab');
    expect(input).toHaveValue('ab');
  });

  it('reports each keystroke to onChange', async () => {
    const onChange = vi.fn();
    render(<TextareaInput {...base} value="" onChange={onChange} />);
    await userEvent.type(screen.getByRole('textbox'), 'a');
    expect(onChange).toHaveBeenCalledWith('a');
  });

  it('defaults to four rows and honours an override', () => {
    const { rerender } = render(<TextareaInput {...base} value="" onChange={vi.fn()} />);
    expect(screen.getByRole('textbox')).toHaveAttribute('rows', '4');
    rerender(<TextareaInput {...base} config={{ rows: 10 }} value="" onChange={vi.fn()} />);
    expect(screen.getByRole('textbox')).toHaveAttribute('rows', '10');
  });

  it('marks itself invalid when the engine passes an error', () => {
    render(<TextareaInput {...base} value="" onChange={vi.fn()} error="Required" />);
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
  });

  it('is disabled when the engine says so', () => {
    render(<TextareaInput {...base} value="" onChange={vi.fn()} disabled />);
    expect(screen.getByRole('textbox')).toBeDisabled();
  });
});
