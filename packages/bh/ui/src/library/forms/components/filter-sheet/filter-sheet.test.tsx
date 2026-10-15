import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { InlineRowContext, useInlineRow } from '../../inline-row';
import { InlineFieldContext, useInlineField } from '../inline-field-wrapper/inline-field';
import { FilterSheet } from './filter-sheet';

/** A bar's form holding the sheet, as a filter form draws it on a phone. */
function Bar({
  count = 3,
  onOpenChange,
}: {
  count?: number;
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <form aria-label="Bar">
      <FilterSheet
        title="Filters"
        count={count}
        open={open}
        onOpenChange={(next) => {
          onOpenChange?.(next);
          setOpen(next);
        }}
      >
        <form aria-label="Sheet">
          <label>
            Type <input />
          </label>
          <div data-actions="">
            <button type="submit">Show 12 items</button>
          </div>
        </form>
      </FilterSheet>
    </form>
  );
}

describe('FilterSheet', () => {
  it('is a 44-pixel Filters button with how many conditions on its badge', () => {
    render(<Bar />);
    const button = screen.getByRole('button', { name: 'Filters, 3 filters' });
    expect(button).toHaveClass('h-44');
    expect(button).toHaveAttribute('aria-haspopup', 'dialog');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(within(button).getByText('3')).toHaveClass('font-mono');
  });

  it('says only its title while there are none', () => {
    render(<Bar count={0} />);
    const button = screen.getByRole('button', { name: 'Filters' });
    expect(button).toHaveTextContent(/^Filters$/);
  });

  it('opens a sheet from the bottom, titled, holding its form', async () => {
    const onOpenChange = vi.fn();
    render(<Bar onOpenChange={onOpenChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Filters, 3 filters' }));
    expect(onOpenChange).toHaveBeenCalledWith(true);
    const sheet = screen.getByRole('dialog', { name: 'Filters' });
    expect(sheet).toHaveClass('panel-slide-bottom');
    expect(within(sheet).getByRole('form', { name: 'Sheet' })).toBeInTheDocument();
    // Its body scrolls, and keeps the form's buttons at its foot.
    const body = within(sheet).getByRole('textbox').closest('.filter-sheet');
    expect(body).toHaveClass('overflow-y-auto');
    expect(body?.querySelector('[data-actions]')).not.toBeNull();
  });

  it('is portaled, so the sheet’s form isn’t inside the bar’s', async () => {
    render(<Bar />);
    await userEvent.click(screen.getByRole('button', { name: 'Filters, 3 filters' }));
    const bar = screen.getByRole('form', { name: 'Bar', hidden: true });
    expect(bar).not.toContainElement(screen.getByRole('form', { name: 'Sheet' }));
  });

  it('gives the focus back to its button as it closes', async () => {
    render(<Bar />);
    await userEvent.click(screen.getByRole('button', { name: 'Filters, 3 filters' }));
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Filters, 3 filters' })).toHaveFocus();
    });
  });

  it('draws its fields out of the bar’s row, at full size', () => {
    function Probe() {
      const row = useInlineRow();
      const field = useInlineField();
      return <p>{row === undefined && field === undefined ? 'full size' : 'in the row'}</p>;
    }
    render(
      <InlineRowContext value={{ collapse: 2 }}>
        <InlineFieldContext value={{ size: 'xs' }}>
          <FilterSheet title="Filters" count={0} open onOpenChange={vi.fn()}>
            <Probe />
          </FilterSheet>
        </InlineFieldContext>
      </InlineRowContext>,
    );
    expect(screen.getByText('full size')).toBeInTheDocument();
  });
});
