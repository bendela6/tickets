import { environment } from './environment';

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(environment.apiUrl + path, {
      ...init,
      headers: {
        // only claim a JSON body when there is one — Fastify 400s otherwise
        ...(init?.body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(init?.headers ?? {}),
      },
    });
  } catch (error) {
    // Network-level failure: no HTTP response at all, hence status 0.
    throw new ApiError(
      0,
      `tickets API unreachable at ${environment.apiUrl} — is the tickets stack running ` +
        `("docker compose up" in the tickets repo)? (${(error as Error).message})`,
    );
  }
  const text = await response.text();
  if (!response.ok) {
    let message = `request failed with status ${response.status}`;
    try {
      const body = JSON.parse(text) as { error?: string };
      if (typeof body.error === 'string') {
        message = body.error;
      }
    } catch {
      // non-JSON error body — keep the default message
    }
    throw new ApiError(response.status, message);
  }
  return (text.length > 0 ? JSON.parse(text) : undefined) as T;
}
