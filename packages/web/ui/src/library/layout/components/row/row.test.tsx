import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Row } from './row';

// Same ruling as Stack: no assertions on classes Row picks for itself.
describe('Row', () => {
  it('renders its children in order', () => {
    render(
      <Row>
        <span>a</span>
        <span>b</span>
      </Row>,
    );
    expect(screen.getByText('a')).toBeInTheDocument();
    expect(screen.getByText('b')).toBeInTheDocument();
  });

  it('keeps a caller-supplied className', () => {
    render(<Row data-testid="r" className="mt-8" />);
    expect(screen.getByTestId('r').className).toContain('mt-8');
  });

  it('forwards unknown props to the underlying div', () => {
    render(<Row data-testid="r" role="group" aria-label="Actions" />);
    expect(screen.getByTestId('r')).toHaveAccessibleName('Actions');
  });

  it('accepts every gap, align and justify value the types allow', () => {
    // Type-level coverage — Row's align domain includes `baseline`, which
    // Stack's does not. Fails to compile if the unions drift from the Records.
    for (const gap of [0, 1, 2, 3, 4, 6, 8] as const) {
      const { unmount } = render(<Row gap={gap} />);
      unmount();
    }
    for (const align of ['start', 'center', 'end', 'stretch', 'baseline'] as const) {
      const { unmount } = render(<Row align={align} />);
      unmount();
    }
    for (const justify of ['start', 'center', 'end', 'between'] as const) {
      const { unmount } = render(<Row justify={justify} />);
      unmount();
    }
  });
});
