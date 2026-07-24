import { render, screen } from '@testing-library/react';
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

// PlaygroundCard is a thin stage-only component post-refactor: values +
// Reset now live in ComponentPage (see component-page.test.tsx), so this
// suite only covers value-flow — PlaygroundCard renders whatever values
// prop it's handed and re-renders when the caller passes new ones.
describe('PlaygroundCard', () => {
  it('renders the preview from the given values', () => {
    render(
      <PlaygroundCard
        playground={pg}
        values={{ variant: 'primary', size: undefined, loading: false, children: 'New ticket' }}
      />,
    );
    const btn = screen.getByRole('button', { name: 'New ticket' });
    expect(btn.getAttribute('data-variant')).toBe('primary');
    expect(btn.getAttribute('data-size')).toBe('default'); // unset falls back to component default
  });

  it('re-renders when the values prop changes (external state, no internal state)', () => {
    const { rerender } = render(
      <PlaygroundCard
        playground={pg}
        values={{ variant: 'primary', size: undefined, loading: false, children: 'New ticket' }}
      />,
    );
    expect(screen.getByRole('button', { name: 'New ticket' }).getAttribute('data-variant')).toBe('primary');

    rerender(
      <PlaygroundCard
        playground={pg}
        values={{ variant: 'secondary', size: 'compact', loading: true, children: 'Save' }}
      />,
    );
    const btn = screen.getByRole('button', { name: 'Save' });
    expect(btn.getAttribute('data-variant')).toBe('secondary');
    expect(btn.getAttribute('data-size')).toBe('compact');
    expect(btn.getAttribute('data-loading')).toBe('true');
  });
});
