import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TextareaInput } from './textarea-input';

const base = { name: 'body', loading: false, onBlur: vi.fn(), config: {} };

describe('TextareaInput', () => {
  it('reports what the user types', async () => {
    const onChange = vi.fn();
    render(<TextareaInput {...base} value="" onChange={onChange} />);
    await userEvent.type(screen.getByRole('textbox'), 'ab');
    expect(onChange).toHaveBeenLastCalledWith('ab');
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
