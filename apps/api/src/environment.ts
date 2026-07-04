// The only place in the app that reads process.env. Postgres settings are
// consumed inside @tickets/db; this file only owns the API's own knobs.
export const environment = {
  apiPort: Number(process.env.API_PORT ?? 4600),
};
