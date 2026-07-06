// The only place in the app that reads process.env. Postgres settings are
// consumed inside @tickets/db; this file only owns the API's own knobs.
export const environment = {
  apiPort: Number(process.env.API_PORT ?? 4600),
  // 127.0.0.1 for local dev; containers set API_HOST=0.0.0.0 to be reachable
  apiHost: process.env.API_HOST ?? '127.0.0.1',
};
