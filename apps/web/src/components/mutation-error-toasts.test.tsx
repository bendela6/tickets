import { QueryClient, QueryClientProvider, useMutation } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test } from 'vitest';
import { ToastProvider } from '@tickets/ui';
import { OWN_ERROR, type MutationHookOptions } from '../api/mutation-meta';
import { MutationErrorToasts } from './mutation-error-toasts';

function FailingSave({ options }: { options?: MutationHookOptions }) {
  const save = useMutation({
    ...options,
    mutationFn: () => Promise.reject(new Error('key "TIX" is already taken')),
  });
  return (
    <button type="button" onClick={() => save.mutate()}>
      Save
    </button>
  );
}

function renderWith(options?: MutationHookOptions) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MutationErrorToasts />
        <FailingSave options={options} />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

test('a failed mutation is toasted with its message', async () => {
  renderWith();
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByText(`Couldn't save: key "TIX" is already taken`)).toBeInTheDocument();
});

test('a mutation whose screen shows its own error is not toasted', async () => {
  renderWith(OWN_ERROR);
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(screen.queryByText(/Couldn't save/)).not.toBeInTheDocument();
});
