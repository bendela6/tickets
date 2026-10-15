import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { InlineFieldContext } from '../../components/inline-field-wrapper/inline-field';
import { ToggleChipsField } from './toggle-chips-field';

const OPTIONS = [
  { value: 'running', label: 'Running' },
  { value: 'failed', label: 'Failed', count: 3 },
  { value: 'finished', label: 'Finished' },
];
const base = { name: 'state', loading: false, onBlur: vi.fn(), config: { options: OPTIONS } };

describe('ToggleChipsField', () => {
  it('shows the pressed chips', () => {
    render(<ToggleChipsField {...base} value={['failed']} onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Failed/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Running' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('paints an option colored by a role, as a resource’s options are, from its hue', () => {
    const options = [{ value: 'done', label: 'Done', color: 'success' as never }];
    render(<ToggleChipsField {...base} config={{ options }} value={[]} onChange={vi.fn()} />);
    const dot = screen.getByRole('button', { name: 'Done' }).querySelector('[aria-hidden]');
    expect(dot).toHaveClass('bg-green-9');
  });

  it('reports the chips pressed after a click', async () => {
    const onChange = vi.fn();
    render(<ToggleChipsField {...base} value={['failed']} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Running' }));
    expect(onChange).toHaveBeenCalledWith(['failed', 'running']);
  });

  it('is named by its config’s label, then the field’s, then its name', () => {
    const { rerender } = render(
      <ToggleChipsField {...base} label="State" value={[]} onChange={vi.fn()} />,
    );
    expect(screen.getByRole('group', { name: 'State' })).toBeInTheDocument();
    rerender(
      <ToggleChipsField
        {...base}
        label="State"
        config={{ options: OPTIONS, label: 'Run state' }}
        value={[]}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByRole('group', { name: 'Run state' })).toBeInTheDocument();
    rerender(<ToggleChipsField {...base} value={[]} onChange={vi.fn()} />);
    expect(screen.getByRole('group', { name: 'state' })).toBeInTheDocument();
  });

  it('puts the options past maxVisible behind a +N chip', () => {
    render(
      <ToggleChipsField
        {...base}
        config={{ options: OPTIONS, maxVisible: 2 }}
        value={[]}
        onChange={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Finished' })).toBeNull();
    expect(screen.getByRole('button', { name: '1 more state options' })).toBeInTheDocument();
  });

  it('takes its size from the config, else from a filter bar’s row, 38 pixels without either', () => {
    const { rerender } = render(<ToggleChipsField {...base} value={[]} onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Running' })).toHaveClass('h-38');
    rerender(
      <InlineFieldContext value={{ size: 'xs' }}>
        <ToggleChipsField {...base} value={[]} onChange={vi.fn()} />
      </InlineFieldContext>,
    );
    expect(screen.getByRole('button', { name: 'Running' })).toHaveClass('h-30');
    rerender(
      <InlineFieldContext value={{ size: 'xs' }}>
        <ToggleChipsField
          {...base}
          config={{ options: OPTIONS, size: 'lg' }}
          value={[]}
          onChange={vi.fn()}
        />
      </InlineFieldContext>,
    );
    expect(screen.getByRole('button', { name: 'Running' })).toHaveClass('h-46');
  });

  it('is disabled while the engine resolves async config', () => {
    render(<ToggleChipsField {...base} config={{}} value={[]} onChange={vi.fn()} loading />);
    expect(screen.getByRole('group')).toHaveAttribute('aria-disabled', 'true');
  });
});
