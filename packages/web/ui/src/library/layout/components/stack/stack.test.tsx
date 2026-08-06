import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Stack } from './stack';

// Spacing and direction are NOT tested — jsdom computes no layout, and
// asserting the class Stack picked for itself would just restate the
// implementation. The gap/align lookups are verified by eye in the gallery.
describe('Stack', () => {
  it('renders its children in order', () => {
    render(
      <Stack>
        <span>a</span>
        <span>b</span>
      </Stack>,
    );
    expect(screen.getByText('a')).toBeInTheDocument();
    expect(screen.getByText('b')).toBeInTheDocument();
  });

  it('renders with no children and no props', () => {
    render(<Stack data-testid="s" />);
    expect(screen.getByTestId('s')).toBeEmptyDOMElement();
  });

  // A caller's className surviving is an API contract, not an internal choice.
  it('keeps a caller-supplied className', () => {
    render(<Stack data-testid="s" className="mt-8" />);
    expect(screen.getByTestId('s').className).toContain('mt-8');
  });

  it('forwards unknown props to the underlying div', () => {
    render(<Stack data-testid="s" role="group" aria-label="Filters" />);
    const el = screen.getByTestId('s');
    expect(el).toHaveAttribute('role', 'group');
    expect(el).toHaveAccessibleName('Filters');
  });

  it('accepts every gap and align value the types allow', () => {
    // Type-level coverage: this fails to compile if the unions and the lookup
    // Records disagree. It asserts nothing about the resulting classes.
    for (const gap of [0, 1, 2, 3, 4, 6, 8] as const) {
      const { unmount } = render(<Stack gap={gap} />);
      unmount();
    }
    for (const align of ['start', 'center', 'end', 'stretch'] as const) {
      const { unmount } = render(<Stack align={align} />);
      unmount();
    }
  });
});
