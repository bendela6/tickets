import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { DsnField } from './dsn-field';

const DSN = 'sgl://pub_4f9c21ab@127.0.0.1:4180/3';

test('shows the dsn text and labels the field for assistive tech', () => {
  render(<DsnField dsn={DSN} />);
  expect(screen.getByText(DSN)).toBeInTheDocument();
  expect(screen.getByLabelText('DSN')).toBeInTheDocument();
});

test('copies the dsn to the clipboard via CopyButton and flips to a "Copied" state', async () => {
  // userEvent.setup() installs its own navigator.clipboard stub (overriding
  // anything set beforehand), so the spy has to attach after setup() runs.
  const user = userEvent.setup();
  const writeText = vi.spyOn(navigator.clipboard, 'writeText');

  render(<DsnField dsn={DSN} />);
  const button = screen.getByRole('button', { name: 'Copy' });
  await user.click(button);

  expect(writeText).toHaveBeenCalledWith(DSN);
  expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument();
});

test('shows a transient "Copy failed" state when the clipboard write rejects, with no unhandled rejection', async () => {
  const onUnhandledRejection = vi.fn();
  window.addEventListener('unhandledrejection', onUnhandledRejection);

  try {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'));

    render(<DsnField dsn={DSN} />);
    const button = screen.getByRole('button', { name: 'Copy' });
    await user.click(button);

    expect(await screen.findByRole('button', { name: 'Copy failed' })).toBeInTheDocument();
    // Give any stray (unhandled) rejection a tick to surface before asserting.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(onUnhandledRejection).not.toHaveBeenCalled();
  } finally {
    window.removeEventListener('unhandledrejection', onUnhandledRejection);
  }
});
