// The only place in the app that reads process.env.
export const environment = {
  apiUrl: process.env.TICKETS_API_URL ?? 'http://127.0.0.1:4600',
  actorName: process.env.TICKETS_ACTOR ?? 'claude',
};
