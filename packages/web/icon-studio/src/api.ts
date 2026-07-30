import type { MarkConfig } from './config';
import { RASTER_SIZES, svgToPngBase64 } from './generate/raster';
import { svgChip } from './generate/svg';
import type { GenerateResponse } from './plugin/write';

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${url} failed: ${res.status}`);
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
