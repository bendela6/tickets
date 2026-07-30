import { render, screen, waitFor } from '@testing-library/react';
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
  await waitFor(() => expect(fetch).toHaveBeenCalledWith('/__icons/config'));
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
