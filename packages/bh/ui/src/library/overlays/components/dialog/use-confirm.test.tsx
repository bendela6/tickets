import { useState } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { ConfirmProvider, useConfirm, type ConfirmOptions } from './use-confirm';

type User = ReturnType<typeof userEvent.setup>;

// A button that asks, and says what it was answered.
function Asker({ options }: { options: ConfirmOptions }) {
  const { confirm } = useConfirm();
  const [answer, setAnswer] = useState('');
  return (
    <>
      <button
        type="button"
        onClick={async () => {
          setAnswer('asking');
          setAnswer(String(await confirm(options)));
        }}
      >
        Delete notes.txt
      </button>
      <output aria-label="Answer">{answer}</output>
    </>
  );
}

const plain: ConfirmOptions = { title: 'Delete notes.txt?', confirmLabel: 'Delete' };
// While the dialog is open, the page behind it is hidden from assistive technology.
const answer = () => screen.getByRole('status', { name: 'Answer', hidden: true });
const ask = (user: User) => user.click(screen.getByRole('button', { name: 'Delete notes.txt' }));
// Busy, Button's spinner adds its own word to the name.
const confirmButton = () => screen.getByRole('button', { name: /^(Loading ?)?Delete$/ });

function renderAsker(options: ConfirmOptions) {
  return render(
    <ConfirmProvider>
      <Asker options={options} />
    </ConfirmProvider>,
  );
}

describe('confirm', () => {
  test('opens a ConfirmDialog with the options it is given', async () => {
    const user = userEvent.setup();
    renderAsker({ ...plain, body: 'The file is removed from this folder.' });
    await ask(user);
    expect(screen.getByRole('dialog', { name: 'Delete notes.txt?' })).toHaveAccessibleDescription(
      'The file is removed from this folder.',
    );
  });

  test('answers true when it is confirmed, and gives focus back to what asked', async () => {
    const user = userEvent.setup();
    renderAsker(plain);
    await ask(user);
    await user.click(confirmButton());
    await waitFor(() => expect(answer()).toHaveTextContent('true'));
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Delete notes.txt' })).toHaveFocus();
    });
  });

  const byCancel = (user: User) => user.click(screen.getByRole('button', { name: 'Cancel' }));
  const byEsc = (user: User) => user.keyboard('{Escape}');

  test.each([
    ['the cancel button', byCancel],
    ['Esc', byEsc],
  ])('answers false when %s closes it', async (_how, close) => {
    const user = userEvent.setup();
    renderAsker(plain);
    await ask(user);
    await close(user);
    await waitFor(() => expect(answer()).toHaveTextContent('false'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  test('runs onConfirm, waits for its promise, and answers true once it has worked', async () => {
    const user = userEvent.setup();
    let finish: () => void = () => {};
    const onConfirm = vi.fn(() => {
      return new Promise<void>((resolve) => {
        finish = resolve;
      });
    });
    renderAsker({ ...plain, onConfirm });
    await ask(user);
    await user.click(confirmButton());
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(confirmButton()).toHaveAttribute('aria-busy', 'true');
    expect(answer()).toHaveTextContent('asking');
    await act(async () => finish());
    await waitFor(() => expect(answer()).toHaveTextContent('true'));
  });

  test('when onConfirm fails, shows the error, and a cancel then answers false', async () => {
    const user = userEvent.setup();
    renderAsker({ ...plain, onConfirm: () => Promise.reject(new Error('The file is locked.')) });
    await ask(user);
    await user.click(confirmButton());
    expect(await screen.findByRole('alert')).toHaveTextContent('The file is locked.');
    expect(answer()).toHaveTextContent('asking');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(answer()).toHaveTextContent('false'));
  });

  test('when onConfirm fails and then works, answers true', async () => {
    const user = userEvent.setup();
    const onConfirm = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error('The file is locked.'))
      .mockResolvedValueOnce(undefined);
    renderAsker({ ...plain, onConfirm });
    await ask(user);
    await user.click(confirmButton());
    await screen.findByRole('alert');
    await user.click(confirmButton());
    await waitFor(() => expect(answer()).toHaveTextContent('true'));
  });

  test('a sync onConfirm that throws answers nothing until the dialog closes', async () => {
    const user = userEvent.setup();
    renderAsker({
      ...plain,
      onConfirm: () => {
        throw new Error('The file is locked.');
      },
    });
    await ask(user);
    await user.click(confirmButton());
    expect(screen.getByRole('alert')).toHaveTextContent('The file is locked.');
    expect(answer()).toHaveTextContent('asking');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(answer()).toHaveTextContent('false'));
  });

  test('asks for a phrase when given one', async () => {
    const user = userEvent.setup();
    renderAsker({ ...plain, phrase: 'notes.txt' });
    await ask(user);
    expect(confirmButton()).toBeDisabled();
    await user.keyboard('notes.txt{Enter}');
    await waitFor(() => expect(answer()).toHaveTextContent('true'));
  });

  test('asks one question at a time: the next waits for the one open to close', async () => {
    function TwoAtOnce() {
      const { confirm } = useConfirm();
      const [answers, setAnswers] = useState<string[]>([]);
      return (
        <>
          <button
            type="button"
            onClick={() => {
              for (const name of ['a.txt', 'b.txt']) {
                void confirm({ title: `Delete ${name}?`, confirmLabel: 'Delete' }).then((ok) => {
                  setAnswers((current) => [...current, `${name} ${String(ok)}`]);
                });
              }
            }}
          >
            Delete both
          </button>
          <output aria-label="Answers">{answers.join(', ')}</output>
        </>
      );
    }
    const user = userEvent.setup();
    render(
      <ConfirmProvider>
        <TwoAtOnce />
      </ConfirmProvider>,
    );
    const opener = screen.getByRole('button', { name: 'Delete both' });
    await user.click(opener);
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Delete a.txt?');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(await screen.findByRole('dialog', { name: 'Delete b.txt?' })).toBeInTheDocument();
    await user.click(confirmButton());
    await waitFor(() => {
      expect(screen.getByRole('status', { name: 'Answers' })).toHaveTextContent(
        'a.txt false, b.txt true',
      );
    });
    await waitFor(() => expect(opener).toHaveFocus());
  });

  test('an ask still open as the provider leaves the page answers false', async () => {
    const user = userEvent.setup();
    let answered: boolean | undefined;
    function Asks() {
      const { confirm } = useConfirm();
      return (
        <button
          type="button"
          onClick={async () => {
            answered = await confirm(plain);
          }}
        >
          Ask
        </button>
      );
    }
    const { unmount } = render(
      <ConfirmProvider>
        <Asks />
      </ConfirmProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Ask' }));
    unmount();
    await waitFor(() => expect(answered).toBe(false));
  });

  test('useConfirm outside a ConfirmProvider throws', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Asker options={plain} />)).toThrow(
      'useConfirm must be used within a ConfirmProvider',
    );
  });
});
