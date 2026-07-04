import { ApiError } from './api-error';

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

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
    throw new ApiError(response.status, message);
  }

  if (text.length === 0) {
    return undefined as T;
  }
  return JSON.parse(text) as T;
}
