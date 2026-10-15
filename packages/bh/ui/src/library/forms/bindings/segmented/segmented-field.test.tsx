import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SegmentedField } from './segmented-field';

const OPTIONS = [
  { value: 'video', label: 'Video' },
  { value: 'audio', label: 'Audio' },
];
const base = { name: 'kind', loading: false, onBlur: vi.fn(), config: { options: OPTIONS } };

describe('SegmentedField', () => {
  it('reports the segment the user picks', async () => {
    const onChange = vi.fn();
    render(<SegmentedField {...base} value="" onChange={onChange} />);
    await userEvent.click(screen.getByRole('radio', { name: 'Audio' }));
    expect(onChange).toHaveBeenCalledWith('audio');
  });

  it('with a placeholder, draws a first segment that holds the empty value', async () => {
    const onChange = vi.fn();
    render(
      <SegmentedField
        {...base}
        config={{ options: OPTIONS, placeholder: 'Any' }}
        value="video"
        onChange={onChange}
      />,
    );
    const radios = screen.getAllByRole('radio');
    expect(radios.map((radio) => radio.textContent)).toEqual(['Any', 'Video', 'Audio']);
    await userEvent.click(screen.getByRole('radio', { name: 'Any' }));
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('with a placeholder, shows it chosen while the value is empty', () => {
    render(
      <SegmentedField
        {...base}
        config={{ options: OPTIONS, placeholder: 'Any' }}
        value=""
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByRole('radio', { name: 'Any' })).toBeChecked();
  });

  it('without one, draws only the options', () => {
    render(<SegmentedField {...base} value="" onChange={vi.fn()} />);
    expect(screen.getAllByRole('radio')).toHaveLength(2);
    expect(screen.queryByRole('radio', { checked: true })).toBeNull();
  });

  it('takes its size from the config, 38 pixels without one', () => {
    const { rerender } = render(<SegmentedField {...base} value="" onChange={vi.fn()} />);
    expect(screen.getByRole('radiogroup')).toHaveClass('h-38');
    rerender(
      <SegmentedField
        {...base}
        config={{ options: OPTIONS, size: 'lg' }}
        value=""
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByRole('radiogroup')).toHaveClass('h-46');
  });

  it('is disabled while the engine resolves async config', () => {
    render(<SegmentedField {...base} value="" onChange={vi.fn()} loading />);
    expect(screen.getByRole('radiogroup')).toHaveAttribute('aria-disabled', 'true');
  });
});
