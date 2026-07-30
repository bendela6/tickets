import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DEFAULT_CONFIG } from './config';
import { Studio } from './studio';

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url === '/__icons/config') return { ok: true, json: async () => DEFAULT_CONFIG };
      return { ok: true, json: async () => ({ results: [] }) };
    }),
  );
});

afterEach(() => vi.unstubAllGlobals());

test('renders the studio heading', async () => {
  render(<Studio />);
  expect(screen.getByRole('heading', { name: 'Icon studio' })).toBeDefined();
});

test('loads the committed config on mount', async () => {
  render(<Studio />);
  // `json()` forwards its optional init, so the call carries a second
  // `undefined` argument — assert the real call, not a tidier one.
  await waitFor(() => expect(fetch).toHaveBeenCalledWith('/__icons/config', undefined));
});

test('shows a colour picker per stick for both themes', async () => {
  render(<Studio />);
  for (const label of ['light top', 'light mid', 'light low', 'dark top', 'dark mid', 'dark low']) {
    expect(screen.getByLabelText(label), label).toBeDefined();
  }
});

test('shows an angle slider per stick', async () => {
  render(<Studio />);
  for (const label of ['top angle', 'mid angle', 'low angle']) {
    expect(screen.getByLabelText(label), label).toBeDefined();
  }
});

test('lists every file that Generate will write', async () => {
  render(<Studio />);
  for (const name of [
    'favicon.svg', 'icon-mono.svg', 'icon-192.png', 'icon-512.png',
    'apple-touch-icon.png', 'site.webmanifest',
  ]) {
    expect(screen.getByText(name), name).toBeDefined();
  }
});

test('offers a Generate button', async () => {
  render(<Studio />);
  expect(screen.getByRole('button', { name: /generate/i })).toBeDefined();
});

test('wires each stick colour picker to its own index, not a neighbour', async () => {
  render(<Studio />);
  // Let the committed config finish loading before mutating state, so the
  // async `loadConfig` dispatch can't race the change below and clobber it.
  await waitFor(() => expect(fetch).toHaveBeenCalledWith('/__icons/config', undefined));

  const top = screen.getByLabelText('light top') as HTMLInputElement;
  const mid = screen.getByLabelText('light mid') as HTMLInputElement;
  const low = screen.getByLabelText('light low') as HTMLInputElement;
  const [originalTop, , originalLow] = DEFAULT_CONFIG.light;

  fireEvent.change(mid, { target: { value: '#123456' } });

  expect(mid.value).toBe('#123456');
  expect(top.value).toBe(originalTop);
  expect(low.value).toBe(originalLow);
});
