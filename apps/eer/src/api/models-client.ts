// Thin fetch wrappers around the dev-only /api/models middleware
// (../../vite-plugins/models-api.ts) — never present in a production build.
// Every entry point that hands the app a plain verdict (null / boolean) instead
// of a thrown error degrades instead of rejecting, so callers can react to
// "the API isn't there" the same way they react to "the API said no" — that's
// what lets ModelMenu hide itself entirely on a null listModels() result.
//
// Degrading to null/false/{error} on an absent dev API or a 404 is by design
// and NOT reported. Only genuine faults reach Signals: a fetch that throws
// (network) or a 5xx response — mirroring apps/web/src/api/client.ts.

import { captureError } from '@bendela6/signals-react';

export interface ModelSummary {
  id: string;
  title: string;
}

const BASE = '/api/models';

async function errorMessage(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? `HTTP ${res.status}`;
}

export async function listModels(): Promise<ModelSummary[] | null> {
  try {
    const res = await fetch(BASE, { cache: 'no-store' });
    if (!res.ok) {
      if (res.status >= 500) {
        captureError(new Error(`GET ${BASE} failed: HTTP ${res.status}`), {
          mechanism: 'manual',
          contexts: { http: { url: BASE, status: res.status } },
        });
      }
      return null;
    }
    const body: unknown = await res.json();
    return Array.isArray(body) ? (body as ModelSummary[]) : null;
  } catch (err) {
    captureError(err, { mechanism: 'manual', contexts: { http: { url: BASE } } });
    return null;
  }
}

export async function getModel(id: string): Promise<unknown> {
  const url = `${BASE}/${encodeURIComponent(id)}`;
  let res: Response;
  try {
    res = await fetch(url, { cache: 'no-store' });
  } catch (err) {
    captureError(err, { mechanism: 'manual', contexts: { http: { url } } });
    throw err;
  }
  if (!res.ok) {
    if (res.status >= 500) {
      captureError(new Error(`GET ${url} failed: HTTP ${res.status}`), {
        mechanism: 'manual',
        contexts: { http: { url, status: res.status } },
      });
    }
    throw new Error(await errorMessage(res));
  }
  return res.json();
}

export async function createModel(raw: unknown): Promise<{ id: string } | { error: string }> {
  try {
    const res = await fetch(BASE, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(raw),
    });
    if (!res.ok) {
      const message = await errorMessage(res);
      if (res.status >= 500) {
        captureError(new Error(`POST ${BASE} failed: ${message}`), {
          mechanism: 'manual',
          contexts: { http: { url: BASE, status: res.status } },
        });
      }
      return { error: message };
    }
    return (await res.json()) as { id: string };
  } catch (err) {
    captureError(err, { mechanism: 'manual', contexts: { http: { url: BASE } } });
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function saveModel(id: string, raw: unknown): Promise<boolean> {
  const url = `${BASE}/${encodeURIComponent(id)}`;
  try {
    const res = await fetch(url, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(raw),
    });
    if (!res.ok && res.status >= 500) {
      captureError(new Error(`PUT ${url} failed: HTTP ${res.status}`), {
        mechanism: 'manual',
        contexts: { http: { url, status: res.status } },
      });
    }
    return res.ok;
  } catch (err) {
    captureError(err, { mechanism: 'manual', contexts: { http: { url } } });
    return false;
  }
}

export async function deleteModel(id: string): Promise<boolean> {
  const url = `${BASE}/${encodeURIComponent(id)}`;
  try {
    const res = await fetch(url, { method: 'DELETE' });
    if (!res.ok && res.status >= 500) {
      captureError(new Error(`DELETE ${url} failed: HTTP ${res.status}`), {
        mechanism: 'manual',
        contexts: { http: { url, status: res.status } },
      });
    }
    return res.ok;
  } catch (err) {
    captureError(err, { mechanism: 'manual', contexts: { http: { url } } });
    return false;
  }
}
