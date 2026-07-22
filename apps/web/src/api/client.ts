import { captureError } from '@bendela6/signals-react';
import { ApiError } from './api-error';

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        // only claim a JSON body when there is one — Fastify 400s otherwise
        ...(init?.body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(init?.headers ?? {}),
      },
    });
  } catch (err) {
    // Network failure (offline, DNS, CORS, aborted) — fetch itself rejected
    // before any response existed. Still worth seeing in Signals; rethrow
    // unchanged so callers see the same error they always did.
    captureError(err, { mechanism: 'manual', contexts: { http: { url } } });
    throw err;
  }

  const text = await response.text();

  if (!response.ok) {
    let message = response.statusText || `request failed with status ${response.status}`;
    if (text.length > 0) {
      try {
        const body: unknown = JSON.parse(text);
        if (body !== null && typeof body === 'object') {
          const record = body as Record<string, unknown>;
          if (typeof record.error === 'string') {
            message = record.error;
          } else if (typeof record.message === 'string') {
            message = record.message;
          }
        }
      } catch {
        // non-JSON error body — keep the default message
      }
    }
    const apiError = new ApiError(response.status, message);
    // The API now captures its own 4xx (handled client errors) as warnings —
    // only report 5xx here, so a genuine server fault is visible from the web
    // side too (in case the API's own capture never lands, e.g. it crashed
    // before reaching the error hook).
    if (response.status >= 500) {
      captureError(apiError, { mechanism: 'manual', contexts: { http: { url, status: response.status } } });
    }
    throw apiError;
  }

  if (text.length === 0) {
    return undefined as T;
  }
  return JSON.parse(text) as T;
}

export function apiMutate<T>(
  path: string,
  opts: { method: 'POST' | 'PUT' | 'PATCH' | 'DELETE'; actorId: number; body?: Record<string, unknown> },
): Promise<T> {
  const body = { ...(opts.body ?? {}), commandId: crypto.randomUUID(), actorId: opts.actorId };
  return fetchJson<T>(path, { method: opts.method, body: JSON.stringify(body) });
}
