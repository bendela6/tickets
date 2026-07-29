import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { NumberFormInput, type NumberInputConfig } from './number-input';

const base = { name: 'estimate', loading: false, onBlur: vi.fn(), config: {} };

/** Feeds `onChange` back into `value`, the way the form engine does. */
function Controlled({ config = {} as NumberInputConfig }) {
  const [value, setValue] = useState<number | null>(null);
  return <NumberFormInput {...base} config={config} value={value} onChange={setValue} />;
}

describe('NumberFormInput', () => {
  it('reports the number the user types', async () => {
    const onChange = vi.fn();
    render(<NumberFormInput {...base} value={null} onChange={onChange} />);
    await userEvent.type(screen.getByRole('spinbutton'), '7');
    expect(onChange).toHaveBeenCalledWith(7);
  });

  // Single keystroke, so the frozen `value` cannot distort the result: 9 alone
  // already exceeds a max of 5.
  it('clamps a single entry above max down to max', async () => {
    const onChange = vi.fn();
    render(<NumberFormInput {...base} config={{ max: 5 }} value={null} onChange={onChange} />);
    await userEvent.type(screen.getByRole('spinbutton'), '9');
    expect(onChange).toHaveBeenCalledWith(5);
  });

  // Multi-digit entry needs the value fed back, or the second 9 would be typed
  // into a still-empty field and read as 9 again rather than 99.
  it('clamps to max as the user keeps typing digits', async () => {
    render(<Controlled config={{ max: 10 }} />);
    const input = screen.getByRole('spinbutton');
    await userEvent.type(input, '99');
    expect(input).toHaveValue(10);
  });

  it('clamps a value below min up to min', async () => {
    const onChange = vi.fn();
    render(<NumberFormInput {...base} config={{ min: 5 }} value={null} onChange={onChange} />);
    await userEvent.type(screen.getByRole('spinbutton'), '1');
    expect(onChange).toHaveBeenCalledWith(5);
  });

  it('reports null when the field is cleared rather than coercing to zero', async () => {
    const onChange = vi.fn();
    render(<NumberFormInput {...base} value={3} onChange={onChange} />);
    await userEvent.clear(screen.getByRole('spinbutton'));
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('fires onBlur through the wrapper so the engine marks it touched', async () => {
    const onBlur = vi.fn();
    render(<NumberFormInput {...base} onBlur={onBlur} value={null} onChange={vi.fn()} />);
    await userEvent.click(screen.getByRole('spinbutton'));
    await userEvent.tab();
    expect(onBlur).toHaveBeenCalled();
  });

  // The proof it holds no state: with `value` pinned by the parent, typing
  // cannot change what is displayed.
  it('shows only what its parent gives it', async () => {
    render(<NumberFormInput {...base} value={7} onChange={vi.fn()} />);
    const input = screen.getByRole('spinbutton');
    await userEvent.type(input, '9');
    expect(input).toHaveValue(7);
  });

  it('renders the suffix when configured', () => {
    render(<NumberFormInput {...base} config={{ suffix: 'hours' }} value={null} onChange={vi.fn()} />);
    expect(screen.getByText('hours')).toBeInTheDocument();
  });

  it('is disabled when the engine says so', () => {
    render(<NumberFormInput {...base} value={null} onChange={vi.fn()} disabled />);
    expect(screen.getByRole('spinbutton')).toBeDisabled();
  });
});
