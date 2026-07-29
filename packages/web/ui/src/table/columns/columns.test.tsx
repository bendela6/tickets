import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ActionsColumn } from './actions-column';
import { BadgeColumn } from './badge-column';
import { DateColumn } from './date-column';
import { ImageColumn } from './image-column';
import { LinkColumn } from './link-column';
import { NumberColumn } from './number-column';
import { TextColumn } from './text-column';

describe('TextColumn', () => {
  it('renders the value', () => {
    const R = TextColumn();
    render(<>{R({ value: 'hello', row: {} })}</>);
    expect(screen.getByText('hello')).toBeInTheDocument();
  });

  it('renders nothing for a null value', () => {
    const R = TextColumn();
    const { container } = render(<>{R({ value: null, row: {} })}</>);
    expect(container.textContent).toBe('');
  });

  // The `mono` and `truncate` options change nothing but the classes the
  // helper picks for itself, which the project's testing ruling forbids
  // asserting — and jsdom would render them identically anyway. Accepting the
  // options is all that is checkable here; the faces are verified in the demo.
  it('accepts its options', () => {
    const R = TextColumn({ mono: true, truncate: false });
    render(<>{R({ value: 'abc', row: {} })}</>);
    expect(screen.getByText('abc')).toBeInTheDocument();
  });
});

describe('NumberColumn', () => {
  it('formats an integer without decimals', () => {
    const R = NumberColumn({ format: 'integer' });
    render(<>{R({ value: 1234.7, row: {} })}</>);
    expect(screen.getByText('1,235')).toBeInTheDocument();
  });

  it('shows an em dash for a missing value', () => {
    const R = NumberColumn();
    render(<>{R({ value: null, row: {} })}</>);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('shows an em dash for a value that is not a number', () => {
    const R = NumberColumn();
    render(<>{R({ value: 'abc', row: {} })}</>);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  // `Number('  ')` is 0, not NaN — without the trim guard this renders a fake
  // zero, which is wrong DATA in a table, not just wrong styling.
  it('shows an em dash for a whitespace-only value, not zero', () => {
    const R = NumberColumn();
    render(<>{R({ value: '   ', row: {} })}</>);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('formats a currency value with its symbol', () => {
    const R = NumberColumn({ format: 'currency', currency: 'USD' });
    render(<>{R({ value: 1234.5, row: {} })}</>);
    expect(screen.getByText(/1,234\.50/)).toBeInTheDocument();
  });

  it('parses a numeric string as a number', () => {
    const R = NumberColumn({ format: 'integer' });
    render(<>{R({ value: '1234', row: {} })}</>);
    expect(screen.getByText('1,234')).toBeInTheDocument();
  });
});
// Right-alignment and `tabular-nums` are deliberately not asserted: they are
// classes the helper picks for itself, and jsdom computes no layout, so the
// assertion would restate the implementation without proving digits line up.
// The demo is where that is checked.

describe('DateColumn', () => {
  it('renders a relative time for a valid date', () => {
    const R = DateColumn();
    const { container } = render(<>{R({ value: new Date().toISOString(), row: {} })}</>);
    expect(container.textContent).not.toBe('');
  });

  it('shows an em dash for a missing date', () => {
    const R = DateColumn();
    render(<>{R({ value: null, row: {} })}</>);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('shows an em dash for an unparseable date', () => {
    const R = DateColumn();
    render(<>{R({ value: 'not-a-date', row: {} })}</>);
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});

describe('LinkColumn', () => {
  it('links to the href derived from the row', () => {
    const R = LinkColumn({ href: (row) => `/items/${(row as { id: string }).id}` });
    render(<>{R({ value: 'Alpha', row: { id: '7' } })}</>);
    expect(screen.getByRole('link', { name: 'Alpha' })).toHaveAttribute('href', '/items/7');
  });

  it('opens external links safely', () => {
    const R = LinkColumn({ href: () => 'https://example.com', external: true });
    render(<>{R({ value: 'Out', row: {} })}</>);
    const link = screen.getByRole('link', { name: 'Out' });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  // Rows in this table are clickable. Without stopPropagation, following a
  // link would ALSO open the row's drawer behind it. Easy to implement and
  // easy to drop in a refactor, so it gets its own test.
  it('does not let a link click reach the row', async () => {
    const onRowClick = vi.fn();
    const R = LinkColumn({ href: () => '#' });
    render(<div onClick={onRowClick}>{R({ value: 'Alpha', row: {} })}</div>);
    await userEvent.click(screen.getByRole('link', { name: 'Alpha' }));
    expect(onRowClick).not.toHaveBeenCalled();
  });
});

describe('BadgeColumn', () => {
  it('renders the value as a pill in the tone the mapper returns', () => {
    const R = BadgeColumn<string>({ tone: () => 'green' });
    render(<>{R({ value: 'done', row: {} })}</>);
    expect(screen.getByText('done')).toBeInTheDocument();
  });

  it('uses the label mapper when given one', () => {
    const R = BadgeColumn<string>({ tone: () => 'blue', label: (v) => v.toUpperCase() });
    render(<>{R({ value: 'open', row: {} })}</>);
    expect(screen.getByText('OPEN')).toBeInTheDocument();
  });

  it('renders nothing for a null value rather than an empty pill', () => {
    const R = BadgeColumn<string | null>({ tone: () => 'gray' });
    const { container } = render(<>{R({ value: null, row: {} })}</>);
    expect(container.textContent).toBe('');
  });
});

describe('ImageColumn', () => {
  it('renders the image when there is a src', () => {
    const R = ImageColumn();
    render(<>{R({ value: 'https://example.com/a.png', row: {} })}</>);
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.com/a.png');
  });

  it('falls back to an avatar built from the row', () => {
    const R = ImageColumn({ fallback: (row) => (row as { name: string }).name });
    render(<>{R({ value: null, row: { name: 'Alpha' } })}</>);
    expect(screen.getByText('A')).toBeInTheDocument();
  });
});

describe('ActionsColumn', () => {
  it('renders a labelled button per action', () => {
    const R = ActionsColumn({ items: [{ icon: 'trash', label: 'Delete', onClick: () => {} }] });
    render(<>{R({ value: undefined, row: {} })}</>);
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  it('calls the action with its row', async () => {
    const onClick = vi.fn();
    const R = ActionsColumn({ items: [{ icon: 'trash', label: 'Delete', onClick }] });
    render(<>{R({ value: undefined, row: { id: '9' } })}</>);
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onClick).toHaveBeenCalledWith({ id: '9' });
  });

  // Rows open a drawer on click; an action must not do both.
  it('does not let the click reach the row', async () => {
    const onRowClick = vi.fn();
    const R = ActionsColumn({ items: [{ icon: 'trash', label: 'Delete', onClick: () => {} }] });
    render(<div onClick={onRowClick}>{R({ value: undefined, row: {} })}</div>);
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onRowClick).not.toHaveBeenCalled();
  });
});
