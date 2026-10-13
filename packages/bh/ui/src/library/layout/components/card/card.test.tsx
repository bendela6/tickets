import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Card, CardBody, CardHeader, CardTitle } from './card';

// Surface, radius, padding and the hover affordance are NOT asserted — those
// are classes Card picks for itself, and jsdom cannot observe their effect.
// The docs site's Card page is where they are checked.
describe('Card', () => {
  it('renders its children', () => {
    render(<Card>body</Card>);
    expect(screen.getByText('body')).toBeInTheDocument();
  });

  it('composes a header, a title and a body', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
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
      <Card data-testid="c" className="mt-8">
        <CardHeader data-testid="h" className="mt-12">
          h
        </CardHeader>
        <CardBody data-testid="b" className="mt-16">
          b
        </CardBody>
      </Card>,
    );
    expect(screen.getByTestId('c').className).toContain('mt-8');
    expect(screen.getByTestId('h').className).toContain('mt-12');
    expect(screen.getByTestId('b').className).toContain('mt-16');
  });

  it('puts the aside after the title, in the same row', () => {
    render(
      <CardHeader data-testid="h" aside={<a href="#all">See all</a>}>
        <CardTitle>Files</CardTitle>
      </CardHeader>,
    );
    const header = screen.getByTestId('h');
    const [title, aside] = Array.from(header.children);
    expect(title).toBe(screen.getByRole('heading', { name: 'Files' }));
    expect(aside).toContainElement(screen.getByRole('link', { name: 'See all' }));
    expect(header.className).toContain('flex');
  });

  // A header without an aside stays a block: one that stacks its title over a
  // line of its own must not turn into a row because the prop exists.
  it('stays a block without an aside, or with a false one', () => {
    render(
      <>
        <CardHeader data-testid="none">
          <CardTitle>Files</CardTitle>
        </CardHeader>
        <CardHeader data-testid="false" aside={false}>
          <CardTitle>Files</CardTitle>
        </CardHeader>
      </>,
    );
    for (const id of ['none', 'false']) {
      const header = screen.getByTestId(id);
      expect(header.className).not.toContain('flex');
      expect(header.children).toHaveLength(1);
    }
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
