import type { IconDoc } from './doc';
import { RASTER_SIZES, svgToPngBase64 } from './generate/raster';
import { renderSvg } from './generate/render';
import type { GenerateResponse } from './plugin/write';

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
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

/**
 * Whatever is currently on disk — either a legacy `MarkConfig` or an
 * `IconDoc`, since a repo that predates the element model may not have
 * regenerated yet. The caller always runs this through `toDoc()` before
 * using it, which accepts both.
 */
export function fetchConfig(): Promise<unknown> {
  return json<unknown>('/__icons/config');
}

/**
 * The only assets the server cannot derive. apple-touch-icon is square because
 * iOS applies its own mask, hence the separate `apple` variant; the other two
 * keep the rounded `chip` field.
 */
export async function buildPngs(doc: IconDoc): Promise<Record<string, string>> {
  const entries = await Promise.all(
    Object.entries(RASTER_SIZES).map(async ([name, size]) => {
      const variant = name === 'apple-touch-icon.png' ? 'apple' : 'chip';
      const svg = renderSvg(doc, variant);
      return [name, await svgToPngBase64(svg, size)] as const;
    }),
  );
  return Object.fromEntries(entries);
}

export async function generate(doc: IconDoc): Promise<GenerateResponse> {
  const pngs = await buildPngs(doc);
  return json<GenerateResponse>('/__icons/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ config: doc, pngs }),
  });
}
