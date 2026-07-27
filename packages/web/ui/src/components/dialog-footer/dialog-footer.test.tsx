import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DialogFooter } from './dialog-footer';

describe('DialogFooter', () => {
  it('renders children', () => {
    render(<DialogFooter>{<button type="button">Save</button>}</DialogFooter>);
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy();
  });

  it('renders cancel before children in DOM order', () => {
    render(
      <DialogFooter cancel={<button type="button">Cancel</button>}>
        <button type="button">Save</button>
      </DialogFooter>,
    );
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual(['Cancel', 'Save']);
  });

  it('renders no cancel node when unset', () => {
    render(
      <DialogFooter>
        <button type="button">Save</button>
      </DialogFooter>,
    );
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
  });

  it('right-aligns with a top hairline border by default', () => {
    const { container } = render(<DialogFooter cancel="Cancel" />);
    const el = container.firstElementChild!;
    for (const cls of ['flex', 'items-center', 'justify-end', 'border-t', 'border-hairline']) {
      expect(el.className).toContain(cls);
    }
  });

  it('merges an extra className onto the outer row', () => {
    const { container } = render(<DialogFooter className="border-t-0 p-0" cancel="Cancel" />);
    expect(container.firstElementChild!.className).toContain('border-t-0');
  });
});
