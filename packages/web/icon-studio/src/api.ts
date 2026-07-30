import type { MarkConfig } from './config';
import { RASTER_SIZES, svgToPngBase64 } from './generate/raster';
import { svgChip } from './generate/svg';
import type { GenerateResponse } from './plugin/write';

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  // Only forward a second argument when there's an init — passing an
  // explicit `undefined` still shows up as a second call argument, which
  // trips up callers asserting `fetch` was called with just the URL.
  const res = init === undefined ? await fetch(url) : await fetch(url, init);
  if (!res.ok) {
    let message = `${url} (${res.status})`;
    try {
      const body = await res.json() as unknown;
      if (typeof body === 'object' && body !== null && 'error' in body) {
        const error = (body as Record<string, unknown>).error;
        if (typeof error === 'string') {
          message = `${url} (${res.status}): ${error}`;
        }
      }
    } catch {
      // Ignore parse errors, use status-based message
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

export function fetchConfig(): Promise<MarkConfig> {
  return json<MarkConfig>('/__icons/config');
}

/**
 * The only assets the server cannot derive. apple-touch-icon is square because
 * iOS applies its own mask; the other two keep the rounded field.
 */
export async function buildPngs(config: MarkConfig): Promise<Record<string, string>> {
  const entries = await Promise.all(
    Object.entries(RASTER_SIZES).map(async ([name, size]) => {
      const svg = svgChip(config, { rounded: name !== 'apple-touch-icon.png' });
      return [name, await svgToPngBase64(svg, size)] as const;
    }),
  );
  return Object.fromEntries(entries);
}

export async function generate(config: MarkConfig): Promise<GenerateResponse> {
  const pngs = await buildPngs(config);
  return json<GenerateResponse>('/__icons/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ config, pngs }),
  });
}
