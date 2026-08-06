import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TextAreaField, type TextAreaFieldConfig } from './textarea-field';

const base = { name: 'body', loading: false, onBlur: vi.fn(), config: {} };

/** Feeds `onChange` back into `value`, the way the form engine does. */
function Controlled({ config = {} as TextAreaFieldConfig }) {
  const [value, setValue] = useState('');
  return <TextAreaField {...base} config={config} value={value} onChange={setValue} />;
}

describe('TextAreaField', () => {
  it('round-trips what the user types through its parent', async () => {
    render(<Controlled />);
    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'ab');
    expect(input).toHaveValue('ab');
  });

  it('reports each keystroke to onChange', async () => {
    const onChange = vi.fn();
    render(<TextAreaField {...base} value="" onChange={onChange} />);
    await userEvent.type(screen.getByRole('textbox'), 'a');
    expect(onChange).toHaveBeenCalledWith('a');
  });

  it('defaults to four rows and honours an override', () => {
    const { rerender } = render(<TextAreaField {...base} value="" onChange={vi.fn()} />);
    expect(screen.getByRole('textbox')).toHaveAttribute('rows', '4');
    rerender(<TextAreaField {...base} config={{ rows: 10 }} value="" onChange={vi.fn()} />);
    expect(screen.getByRole('textbox')).toHaveAttribute('rows', '10');
  });

  // The proof it holds no state: with `value` pinned by the parent, typing
  // cannot change what is displayed.
  it('shows only what its parent gives it', async () => {
    render(<TextAreaField {...base} value="fixed" onChange={vi.fn()} />);
    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'more');
    expect(input).toHaveValue('fixed');
  });

  it('marks itself invalid when the engine passes an error', () => {
    render(<TextAreaField {...base} value="" onChange={vi.fn()} error="Required" />);
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
  });

  it('is disabled when the engine says so', () => {
    render(<TextAreaField {...base} value="" onChange={vi.fn()} disabled />);
    expect(screen.getByRole('textbox')).toBeDisabled();
  });
});
