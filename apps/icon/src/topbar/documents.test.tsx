import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../app';
import { agoOf } from './use-documents';

const setup = async () => {
  const user = userEvent.setup();
  render(<App />);
  // Boot loads or creates a document asynchronously.
  await waitFor(() => expect(screen.getByRole('button', { name: 'Documents' })).toBeInTheDocument());
  return { user };
};

const topBar = () => screen.getByRole('banner');

describe('agoOf', () => {
  it('reads never when nothing has been saved', () => {
    expect(agoOf(null, 1_000_000)).toBe('never');
  });
  it('rounds recent saves to just now rather than counting seconds', () => {
    expect(agoOf(1_000_000, 1_010_000)).toBe('just now');
  });
  it('steps up through minutes, hours and days', () => {
    const now = 100_000_000;
    expect(agoOf(now - 120_000, now)).toBe('2m ago');
    expect(agoOf(now - 3 * 3_600_000, now)).toBe('3h ago');
    expect(agoOf(now - 2 * 86_400_000, now)).toBe('2d ago');
  });
  it('never reads as the future, however the clocks disagree', () => {
    expect(agoOf(2_000_000, 1_000_000)).toBe('just now');
  });
});

describe('the document lifecycle', () => {
  it('starts on an untitled document that has never been saved', async () => {
    await setup();
    expect(within(topBar()).getByText('untitled.icon')).toBeInTheDocument();
    expect(within(topBar()).getByText('saved never')).toBeInTheDocument();
  });

  it('reads clean until something is edited', async () => {
    const { user } = await setup();
    expect(within(topBar()).queryByText('unsaved')).not.toBeInTheDocument();
    await user.keyboard('r');
    expect(within(topBar()).getByText('unsaved')).toBeInTheDocument();
  });

  it('offers the save button only while dirty', async () => {
    const { user } = await setup();
    expect(within(topBar()).queryByRole('button', { name: /save/ })).not.toBeInTheDocument();
    await user.keyboard('r');
    expect(within(topBar()).getByRole('button', { name: 'save ⌘S' })).toBeInTheDocument();
  });

  it('goes clean again once saved', async () => {
    const { user } = await setup();
    await user.keyboard('r');
    await user.click(within(topBar()).getByRole('button', { name: 'save ⌘S' }));
    await waitFor(() => expect(within(topBar()).getByText('saved just now')).toBeInTheDocument());
  });

  it('⌘S saves without reaching for the button', async () => {
    const { user } = await setup();
    await user.keyboard('r');
    await user.keyboard('{Meta>}s{/Meta}');
    await waitFor(() => expect(within(topBar()).getByText('saved just now')).toBeInTheDocument());
  });

  it('undoing back to the saved state leaves the document clean again', async () => {
    const { user } = await setup();
    await user.keyboard('r');
    await user.keyboard('{Meta>}z{/Meta}');
    // Dirtiness is measured against what was saved, not tracked with a flag,
    // so walking back to it is genuinely clean.
    await waitFor(() => expect(within(topBar()).queryByText('unsaved')).not.toBeInTheDocument());
  });
});

describe('the documents popover', () => {
  it('lists the saved documents with the current one marked', async () => {
    const { user } = await setup();
    await user.click(screen.getByRole('button', { name: 'Documents' }));
    const list = screen.getByRole('list', { name: 'Saved documents' });
    const current = within(list).getAllByRole('button')[0];
    expect(current).toHaveAttribute('aria-current', 'true');
    expect(current).toHaveTextContent('untitled.icon');
  });

  it('creates a new icon from the dashed row, on an empty artboard', async () => {
    const { user } = await setup();
    await user.keyboard('r');
    await user.click(screen.getByRole('button', { name: 'Documents' }));
    await user.click(screen.getByRole('button', { name: '+ new icon' }));
    await waitFor(() =>
      expect(
        within(screen.getByRole('complementary', { name: 'Objects' })).getByText('— no objects —'),
      ).toBeInTheDocument(),
    );
  });

  it('reopening a saved document restores what was in it', async () => {
    const { user } = await setup();
    await user.keyboard('r');
    await user.keyboard('{Meta>}s{/Meta}');
    await waitFor(() => expect(within(topBar()).getByText('saved just now')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Documents' }));
    await user.click(screen.getByRole('button', { name: '+ new icon' }));
    await waitFor(() =>
      expect(
        within(screen.getByRole('complementary', { name: 'Objects' })).getByText('— no objects —'),
      ).toBeInTheDocument(),
    );

    await user.click(screen.getByRole('button', { name: 'Documents' }));
    const rows = within(screen.getByRole('list', { name: 'Saved documents' })).getAllByRole(
      'button',
    );
    await user.click(rows[rows.length - 1]!);
    await waitFor(() =>
      expect(
        within(screen.getByRole('complementary', { name: 'Objects' })).getAllByRole('listitem'),
      ).toHaveLength(1),
    );
  });

  it('a reopened document has no history to undo into', async () => {
    const { user } = await setup();
    await user.keyboard('r');
    await user.keyboard('{Meta>}s{/Meta}');
    await waitFor(() => expect(within(topBar()).getByText('saved just now')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Documents' }));
    await user.click(screen.getByRole('button', { name: '+ new icon' }));
    await waitFor(() =>
      expect(
        within(screen.getByRole('complementary', { name: 'Objects' })).getByText('— no objects —'),
      ).toBeInTheDocument(),
    );

    // ⌘Z must not walk back into the previous document's edits.
    await user.keyboard('{Meta>}z{/Meta}');
    expect(
      within(screen.getByRole('complementary', { name: 'Objects' })).getByText('— no objects —'),
    ).toBeInTheDocument();
  });
});
