import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DEFAULT_DOC } from './doc';
import { Studio } from './studio';

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url === '/__icons/config') return { ok: true, json: async () => DEFAULT_DOC };
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

/** The swatch's rendered preview hex — the live, adjusted colour, distinct
 * from the raw picker `value` which never itself carries an adjustment. */
function derivedHexFor(label: string): string {
  const input = screen.getByLabelText(label);
  const row = input.closest('div');
  const hexSpan = row
    ? Array.from(row.querySelectorAll('span')).find((s) => /^#[0-9a-f]{6}$/i.test(s.textContent ?? ''))
    : null;
  if (!hexSpan) throw new Error(`no derived colour text found for "${label}"`);
  return hexSpan.textContent ?? '';
}

test('vividness adjustments never compound: resetting returns to the original colour', async () => {
  render(<Studio />);
  await waitFor(() => expect(fetch).toHaveBeenCalledWith('/__icons/config', undefined));

  const original = derivedHexFor('light top');

  // Two adjustments in a row — if the second derived from the first's
  // already-adjusted result rather than from the untouched base, resetting
  // below would land somewhere other than `original`.
  const vivid = screen.getByLabelText('light vivid') as HTMLInputElement;
  fireEvent.change(vivid, { target: { value: '1.6' } });
  fireEvent.change(vivid, { target: { value: '0.5' } });
  expect(derivedHexFor('light top')).not.toBe(original);

  fireEvent.click(screen.getByRole('button', { name: /reset adjustments/i }));
  await waitFor(() => expect(derivedHexFor('light top')).toBe(original));
});

test('wires each stick colour picker to its own index, not a neighbour', async () => {
  render(<Studio />);
  // Let the committed config finish loading before mutating state, so the
  // async `loadConfig` dispatch can't race the change below and clobber it.
  await waitFor(() => expect(fetch).toHaveBeenCalledWith('/__icons/config', undefined));

  const top = screen.getByLabelText('light top') as HTMLInputElement;
  const mid = screen.getByLabelText('light mid') as HTMLInputElement;
  const low = screen.getByLabelText('light low') as HTMLInputElement;
  const originalTop = DEFAULT_DOC.inks.top?.light;
  const originalLow = DEFAULT_DOC.inks.low?.light;

  fireEvent.change(mid, { target: { value: '#123456' } });

  expect(mid.value).toBe('#123456');
  expect(top.value).toBe(originalTop);
  expect(low.value).toBe(originalLow);
});
