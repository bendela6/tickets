import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../app';

const setup = async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.keyboard('r');
  return { user };
};

const openDialog = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: 'Export' }));
  return screen.getByRole('dialog');
};

describe('the export dialog', () => {
  it('opens only from the top-bar button', async () => {
    const { user } = await setup();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await openDialog(user);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('says plainly that nothing is written until Export is pressed', async () => {
    const { user } = await setup();
    const dialog = await openDialog(user);
    expect(
      within(dialog).getByText('nothing is written until you press Export'),
    ).toBeInTheDocument();
  });

  it('names the number of files on the confirm button, and disables at zero', async () => {
    const { user } = await setup();
    const dialog = await openDialog(user);
    // Defaults: favicon (4) + PWA (3) + iOS (14).
    expect(within(dialog).getByRole('button', { name: 'Export 21 files' })).toBeEnabled();

    for (const name of ['Browser favicon', 'PWA', 'iOS']) {
      await user.click(within(dialog).getByRole('checkbox', { name: new RegExp(name) }));
    }
    expect(within(dialog).getByRole('button', { name: 'Export' })).toBeDisabled();
    expect(within(dialog).getByText('pick at least one target')).toBeInTheDocument();
  });

  it('offers the six platforms, and every one of them can be ticked', async () => {
    const { user } = await setup();
    const dialog = await openDialog(user);
    const names = ['Browser favicon', 'PWA', 'iOS', 'Android', 'macOS', 'Windows'];
    expect(within(dialog).getAllByRole('checkbox')).toHaveLength(names.length);
    for (const name of names) {
      const row = within(dialog).getByRole('checkbox', { name: new RegExp(name) });
      const before = row.getAttribute('aria-checked');
      await user.click(row);
      expect(within(dialog).getByRole('checkbox', { name: new RegExp(name) })).not.toHaveAttribute(
        'aria-checked',
        before,
      );
    }
  });
});

describe('platform validation', () => {
  it('is silent when nothing reaches past the safe zone', async () => {
    const { user } = await setup();
    const dialog = await openDialog(user);
    expect(within(dialog).queryByText(/of the tile/)).not.toBeInTheDocument();
  });

  it('names the rule, the object and the measured value', async () => {
    const { user } = await setup();
    const w = within(screen.getByRole('complementary', { name: 'Properties' })).getByLabelText(
      'Width',
    );
    await user.clear(w);
    await user.type(w, '500');
    await user.tab();

    const dialog = await openDialog(user);
    expect(within(dialog).getByText(/rect 1 reaches \d+% of the tile/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Android crops a maskable icon/)).toBeInTheDocument();
  });

  it('is a warning, not a lock — Export stays enabled', async () => {
    const { user } = await setup();
    const w = within(screen.getByRole('complementary', { name: 'Properties' })).getByLabelText(
      'Width',
    );
    await user.clear(w);
    await user.type(w, '500');
    await user.tab();

    const dialog = await openDialog(user);
    expect(within(dialog).getByRole('button', { name: /^Export \d+ files$/ })).toBeEnabled();
  });
});
