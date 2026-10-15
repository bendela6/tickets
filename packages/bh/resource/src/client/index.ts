// @bh/resource/client: what a client of the contract's routes needs, with no
// React and no DOM, so a browser and a server calling another app's API take
// the same one. A typed fetcher for the routes (resourceClient), the error it
// throws (ResourceRequestError), and what a list the client holds does with
// a row it just wrote: keeps or drops it by the query's filter and search,
// and puts it in its place by the query's order, without asking the server
// again. @bh/resource-query builds React Query's hooks on it.
export {
  idempotencyKey,
  resourceClient,
  type CallOptions,
  type DeleteOptions,
  type HeaderValues,
  type QueryAnswer,
  type ResourceClient,
  type ResourceClientOptions,
  type WriteOptions,
} from './fetcher';
export { ResourceRequestError } from './errors';
export {
  answerAfterDelete,
  answerAfterWrite,
  keepsRow,
  pagesAfterDelete,
  pagesAfterWrite,
  placeRow,
  removeRow,
  type HeldContext,
  type HeldEdges,
  type Previous,
} from './held';
