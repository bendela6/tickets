import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FilterChanges } from './filter-changes';

describe('FilterChanges', () => {
  it('says how many changes wait for the Apply', () => {
    const { rerender } = render(<FilterChanges count={1} />);
    expect(screen.getByRole('status')).toHaveTextContent('1 change waiting');
    // An inline row puts it at its end.
    expect(screen.getByRole('status')).toHaveAttribute('data-row-end');
    rerender(<FilterChanges count={3} />);
    expect(screen.getByRole('status')).toHaveTextContent('3 changes waiting');
  });

  it('says nothing while none wait, but stays to be heard', () => {
    render(<FilterChanges count={0} />);
    const status = screen.getByRole('status');
    expect(status).toBeEmptyDOMElement();
    expect(status).toHaveAttribute('aria-live', 'polite');
  });
});
