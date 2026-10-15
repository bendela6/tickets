import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FilterCount } from './filter-count';

const label = { one: 'item', other: 'items' };

describe('FilterCount', () => {
  it('reads how many of how many, in an output that speaks politely', () => {
    render(<FilterCount shown={12} total={40} label={label} loading={false} />);
    const count = screen.getByRole('status');
    expect(count.tagName).toBe('OUTPUT');
    expect(count).toHaveAttribute('aria-live', 'polite');
    expect(count).toHaveTextContent('12 of 40 items');
    // An inline row puts it at its end.
    expect(count).toHaveAttribute('data-row-end');
    expect(screen.getByText('12')).toHaveClass('font-mono');
    expect(screen.getByText('40')).toHaveClass('font-mono');
  });

  it('reads just the total when every row is shown, or the count when there is no total', () => {
    const { rerender } = render(
      <FilterCount shown={40} total={40} label={label} loading={false} />,
    );
    expect(screen.getByRole('status')).toHaveTextContent(/^40 items$/);
    rerender(<FilterCount shown={7} label={label} loading={false} />);
    expect(screen.getByRole('status')).toHaveTextContent(/^7 items$/);
    rerender(<FilterCount total={1} label={label} loading={false} />);
    expect(screen.getByRole('status')).toHaveTextContent(/^1 item$/);
  });

  it('names the rows by the total: one of one, but 1 of 40 items', () => {
    render(<FilterCount shown={1} total={40} label={label} loading={false} />);
    expect(screen.getByRole('status')).toHaveTextContent('1 of 40 items');
  });

  it('says Counting with a spinner while it counts, busy until it knows', () => {
    render(<FilterCount shown={12} total={40} label={label} loading />);
    const count = screen.getByRole('status');
    expect(count).toHaveTextContent(/^Counting$/);
    expect(count).toHaveAttribute('aria-busy', 'true');
    expect(count.querySelector('svg')).not.toBeNull();
  });

  it('draws the count in the danger tone when nothing matches', () => {
    const { rerender } = render(<FilterCount shown={0} total={40} label={label} loading={false} />);
    expect(screen.getByRole('status')).toHaveTextContent('0 of 40 items');
    expect(screen.getByRole('status')).toHaveClass('text-red-11');
    rerender(<FilterCount shown={12} total={40} label={label} loading={false} />);
    expect(screen.getByRole('status')).not.toHaveClass('text-red-11');
  });

  it('says nothing while there is nothing to count', () => {
    render(<FilterCount label={label} loading={false} />);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });
});
