import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Card, CardBody, CardHeader, CardTitle } from './card';

// Surface, radius, padding and the hover affordance are NOT asserted — those
// are classes Card picks for itself, and jsdom cannot observe their effect.
// The gallery demo is where they are checked.
describe('Card', () => {
  it('renders its children', () => {
    render(<Card>body</Card>);
    expect(screen.getByText('body')).toBeInTheDocument();
  });

  it('composes a header, a title and a body', () => {
    render(
      <Card>
        <CardHeader><CardTitle>Filters</CardTitle></CardHeader>
        <CardBody>content</CardBody>
      </Card>,
    );
    expect(screen.getByRole('heading', { name: 'Filters' })).toBeInTheDocument();
    expect(screen.getByText('content')).toBeInTheDocument();
  });

  // The heading level is a real accessibility contract, not a style choice.
  it('renders the title as a level-3 heading', () => {
    render(<CardTitle>Filters</CardTitle>);
    expect(screen.getByRole('heading', { level: 3, name: 'Filters' })).toBeInTheDocument();
  });

  it('keeps a caller-supplied className on each part', () => {
    render(
      <Card data-testid="c" className="mt-2">
        <CardHeader data-testid="h" className="mt-3">h</CardHeader>
        <CardBody data-testid="b" className="mt-4">b</CardBody>
      </Card>,
    );
    expect(screen.getByTestId('c').className).toContain('mt-2');
    expect(screen.getByTestId('h').className).toContain('mt-3');
    expect(screen.getByTestId('b').className).toContain('mt-4');
  });

  it('forwards unknown props to the underlying div', () => {
    render(<Card data-testid="c" role="region" aria-label="Summary" />);
    expect(screen.getByTestId('c')).toHaveAccessibleName('Summary');
  });

  it('accepts every radius, padding and interactive value the types allow', () => {
    // Type-level coverage only; asserts nothing about the resulting classes.
    for (const radius of ['md', 'lg', 'xl'] as const) {
      const { unmount } = render(<Card radius={radius} />);
      unmount();
    }
    for (const padding of [0, 1, 2, 3, 4, 6, 8] as const) {
      const { unmount } = render(<Card padding={padding} />);
      unmount();
      const body = render(<CardBody padding={padding} />);
      body.unmount();
    }
    const { unmount } = render(<Card interactive />);
    unmount();
  });
});
