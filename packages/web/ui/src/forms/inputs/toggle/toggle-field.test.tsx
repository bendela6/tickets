import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ToggleField } from './toggle-field';

const base = { name: 'notify', loading: false, onBlur: vi.fn(), config: {} };

describe('ToggleField', () => {
  it('reflects the current value', () => {
    render(<ToggleField {...base} value onChange={vi.fn()} />);
    expect(screen.getByRole('switch')).toBeChecked();
  });

  it('reports the flipped value', async () => {
    const onChange = vi.fn();
    render(<ToggleField {...base} value={false} onChange={onChange} />);
    await userEvent.click(screen.getByRole('switch'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  // A switch is toggled, not blurred — without this the engine never marks the
  // field touched and its validation message never appears.
  it('marks the field touched on toggle', async () => {
    const onBlur = vi.fn();
    render(<ToggleField {...base} onBlur={onBlur} value={false} onChange={vi.fn()} />);
    await userEvent.click(screen.getByRole('switch'));
    expect(onBlur).toHaveBeenCalled();
  });

  it('renders the inline label when configured', () => {
    render(<ToggleField {...base} config={{ label: 'Email me' }} value={false} onChange={vi.fn()} />);
    expect(screen.getByText('Email me')).toBeInTheDocument();
  });

  it('is disabled when the engine says so', () => {
    render(<ToggleField {...base} value={false} onChange={vi.fn()} disabled />);
    expect(screen.getByRole('switch')).toBeDisabled();
  });
});
