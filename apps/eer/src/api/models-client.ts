// Thin fetch wrappers around the dev-only /api/models middleware
// (../../vite-plugins/models-api.ts) — never present in a production build.
// Every entry point that hands the app a plain verdict (null / boolean) instead
// of a thrown error degrades instead of rejecting, so callers can react to
// "the API isn't there" the same way they react to "the API said no" — that's
// what lets ModelMenu hide itself entirely on a null listModels() result.

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
    if (!res.ok) return null;
    const body: unknown = await res.json();
    return Array.isArray(body) ? (body as ModelSummary[]) : null;
  } catch {
    return null;
  }
}

export async function getModel(id: string): Promise<unknown> {
  const res = await fetch(`${BASE}/${encodeURIComponent(id)}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(await errorMessage(res));
  return res.json();
}

export async function createModel(raw: unknown): Promise<{ id: string } | { error: string }> {
  try {
    const res = await fetch(BASE, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(raw),
    });
    if (!res.ok) return { error: await errorMessage(res) };
    return (await res.json()) as { id: string };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function saveModel(id: string, raw: unknown): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(raw),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function deleteModel(id: string): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' });
    return res.ok;
  } catch {
    return false;
  }
}
