import { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { useRestoreFocus } from './use-restore-focus';

// A surface of an app's own, without Radix: rendered while open, and closed by
// unmounting it, so `open` never turns false.
function Surface({ onClose }: { onClose: () => void }) {
  useRestoreFocus({ open: true });
  return (
    <section aria-label="Surface">
      <input aria-label="Name" autoFocus />
      <button type="button" onClick={onClose}>
        Done
      </button>
    </section>
  );
}

function Host() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Edit
      </button>
      {open ? <Surface onClose={() => setOpen(false)} /> : null}
    </>
  );
}

describe('useRestoreFocus, given open', () => {
  it('gives focus back to the opener when the surface unmounts open', async () => {
    const user = userEvent.setup();
    render(<Host />);
    const edit = screen.getByRole('button', { name: 'Edit' });
    await user.click(edit);
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('region', { name: 'Surface' })).toBeNull();
    await waitFor(() => expect(edit).toHaveFocus());
  });
});
