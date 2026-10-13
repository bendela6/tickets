// PageBody: a column in the page's gutters at full width, and the same gutters
// as CardGrid's, so a page of cards and any other page line up.

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CardGrid } from './card-grid';
import { PAGE_GUTTERS } from './gutters';
import { PageBody } from './page-body';

const GUTTERS = PAGE_GUTTERS.split(' ');

describe('PageBody', () => {
  it('lays its content out in a column, 16 pixels apart', () => {
    render(
      <PageBody>
        <p>Labels</p>
        <p>Boxes</p>
      </PageBody>,
    );
    const body = screen.getByText('Labels').parentElement;
    for (const cls of ['flex', 'flex-col', 'gap-16', 'min-w-0']) {
      expect(body?.className.split(' ')).toContain(cls);
    }
    expect(body).toContainElement(screen.getByText('Boxes'));
  });

  it('pads by the page’s gutters, which line up with the header’s', () => {
    expect(PAGE_GUTTERS).toBe('px-16 py-16 md:px-32 md:py-24');
    render(<PageBody>Labels</PageBody>);
    for (const cls of GUTTERS) {
      expect(screen.getByText('Labels').className.split(' ')).toContain(cls);
    }
  });

  // The user chose full width on every page: what must not run the width
  // sets its own.
  it('caps no width', () => {
    render(<PageBody>Labels</PageBody>);
    expect(screen.getByText('Labels').className).not.toMatch(/max-w-/);
  });

  it('takes classes that win over its own', () => {
    render(<PageBody className="flex-1 gap-24">Labels</PageBody>);
    const classes = screen.getByText('Labels').className.split(' ');
    expect(classes).toContain('flex-1');
    expect(classes).toContain('gap-24');
    expect(classes).not.toContain('gap-16');
  });
});

describe('CardGrid', () => {
  it('pads by the same gutters as PageBody', () => {
    render(
      <CardGrid>
        <p>A card</p>
      </CardGrid>,
    );
    const grid = screen.getByText('A card').parentElement;
    for (const cls of [...GUTTERS, 'gap-16']) {
      expect(grid?.className.split(' ')).toContain(cls);
    }
  });
});
