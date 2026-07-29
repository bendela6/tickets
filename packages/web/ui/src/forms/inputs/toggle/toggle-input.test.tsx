import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ToggleInput } from './toggle-input';

const base = { name: 'notify', loading: false, onBlur: vi.fn(), config: {} };

describe('ToggleInput', () => {
  it('reflects the current value', () => {
    render(<ToggleInput {...base} value onChange={vi.fn()} />);
    expect(screen.getByRole('switch')).toBeChecked();
  });

  it('reports the flipped value', async () => {
    const onChange = vi.fn();
    render(<ToggleInput {...base} value={false} onChange={onChange} />);
    await userEvent.click(screen.getByRole('switch'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  // A switch is toggled, not blurred — without this the engine never marks the
  // field touched and its validation message never appears.
  it('marks the field touched on toggle', async () => {
    const onBlur = vi.fn();
    render(<ToggleInput {...base} onBlur={onBlur} value={false} onChange={vi.fn()} />);
    await userEvent.click(screen.getByRole('switch'));
    expect(onBlur).toHaveBeenCalled();
  });

  it('renders the inline label when configured', () => {
    render(<ToggleInput {...base} config={{ label: 'Email me' }} value={false} onChange={vi.fn()} />);
    expect(screen.getByText('Email me')).toBeInTheDocument();
  });

  it('is disabled when the engine says so', () => {
    render(<ToggleInput {...base} value={false} onChange={vi.fn()} disabled />);
    expect(screen.getByRole('switch')).toBeDisabled();
  });
});
