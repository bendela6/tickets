import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { CurrentUserProvider } from '../../state/current-user-context';
import { NewProjectDialog } from './new-project-dialog';

const { navigateMock } = vi.hoisted(() => ({ navigateMock: vi.fn() }));
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => navigateMock }));

function renderDialog() {
  const onOpenChange = vi.fn();
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <CurrentUserProvider>
        <NewProjectDialog open onOpenChange={onOpenChange} />
      </CurrentUserProvider>
    </QueryClientProvider>,
  );
  return { onOpenChange };
}

function answer(status: number, body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: status < 400,
    status,
    statusText: '',
    text: () => Promise.resolve(JSON.stringify(body)),
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

async function fillAndCreate() {
  await userEvent.type(screen.getByPlaceholderText('Gateway'), 'Gateway');
  await userEvent.type(screen.getByPlaceholderText('gateway'), 'gateway');
  await userEvent.type(screen.getByPlaceholderText('GW'), 'gw');
  await userEvent.click(screen.getByRole('button', { name: 'Create project' }));
}

beforeEach(() => {
  localStorage.setItem('tickets-user-id', '7');
});

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
  navigateMock.mockClear();
});

// The API answers project.create with the id alone, so the dialog opens the
// project on the key it sent.
test('creating closes the dialog and opens the new project by its key', async () => {
  const fetchMock = answer(201, { id: 9 });
  const { onOpenChange } = renderDialog();
  await fillAndCreate();
  await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(JSON.parse(String(init.body))).toMatchObject({ key: 'gateway', name: 'Gateway', itemPrefix: 'GW' });
  expect(navigateMock).toHaveBeenCalledWith({ to: '/p/$projectKey', params: { projectKey: 'gateway' } });
});

test('a refused create shows why under the fields and keeps the dialog open', async () => {
  answer(409, { error: 'key "gateway" is already taken' });
  const { onOpenChange } = renderDialog();
  await fillAndCreate();
  expect(await screen.findByText('key "gateway" is already taken')).toBeInTheDocument();
  expect(onOpenChange).not.toHaveBeenCalled();
  expect(navigateMock).not.toHaveBeenCalled();
});
