import { fireEvent, render, screen } from '@testing-library/react';
import { boolean as booleanControl, definePlayground, select, text } from '@tickets/ui/gallery';
import { PlaygroundCard } from './playground-card';

const pg = definePlayground({
  controls: {
    variant: select(['primary', 'secondary'], { label: 'variant' }),
    size: select(['compact', 'regular'], { allowNone: true }),
    loading: booleanControl(false),
    children: text('New ticket'),
  },
  render: (v) => (
    <button data-loading={v.loading} data-size={v.size ?? 'default'} data-variant={v.variant}>
      {v.children}
    </button>
  ),
});

describe('PlaygroundCard', () => {
  it('renders the preview with initial values', () => {
    render(<PlaygroundCard playground={pg} />);
    const btn = screen.getByRole('button', { name: 'New ticket' });
    expect(btn.getAttribute('data-variant')).toBe('primary');
    expect(btn.getAttribute('data-size')).toBe('default'); // allowNone starts unset
  });

  it('select change re-renders the preview', () => {
    render(<PlaygroundCard playground={pg} />);
    fireEvent.change(screen.getByLabelText('variant'), { target: { value: 'secondary' } });
    expect(screen.getByRole('button', { name: 'New ticket' }).getAttribute('data-variant')).toBe('secondary');
  });

  it('allowNone select can return to (unset)', () => {
    render(<PlaygroundCard playground={pg} />);
    fireEvent.change(screen.getByLabelText('size'), { target: { value: 'compact' } });
    expect(screen.getByRole('button', { name: 'New ticket' }).getAttribute('data-size')).toBe('compact');
    fireEvent.change(screen.getByLabelText('size'), { target: { value: '' } });
    expect(screen.getByRole('button', { name: 'New ticket' }).getAttribute('data-size')).toBe('default');
  });

  it('checkbox and text changes flow through', () => {
    render(<PlaygroundCard playground={pg} />);
    fireEvent.click(screen.getByLabelText('loading'));
    expect(screen.getByRole('button', { name: 'New ticket' }).getAttribute('data-loading')).toBe('true');
    fireEvent.change(screen.getByLabelText('children'), { target: { value: 'Save' } });
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy();
  });

  it('Reset button restores initial values', () => {
    render(<PlaygroundCard playground={pg} />);
    // Change variant to secondary
    fireEvent.change(screen.getByLabelText('variant'), { target: { value: 'secondary' } });
    expect(screen.getByRole('button', { name: 'New ticket' }).getAttribute('data-variant')).toBe('secondary');
    // Click Reset
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    // Verify variant is back to primary (initial value)
    expect(screen.getByRole('button', { name: 'New ticket' }).getAttribute('data-variant')).toBe('primary');
  });
});
