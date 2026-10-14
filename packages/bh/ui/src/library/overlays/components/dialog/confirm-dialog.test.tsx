import { useState } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { ConfirmDialog } from './confirm-dialog';

/** A promise and the two ways to settle it, for a run the test ends when it chooses. */
function deferred() {
  let resolve: () => void = () => {};
  let reject: (error: unknown) => void = () => {};
  const promise = new Promise<void>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

type Props = Partial<Parameters<typeof ConfirmDialog>[0]>;

// Opened from a button of its own, the way an app opens one, with every
// change of `open` recorded.
function Host({ onOpenChange, ...props }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Delete report.pdf
      </button>
      <ConfirmDialog
        title="Delete report.pdf?"
        confirmLabel="Delete"
        onConfirm={() => {}}
        {...props}
        open={open}
        onOpenChange={(next) => {
          onOpenChange?.(next);
          setOpen(next);
        }}
      />
    </>
  );
}

// Busy, Button's spinner adds its own word to the name: "Loading Delete".
const confirmButton = () => screen.getByRole('button', { name: /^(Loading ?)?Delete$/ });

async function openIt(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Delete report.pdf' }));
  expect(screen.getByRole('dialog')).toBeInTheDocument();
}

describe('a sync onConfirm', () => {
  test('closes the dialog at once, after onConfirm', async () => {
    const user = userEvent.setup();
    const calls: string[] = [];
    render(
      <Host
        onConfirm={() => calls.push('confirm')}
        onOpenChange={(open) => calls.push(`open ${String(open)}`)}
      />,
    );
    await openIt(user);
    await user.click(confirmButton());
    expect(calls).toEqual(['confirm', 'open false']);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  test('that throws shows the error and stays open', async () => {
    const user = userEvent.setup();
    render(
      <Host
        onConfirm={() => {
          throw new Error('The file is locked.');
        }}
      />,
    );
    await openIt(user);
    await user.click(confirmButton());
    expect(screen.getByRole('alert')).toHaveTextContent('The file is locked.');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

describe('an onConfirm that returns a promise', () => {
  test('is busy while it runs, then closes when it resolves', async () => {
    const user = userEvent.setup();
    const run = deferred();
    const onOpenChange = vi.fn();
    render(<Host onConfirm={() => run.promise} onOpenChange={onOpenChange} />);
    await openIt(user);
    await user.click(confirmButton());

    expect(confirmButton()).toHaveAttribute('aria-busy', 'true');
    expect(confirmButton()).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(onOpenChange).not.toHaveBeenCalled();

    await act(async () => run.resolve());
    expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  test('holds open against Esc while it runs', async () => {
    const user = userEvent.setup();
    const run = deferred();
    const onOpenChange = vi.fn();
    render(<Host onConfirm={() => run.promise} onOpenChange={onOpenChange} />);
    await openIt(user);
    await user.click(confirmButton());
    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
    await act(async () => run.resolve());
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  test('runs once, however often the button is pressed', async () => {
    const user = userEvent.setup();
    const run = deferred();
    const onConfirm = vi.fn(() => run.promise);
    render(<Host onConfirm={onConfirm} />);
    await openIt(user);
    await user.click(confirmButton());
    await user.click(confirmButton());
    await user.keyboard('{Enter}');
    expect(onConfirm).toHaveBeenCalledOnce();
    await act(async () => run.resolve());
  });

  test('keeps focus inside the dialog while it runs', async () => {
    const user = userEvent.setup();
    const run = deferred();
    render(<Host onConfirm={() => run.promise} />);
    await openIt(user);
    await user.click(confirmButton());
    expect(screen.getByRole('dialog')).toHaveFocus();
    await act(async () => run.resolve());
  });

  test('that rejects shows its error, stays open, and gives focus back to the button', async () => {
    const user = userEvent.setup();
    const run = deferred();
    render(<Host onConfirm={() => run.promise} />);
    await openIt(user);
    await user.click(confirmButton());
    await act(async () => run.reject(new Error('The server did not answer.')));

    expect(screen.getByRole('alert')).toHaveTextContent('The server did not answer.');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(confirmButton()).toBeEnabled();
    expect(confirmButton()).not.toHaveAttribute('aria-busy');
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled();
    expect(confirmButton()).toHaveFocus();
  });

  test('can be tried again after it fails, and the error goes as it starts', async () => {
    const user = userEvent.setup();
    const first = deferred();
    const second = deferred();
    const onConfirm = vi
      .fn<() => Promise<void>>()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    render(<Host onConfirm={onConfirm} />);
    await openIt(user);
    await user.click(confirmButton());
    await act(async () => first.reject(new Error('The server did not answer.')));
    expect(screen.getByRole('alert')).toBeInTheDocument();

    await user.click(confirmButton());
    expect(screen.queryByRole('alert')).toBeNull();
    await act(async () => second.resolve());
    expect(onConfirm).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  test('can be cancelled after it fails', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<Host onConfirm={() => Promise.reject(new Error('No.'))} onOpenChange={onOpenChange} />);
    await openIt(user);
    await user.click(confirmButton());
    await screen.findByRole('alert');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  test('says what it was given in place of a message, or a sentence of its own', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Host onConfirm={() => Promise.reject('Quota exceeded.')} />);
    await openIt(user);
    await user.click(confirmButton());
    expect(await screen.findByRole('alert')).toHaveTextContent('Quota exceeded.');
    unmount();

    render(<Host onConfirm={() => Promise.reject(undefined)} />);
    await openIt(user);
    await user.click(confirmButton());
    expect(await screen.findByRole('alert')).toHaveTextContent('This could not be done.');
  });

  test('describeError puts the failure in words of its own', async () => {
    const user = userEvent.setup();
    const describeError = vi.fn(() => 'Could not delete the file.');
    const failure = new Error('HTTP 503');
    render(<Host onConfirm={() => Promise.reject(failure)} describeError={describeError} />);
    await openIt(user);
    await user.click(confirmButton());
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not delete the file.');
    expect(describeError).toHaveBeenCalledWith(failure);
  });

  test('each opening starts with no error', async () => {
    const user = userEvent.setup();
    render(<Host onConfirm={() => Promise.reject(new Error('No.'))} />);
    await openIt(user);
    await user.click(confirmButton());
    await screen.findByRole('alert');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await openIt(user);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  test('closed by the app while it runs, what it settles to later is no one’s', async () => {
    const run = deferred();
    const onOpenChange = vi.fn();
    const props = {
      title: 'Delete report.pdf?',
      confirmLabel: 'Delete',
      onConfirm: () => run.promise,
      onOpenChange,
    };
    const user = userEvent.setup();
    const { rerender } = render(<ConfirmDialog {...props} open />);
    await user.click(confirmButton());
    rerender(<ConfirmDialog {...props} open={false} />);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    rerender(<ConfirmDialog {...props} open />);
    // Not busy: the run belonged to the opening that was closed.
    expect(confirmButton()).toBeEnabled();
    await act(async () => run.resolve());
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

describe('children', () => {
  test('are drawn under the body and above the buttons', async () => {
    const user = userEvent.setup();
    render(
      <Host body="The folder and its files leave the library.">
        <p>Three files are in it.</p>
      </Host>,
    );
    await openIt(user);
    const dialog = screen.getByRole('dialog');
    const order = [...dialog.querySelectorAll('p, button')].map((node) => node.textContent);
    expect(order).toEqual([
      'The folder and its files leave the library.',
      'Three files are in it.',
      'Cancel',
      'Delete',
    ]);
  });

  test('can hold a choice that changes what the confirm does', async () => {
    function WithAChoice({ onConfirm }: { onConfirm: (alsoFiles: boolean) => void }) {
      const [alsoFiles, setAlsoFiles] = useState(false);
      return (
        <Host onConfirm={() => onConfirm(alsoFiles)}>
          <label>
            <input
              type="checkbox"
              checked={alsoFiles}
              onChange={(event) => setAlsoFiles(event.target.checked)}
            />
            Also delete the files
          </label>
        </Host>
      );
    }
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<WithAChoice onConfirm={onConfirm} />);
    await openIt(user);
    await user.click(screen.getByRole('checkbox', { name: 'Also delete the files' }));
    await user.click(confirmButton());
    expect(onConfirm).toHaveBeenCalledExactlyOnceWith(true);
  });

  test('without a body, the dialog names no description', async () => {
    const user = userEvent.setup();
    render(
      <Host>
        <p>Three files are in it.</p>
      </Host>,
    );
    await openIt(user);
    expect(screen.getByRole('dialog')).not.toHaveAttribute('aria-describedby');
  });

  test('with a body, the body describes it', async () => {
    const user = userEvent.setup();
    render(<Host body="The file is removed from this folder." />);
    await openIt(user);
    expect(screen.getByRole('dialog')).toHaveAccessibleDescription(
      'The file is removed from this folder.',
    );
  });
});

describe('a phrase to type', () => {
  const field = () => screen.getByRole('textbox', { name: 'Type my-app to confirm' });

  test('keeps the confirm button disabled until the field holds it exactly', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<Host phrase="my-app" onConfirm={onConfirm} />);
    await openIt(user);
    expect(confirmButton()).toBeDisabled();
    await user.type(field(), 'my-ap');
    expect(confirmButton()).toBeDisabled();
    await user.clear(field());
    await user.type(field(), 'MY-APP');
    expect(confirmButton()).toBeDisabled();
    await user.clear(field());
    await user.type(field(), 'my-app ');
    expect(confirmButton()).toBeDisabled();
    await user.type(field(), '{Backspace}');
    expect(confirmButton()).toBeEnabled();
    await user.click(confirmButton());
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  test('takes focus as the dialog opens', async () => {
    const user = userEvent.setup();
    render(<Host phrase="my-app" />);
    await openIt(user);
    expect(field()).toHaveFocus();
  });

  test('Enter in the field confirms once it matches, and not before', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<Host phrase="my-app" onConfirm={onConfirm} />);
    await openIt(user);
    await user.type(field(), 'my{Enter}');
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.type(field(), '-app{Enter}');
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  test('each opening starts with an empty field', async () => {
    const user = userEvent.setup();
    render(<Host phrase="my-app" />);
    await openIt(user);
    await user.type(field(), 'my-app');
    await user.keyboard('{Escape}');
    await openIt(user);
    expect(field()).toHaveValue('');
    expect(confirmButton()).toBeDisabled();
  });

  test('is disabled while onConfirm runs, and takes focus back if it fails', async () => {
    const user = userEvent.setup();
    const run = deferred();
    render(<Host phrase="my-app" onConfirm={() => run.promise} />);
    await openIt(user);
    await user.type(field(), 'my-app{Enter}');
    expect(field()).toBeDisabled();
    expect(screen.getByRole('dialog')).toHaveFocus();
    await act(async () => run.reject(new Error('No.')));
    expect(field()).toBeEnabled();
    expect(field()).toHaveFocus();
    expect(field()).toHaveValue('my-app');
  });

  test('phraseLabel puts the ask in words of its own', async () => {
    const user = userEvent.setup();
    render(<Host phrase="my-app" phraseLabel="Write the app's name, my-app" />);
    await openIt(user);
    expect(screen.getByRole('textbox', { name: "Write the app's name, my-app" })).toBeVisible();
  });

  test('an empty phrase asks for nothing', async () => {
    const user = userEvent.setup();
    render(<Host phrase="" />);
    await openIt(user);
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(confirmButton()).toBeEnabled();
  });
});
