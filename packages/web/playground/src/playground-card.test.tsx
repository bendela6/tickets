import { render, screen } from '@testing-library/react';
import { boolean as booleanControl, definePlayground, select, text } from '@tickets/ui';
import { PlaygroundCard, playgroundCaption } from './playground-card';

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
        component="Button"
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
        component="Button"
        playground={pg}
        values={{ variant: 'primary', size: undefined, loading: false, children: 'New ticket' }}
      />,
    );
    expect(screen.getByRole('button', { name: 'New ticket' }).getAttribute('data-variant')).toBe('primary');

    rerender(
      <PlaygroundCard
        component="Button"
        playground={pg}
        values={{ variant: 'secondary', size: 'compact', loading: true, children: 'Save' }}
      />,
    );
    const btn = screen.getByRole('button', { name: 'Save' });
    expect(btn.getAttribute('data-variant')).toBe('secondary');
    expect(btn.getAttribute('data-size')).toBe('compact');
    expect(btn.getAttribute('data-loading')).toBe('true');
  });

  it('captions the stage with the component and its non-default values', () => {
    render(
      <PlaygroundCard
        component="Button"
        playground={pg}
        values={{ variant: 'secondary', size: 'compact', loading: true, children: 'New ticket' }}
      />,
    );
    expect(screen.getByText('Button · secondary · compact · loading')).toBeTruthy();
  });
});

describe('playgroundCaption', () => {
  const { controls } = pg;

  it('names the component alone when nothing is set away from its default', () => {
    expect(
      playgroundCaption('Button', controls, {
        variant: 'primary',
        size: undefined,
        loading: false,
        children: 'New ticket',
      }),
    ).toBe('Button');
  });

  it('lists booleans by prop name and everything else by value', () => {
    expect(
      playgroundCaption('Button', controls, {
        variant: 'secondary',
        size: undefined,
        loading: true,
        children: 'Save',
      }),
    ).toBe('Button · secondary · loading · Save');
  });
});
